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
import { TmOnSaleProcessor } from './tm-on-sale.processor';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MarketHashName.name, schema: MarketHashNameSchema },
      { name: TmOnSale.name, schema: TmOnSaleSchema },
      { name: TmOnSaleLog.name, schema: TmOnSaleLogSchema },
    ]),
    BullModule.registerQueue({
      name: 'tm-on-sale-queue',
    }),
  ],
  providers: [
    Logger,
    TmOnSaleProcessor,
    MarketHashNameTaskService,
    TmOnSaleService,
  ],
})
export class TmOnSaleModule {}
