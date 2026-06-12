import { createBaseRouter } from '@/config/base-router.js';
import * as cloudflareDnsCont from '@/controllers/panel/cloudflareDns.controller.js';
import { checkPermission } from '@/middlewares/checkPermission.js';

const router = createBaseRouter();

router.get('/', checkPermission('read', 'CloudflareDns'), cloudflareDnsCont.fetch);

router.put('/', checkPermission('update', 'CloudflareDns'), cloudflareDnsCont.update);

export default router;
