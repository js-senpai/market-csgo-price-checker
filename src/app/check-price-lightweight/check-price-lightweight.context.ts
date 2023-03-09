import { NestFactory } from '@nestjs/core';
import { CheckPriceLightweightModule } from './check-price-lightweight.module';

let context = null;
export const CheckPriceLWCachedContext = async () => {
  if (!context) {
    context = await NestFactory.createApplicationContext(
      CheckPriceLightweightModule,
    );
  }
  return context;
};
