import { createBaseRouter } from '@/config/base-router.js';
import * as xuiClientCont from '@/controllers/panel/xuiClient.controller.js';
import { checkPermission } from '@/middlewares/checkPermission.js';

const router = createBaseRouter();

router.get('/', checkPermission('read', 'XuiClient'), xuiClientCont.fetch);

router.get('/stats', checkPermission('read', 'XuiClient'), xuiClientCont.stats);

router.post('/', checkPermission('create', 'XuiClient'), xuiClientCont.create);

router.patch('/:serverId/:clientId', checkPermission('update', 'XuiClient'), xuiClientCont.update);

router.delete('/:serverId/:clientId', checkPermission('delete', 'XuiClient'), xuiClientCont.remove);

export default router;
