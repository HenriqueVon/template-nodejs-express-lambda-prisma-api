import type { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { requestContext } from '@shared/logging/request-context';

// Runs after the body parser (see request-context.ts). Each request receives its own child container. No
// registration uses a scoped lifecycle, so every request still shares the singletons registered in
// src/shared/container/index.ts. It also starts the request context that carries the request id.
export function requestContainerMiddleware(req: Request, _res: Response, next: NextFunction) {
  req.container = container.createChildContainer();

  requestContext.run({ requestId: req.requestId ?? 'unknown' }, () => next());
}
