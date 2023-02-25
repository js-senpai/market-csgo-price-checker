import { Logger, Module } from '@nestjs/common';
import { CheckPriceService } from './check-price.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
  MarketHashName,
  MarketHashNameSchema,
} from '../../common/schemas/market-hash-name.schema';
import {
  TmHistory,
  TmHistorySchema,
} from '../../common/schemas/tm-history.schema';
import {
  TmOnSale,
  TmOnSaleSchema,
} from '../../common/schemas/tm-on-sale.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MarketHashName.name, schema: MarketHashNameSchema },
      { name: TmHistory.name, schema: TmHistorySchema },
      { name: TmOnSale.name, schema: TmOnSaleSchema },
    ]),
  ],
  providers: [Logger, CheckPriceService],
})
export class CheckPriceModule {}
