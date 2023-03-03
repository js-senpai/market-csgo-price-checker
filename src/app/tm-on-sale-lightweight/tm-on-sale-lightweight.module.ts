import { Logger, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  MarketHashName,
  MarketHashNameSchema,
} from '../../common/schemas/market-hash-name.schema';
import {
  TmOnSale,
  TmOnSaleSchema,
} from '../../common/schemas/tm-on-sale.schema';
import TmOnSaleQueueService from '../tm-on-sale/tm-on-sale.queue-service';
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
      { name: MarketHashName.name, schema: MarketHashNameSchema },
      { name: TmOnSale.name, schema: TmOnSaleSchema },
    ]),
  ],
  providers: [Logger, TmOnSaleQueueService],
})
export class TmOnSaleLightweightModule {}
