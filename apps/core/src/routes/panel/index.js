import sessionRoutes from './session';
import userRoutes from './user';
import roleRoutes from './role';
import organRoutes from './organ';
import xuiServerRoutes from './xuiServer';
import xuiClientRoutes from './xuiClient';
import cloudflareDnsRoutes from './cloudflareDns';
import cloudflareBanRoutes from './cloudflareBan';
import { createBaseRouter } from "@/config/base-router.js";

const panelRouter = createBaseRouter({ auth: true });

panelRouter.use('/session', sessionRoutes);
panelRouter.use('/users', userRoutes);
panelRouter.use('/roles', roleRoutes);
panelRouter.use('/organs', organRoutes);
panelRouter.use('/xui-servers', xuiServerRoutes);
panelRouter.use('/xui-clients', xuiClientRoutes);
panelRouter.use('/cloudflare-dns', cloudflareDnsRoutes);
panelRouter.use('/cloudflare-bans', cloudflareBanRoutes);


export default panelRouter;
