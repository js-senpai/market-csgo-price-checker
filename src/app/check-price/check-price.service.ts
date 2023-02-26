import { Injectable, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import {
  MarketHashName,
  MarketHashNameDocument,
} from '../../common/schemas/market-hash-name.schema';
import { Model, PaginateModel } from 'mongoose';
import {
  TmHistory,
  TmHistoryDocument,
} from '../../common/schemas/tm-history.schema';
import {
  TmOnSale,
  TmOnSaleDocument,
} from '../../common/schemas/tm-on-sale.schema';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { PRODUCT_STATUS } from '../../common/enums/mongo.enum';

@Injectable()
export class CheckPriceService {
  constructor(
    private schedulerRegistry: SchedulerRegistry,
    private readonly logger: Logger,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
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
        .select(['status', 'priceInfo', 'priceHistory'])
        .populate(['priceInfo', 'priceHistory']);
      await Promise.all(
        getItems.map(
          async ({ priceInfo = [], priceHistory = [], status, _id }) => {
            if (
              status === PRODUCT_STATUS.NEED_CHECK &&
              priceHistory.length &&
              priceInfo.length
            ) {
              for (const { price, id } of priceHistory) {
                const getPriceOnSale = await this.tmOnSaleModel.findOne({
                  price,
                });
                if (getPriceOnSale) {
                  await this.tmHistoryModel.updateOne(
                    {
                      id,
                    },
                    {
                      tmId: getPriceOnSale.tmId,
                      asset: getPriceOnSale.asset,
                      classId: getPriceOnSale.classId,
                      instanceId: getPriceOnSale.instanceId,
                    },
                  );
                  await this.marketHashNameModel.updateOne(
                    {
                      _id,
                    },
                    {
                      status: PRODUCT_STATUS.FOUND,
                    },
                  );
                  totalItems += 1;
                }
              }
            }
          },
        ),
      );
      this.logger.log(
        `The start method has finished. Total items (${totalItems}) was updated.`,
        CheckPriceService.name,
      );
      this.eventEmitter.emit('tm-on-sale-event');
    } catch (e) {
      this.logger.error(
        'Error in the start method',
        e.stack,
        CheckPriceService.name,
      );
    }
  }
}
