import "@/app/[lang]/(panel)/style.css";
import { AntdRegistry } from '@ant-design/nextjs-registry';
import AntConfigProvider from '@/components/providers/ant-config-provider';
import { redirect } from 'next/navigation';
import { AppHydrator } from '@/components/providers/app-hydrator';
import { getDictionary } from '@/lib/dictionary';
import ClientPanel from '@/components/layouts/client-panel';
import { getSessionData } from "@/lib/auth-service";

export default async function PanelLayout({ children, params }) {
  const { lang } = await params;
  const dir = lang === 'fa' ? 'rtl' : 'ltr';
  const dict = await getDictionary(lang);
  const sessionData = await getSessionData();
  if (!sessionData || !sessionData.user) {
    redirect(`/${lang}/auth/login?reason=expired`);
  }
  const isMultiOrg = sessionData.isMultiOrg ?? process.env.NEXT_PUBLIC_IS_MULTI_ORG === 'true';
  return (
    <div className="panel-wrapper min-h-screen flex">
      <AppHydrator
        rules={sessionData.rules}
        user={{
          ...sessionData.user,
          isMultiOrg,
          memberships: isMultiOrg ? sessionData.memberships || [] : []
        }}
        lang={lang}
        dir={dir}
        dict={dict}
      >
        <AntdRegistry>
          <AntConfigProvider lang={lang} dir={dir}>
            <ClientPanel>
              {children}
            </ClientPanel>
          </AntConfigProvider>
        </AntdRegistry>
      </AppHydrator>
    </div>
  );
}
