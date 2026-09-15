"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guards";
import { REQUESTER_ROLES } from "@/lib/auth/rbac";
import { type SubmitResult, submitRequest } from "@/lib/services/verification.service";
import { type ActionState, fieldErrorsOf } from "@/lib/utils/action-state";
import { getRequestContext } from "@/lib/utils/request-context";
import { submitOwnRequestSchema, submitRequestSchema } from "@/lib/validations/verification";

// F-VER-03 — auth + validate + เรียก service แล้วพาไปหน้ารายละเอียด (หรือหน้าแจ้งโควตาเต็ม)
export async function submitRequestAction(input: unknown): Promise<ActionState> {
  const user = await requireRole(REQUESTER_ROLES);
  const locale = (await getLocale()) === "en" ? "en" : "th";
  const context = await getRequestContext();

  let result: SubmitResult;
  if (user.role === "ALUMNI") {
    const parsed = submitOwnRequestSchema.safeParse(input);
    if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };
    result = await submitRequest(user.id, { kind: "own", data: parsed.data }, context);
  } else {
    const parsed = submitRequestSchema.safeParse(input);
    if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };
    result = await submitRequest(user.id, { kind: "search", data: parsed.data }, context);
  }

  if (!result.ok) {
    if (result.code === "rateLimited") {
      return redirect({
        href: {
          pathname: "/requests/limit",
          query: { retry: String(Math.ceil(result.retryAfterSec / 60)) },
        },
        locale,
      });
    }
    return { ok: false, error: `verify.errors.${result.code}` };
  }

  return redirect({
    href: { pathname: `/requests/${result.refNo}`, query: { submitted: "1" } },
    locale,
  });
}
