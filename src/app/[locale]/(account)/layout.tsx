import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireAuth } from "@/lib/auth/guards";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const user = await requireAuth();
  return <AppShell user={user}>{children}</AppShell>;
}
