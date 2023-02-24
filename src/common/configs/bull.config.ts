import { BullModuleOptions } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';

export const getBullConfig = async (
  configService: ConfigService,
): Promise<BullModuleOptions> => ({
  redis: {
    host: configService.get('REDIS_HOST'),
    port: Number(configService.get('REDIS_PORT')),
  },
  settings: {
    lockDuration: 200000,
  },
});
