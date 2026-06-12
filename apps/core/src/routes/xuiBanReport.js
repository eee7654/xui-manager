import { createBaseRouter } from '@/config/base-router.js';
import * as xuiBanReportCont from '@/controllers/xuiBanReport.controller.js';

const router = createBaseRouter();

router.post('/', xuiBanReportCont.create);

export default router;
