import { createBaseRouter } from '@/config/base-router.js';
import * as xuiServerCont from '@/controllers/panel/xuiServer.controller.js';
import { checkPermission } from '@/middlewares/checkPermission.js';

const router = createBaseRouter();

router.get('/', checkPermission('read', 'XuiServer'), xuiServerCont.fetch);

router.post('/', checkPermission('create', 'XuiServer'), xuiServerCont.create);

router.patch('/:id', checkPermission('update', 'XuiServer'), xuiServerCont.update);

router.get('/lookup', checkPermission('read', 'XuiServer'), xuiServerCont.lookup);

export default router;
