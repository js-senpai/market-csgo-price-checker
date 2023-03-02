import { Logger, Module } from '@nestjs/common';
import { TmOnSaleService } from './tm-on-sale.service';
import { MarketHashNameTaskService } from '../market-hash-name-task/market-hash-name-task.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
  MarketHashName,
  MarketHashNameSchema,
} from '../../common/schemas/market-hash-name.schema';
import {
  TmOnSale,
  TmOnSaleSchema,
} from '../../common/schemas/tm-on-sale.schema';
import {
  TmOnSaleLog,
  TmOnSaleLogSchema,
} from '../../common/schemas/tm-on-sale-log.schema';
import { BullModule } from '@nestjs/bull';
import {
  ItemValueSchema,
  ItemValue,
} from '../../common/schemas/item-value.schema';
import TmOnSaleProcessor from './tm-on-sale.processor';
import {
  TmHistory,
  TmHistorySchema,
} from '../../common/schemas/tm-history.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MarketHashName.name, schema: MarketHashNameSchema },
      { name: TmOnSale.name, schema: TmOnSaleSchema },
      { name: TmOnSaleLog.name, schema: TmOnSaleLogSchema },
      { name: ItemValue.name, schema: ItemValueSchema },
      { name: TmHistory.name, schema: TmHistorySchema },
    ]),
    BullModule.registerQueue({
      name: 'tm-on-sale-queue',
      processors: [
        {
          name: 'start',
          // path: join(__dirname, 'tm-on-sale.processor.js'),
          callback: TmOnSaleProcessor,
        },
      ],
    }),
  ],
  providers: [Logger, MarketHashNameTaskService, TmOnSaleService],
})
export class TmOnSaleModule {}
