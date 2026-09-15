"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import type { ActionState } from "@/actions/auth";
import { requireRole } from "@/lib/auth/guards";
import { STAFF_ROLES } from "@/lib/auth/rbac";
import * as syncService from "@/lib/services/sync.service";
import { getRequestContext } from "@/lib/utils/request-context";
import { isValidStudentCode } from "@/lib/validations/identifiers";

// F-DATA-08: เจ้าหน้าที่สั่ง full sync — ตอบกลับทันที แล้วทำงานต่อหลังส่ง response
export async function runFullSyncAction(): Promise<ActionState> {
  const user = await requireRole(STAFF_ROLES);
  const started = await syncService.startBulkSync("FULL", {
    actorId: user.id,
    context: await getRequestContext(),
  });
  if (!started.ok) return { ok: false, error: "sync.errors.alreadyRunning" };

  after(() => syncService.executeBulkSync(started.job));
  refresh();
  return { ok: true, message: "sync.started" };
}

// F-DATA-09: ดึงข้อมูลรายคน — ปุ่มจะวางในหน้าพิจารณาคำขอ (F-REG-02, Phase 4)
export async function refreshStudentAction(studentCode: unknown): Promise<ActionState> {
  const user = await requireRole(STAFF_ROLES);
  if (typeof studentCode !== "string" || !isValidStudentCode(studentCode)) {
    return { ok: false, error: "sync.errors.invalidStudentCode" };
  }

  const result = await syncService.refreshStudent(studentCode.trim(), {
    actorId: user.id,
    context: await getRequestContext(),
  });
  refresh();
  if (!result.ok) return { ok: false, error: `sync.errors.${result.code}` };
  return { ok: true, message: result.changed ? "sync.refreshed" : "sync.refreshedUnchanged" };
}
