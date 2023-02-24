import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { getBullConfig } from './common/configs/bull.config';
import { MongooseModule } from '@nestjs/mongoose';
import { getMongoConfig } from './common/configs/mongo.config';

@Module({
  imports: [
    // Config module
    ConfigModule.forRoot({
      isGlobal: true,
    }),
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
  ],
})
export class AppModule {}
