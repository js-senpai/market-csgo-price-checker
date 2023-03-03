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
        .select(['status', 'priceInfo', 'priceHistory']);
      await Promise.all(
        getItems.map(async ({ priceInfo = [], priceHistory = [], _id }) => {
          if (priceHistory.length && priceInfo.length) {
            const getPriceHistory = await this.tmHistoryModel.find({
              tmId: {
                $in: priceHistory.map(({ tmId }) => tmId),
              },
              status: PRODUCT_STATUS.NEED_CHECK,
              parent: _id,
            });
            await Promise.all(
              getPriceHistory.map(async ({ price, id, parent }) => {
                const getPriceOnSale = await this.tmOnSaleModel.findOne({
                  price,
                  status: PRODUCT_STATUS.NEED_CHECK,
                  parent,
                });
                if (getPriceOnSale) {
                  await this.tmHistoryModel.updateOne(
                    {
                      id,
                      parent,
                    },
                    {
                      tmId: getPriceOnSale.tmId,
                      asset: getPriceOnSale.asset,
                      classId: getPriceOnSale.classId,
                      instanceId: getPriceOnSale.instanceId,
                      status: PRODUCT_STATUS.FOUND,
                    },
                  );
                  await this.tmOnSaleModel.updateOne(
                    {
                      _id: getPriceOnSale._id,
                    },
                    {
                      status: PRODUCT_STATUS.FOUND,
                    },
                  );
                }
              }),
            );
            totalItems += await this.tmHistoryModel.count({
              parent: _id,
              status: PRODUCT_STATUS.FOUND,
            });
          }
        }),
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
