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
import { join } from 'path';
import {
  ItemValue,
  ItemValueSchema,
} from '../../common/schemas/item-value.schema';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ItemValue.name, schema: ItemValueSchema },
      { name: MarketHashName.name, schema: MarketHashNameSchema },
      { name: TmHistory.name, schema: TmHistorySchema },
      { name: TmHistoryLog.name, schema: TmHistoryLogSchema },
    ]),
    BullModule.registerQueue({
      name: 'tm-history-queue',
      processors: [
        {
          name: 'start',
          path: join(__dirname, 'tm-history.processor-functional.js'),
        },
      ],
    }),
  ],
  providers: [
    Logger,
    // TmHistoryProcessor,
    MarketHashNameTaskService,
    TmHistoryService,
  ],
})
export class TmHistoryModule {}
