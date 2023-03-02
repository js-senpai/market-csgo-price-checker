import { Injectable, Logger } from '@nestjs/common';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import {
  MarketHashName,
  MarketHashNameDocument,
} from '../../common/schemas/market-hash-name.schema';
import { PaginateModel, PaginateResult } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PRODUCT_STATUS } from '../../common/enums/mongo.enum';
import {
  ItemValue,
  ItemValueDocument,
} from '../../common/schemas/item-value.schema';

@Injectable()
export class MarketHashNameTaskService {
  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: Logger,
    private readonly configService: ConfigService,
    @InjectModel(MarketHashName.name)
    private readonly marketHashNameModel: PaginateModel<MarketHashNameDocument>,
    @InjectModel(ItemValue.name)
    private readonly itemValueModel: PaginateModel<ItemValueDocument>,
  ) {}

  @Cron('0 23 */1 * *', {
    name: 'market-hash-name-task',
  })
  async start() {
    this.logger.log(
      `The start method has been started`,
      MarketHashNameTaskService.name,
    );
    const job = this.schedulerRegistry.getCronJob('market-hash-name-task');
    const jobTmOnSaleChecker = this.schedulerRegistry.getCronJob(
      'tm-on-sale-checker-task',
    );
    const jobTmHistoryChecker = this.schedulerRegistry.getCronJob(
      'tm-history-checker-task',
    );
    jobTmOnSaleChecker.stop();
    jobTmHistoryChecker.stop();
    try {
      const { data, status } = await axios.get(
        `${this.configService.get(
          'STEAM_APIS_URL',
        )}/items/730?api_key=${this.configService.get(
          'STEAM_APIS_KEY',
        )}&format=comact`,
      );
      const getItems = Object.entries(data).map(([name, value]) => ({
        name,
        value,
      }));
      for (const { name, value } of getItems) {
        await this.marketHashNameModel.updateOne(
          {
            name,
          },
          {
            name,
          },
          {
            upsert: true,
          },
        );
        const getMarketHashModel = await this.marketHashNameModel.findOne({
          name,
        });
        await this.itemValueModel.create({
          value,
          parent: getMarketHashModel._id,
        });
      }
      this.logger.log(
        `The start method has  finished with status ${status} and received total items ${getItems.length}`,
        MarketHashNameTaskService.name,
      );
      this.eventEmitter.emit('tm-on-sale-event');
    } catch (e) {
      this.logger.error(
        'Error in the start method',
        e.stack,
        MarketHashNameTaskService.name,
      );
      setTimeout(() => {
        job.start();
      }, 60 * 1000);
    }
  }

  async paginate({
    currentPage = 1,
    ...options
  }): Promise<PaginateResult<MarketHashNameDocument>> {
    return await this.marketHashNameModel.paginate(
      {},
      { page: currentPage, limit: 50, ...options },
    );
  }
}
