import { Injectable, Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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
import { TM_KEYS } from '../../common/constants/general.constant';
import { PRODUCT_STATUS } from '../../common/enums/mongo.enum';

@Injectable()
@Processor('tm-history-queue')
export class TmHistoryProcessor {
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
    const { docs = [], listName = '' } = job.data;
    let totalOnSale = 0;
    let totalNotFound = 0;
    try {
      let keyIndex = 0;
      this.logger.log(
        `The history list with name "${listName}" has started`,
        TmHistoryProcessor.name,
      );
      for (const { _id, name } of docs) {
        const { data = {} } = await (async () => {
          try {
            const {
              data: { data = null },
            }: {
              data: {
                data: {
                  [key: string]: {
                    history: [number, number][];
                  };
                };
              };
            } = await axios.get(
              `${this.configService.get(
                'CSGO_MARKET_URL',
              )}/get-list-items-info?key=${TM_KEYS[keyIndex]}`,
              {
                params: {
                  'list_hash_name[]': name,
                },
              },
            );
            return {
              data,
            };
          } catch (e) {
            this.logger.error(
              `Error in start method. The history list name ${listName}. The error was in an interaction where the item had the name "${name}". Response status ${
                e?.response?.status || 500
              } `,
              e.stack,
              TmHistoryProcessor.name,
            );
            return {
              data: {},
            };
          }
        })();
        const getData = Object.values({ ...data }).flat(1);
        if (!getData.length) {
          await this.marketHashNameModel.updateOne(
            {
              _id,
            },
            {
              status: PRODUCT_STATUS.ON_SALE,
            },
          );
          totalNotFound += 1;
        } else {
          const filteredData = getData.flatMap(({ history = [] }) => history);
          for (const [id, price] of filteredData) {
            await this.tmHistoryModel.updateOne(
              {
                id,
              },
              {
                price,
              },
              {
                upsert: true,
              },
            );
          }
          const getNewItems = await this.tmHistoryModel
            .find({
              id: {
                $in: filteredData.map(([id]) => id),
              },
            })
            .select('_id');
          await this.marketHashNameModel.updateOne(
            {
              _id,
            },
            {
              status: PRODUCT_STATUS.ON_SALE,
              $addToSet: {
                priceHistory: {
                  $each: getNewItems.map(({ _id }) => _id),
                },
              },
            },
          );
          totalOnSale += 1;
        }
        if (keyIndex + 1 === TM_KEYS.length) {
          keyIndex = 0;
        } else {
          keyIndex += 1;
        }
      }
      this.logger.log(
        `The history list with name "${listName}" has finished. Total items with status "on_sale" - ${totalOnSale}.Total items with status "not_found" - ${totalNotFound}.`,
        TmHistoryProcessor.name,
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
        TmHistoryProcessor.name,
      );
      throw e;
    }
  }
}
