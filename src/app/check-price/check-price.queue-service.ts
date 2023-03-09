import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  TmHistory,
  TmHistoryDocument,
} from '../../common/schemas/tm-history.schema';
import {
  TmOnSale,
  TmOnSaleDocument,
} from '../../common/schemas/tm-on-sale.schema';
import { Injectable, Logger } from '@nestjs/common';
import { PRODUCT_STATUS } from '../../common/enums/mongo.enum';
import { Job } from 'bull';

@Injectable()
export default class CheckPriceQueueService {
  constructor(
    private readonly logger: Logger,
    @InjectModel(TmHistory.name)
    private readonly tmHistoryModel: Model<TmHistoryDocument>,
    @InjectModel(TmOnSale.name)
    private readonly tmOnSaleModel: Model<TmOnSaleDocument>,
  ) {}

  async start(job: Job): Promise<{ ok: string }> {
    this.logger.log(
      `The check price task has started`,
      CheckPriceQueueService.name,
    );
    try {
      let progress = 0;
      const getPriceHistory = await this.tmHistoryModel.find({
        status: PRODUCT_STATUS.NEED_CHECK,
      });
      for (const { price, id, parent } of getPriceHistory) {
        const getPriceOnSale = await this.tmOnSaleModel.findOne({
          price,
          parent,
          status: PRODUCT_STATUS.NEED_CHECK,
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
              tmId: getPriceOnSale.tmId,
            },
            {
              status: PRODUCT_STATUS.FOUND,
            },
          );
        }
        progress += 1;
        await job.progress(
          Math.round((progress / getPriceHistory.length) * 100),
        );
      }
      this.logger.log(
        `The check price task  has finished`,
        CheckPriceQueueService.name,
      );
      return {
        ok: 'The task has successfully finished',
      };
    } catch (e) {
      this.logger.error(
        `Error in check price task`,
        e.stack,
        CheckPriceQueueService.name,
      );
      throw e;
    }
  }
}
