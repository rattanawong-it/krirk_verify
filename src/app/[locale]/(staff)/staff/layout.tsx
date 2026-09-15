import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireRole } from "@/lib/auth/guards";
import { STAFF_ROLES } from "@/lib/auth/rbac";

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const user = await requireRole(STAFF_ROLES);
  return <AppShell user={user}>{children}</AppShell>;
}
