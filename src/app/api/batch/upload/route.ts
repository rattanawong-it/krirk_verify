import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { parseBatchFile } from "@/lib/batch/parse-file";
import { createBatchJob } from "@/lib/services/batch.service";
import { getRequestContext } from "@/lib/utils/request-context";
import { batchUploadSchema } from "@/lib/validations/batch";

// F-BAT-03 — อัปโหลดไฟล์ → ตรวจทีละแถว → สร้างงานสถานะ DRAFT ไว้ให้ผู้ขอดูตัวอย่างก่อนยืนยัน
// รหัสข้อผิดพลาดที่คืนไปตรงกับคีย์ batch.errors.* ในไฟล์แปล

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (user.role !== "EXTERNAL") return Response.json({ error: "forbidden" }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) return Response.json({ error: "empty" }, { status: 400 });

  const parsedForm = batchUploadSchema.safeParse({
    purpose: form.get("purpose"),
    consent: form.get("consent") === "true",
  });
  if (!parsedForm.success) return Response.json({ error: "invalidForm" }, { status: 400 });

  const parsedFile = await parseBatchFile(file);
  if (!parsedFile.ok) return Response.json({ error: parsedFile.code }, { status: 400 });

  const created = await createBatchJob({
    actorId: user.id,
    fileName: file.name,
    data: parsedForm.data,
    rows: parsedFile.outcome.rows,
    context: await getRequestContext(),
  });
  if (!created.ok) {
    return Response.json(
      {
        error: created.code,
        ...(created.code === "quotaExceeded" ? { retryAfterSec: created.retryAfterSec } : {}),
      },
      { status: 400 },
    );
  }

  return Response.json(
    {
      batchId: created.batchId,
      validCount: created.validCount,
      invalidCount: created.invalidCount,
      truncated: parsedFile.outcome.truncated,
    },
    { status: 201 },
  );
}
