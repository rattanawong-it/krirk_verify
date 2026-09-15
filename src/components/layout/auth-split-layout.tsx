import Image from "next/image";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./locale-switcher";

// เลย์เอาต์หน้า auth ตาม project-ui/1 (login) และ 5 (forgot/reset/verified):
// แผงไล่เฉดเขียวซ้ายบนเดสก์ท็อป · มือถือแสดงเฉพาะฟอร์มพร้อมโลโก้ด้านบน

type Props = {
  asideTitle: string;
  asideSub: string;
  points?: { icon: IconName; text: string }[];
  logoAlt: string;
  children: ReactNode;
};

export function AuthSplitLayout({ asideTitle, asideSub, points, logoAlt, children }: Props) {
  return (
    <div className="flex min-h-dvh flex-1">
      <aside className="relative hidden w-[420px] shrink-0 flex-col overflow-hidden bg-auth-aside p-10 lg:flex xl:w-[480px]">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -bottom-20 size-72 rounded-full bg-brand-mark/20"
        />
        <Link href="/" className="relative w-fit">
          <Image
            src="/brand/kru-logo-white.png"
            alt={logoAlt}
            width={140}
            height={24}
            className="h-6 w-auto"
            priority
          />
        </Link>
        <div className="relative mt-auto">
          <h2 className="text-3xl leading-tight font-bold text-white">{asideTitle}</h2>
          <p className="mt-3.5 text-[14.5px] leading-relaxed text-white/75">{asideSub}</p>
          {points && (
            <ul className="mt-6 space-y-3">
              {points.map((point) => (
                <li key={point.text} className="flex items-start gap-2.5">
                  <Icon name={point.icon} size={18} className="mt-0.5 text-brand-mark" />
                  <span className="text-[13.5px] leading-snug text-white/85">{point.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <div className="flex flex-1 flex-col bg-surface">
        <div className="flex items-center justify-between gap-3 px-4 pt-5 sm:px-8">
          <Link href="/" className="lg:invisible" tabIndex={-1} aria-hidden>
            <Image
              src="/brand/kru-logo.png"
              alt=""
              width={140}
              height={24}
              className="h-6 w-auto dark:hidden"
            />
            <Image
              src="/brand/kru-logo-white.png"
              alt=""
              width={140}
              height={24}
              className="hidden h-6 w-auto dark:block"
            />
          </Link>
          <LocaleSwitcher />
        </div>
        <main className="flex flex-1 items-start justify-center px-4 py-8 sm:items-center sm:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
