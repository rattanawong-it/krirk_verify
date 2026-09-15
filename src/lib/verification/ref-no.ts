// F-VER-02 — เลขอ้างอิง KRU-{พ.ศ.}-{running 6 หลัก} · ลำดับเริ่มใหม่ทุกปี พ.ศ. ตามเวลาประเทศไทย
// การจองเลขแบบกันชนกันอยู่ใน verification.service (INSERT … ON CONFLICT … RETURNING ในคำสั่งเดียว)

export const REF_NO_PATTERN = /^KRU-\d{4}-\d{6,}$/;

export function buddhistYear(date: Date, timeZone = "Asia/Bangkok"): number {
  const gregorian = Number(
    new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric" }).format(date),
  );
  return gregorian + 543;
}

export function formatRefNo(beYear: number, sequence: number): string {
  return `KRU-${beYear}-${String(sequence).padStart(6, "0")}`;
}

export function normalizeRefNo(value: string): string | null {
  const refNo = value.trim().toUpperCase();
  return REF_NO_PATTERN.test(refNo) ? refNo : null;
}
