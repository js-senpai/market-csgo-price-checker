import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WinstonModule } from 'nest-winston';
import { getWinstonConfig } from './common/configs/winston.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useLogger(WinstonModule.createLogger(getWinstonConfig()));
  await app.listen(3000);
}
bootstrap();
