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
import {
  ItemValueSchema,
  ItemValue,
} from '../../common/schemas/item-value.schema';
import { join } from 'path';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MarketHashName.name, schema: MarketHashNameSchema },
      { name: TmHistory.name, schema: TmHistorySchema },
      { name: TmHistoryLog.name, schema: TmHistoryLogSchema },
      { name: ItemValue.name, schema: ItemValueSchema },
    ]),
    BullModule.registerQueue({
      name: 'tm-history-queue',
      processors: [
        {
          name: 'start-parser',
          path: join(__dirname, 'tm-history.processor.js'),
        },
      ],
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
