import { Injectable, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import {
  MarketHashName,
  MarketHashNameDocument,
} from '../../common/schemas/market-hash-name.schema';
import { Model, PaginateModel } from 'mongoose';
import { PRODUCT_STATUS } from '../../common/enums/mongo.enum';
import {
  TmHistory,
  TmHistoryDocument,
} from '../../common/schemas/tm-history.schema';
import {
  TmOnSale,
  TmOnSaleDocument,
} from '../../common/schemas/tm-on-sale.schema';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class CheckPriceService {
  constructor(
    private schedulerRegistry: SchedulerRegistry,
    private readonly logger: Logger,
    private readonly configService: ConfigService,

    @InjectModel(MarketHashName.name)
    private readonly marketHashNameModel: PaginateModel<MarketHashNameDocument>,

    @InjectModel(TmHistory.name)
    private readonly tmHistoryModel: Model<TmHistoryDocument>,

    @InjectModel(TmOnSale.name)
    private readonly tmOnSaleModel: Model<TmOnSaleDocument>,
  ) {}

  @OnEvent('check-price-event')
  async start() {
    try {
      this.logger.log(
        `The start method has been started`,
        CheckPriceService.name,
      );
      let totalItems = 0;
      const getItems = await this.marketHashNameModel
        .find()
        .populate(['priceInfo', 'priceHistory']);
      await Promise.all(
        getItems.map(async ({ priceInfo = null, priceHistory = null }) => {
          if (
            priceHistory?.status === PRODUCT_STATUS.NEED_CHECK &&
            priceInfo?.status === PRODUCT_STATUS.NEED_CHECK &&
            priceHistory?.price === priceInfo?.price
          ) {
            await this.tmOnSaleModel.updateOne(
              {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                _id: priceInfo._id,
              },
              {
                status: PRODUCT_STATUS.FOUND,
              },
            );
            await this.tmHistoryModel.updateOne(
              {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                _id: priceHistory._id,
              },
              {
                status: PRODUCT_STATUS.FOUND,
                tmId: priceInfo.tmId,
                asset: priceInfo.asset,
                classId: priceInfo.classId,
                instanceId: priceInfo.instanceId,
              },
            );
            totalItems += 1;
          }
        }),
      );
      this.logger.log(
        `The start method has finished. Total items (${totalItems}) was updated.`,
        CheckPriceService.name,
      );
    } catch (e) {
      this.logger.error(
        'Error in the start method',
        e.stack,
        CheckPriceService.name,
      );
    }
  }
}
