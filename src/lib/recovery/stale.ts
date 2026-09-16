// งานเบื้องหลังที่ค้างเมื่อ process ถูกรีสตาร์ต (เช่น deploy ใหม่ระหว่าง after() ทำงาน) — pure function เพื่อ unit test ได้

const MINUTE_MS = 60_000;

// งานแบบชุดอัปเดต updatedAt ทุกแถวที่ประมวลผล (ใช้เวลาไม่กี่วินาทีต่อแถว)
// ถ้าเงียบนานกว่านี้แปลว่าไม่มี process ใดทำงานนั้นอยู่แล้ว
export const BATCH_STALE_MINUTES = 10;

// แถว EmailLog สถานะ PENDING ปกติจะเปลี่ยนเป็น SENT/FAILED ภายในเวลา timeout ของ SMTP
// เผื่อ socket timeout ของ nodemailer (สูงสุด 10 นาที) ไว้สามเท่า
export const EMAIL_PENDING_STALE_MINUTES = 30;

export function staleBefore(now: Date, minutes: number): Date {
  return new Date(now.getTime() - minutes * MINUTE_MS);
}

export const STALE_EMAIL_ERROR = "ค้างสถานะรอส่ง (process หยุดระหว่างส่ง) — ส่งซ้ำอัตโนมัติ";
