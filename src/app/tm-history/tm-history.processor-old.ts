import { Injectable, Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  MarketHashName,
  MarketHashNameDocument,
} from '../../common/schemas/market-hash-name.schema';
import {
  TmHistory,
  TmHistoryDocument,
} from '../../common/schemas/tm-history.schema';
import { Job } from 'bull';
import axios from 'axios';
import { PRODUCT_STATUS } from '../../common/enums/mongo.enum';

@Injectable()
@Processor('tm-history-queue')
export class TmHistoryProcessorOld {
  constructor(
    private readonly logger: Logger,
    private readonly configService: ConfigService,
    @InjectModel(TmHistory.name)
    private readonly tmHistoryModel: Model<TmHistoryDocument>,
    @InjectModel(MarketHashName.name)
    private readonly marketHashNameModel: Model<MarketHashNameDocument>,
  ) {}

  @Process('start')
  async start(job: Job): Promise<{ ok: string }> {
    const { docs = [], listName = '', token } = job.data;
    try {
      this.logger.log(
        `The history list with name "${listName}" has started`,
        TmHistoryProcessorOld.name,
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
        TmHistoryProcessorOld.name,
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
        TmHistoryProcessorOld.name,
      );
      throw e;
    }
  }
}
