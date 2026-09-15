import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireRole } from "@/lib/auth/guards";
import { REQUESTER_ROLES } from "@/lib/auth/rbac";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const user = await requireRole(REQUESTER_ROLES);
  return <AppShell user={user}>{children}</AppShell>;
}
