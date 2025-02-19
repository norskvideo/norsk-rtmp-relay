import * as winston from 'winston'
import config from './config'
import * as path from 'path'
import util from 'util';

const { combine, colorize, label, timestamp, printf } = winston.format;


function defaultLogger(cfg: {
  base: string,
  serviceName: string
}) {
  const l = winston.createLogger({
    level: process.env.LOG_LEVEL ?? 'info',
    format: winston.format.json(),
    defaultMeta: { service: cfg.serviceName },
    transports: [
      new winston.transports.File({ filename: path.join(cfg.base, 'error.log'), level: 'error' }),
      new winston.transports.File({ filename: path.join(cfg.base, 'debug.log'), level: 'debug' }),
    ],
  });
  const colorFormat = winston.format.combine(
    colorize({ all: true }),
    timestamp({ format: 'YY-MM-DD HH:mm:ss.SSS' }),
    label({ label: cfg.serviceName }),
    printf(
      (info) =>
        ` ${info.label} ${info.timestamp}  ${info.level} : ${info.message} (${formatArgs(info)})`
    ),
  );
  winston.addColors({
    info: 'bold blue',
    warn: 'italic yellow',
    error: 'bold red',
    debug: 'green',
    silly: 'grey'
  });

  l.add(new winston.transports.Console({
    format: combine(colorFormat),
  }));
  return l
}


function formatArgs(a: { [key: string | symbol]: unknown }) {
  const valid: unknown[] = [];
  for (let x = 0; x < 10; x++) {
    if (a[x])
      valid.push(a[x])
    else
      break;
  }
  return util.inspect(valid, { colors: true, depth: 3 })
}

let logger = defaultLogger({
  base: config.server.logs(),
  serviceName: 'default'
});

// We kinda want a different default logger for runner vs server, etc
export function initialiseDefaultLogging(base: string, serviceName: string) {
  logger = defaultLogger({ base, serviceName });
}

export function errorlog(message: string, ...meta: unknown[]) {
  logger.log('error', message, meta)
}

export function warninglog(message: string, ...meta: unknown[]) {
  logger.log('warn', message, meta)
}

export function infolog(message: string, ...meta: unknown[]) {
  logger.log('info', message, meta)
}

export function debuglog(message: string, ...meta: unknown[]) {
  logger.log('debug', message, meta)
}

export function sillylog(message: string, ...meta: unknown[]) {
  logger.log('silly', message, meta)
}
