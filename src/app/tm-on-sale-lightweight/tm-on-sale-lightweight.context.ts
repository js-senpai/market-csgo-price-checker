import { NestFactory } from '@nestjs/core';
import { TmOnSaleLightweightModule } from './tm-on-sale-lightweight.module';

let context = null;
export const TmOnSaleLWCachedContext = async () => {
  if (!context) {
    context = await NestFactory.createApplicationContext(
      TmOnSaleLightweightModule,
    );
  }
  return context;
};
