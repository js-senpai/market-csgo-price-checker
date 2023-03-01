import { Injectable, Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import {
  TmOnSale,
  TmOnSaleDocument,
} from '../../common/schemas/tm-on-sale.schema';
import { Model } from 'mongoose';
import {
  MarketHashName,
  MarketHashNameDocument,
} from '../../common/schemas/market-hash-name.schema';
import { Job } from 'bull';
import axios from 'axios';
import { TM_KEYS } from '../../common/constants/general.constant';
import { PRODUCT_STATUS } from '../../common/enums/mongo.enum';

@Injectable()
@Processor('tm-on-sale-queue')
export class TmOnSaleProcessor {
  constructor(
    private readonly logger: Logger,
    private readonly configService: ConfigService,
    @InjectModel(TmOnSale.name)
    private readonly tmOnSaleModel: Model<TmOnSaleDocument>,
    @InjectModel(MarketHashName.name)
    private readonly marketHashNameModel: Model<MarketHashNameDocument>,
  ) {}

  @Process('start')
  async start(job: Job): Promise<{ ok: string }> {
    const { docs = [], listName = '' } = job.data;
    let totalOnSale = 0;
    let totalNotFound = 0;
    let keyIndex = 0;
    try {
      this.logger.log(
        `The on sale list with name "${listName}" has started`,
        TmOnSaleProcessor.name,
      );
      for (const { _id, name } of docs) {
        const { data = {} } = await (async () => {
          try {
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
                  };
                };
              };
            } = await axios.get(
              `${this.configService.get(
                'CSGO_MARKET_URL',
              )}/search-list-items-by-hash-name-all?key=${TM_KEYS[keyIndex]}`,
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
              `Error in start method. The list name ${listName}. The error was in an interaction where the item had the name "${name}". Response status ${
                e?.response?.status || 500
              } `,
              e.stack,
              TmOnSaleProcessor.name,
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
          for (const item of getData) {
            await this.tmOnSaleModel.updateOne(
              {
                tmId: item.id,
                parent: _id,
              },
              {
                tmId: item.id,
                asset: item.extra?.asset || 0,
                classId: item.class,
                instanceId: item.instance,
                price: +item.price / 100,
              },
              {
                upsert: true,
              },
            );
          }
          const getNewItems = await this.tmOnSaleModel
            .find({
              tmId: {
                $in: getData.map(({ id }) => id),
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
                priceInfo: {
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
        `The on sale list with name "${listName}" has finished. Total items with status "on_sale" - ${totalOnSale}.Total items with status "not_found" - ${totalNotFound}.`,
        TmOnSaleProcessor.name,
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
        TmOnSaleProcessor.name,
      );
      throw e;
    }
  }
}
