import { Job, Queue } from 'bull';
import axios from 'axios';
import { PRODUCT_STATUS } from '../../common/enums/mongo.enum';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import {
  MarketHashName,
  MarketHashNameDocument,
} from '../../common/schemas/market-hash-name.schema';
import { Model } from 'mongoose';
import { InjectQueue } from '@nestjs/bull';
import {
  TmHistory,
  TmHistoryDocument,
} from '../../common/schemas/tm-history.schema';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export default class TmHistoryQueueService {
  constructor(
    private readonly logger: Logger,
    private readonly configService: ConfigService,
    @InjectModel(MarketHashName.name)
    private readonly marketHashNameModel: Model<MarketHashNameDocument>,
    @InjectModel(TmHistory.name)
    private readonly tmHistoryModel: Model<TmHistoryDocument>,
  ) {}
  async start(job: Job): Promise<{ ok: string }> {
    const { docs = [], listName = '', token } = job.data;
    try {
      this.logger.log(
        `The history list with name "${listName}" has started`,
        TmHistoryQueueService.name,
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
          if (parent) {
            const filteredData = Object.entries(items).flatMap(
              ([name, value]) => (name === 'history' ? value : []),
            );
            await Promise.all(
              filteredData.map(async ([id, price]) => {
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
                );
              }),
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
                name: parent.name,
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
        TmHistoryQueueService.name,
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
        TmHistoryQueueService.name,
      );
      throw e;
    }
  }
}
