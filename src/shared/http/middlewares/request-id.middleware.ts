import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// A caller may send its own id to correlate the logs of several services. Only a short, plain value is
// accepted, so that a header cannot inject text into the logs.
const CALLER_REQUEST_ID = /^[A-Za-z0-9._-]{1,100}$/;

function resolveRequestId(req: Request): string {
  // On Lambda, serverless-http exposes the API Gateway event: its request id is the one AWS logs show
  // and a caller cannot choose it
  const gatewayRequestId = req.apiGateway?.event?.requestContext?.requestId;
  if (typeof gatewayRequestId === 'string' && gatewayRequestId !== '') {
    return gatewayRequestId;
  }

  const callerRequestId = req.header('x-request-id');
  if (callerRequestId && CALLER_REQUEST_ID.test(callerRequestId)) {
    return callerRequestId;
  }

  return randomUUID();
}

// First middleware of the app: every response, including the ones for a malformed body, carries the id
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  req.requestId = resolveRequestId(req);
  res.setHeader('x-request-id', req.requestId);
  next();
}
