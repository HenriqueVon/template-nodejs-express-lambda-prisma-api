import { AsyncLocalStorage } from 'node:async_hooks';

type RequestContext = {
  requestId: string;
};

// Carries the id of the current request through every `await`, so that code far from the controller
// (a repository, `prismaCall`) can log it without receiving `req`. It is started by
// requestContainerMiddleware, after the body is parsed: the body parser continues from a stream event,
// which would drop a context started earlier.
export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}
