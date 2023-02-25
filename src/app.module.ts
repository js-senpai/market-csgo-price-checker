import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { getBullConfig } from './common/configs/bull.config';
import { MongooseModule } from '@nestjs/mongoose';
import { getMongoConfig } from './common/configs/mongo.config';
import { MarketHashNameTaskModule } from './app/market-hash-name-task/market-hash-name-task.module';
import { TmOnSaleModule } from './app/tm-on-sale/tm-on-sale.module';
import { TmHistoryModule } from './app/tm-history/tm-history.module';
import { CheckPriceModule } from './app/check-price/check-price.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    // Config module
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getBullConfig,
      inject: [ConfigService],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getMongoConfig,
      inject: [ConfigService],
    }),
    MarketHashNameTaskModule,
    TmOnSaleModule,
    TmHistoryModule,
    CheckPriceModule,
  ],
})
export class AppModule {}
