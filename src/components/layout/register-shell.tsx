import Image from "next/image";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./locale-switcher";

// ส่วนหัวของหน้าลงทะเบียน ตาม project-ui/1 (regOrg / regAlumni)
type Props = {
  logoAlt: string;
  haveAccount: string;
  loginLabel: string;
  children: ReactNode;
};

export function RegisterShell({ logoAlt, haveAccount, loginLabel, children }: Props) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-surface">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-5 pb-2 sm:px-10 sm:pt-8">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/brand/kru-logo.png"
            alt={logoAlt}
            width={128}
            height={22}
            className="h-[22px] w-auto dark:hidden"
          />
          <Image
            src="/brand/kru-logo-white.png"
            alt={logoAlt}
            width={128}
            height={22}
            className="hidden h-[22px] w-auto dark:block"
          />
          <span className="h-5 w-px bg-border" aria-hidden />
          <span className="text-[13px] font-bold">Krirk Verify</span>
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-[12.5px] text-muted-foreground sm:inline">
            {haveAccount}{" "}
            <Link href="/login" className="font-bold text-primary hover:underline">
              {loginLabel}
            </Link>
          </span>
          <LocaleSwitcher />
        </div>
      </header>
      <main className="flex-1 px-4 pt-4 pb-12 sm:px-10">{children}</main>
    </div>
  );
}
