import { Router } from 'express';
import { controllerAdapter } from '@shared/http/controller.adapter';
import { validateRequest } from '@shared/http/middlewares/validate.middleware';
import { ExampleController } from './example.controller';
import { idParamsSchema } from '@shared/schemas/id.schema';
import {
  createExampleSchema,
  updateExampleSchema,
  listExampleQuerySchema
} from './schemas';

const router = Router();

router.get(
  '/',
  validateRequest({ query: listExampleQuerySchema }),
  controllerAdapter(ExampleController, 'list')
);

router.post(
  '/',
  validateRequest({ body: createExampleSchema }),
  controllerAdapter(ExampleController, 'create')
);

router.get(
  '/:id',
  validateRequest({ params: idParamsSchema }),
  controllerAdapter(ExampleController, 'getById')
);

router.patch(
  '/:id',
  validateRequest({ params: idParamsSchema, body: updateExampleSchema }),
  controllerAdapter(ExampleController, 'update')
);

router.delete(
  '/:id',
  validateRequest({ params: idParamsSchema }),
  controllerAdapter(ExampleController, 'delete')
);

export default router;
