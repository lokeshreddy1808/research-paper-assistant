import pino from 'pino';

/**
 * Structured application logger using Pino.
 * Configured with redaction rules to prevent credentials or sensitive authorization
 * tokens from leaking into terminal stdout or log files.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'apiKey',
      'authorization',
      'headers.authorization',
      '*.apiKey',
      '*.*.apiKey',
      'req.headers.authorization',
      'body.apiKey'
    ],
    censor: '[REDACTED]'
  },
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
      ignore: 'pid,hostname'
    }
  }
});
