import { createBaseRouter } from '@/config/base-router.js';
import * as cloudflareBanCont from '@/controllers/panel/cloudflareBan.controller.js';
import { checkPermission } from '@/middlewares/checkPermission.js';

const router = createBaseRouter();

router.get('/', checkPermission('read', 'CloudflareBan'), cloudflareBanCont.fetch);

router.post('/sync', checkPermission('sync', 'CloudflareBan'), cloudflareBanCont.sync);

router.post('/clear', checkPermission('delete', 'CloudflareBan'), cloudflareBanCont.clear);

export default router;
