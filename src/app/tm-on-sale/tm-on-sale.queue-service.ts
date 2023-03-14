import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bull';
import axios from 'axios';
import { PRODUCT_STATUS } from '../../common/enums/mongo.enum';
import { InjectModel } from '@nestjs/mongoose';
import {
  TmOnSale,
  TmOnSaleDocument,
} from '../../common/schemas/tm-on-sale.schema';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import {
  MarketHashName,
  MarketHashNameDocument,
} from '../../common/schemas/market-hash-name.schema';
@Injectable()
export default class TmOnSaleQueueService {
  constructor(
    private readonly logger: Logger,
    private readonly configService: ConfigService,
    @InjectModel(TmOnSale.name)
    private readonly tmOnSaleModel: Model<TmOnSaleDocument>,
    @InjectModel(MarketHashName.name)
    private readonly marketHashNameModel: Model<MarketHashNameDocument>,
  ) {}
  async start(job: Job): Promise<{ ok: string }> {
    const { docs = [], listName = '', token } = job.data;
    try {
      this.logger.log(
        `The on sale list with name "${listName}" has started`,
        TmOnSaleQueueService.name,
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
      const childIds = [
        ...(await Promise.all(
          getData.flatMap(async ([name, items]) => {
            const parent = await this.marketHashNameModel
              .findOne({
                name,
              })
              .select('_id');
            if (parent) {
              const getIds = await Promise.all(
                items.flatMap(async (item) => {
                  const getTmOnSale = await this.tmOnSaleModel
                    .findOne({
                      tmId: item.id,
                      parent: parent._id,
                    })
                    .select('status');
                  const { _id } = await this.tmOnSaleModel.findOneAndUpdate(
                    {
                      tmId: item.id,
                      parent: parent._id,
                    },
                    {
                      tmId: item.id,
                      asset: item.extra?.asset || 0,
                      classId: item.class,
                      instanceId: item.instance,
                      price: +item.price / 100,
                      ...(getTmOnSale?.status !== PRODUCT_STATUS.FOUND && {
                        status: PRODUCT_STATUS.ON_SALE,
                      }),
                    },
                    {
                      new: true,
                      upsert: true,
                    },
                  );
                  return _id;
                }),
              );
              await this.tmOnSaleModel.updateMany(
                {
                  tmId: {
                    $nin: items.map(({ id }) => id),
                  },
                  parent: parent._id,
                  status: PRODUCT_STATUS.ON_SALE,
                },
                {
                  status: PRODUCT_STATUS.NEED_CHECK,
                },
              );
              await this.marketHashNameModel.updateOne(
                {
                  _id: parent._id,
                },
                {
                  $addToSet: {
                    priceInfo: {
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
      const totalOnSale = await this.tmOnSaleModel.count({
        status: PRODUCT_STATUS.ON_SALE,
        _id: {
          $in: childIds,
        },
      });
      const totalNotFound = await this.tmOnSaleModel.count({
        status: PRODUCT_STATUS.NEED_CHECK,
        _id: {
          $nin: childIds,
        },
      });
      this.logger.log(
        `The on sale list with name "${listName}" has finished. Total items with status "on_sale" - ${totalOnSale}.Total items with status "not_found" - ${totalNotFound}.`,
        TmOnSaleQueueService.name,
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
        TmOnSaleQueueService.name,
      );
      throw e;
    }
  }
}
