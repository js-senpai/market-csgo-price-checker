import { NestFactory } from '@nestjs/core';
import { TmHistoryLightweightModule } from './tm-history-lightweight.module';

let context = null;
export const TmHistoryLWCachedContext = async () => {
  if (!context) {
    context = await NestFactory.createApplicationContext(
      TmHistoryLightweightModule,
    );
  }
  return context;
};
