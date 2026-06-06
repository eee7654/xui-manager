// src/components/layout/app-menu.jsx
"use client";

import { Menu } from "antd";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useEffect } from "react";
import { useAtomValue } from "jotai";
import { abilityAtom } from "@/store/authAtom";
import { SYSTEM_MENUS } from "@/constants/menu";
import { dictAtom, langAtom } from "@/store/i18nAtom";
import Link from "next/link";

const AppMenu = ({ layout = "inline", cliWidth = 360 }) => {
  const pathname = usePathname();
  const ability = useAtomValue(abilityAtom);
  const dict = useAtomValue(dictAtom);
  const lang = useAtomValue(langAtom);
  const isHorizontal = layout === 'horizontal';
  const router = useRouter();

  const activeKey = useMemo(() => {
    const activeItem = SYSTEM_MENUS.find(item => pathname.includes(item.route));
    return activeItem ? activeItem.key : '1';
  }, [pathname]);

  const finalMenu = useMemo(() => {
    return SYSTEM_MENUS
      .filter(item => {
        if (!item.subject) return true;
        return ability.can(item.action || 'read', item.subject);
      })
      .map((item) => (
        {
          key:item.key,
          label: isHorizontal
            ? <span className="sr-only">{dict.pages?.[item.label]}</span>
            : <Link href={`/${lang}${item.route}`}><span className="font-medium">{dict.pages?.[item.label]}</span></Link>,
          className: `!flex !items-center !rounded-xl my-1 ${isHorizontal ? '!justify-center !w-[54px] !h-[54px] !min-w-[54px] !p-0 !mx-1' : ''}`,
          icon: (
            <span className="!flex !justify-center !text-[20px] !min-w-[20px]">
              {item.icon}
            </span>
          )
        }
      ));
  }, [ability, dict, isHorizontal, lang, layout]);

  useEffect(() => {
    const el = document.querySelector('.ant-menu-item-selected');
    el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [activeKey]);

  return (
    <>
      {isHorizontal && (
        <style>{`
          .mobile-app-menu .ant-menu-item {
            align-items: center !important;
            display: flex !important;
            justify-content: center !important;
            padding: 0 !important;
          }
          .mobile-app-menu .ant-menu-item-icon {
            margin: 0 !important;
            line-height: 1 !important;
          }
          .mobile-app-menu .ant-menu-title-content {
            display: none !important;
            margin: 0 !important;
            width: 0 !important;
          }
        `}</style>
      )}
      <Menu
        selectedKeys={[activeKey]}
        mode={layout}
        items={finalMenu}
        onClick={({ key }) => {
          const item = SYSTEM_MENUS.find(menuItem => menuItem.key === key);
          if (isHorizontal && item?.route) router.push(`/${lang}${item.route}`);
        }}
        className={`bg-transparent border-none md:w-[94%] ${isHorizontal ? 'mobile-app-menu w-max flex-nowrap hide-scrollbar mx-auto' : 'px-3'}`}
        style={
          isHorizontal ?
            {
              height:60,
              background: "transparent",
              border: "none",
              display: "flex",
              margin: 0,
              justifyContent: "flex-start",
              width: finalMenu?.length * 62,
              minWidth: finalMenu?.length * 62,
              maxWidth: cliWidth - 24
            } : {
              background: "transparent",
              border: "none",
              paddingRight: "3%",
              paddingLeft: "3%",
            }
        }
      />
    </>
  );
};

export default AppMenu;
