import { Logger, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  TmHistory,
  TmHistorySchema,
} from '../../common/schemas/tm-history.schema';
import {
  TmOnSale,
  TmOnSaleSchema,
} from '../../common/schemas/tm-on-sale.schema';
import CheckPriceQueueService from '../check-price/check-price.queue-service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getMongoConfig } from '../../common/configs/mongo.config';

@Module({
  imports: [
    // Config module
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getMongoConfig,
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: TmHistory.name, schema: TmHistorySchema },
      { name: TmOnSale.name, schema: TmOnSaleSchema },
    ]),
  ],
  providers: [Logger, CheckPriceQueueService],
})
export class CheckPriceLightweightModule {}
