import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';
import 'winston-daily-rotate-file';
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
    new winston.transports.DailyRotateFile({
      datePattern: 'DD.MM.YYYY',
      filename: `logs/info-%DATE%.log`,
      level: 'info',
      handleExceptions: true,
      zippedArchive: true,
      maxFiles: '7d',
    }),
    new winston.transports.DailyRotateFile({
      filename: `logs/errors-%DATE%.log`,
      datePattern: 'DD.MM.YYYY',
      level: 'error',
      zippedArchive: true,
      maxFiles: '7d',
    }),
  ],
  exceptionHandlers: [
    new winston.transports.DailyRotateFile({
      filename: `logs/exceptions-%DATE%.log`,
      datePattern: 'DD.MM.YYYY',
      zippedArchive: true,
      maxFiles: '7d',
    }),
  ],
});
