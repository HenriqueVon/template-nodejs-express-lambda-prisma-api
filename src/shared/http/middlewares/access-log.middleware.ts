import type { Request, Response, NextFunction } from 'express';
import { logger } from '@shared/logging/logger';

// One line per finished request: method, path (without the query string, which can carry secrets), status and
// duration. It runs before the body parser and reads the request id from `req`, because the request context
// is not started yet and a `finish` listener does not run in it.
export function accessLogMiddleware(req: Request, res: Response, next: NextFunction) {
  const startedAt = process.hrtime.bigint();
  const { requestId, method, path } = req;

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    logger.info('http_request', {
      requestId,
      method,
      path,
      status     : res.statusCode,
      durationMs : Math.round(durationMs * 10) / 10,
    });
  });

  next();
}
