import type { Request, Response, NextFunction } from 'express';
import { AppError, BadRequestError, PayloadTooLargeError } from '../../errors/app-error';
import { errorFields, logger } from '../../logging/logger';

// Errors raised by the JSON body parser (express.json()) carry a `type`; any other type stays unexpected
function fromBodyParserError(err: unknown): unknown {
  const type = (err as { type?: unknown } | null)?.type;

  if (type === 'entity.parse.failed') {
    return new BadRequestError('Malformed JSON body');
  }

  if (type === 'entity.too.large') {
    return new PayloadTooLargeError();
  }

  return err;
}

// The request id is read from `req`, not from the request context: a body parser error happens before the
// context starts
export function errorHandler(
  originalError: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const err = fromBodyParserError(originalError);
  const { requestId, method, path } = req;

  if (err instanceof AppError) {
    logger.warn('app_error', { requestId, status: err.statusCode, code: err.code, message: err.message, method, path });

    return res.status(err.statusCode).json({
      message : err.message,
      code    : err.code,
    });
  }

  logger.error('unhandled_error', { requestId, method, path, ...errorFields(err) });

  return res.status(500).json({
    message: 'Internal server error',
  });
}
