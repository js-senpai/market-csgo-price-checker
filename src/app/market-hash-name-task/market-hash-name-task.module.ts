import { Logger, Module } from '@nestjs/common';
import { MarketHashNameTaskService } from './market-hash-name-task.service';
import {
  MarketHashName,
  MarketHashNameSchema,
} from '../../common/schemas/market-hash-name.schema';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ItemValueSchema,
  ItemValue,
} from '../../common/schemas/item-value.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MarketHashName.name, schema: MarketHashNameSchema },
      { name: ItemValue.name, schema: ItemValueSchema },
    ]),
  ],
  providers: [Logger, MarketHashNameTaskService],
})
export class MarketHashNameTaskModule {}
