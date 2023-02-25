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
      let currentPage = 1;
      let prevCounter = 1;
      const { totalPages = 0 } = await this.marketHashNameService.paginate({
        currentPage: 1,
        select: ['name'],
      });
      await Promise.all(
        Array.from({ length: totalPages }, (x, y) => y + 1).map(async (_) => {
          const { pagingCounter, docs = [] } =
            await this.marketHashNameService.paginate({
              currentPage,
              populate: 'priceHistory',
            });
          const name =
            currentPage === 1 ? '1-50' : `${prevCounter}-${pagingCounter}`;
          const job = await this.tmHistoryQueue.add(
            'start',
            {
              docs,
              name,
            },
            {
              attempts: 0,
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
          prevCounter = pagingCounter;
          currentPage += 1;
        }),
      );
      jobTmHistoryChecker.setTime(new CronTime('*/1 * * * *'));
    } catch (e) {
      this.logger.error(
        'Error in the start method',
        e.stack,
        TmHistoryService.name,
      );
    }
  }

  @Cron('0 0 * * *', {
    name: 'tm-history-checker-task',
  })
  async getJobs() {
    try {
      const jobTmHistoryChecker = this.schedulerRegistry.getCronJob(
        'tm-history-checker-task',
      );
      const getJobs = await this.tmHistoryLogModel.find({ available: true });
      if (getJobs.length) {
        for (const { jobId, status = 'active', name } of getJobs) {
          const job = await this.tmHistoryQueue.getJob(jobId);
          if (job) {
            const getStateJob = await job.getState();
            const progress = await job.progress();
            this.logger.log(
              `Job [${jobId}], name: ${name}, progress: ${progress}, status: ${getStateJob}`,
            );
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
            this.logger.log(`Job [${jobId}] with name ${name} not found`);
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

  @Cron('*/60 * * * *')
  async checkNotFound() {
    try {
      this.logger.log(
        `The checkNotFound method has been started`,
        TmHistoryService.name,
      );
      const getTotalNeedCheckItems = await this.tmHistoryModel.count({
        status: PRODUCT_STATUS.NEED_CHECK,
      });
      await this.tmHistoryModel.updateMany(
        {
          status: PRODUCT_STATUS.NEED_CHECK,
        },
        {
          status: PRODUCT_STATUS.NOT_FOUND,
        },
      );
      this.logger.log(
        `The checkNotFound method has finished.Total updated items - ${getTotalNeedCheckItems}`,
        TmHistoryService.name,
      );
    } catch (e) {
      this.logger.error(
        'Error in the checkNotFound method',
        e.stack,
        TmHistoryService.name,
      );
    }
  }
}
