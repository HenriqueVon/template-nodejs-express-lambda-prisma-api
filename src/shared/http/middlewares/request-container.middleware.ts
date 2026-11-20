import type { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { randomUUID } from 'crypto';

export function requestContainerMiddleware(req: Request, _res: Response, next: NextFunction) {
  req.requestId = req.requestId ?? randomUUID();

  // Each request receives its own child container. No registration uses a scoped lifecycle,
  // so every request still shares the singletons registered in src/shared/container/index.ts.
  req.container = container.createChildContainer();
  next();
}
