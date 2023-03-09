import { Logger, Module } from '@nestjs/common';
import { CheckPriceService } from './check-price.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CheckPriceLog,
  CheckPriceLogSchema,
} from '../../common/schemas/check-price-log.schema';
import { BullModule } from '@nestjs/bull';
import { join } from 'path';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CheckPriceLog.name, schema: CheckPriceLogSchema },
    ]),
    BullModule.registerQueue({
      name: 'check-price-queue',
      processors: [
        {
          name: 'start',
          path: join(__dirname, 'check-price.processor-functional.js'),
        },
      ],
    }),
  ],
  providers: [Logger, CheckPriceService],
})
export class CheckPriceModule {}
