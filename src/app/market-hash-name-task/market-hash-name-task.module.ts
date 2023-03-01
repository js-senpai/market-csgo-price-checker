import { Logger, Module } from '@nestjs/common';
import { MarketHashNameTaskService } from './market-hash-name-task.service';
import {
  MarketHashName,
  MarketHashNameSchema,
} from '../../common/schemas/market-hash-name.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { TmValue, TmValueSchema } from '../../common/schemas/tm-value.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MarketHashName.name, schema: MarketHashNameSchema },
      { name: TmValue.name, schema: TmValueSchema },
    ]),
  ],
  providers: [Logger, MarketHashNameTaskService],
})
export class MarketHashNameTaskModule {}
