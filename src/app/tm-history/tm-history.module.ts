import { Logger, Module } from '@nestjs/common';
import { TmHistoryService } from './tm-history.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
  MarketHashName,
  MarketHashNameSchema,
} from '../../common/schemas/market-hash-name.schema';
import { BullModule } from '@nestjs/bull';
import {
  TmHistory,
  TmHistorySchema,
} from '../../common/schemas/tm-history.schema';
import {
  TmHistoryLog,
  TmHistoryLogSchema,
} from '../../common/schemas/tm-history-log.schema';
import { MarketHashNameTaskService } from '../market-hash-name-task/market-hash-name-task.service';
import { TmHistoryProcessor } from './tm-history.processor';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MarketHashName.name, schema: MarketHashNameSchema },
      { name: TmHistory.name, schema: TmHistorySchema },
      { name: TmHistoryLog.name, schema: TmHistoryLogSchema },
    ]),
    BullModule.registerQueue({
      name: 'tm-history-queue',
    }),
  ],
  providers: [
    Logger,
    TmHistoryProcessor,
    MarketHashNameTaskService,
    TmHistoryService,
  ],
})
export class TmHistoryModule {}
