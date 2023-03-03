import { WinstonModule } from 'nest-winston';
import { getWinstonConfig } from './common/configs/winston.config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  app.useLogger(WinstonModule.createLogger(getWinstonConfig()));
  await app.listen(3000);
}
bootstrap();
