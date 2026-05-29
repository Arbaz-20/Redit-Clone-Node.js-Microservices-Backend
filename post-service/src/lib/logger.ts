import winston from 'winston';

const service = process.env.SERVICE_NAME || 'auth-service';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()} [${service}] ${message}`)
  ),
  transports: [new winston.transports.Console()],
});
