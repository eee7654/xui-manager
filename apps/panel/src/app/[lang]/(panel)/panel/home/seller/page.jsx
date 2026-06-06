import { requireActiveOrg } from "@/lib/auth-service";
import { getDictionary } from "@/lib/dictionary";
import { redirect } from 'next/navigation';
import SellerHomeClient from "./_components/SellerHomeClient";

export default async function AdminHome({ params }) {
  const { lang } = await params;
  const sessionData = await requireActiveOrg(lang)
  if(sessionData.roleName !== 'seller'){
    redirect(`/${lang}/panel/home/${sessionData.roleName}`);
  }
  return <SellerHomeClient />;
}

export async function generateMetadata({ params }) {
  const { lang } = await params;
  const dict = await getDictionary(lang);
  return {
    title: dict.pages.home,
  };
}
