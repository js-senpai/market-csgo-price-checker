import { Injectable, Logger } from '@nestjs/common';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { MarketHashNameTaskService } from '../market-hash-name-task/market-hash-name-task.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import {
  TmHistoryLog,
  TmHistoryLogDocument,
} from '../../common/schemas/tm-history-log.schema';
import { PRODUCT_STATUS } from '../../common/enums/mongo.enum';
import {
  TmHistory,
  TmHistoryDocument,
} from '../../common/schemas/tm-history.schema';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { CronTime } from 'cron';
import { timer } from 'rxjs';

@Injectable()
export class TmHistoryService {
  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: Logger,
    private readonly marketHashNameService: MarketHashNameTaskService,
    @InjectModel(TmHistory.name)
    private readonly tmHistoryModel: Model<TmHistoryDocument>,
    @InjectModel(TmHistoryLog.name)
    private readonly tmHistoryLogModel: Model<TmHistoryLogDocument>,
    @InjectQueue('tm-history-queue')
    private readonly tmHistoryQueue: Queue,
  ) {}

  @OnEvent('tm-history-event')
  async start() {
    const jobTmHistoryChecker = this.schedulerRegistry.getCronJob(
      'tm-history-checker-task',
    );
    try {
      this.logger.log(
        `The start method has been started`,
        TmHistoryService.name,
      );
      const { totalPages = 0 } = await this.marketHashNameService.paginate({
        currentPage: 1,
        select: ['name'],
      });
      for (const currentPage of Array.from(
        { length: totalPages },
        (x, y) => y + 1,
      )) {
        const { pagingCounter, docs = [] } =
          await this.marketHashNameService.paginate({
            currentPage,
            select: ['name'],
          });
        const name = `${pagingCounter}-${pagingCounter + 50}`;
        // await timer(30 * 1000);
        const job = await this.tmHistoryQueue.add(
          'start',
          {
            docs,
            name,
          },
          {
            attempts: 0,
            // timeout: 30 * 1000,
          },
        );
        // Delete  duplicates
        await this.tmHistoryLogModel.deleteMany({
          jobId: job.id,
        });
        await this.tmHistoryLogModel.create({
          jobId: job.id,
          status: 'started',
          name,
        });
      }
      jobTmHistoryChecker.setTime(new CronTime('*/5 * * * *'));
    } catch (e) {
      this.logger.error(
        'Error in the start method',
        e.stack,
        TmHistoryService.name,
      );
    }
  }

  @Cron('0 0 */365 * *', {
    name: 'tm-history-checker-task',
  })
  async getJobs() {
    try {
      const jobTmHistoryChecker = this.schedulerRegistry.getCronJob(
        'tm-history-checker-task',
      );
      const getJobs = await this.tmHistoryLogModel.find({ available: true });
      if (getJobs.length) {
        for (const { jobId, status = 'active' } of getJobs) {
          const job = await this.tmHistoryQueue.getJob(jobId);
          if (job) {
            const getStateJob = await job.getState();
            const progress = await job.progress();
            const available = !(
              (await job.isStuck()) ||
              (await job.isCompleted()) ||
              (await job.isFailed())
            );
            await this.tmHistoryLogModel.updateOne(
              {
                jobId,
              },
              {
                progress,
                status: getStateJob,
                available,
                ...(job.failedReason && {
                  message: job.failedReason,
                }),
              },
            );
            if (!available && status !== 'active') {
              await job.remove();
            }
          } else {
            await this.tmHistoryLogModel.updateOne(
              {
                jobId,
              },
              {
                available: false,
                status: 'unknown',
              },
            );
          }
        }
      } else {
        jobTmHistoryChecker.stop();
        this.eventEmitter.emit('check-price-event');
      }
    } catch (e) {
      this.logger.error(
        'Error in the getJobs method',
        e.stack,
        TmHistoryService.name,
      );
    }
  }
}
