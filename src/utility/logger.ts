import winston from 'winston';
import { Logtail } from '@logtail/node';
import { LogtailTransport } from '@logtail/winston';
import { env as serverEnv } from '~env/server.mjs';

const logtail = new Logtail(serverEnv.LOGTAIL_TOKEN);

export const logger = winston.createLogger({
  transports: [new LogtailTransport(logtail)],
});
