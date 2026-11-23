import 'express';
import type { DependencyContainer } from 'tsyringe';

declare global {
  namespace Express {
    export interface Request {
      requestId: string | undefined,
      container?: DependencyContainer;
      // Set by serverless-http when the app runs on Lambda; only the field used here is typed
      apiGateway?: { event?: { requestContext?: { requestId?: string } } };
    }
  }
}
