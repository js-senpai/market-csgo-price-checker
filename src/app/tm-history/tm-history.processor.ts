import { Injectable } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import TmHistoryQueueService from './tm-history.queue-service';

@Injectable()
@Processor('tm-history-queue')
export default class TmHistoryProcessor {
  constructor(private readonly tmHistoryQueueService: TmHistoryQueueService) {}

  @Process('start')
  async start(job: Job): Promise<{ ok: string }> {
    return await this.tmHistoryQueueService.start(job);
  }
}
