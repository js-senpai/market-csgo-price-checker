import { Injectable, Logger } from '@nestjs/common';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  TmOnSaleLog,
  TmOnSaleLogDocument,
} from '../../common/schemas/tm-on-sale-log.schema';
import { MarketHashNameTaskService } from '../market-hash-name-task/market-hash-name-task.service';
import { InjectQueue } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import {
  TmOnSale,
  TmOnSaleDocument,
} from '../../common/schemas/tm-on-sale.schema';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { CronTime } from 'cron';
import { PRODUCT_STATUS } from '../../common/enums/mongo.enum';
import { TM_KEYS } from '../../common/constants/general.constant';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import {
  TmHistory,
  TmHistoryDocument,
} from '../../common/schemas/tm-history.schema';
import {
  MarketHashName,
  MarketHashNameDocument,
} from '../../common/schemas/market-hash-name.schema';

@Injectable()
export class TmOnSaleService {
  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: Logger,
    private readonly marketHashNameService: MarketHashNameTaskService,
    @InjectModel(TmOnSaleLog.name)
    private readonly tmOnSaleLogModel: Model<TmOnSaleLogDocument>,
    @InjectQueue('tm-on-sale-queue')
    private readonly tmOnSaleQueue: Queue,
    @InjectModel(TmOnSale.name)
    private readonly tmOnSaleModel: Model<TmOnSaleDocument>,
    private readonly configService: ConfigService,
    @InjectModel(TmHistory.name)
    private readonly tmHistoryModel: Model<TmHistoryDocument>,
    @InjectModel(MarketHashName.name)
    private readonly marketHashNameModel: Model<MarketHashNameDocument>,
  ) {}

  @OnEvent('tm-on-sale-event')
  async start() {
    const jobTmOnSaleChecker = this.schedulerRegistry.getCronJob(
      'tm-on-sale-checker-task',
    );
    try {
      this.logger.log(
        `The start method has been started`,
        TmOnSaleService.name,
      );
      const { totalPages = 0 } = await this.marketHashNameService.paginate({
        currentPage: 1,
        select: ['name'],
      });
      let keyIndex = 0;
      for (const currentPage of Array.from(
        { length: totalPages },
        (x, y) => y + 1,
      )) {
        const { pagingCounter, docs = [] } =
          await this.marketHashNameService.paginate({
            currentPage,
            select: ['name'],
          });
        const name = `${pagingCounter}-${pagingCounter + 50}`;
        // await timer(30 * 1000);
        const job = await this.tmOnSaleQueue.add(
          'start',
          {
            docs,
            listName: name,
            token: TM_KEYS[keyIndex],
          },
          {
            attempts: 0,
            // timeout: 30 * 1000,
          },
        );
        // Delete  duplicates
        await this.tmOnSaleLogModel.deleteMany({
          jobId: job.id,
        });
        await this.tmOnSaleLogModel.create({
          jobId: job.id,
          status: 'started',
          name,
        });
        if (keyIndex + 1 === TM_KEYS.length) {
          keyIndex = 0;
        } else {
          keyIndex += 1;
        }
      }
      jobTmOnSaleChecker.setTime(new CronTime('*/5 * * * *'));
    } catch (e) {
      this.logger.error(
        'Error in the start method',
        e.stack,
        TmOnSaleService.name,
      );
    }
  }

  @Cron('0 0 */365 * *', {
    name: 'tm-on-sale-checker-task',
  })
  async getJobs() {
    try {
      const jobTmOnSaleChecker = this.schedulerRegistry.getCronJob(
        'tm-on-sale-checker-task',
      );
      const getJobs = await this.tmOnSaleLogModel.find({ available: true });
      if (getJobs.length) {
        for (const { jobId, status = 'active' } of getJobs) {
          const job = await this.tmOnSaleQueue.getJob(jobId);
          if (job) {
            const getStateJob = await job.getState();
            const progress = await job.progress();
            const available = !(
              (await job.isStuck()) ||
              (await job.isCompleted()) ||
              (await job.isFailed())
            );
            await this.tmOnSaleLogModel.updateOne(
              {
                jobId,
              },
              {
                progress,
                status: getStateJob,
                available,
                ...(job.failedReason && {
                  message: job.failedReason,
                }),
              },
            );
            if (!available && status !== 'active') {
              await job.remove();
            }
          } else {
            await this.tmOnSaleLogModel.updateOne(
              {
                jobId,
              },
              {
                available: false,
                status: 'unknown',
              },
            );
          }
        }
      } else {
        jobTmOnSaleChecker.stop();
        this.eventEmitter.emit('tm-history-event');
      }
    } catch (e) {
      this.logger.error(
        'Error in getJobs method',
        e.stack,
        TmOnSaleService.name,
      );
    }
  }

  @Cron('*/60 * * * *')
  async checkNotFound() {
    try {
      this.logger.log(
        `The checkNotFound method has been started`,
        TmOnSaleService.name,
      );
      const getTotalNeedCheckItems = await this.tmOnSaleModel.count({
        status: PRODUCT_STATUS.NEED_CHECK,
      });
      await this.tmOnSaleModel.updateMany(
        {
          status: PRODUCT_STATUS.NEED_CHECK,
        },
        {
          status: PRODUCT_STATUS.NOT_FOUND,
        },
      );
      this.logger.log(
        `The checkNotFound method has finished.Total updated items - ${getTotalNeedCheckItems}`,
        TmOnSaleService.name,
      );
    } catch (e) {
      this.logger.error(
        'Error in the checkNotFound method',
        e.stack,
        TmOnSaleService.name,
      );
    }
  }

  async startParser(job: Job): Promise<{ ok: string }> {
    const { docs = [], listName = '', token } = job.data;
    try {
      this.logger.log(
        `The on sale list with name "${listName}" has started`,
        TmOnSaleService.name,
      );
      const {
        data: { data = {} },
      }: {
        data: {
          data: {
            [key: string]: {
              id?: number;
              extra?: {
                asset: number;
              };
              class: number;
              instance: number;
              price: number;
            }[];
          };
        };
      } = await axios.get(
        `${this.configService.get(
          'CSGO_MARKET_URL',
        )}/search-list-items-by-hash-name-all?key=${token}&${docs
          .map(({ name }) => `list_hash_name[]=${name}`)
          .join('&')}`,
      );
      const getData = Object.entries({ ...data });
      await Promise.all(
        getData.map(async ([name, items]) => {
          const parent = await this.marketHashNameModel.findOne({
            name,
          });
          if (!parent) {
            this.logger.error(
              `Error in start method. The sale list name ${listName}. The error was in an interaction where the item had the name "${name}".`,
            );
          } else {
            await Promise.all([
              items.map(
                async (item) =>
                  await this.tmOnSaleModel.updateOne(
                    {
                      tmId: item.id,
                      parent,
                    },
                    {
                      tmId: item.id,
                      asset: item.extra?.asset || 0,
                      classId: item.class,
                      instanceId: item.instance,
                      price: +item.price / 100,
                      status: PRODUCT_STATUS.ON_SALE,
                    },
                    {
                      upsert: true,
                    },
                  ),
              ),
            ]);
            await this.tmOnSaleModel.updateMany(
              {
                tmId: {
                  $nin: items.map(({ id }) => id),
                },
                parent,
              },
              {
                status: PRODUCT_STATUS.NEED_CHECK,
              },
            );
            const getNewItems = await this.tmOnSaleModel
              .find({
                tmId: {
                  $in: items.map(({ id }) => id),
                },
              })
              .select('_id');
            await this.marketHashNameModel.updateOne(
              {
                _id: parent._id,
              },
              {
                $addToSet: {
                  priceInfo: {
                    $each: getNewItems.map(({ _id }) => _id),
                  },
                },
              },
            );
          }
        }),
      );
      const totalNotFound = await this.tmOnSaleModel.count({
        status: PRODUCT_STATUS.NEED_CHECK,
      });
      const totalOnSale = await this.tmOnSaleModel.count({
        status: PRODUCT_STATUS.ON_SALE,
      });
      this.logger.log(
        `The on sale list with name "${listName}" has finished. Total items with status "on_sale" - ${totalOnSale}.Total items with status "not_found" - ${totalNotFound}.`,
        TmOnSaleService.name,
      );
      return {
        ok: 'The task has successfully finished',
      };
    } catch (e) {
      this.logger.error(
        `Error in start method. The list name ${listName}. Response status ${
          e?.response?.status || 500
        } `,
        e.stack,
        TmOnSaleService.name,
      );
      throw e;
    }
  }
}
