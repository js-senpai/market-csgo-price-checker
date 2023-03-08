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
      const getItems = await this.marketHashNameModel
        .find()
        .populate({
          path: 'priceHistory',
          match: {
            status: PRODUCT_STATUS.NEED_CHECK,
          },
          select: ['price', 'id', 'parent', '_id'],
        })
        // .populate({
        //   path: 'priceInfo',
        //   match: {
        //     status: PRODUCT_STATUS.NEED_CHECK,
        //   },
        //   select: ['_id', 'tmId', 'asset', 'classId', 'instanceId', 'price'],
        // })
        .exec();
      await Promise.all(
        getItems.map(async ({ priceHistory = [] }) => {
          if (priceHistory.length) {
            await Promise.all(
              priceHistory.map(async ({ price, id, parent }) => {
                const getPriceOnSale = await this.tmOnSaleModel
                  .findOne({
                    price,
                    parent,
                    status: PRODUCT_STATUS.NEED_CHECK,
                  })
                  .select([
                    '_id',
                    'tmId',
                    'asset',
                    'classId',
                    'instanceId',
                    'price',
                  ]);
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
                      tmId: getPriceOnSale.tmId,
                    },
                    {
                      status: PRODUCT_STATUS.FOUND,
                    },
                  );
                }
              }),
            );
          }
        }),
      );
      const totalItems = await this.tmHistoryModel.count({
        status: PRODUCT_STATUS.FOUND,
      });
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
    } finally {
      this.eventEmitter.emit('tm-on-sale-event');
    }
  }
}
