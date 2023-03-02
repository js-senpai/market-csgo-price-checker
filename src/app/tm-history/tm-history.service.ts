import { Injectable, Logger } from '@nestjs/common';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { MarketHashNameTaskService } from '../market-hash-name-task/market-hash-name-task.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InjectQueue } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import {
  TmHistoryLog,
  TmHistoryLogDocument,
} from '../../common/schemas/tm-history-log.schema';
import {
  TmHistory,
  TmHistoryDocument,
} from '../../common/schemas/tm-history.schema';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { CronTime } from 'cron';
import { PRODUCT_STATUS } from '../../common/enums/mongo.enum';
import { TM_KEYS } from '../../common/constants/general.constant';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import {
  MarketHashName,
  MarketHashNameDocument,
} from '../../common/schemas/market-hash-name.schema';

@Injectable()
export class TmHistoryService {
  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: Logger,
    private readonly marketHashNameService: MarketHashNameTaskService,
    @InjectModel(TmHistory.name)
    private readonly tmHistoryModel: Model<TmHistoryDocument>,
    @InjectModel(TmHistoryLog.name)
    private readonly tmHistoryLogModel: Model<TmHistoryLogDocument>,
    @InjectQueue('tm-history-queue')
    private readonly tmHistoryQueue: Queue,
    private readonly configService: ConfigService,
    @InjectModel(MarketHashName.name)
    private readonly marketHashNameModel: Model<MarketHashNameDocument>,
  ) {}

  @OnEvent('tm-history-event')
  async start() {
    const jobTmHistoryChecker = this.schedulerRegistry.getCronJob(
      'tm-history-checker-task',
    );
    try {
      this.logger.log(
        `The start method has been started`,
        TmHistoryService.name,
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
        const job = await this.tmHistoryQueue.add(
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
        await this.tmHistoryLogModel.deleteMany({
          jobId: job.id,
        });
        await this.tmHistoryLogModel.create({
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
      jobTmHistoryChecker.setTime(new CronTime('*/5 * * * *'));
    } catch (e) {
      this.logger.error(
        'Error in the start method',
        e.stack,
        TmHistoryService.name,
      );
    }
  }

  @Cron('0 0 */365 * *', {
    name: 'tm-history-checker-task',
  })
  async getJobs() {
    try {
      const jobTmHistoryChecker = this.schedulerRegistry.getCronJob(
        'tm-history-checker-task',
      );
      const getJobs = await this.tmHistoryLogModel.find({ available: true });
      if (getJobs.length) {
        for (const { jobId, status = 'active' } of getJobs) {
          const job = await this.tmHistoryQueue.getJob(jobId);
          if (job) {
            const getStateJob = await job.getState();
            const progress = await job.progress();
            const available = !(
              (await job.isStuck()) ||
              (await job.isCompleted()) ||
              (await job.isFailed())
            );
            await this.tmHistoryLogModel.updateOne(
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
            await this.tmHistoryLogModel.updateOne(
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
        jobTmHistoryChecker.stop();
        this.eventEmitter.emit('check-price-event');
      }
    } catch (e) {
      this.logger.error(
        'Error in the getJobs method',
        e.stack,
        TmHistoryService.name,
      );
    }
  }

  @Cron('*/60 * * * *')
  async checkNotFound() {
    try {
      this.logger.log(
        `The checkNotFound method has been started`,
        TmHistoryService.name,
      );
      const getTotalNeedCheckItems = await this.tmHistoryModel.count({
        status: PRODUCT_STATUS.NEED_CHECK,
      });
      await this.tmHistoryModel.updateMany(
        {
          status: PRODUCT_STATUS.NEED_CHECK,
        },
        {
          status: PRODUCT_STATUS.NOT_FOUND,
        },
      );
      this.logger.log(
        `The checkNotFound method has finished.Total updated items - ${getTotalNeedCheckItems}`,
        TmHistoryService.name,
      );
    } catch (e) {
      this.logger.error(
        'Error in the checkNotFound method',
        e.stack,
        TmHistoryService.name,
      );
    }
  }

  async startParser(job: Job): Promise<{ ok: string }> {
    const { docs = [], listName = '', token } = job.data;
    try {
      this.logger.log(
        `The history list with name "${listName}" has started`,
        TmHistoryService.name,
      );
      const {
        data: { data = {} },
      }: {
        data: {
          data: {
            [key: string]: {
              history: [number, number][];
            }[];
          };
        };
      } = await axios.get(
        `${this.configService.get(
          'CSGO_MARKET_URL',
        )}/get-list-items-info?key=${token}&${docs
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
              `Error in start method. The history list name ${listName}. The error was in an interaction where the item had the name "${name}".`,
            );
          } else {
            const filteredData = items.flatMap(({ history = [] }) => history);
            await Promise.all(
              filteredData.map(
                async ([id, price]) =>
                  await this.tmHistoryModel.updateOne(
                    {
                      id,
                      parent,
                    },
                    {
                      price,
                      status: PRODUCT_STATUS.ON_SALE,
                    },
                    {
                      upsert: true,
                    },
                  ),
              ),
            );
            await this.tmHistoryModel.updateMany(
              {
                id: {
                  $nin: filteredData.map(([id]) => id),
                },
                parent,
              },
              {
                status: PRODUCT_STATUS.NEED_CHECK,
              },
            );
            const getNewItems = await this.tmHistoryModel
              .find({
                id: {
                  $in: filteredData.map(([id]) => id),
                },
              })
              .select('_id');
            await this.marketHashNameModel.updateOne(
              {
                _id: parent._id,
              },
              {
                $addToSet: {
                  priceHistory: {
                    $each: getNewItems.map(({ _id }) => _id),
                  },
                },
              },
            );
          }
        }),
      );
      const totalNotFound = await this.tmHistoryModel.count({
        status: PRODUCT_STATUS.NEED_CHECK,
      });
      const totalOnSale = await this.tmHistoryModel.count({
        status: PRODUCT_STATUS.ON_SALE,
      });
      this.logger.log(
        `The history list with name "${listName}" has finished. Total items with status "on_sale" - ${totalOnSale}.Total items with status "not_found" - ${totalNotFound}.`,
        TmHistoryService.name,
      );
      return {
        ok: 'The task has successfully finished',
      };
    } catch (e) {
      this.logger.error(
        `Error in start method. The history list name ${listName}. Response status ${
          e?.response?.status || 500
        } `,
        e.stack,
        TmHistoryService.name,
      );
      throw e;
    }
  }
}
