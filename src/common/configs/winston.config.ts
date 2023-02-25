import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';
import * as dayjs from 'dayjs';
export const getWinstonConfig = (): WinstonModuleOptions => ({
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'DD.MM.YYYY HH:mm:ss',
    }),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({
          all: true,
        }),
        winston.format.label({
          label: '[LOGGER]',
        }),
        winston.format.timestamp({
          format: 'DD.MM.YYYY HH:mm:ss',
        }),
        winston.format.printf(
          (error) =>
            `[Nest] - ${[error.timestamp]}  [${error.context}] :  ${
              error.level
            }: ${error.message}`,
        ),
      ),
    }),
    new winston.transports.File({
      filename: `logs/info-${dayjs().format('DD.MM.YYYY')}.log`,
      level: 'info',
      handleExceptions: true,
    }),
    new winston.transports.File({
      filename: `logs/errors-${dayjs().format('DD.MM.YYYY')}.log`,
      level: 'error',
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: `logs/exceptions-${dayjs().format('DD.MM.YYYY')}.log`,
    }),
  ],
});
