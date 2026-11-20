import { Router } from 'express';

export const basePath = '/v1/api';
const router = Router();

// Mount a more specific path before a path that is its prefix: otherwise the `/:id` route of the
// shorter path would capture it.

// @template:example:start
import exampleRoute from '@modules/example/example.routes';
router.use(`${basePath}/examples`, exampleRoute);
// @template:example:end

export default router;
