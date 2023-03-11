import { Job } from 'bull';
import axios from 'axios';
import { PRODUCT_STATUS } from '../../common/enums/mongo.enum';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import {
  MarketHashName,
  MarketHashNameDocument,
} from '../../common/schemas/market-hash-name.schema';
import { Model } from 'mongoose';
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
      const childIds = [
        ...(await Promise.all(
          getData.flatMap(async ([name, items]) => {
            const parent = await this.marketHashNameModel
              .findOne({
                name,
              })
              .select('_id');
            if (parent) {
              const filteredData = Object.entries(items).flatMap(
                ([name, value]) => (name === 'history' ? value : []),
              );
              const getIds = await Promise.all(
                filteredData.flatMap(async ([id, price]) => {
                  const getTmHistory = await this.tmHistoryModel
                    .findOne({
                      id,
                      parent: parent._id,
                    })
                    .select('status');
                  const { _id } = await this.tmHistoryModel.findOneAndUpdate(
                    {
                      id,
                      parent: parent._id,
                    },
                    {
                      price,
                      ...(getTmHistory?.status !== PRODUCT_STATUS.FOUND && {
                        status: PRODUCT_STATUS.NEED_CHECK,
                      }),
                    },
                    {
                      upsert: true,
                      new: true,
                    },
                  );
                  return _id;
                }),
              );
              await this.marketHashNameModel.updateOne(
                {
                  _id: parent._id,
                },
                {
                  $addToSet: {
                    priceHistory: {
                      $each: getIds,
                    },
                  },
                },
              );
              return getIds;
            }
          }),
        )),
      ]
        .flat(1)
        .filter((item) => item);
      this.logger.log(
        `The history list with name "${listName}" has finished. Total items with status has successfully created - ${childIds.length}.`,
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
