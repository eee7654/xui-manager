import { requireActiveOrg } from "@/lib/auth-service";
import { getDictionary } from "@/lib/dictionary";
import { redirect } from 'next/navigation';
import AdminHomeClient from "./_components/AdminHomeClient";

export default async function AdminHome({ params }) {
  const { lang } = await params;
  const sessionData = await requireActiveOrg(lang)
  if(sessionData.roleName !== 'admin'){
    redirect(`/${lang}/panel/home/${sessionData.roleName}`);
  }
  return <AdminHomeClient />;
}

export async function generateMetadata({ params }) {
  const { lang } = await params;
  const dict = await getDictionary(lang);
  return {
    title: dict.pages.home,
  };
}
