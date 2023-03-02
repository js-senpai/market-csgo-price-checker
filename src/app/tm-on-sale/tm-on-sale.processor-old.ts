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
import { PRODUCT_STATUS } from '../../common/enums/mongo.enum';

@Injectable()
@Processor('tm-on-sale-queue')
export class TmOnSaleProcessorOld {
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
    const { docs = [], listName = '', token } = job.data;
    try {
      this.logger.log(
        `The on sale list with name "${listName}" has started`,
        TmOnSaleProcessorOld.name,
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
        TmOnSaleProcessorOld.name,
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
        TmOnSaleProcessorOld.name,
      );
      throw e;
    }
  }
}
