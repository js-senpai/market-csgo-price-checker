import { Injectable } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import TmOnSaleQueueService from './tm-on-sale.queue-service';

@Injectable()
@Processor('tm-on-sale-queue')
export default class TmOnSaleProcessor {
  constructor(private readonly tmOnSaleQueueService: TmOnSaleQueueService) {}

  @Process('start')
  async start(job: Job): Promise<{ ok: string }> {
    return await this.tmOnSaleQueueService.start(job);
  }
}
