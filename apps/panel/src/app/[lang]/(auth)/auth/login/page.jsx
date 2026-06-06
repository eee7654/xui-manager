import { getDictionary } from '@/lib/dictionary';
import LoginForm from '@/app/[lang]/(auth)/auth/login/_components/form';
import { Suspense } from 'react';

export default async function LoginPage({ params }) {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  return (
    <Suspense fallback={null}>
      <LoginForm dict={dict} lang={lang} />
    </Suspense>
  );
}
