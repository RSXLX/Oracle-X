// Simple logger for production use
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDev = process.env.NODE_ENV !== 'production';

function format(level: LogLevel, msg: string, meta?: unknown): string {
  const time = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${time}] [${level.toUpperCase()}] ${msg}${metaStr}`;
}

export const logger = {
  debug(msg: string, meta?: unknown): void {
    if (isDev) // eslint-disable-next-line no-console
    console.debug(format('debug', msg, meta));
  },
  info(msg: string, meta?: unknown): void {
    // eslint-disable-next-line no-console
    console.info(format('info', msg, meta));
  },
  warn(msg: string, meta?: unknown): void {
    console.warn(format('warn', msg, meta));
  },
  error(msg: string, meta?: unknown): void {
    console.error(format('error', msg, meta));
  },
};
