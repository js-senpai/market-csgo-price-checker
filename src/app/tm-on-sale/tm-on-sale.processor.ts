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
    const { docs = [], name = '' } = job.data;
    let totalOnSale = 0;
    let totalNotFound = 0;
    try {
      let keyIndex = 0;
      this.logger.log(
        `The on sale list with name "${name}" has started`,
        TmOnSaleProcessor.name,
      );
      for await (const { _id, name, priceInfo = null } of docs) {
        const {
          data: { data = null },
        } = await axios.get(
          `${this.configService.get(
            'CSGO_MARKET_URL',
          )}/search-list-items-by-hash-name-all?key=${
            TM_KEYS[keyIndex]
          }&list_hash_name[]=${name}`,
        );
        if (!priceInfo && data) {
          const createData = await this.tmOnSaleModel.create({
            tmId: data.id,
            asset: data.extra.asset,
            classId: data.class,
            instanceId: data.instance,
            price: +data.price / 100,
            status: PRODUCT_STATUS.ON_SALE,
          });
          // Update parent
          await this.marketHashNameModel.updateOne(
            {
              _id,
            },
            {
              priceInfo: createData._id,
            },
          );
          totalOnSale += 1;
        } else {
          if (!data) {
            await this.tmOnSaleModel.updateOne(
              {
                _id: priceInfo._id,
              },
              {
                status: PRODUCT_STATUS.NEED_CHECK,
              },
            );
            totalNotFound += 1;
          } else {
            await this.tmOnSaleModel.updateOne(
              {
                _id: priceInfo._id,
              },
              {
                status: PRODUCT_STATUS.ON_SALE,
                tmId: data.id,
                asset: data.extra.asset,
                classId: data.class,
                instanceId: data.instance,
                price: +data.price / 100,
              },
            );
            totalOnSale += 1;
          }
        }
        if (keyIndex + 1 === TM_KEYS.length) {
          keyIndex = 0;
        } else {
          keyIndex += 1;
        }
      }
      this.logger.log(
        `The on sale list with name "${name}" has finished. Total items with status "on_sale" - ${totalOnSale}.Total items with status "not_found" - ${totalNotFound}.`,
      );
      return {
        ok: 'The task has successfully finished',
      };
    } catch (e) {
      this.logger.error(
        `Error in start method. The list name ${name}. Response status ${
          e?.status || 500
        } `,
        e.stack,
        TmOnSaleProcessor.name,
      );
    }
  }
}
