import { Injectable, Logger } from '@nestjs/common';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  CheckPriceLog,
  CheckPriceLogDocument,
} from '../../common/schemas/check-price-log.schema';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { CronTime } from 'cron';

@Injectable()
export class CheckPriceService {
  constructor(
    private schedulerRegistry: SchedulerRegistry,
    private readonly logger: Logger,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    @InjectModel(CheckPriceLog.name)
    private readonly checkPriceLogModel: Model<CheckPriceLogDocument>,
    @InjectQueue('check-price-queue')
    private readonly checkPriceQueue: Queue,
  ) {}

  @OnEvent('check-price-event')
  async start() {
    try {
      this.logger.log(
        `The start method has been started`,
        CheckPriceService.name,
      );
      const jobCheckPriceChecker =
        this.schedulerRegistry.getCronJob('check-price-task');
      const job = await this.checkPriceQueue.add(
        'start',
        {},
        {
          attempts: 0,
        },
      );
      // Delete  duplicates
      await this.checkPriceLogModel.deleteMany({
        jobId: job.id,
      });
      await this.checkPriceLogModel.create({
        jobId: job.id,
        status: 'started',
        name: 'Check price task',
      });
      this.logger.log(`The start method has finished.`, CheckPriceService.name);
      jobCheckPriceChecker.setTime(new CronTime('*/30 * * * * *'));
    } catch (e) {
      this.logger.error(
        'Error in the start method',
        e.stack,
        CheckPriceService.name,
      );
    }
  }

  @Cron('0 0 */365 * *', {
    name: 'check-price-task',
  })
  async getJobs() {
    try {
      const getJobs = await this.checkPriceLogModel.find({ available: true });
      const jobCheckPriceChecker =
        this.schedulerRegistry.getCronJob('check-price-task');
      if (getJobs.length) {
        await Promise.all(
          getJobs.map(async ({ jobId, status = 'active' }) => {
            const job = await this.checkPriceQueue.getJob(jobId);
            if (job) {
              const getStateJob = await job.getState();
              const progress = await job.progress();
              const available = !(
                (await job.isStuck()) ||
                (await job.isCompleted()) ||
                (await job.isFailed())
              );
              await this.checkPriceLogModel.updateOne(
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
              await this.checkPriceLogModel.updateOne(
                {
                  jobId,
                },
                {
                  available: false,
                  status: 'unknown',
                },
              );
            }
          }),
        );
      } else {
        // await this.checkPriceLogModel.deleteMany();
        this.eventEmitter.emit('tm-on-sale-event');
        jobCheckPriceChecker.stop();
      }
    } catch (e) {
      this.logger.error(
        'Error in the getJobs method',
        e.stack,
        CheckPriceService.name,
      );
    }
  }
}
