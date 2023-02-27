import { Injectable, Logger } from '@nestjs/common';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  TmOnSaleLog,
  TmOnSaleLogDocument,
} from '../../common/schemas/tm-on-sale-log.schema';
import { MarketHashNameTaskService } from '../market-hash-name-task/market-hash-name-task.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import {
  TmOnSale,
  TmOnSaleDocument,
} from '../../common/schemas/tm-on-sale.schema';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { CronTime } from 'cron';

@Injectable()
export class TmOnSaleService {
  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: Logger,
    private readonly marketHashNameService: MarketHashNameTaskService,
    @InjectModel(TmOnSaleLog.name)
    private readonly tmOnSaleLogModel: Model<TmOnSaleLogDocument>,

    @InjectQueue('tm-on-sale-queue')
    private readonly tmOnSaleQueue: Queue,

    @InjectModel(TmOnSale.name)
    private readonly tmOnSaleModel: Model<TmOnSaleDocument>,
  ) {}

  @OnEvent('tm-on-sale-event')
  async start() {
    const jobTmOnSaleChecker = this.schedulerRegistry.getCronJob(
      'tm-on-sale-checker-task',
    );
    try {
      this.logger.log(
        `The start method has been started`,
        TmOnSaleService.name,
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
        const job = await this.tmOnSaleQueue.add(
          'start',
          {
            docs,
            listName: name,
          },
          {
            attempts: 0,
            // timeout: 30 * 1000,
          },
        );
        // Delete  duplicates
        await this.tmOnSaleLogModel.deleteMany({
          jobId: job.id,
        });
        await this.tmOnSaleLogModel.create({
          jobId: job.id,
          status: 'started',
          name,
        });
      }
      jobTmOnSaleChecker.setTime(new CronTime('*/5 * * * *'));
    } catch (e) {
      this.logger.error(
        'Error in the start method',
        e.stack,
        TmOnSaleService.name,
      );
    }
  }

  @Cron('0 0 */365 * *', {
    name: 'tm-on-sale-checker-task',
  })
  async getJobs() {
    try {
      const jobTmOnSaleChecker = this.schedulerRegistry.getCronJob(
        'tm-on-sale-checker-task',
      );
      const getJobs = await this.tmOnSaleLogModel.find({ available: true });
      if (getJobs.length) {
        for (const { jobId, status = 'active' } of getJobs) {
          const job = await this.tmOnSaleQueue.getJob(jobId);
          if (job) {
            const getStateJob = await job.getState();
            const progress = await job.progress();
            const available = !(
              (await job.isStuck()) ||
              (await job.isCompleted()) ||
              (await job.isFailed())
            );
            await this.tmOnSaleLogModel.updateOne(
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
            await this.tmOnSaleLogModel.updateOne(
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
        jobTmOnSaleChecker.stop();
        this.eventEmitter.emit('tm-history-event');
      }
    } catch (e) {
      this.logger.error(
        'Error in getJobs method',
        e.stack,
        TmOnSaleService.name,
      );
    }
  }
}
