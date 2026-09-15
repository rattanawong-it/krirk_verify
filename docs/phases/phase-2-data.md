# Phase 2 — Data Layer & Registry Integration

| รายการ | รายละเอียด |
|--------|------------|
| วันที่ | 15 กันยายน 2569 (2026-09-15) |
| สถานะ | ✅ เสร็จ 7/8 รายการ · `[~]` 1 รายการ (F-DATA-09 รอหน้า Phase 4) · F-DATA-01/02 ทำไว้แล้วใน Phase 1 |
| UI อ้างอิง | `project-ui/4 Admin & Reports` (หน้า Sync) · ปุ่ม "ดึงข้อมูลใหม่" รายคนอยู่ใน `3 Registrar Workspace` (หน้าพิจารณาคำขอ) |

## สรุปสั้น

ระบบดึงข้อมูลผู้สำเร็จการศึกษาจากระบบทะเบียนมาเก็บใน PostgreSQL ได้แล้ว ผ่าน Adapter (`RegistryClient`) ที่สลับ Mock ↔ HTTP ได้ด้วย env · sync ได้ 3 แบบ (เต็ม / เฉพาะที่เปลี่ยน / รายคน) พร้อมบันทึก `SyncJob` · system cron สั่งผ่าน `/api/cron/sync` · เจ้าหน้าที่ดูสถานะและสั่งซิงก์ได้ที่ `/staff/sync`

## สิ่งที่ทำในแต่ละรายการ

| ID | ผลลัพธ์ | ไฟล์หลัก |
|----|---------|----------|
| F-DATA-03 | `RegistryClient` interface (`listStudents` แบบแบ่งหน้า + `updatedSince`, `getStudent`, `ping`) · Zod DTO · รหัส error กลาง 7 แบบ · ระเบียนที่รูปแบบผิดถูกข้ามทีละรายการ ไม่ทำให้ทั้งหน้าล้ม | `src/lib/integrations/registry/types.ts`, `errors.ts` |
| F-DATA-04 | ข้อมูลสมมติ **240 ราย** สร้างแบบ deterministic · เคสตั้งใจ 15 เคส (จบปกติ, เกียรตินิยม 1/2, กำลังศึกษา, ลาออก, เพิกถอน, ชื่อซ้ำคนละคน, คนเดียวหลายวุฒิ, ต่างชาติใช้พาสปอร์ต, ข้อมูลเก่าไม่มีวันสภาอนุมัติ, สภายังไม่อนุมัติ, ข้อพิพาท, ป.เอก) · Mock API `GET /api/mock/registry/{health, students, students/[code]}` | `mock-data.ts`, `mock-client.ts`, `src/app/api/mock/registry/` |
| F-DATA-05 | timeout (`AbortSignal.timeout`) + retry 3 ครั้งแบบ exponential backoff (0.5s → 1s → 2s) เฉพาะ error ที่ลองใหม่ได้ (timeout, network, 429, 5xx) · 401/403 ไม่ retry · 404 ของรายคน = `null` | `http-client.ts` |
| F-DATA-06 | full / incremental / single · upsert เฉพาะระเบียนที่ `updatedAt` ต้นทางใหม่กว่า · กันการรันซ้อนด้วย unique `runLock` ในฐานข้อมูล · งานค้างเกิน 60 นาทีถูกปลด lock อัตโนมัติ · บันทึก audit เริ่ม/สำเร็จ/ล้มเหลว | `src/lib/services/sync.service.ts` |
| F-DATA-07 | `POST /api/cron/sync?type=full\|incremental` + header `x-cron-secret` (เทียบแบบเวลาคงที่ · ปฏิเสธทุกคำขอถ้ายังไม่ได้ตั้ง secret จริง) · ตอบ `202` + jobId ทันทีแล้วซิงก์ต่อเบื้องหลัง · `409` ถ้ามีงานรันอยู่ | `src/app/api/cron/sync/route.ts`, `src/lib/auth/cron-secret.ts` |
| F-DATA-08 | หน้าตามดีไซน์: แถบสถานะ (เป็นปัจจุบัน / กำลังซิงก์ / ล้มเหลว / ยังไม่เคยซิงก์) · ตารางประวัติ (มือถือเป็นการ์ด) แบ่งหน้าละ 20 · การ์ด API ระบบทะเบียน + ตรวจสถานะเชื่อมต่อจริง · ปุ่มซิงก์ทั้งหมด · หน้ารีเฟรชเองทุก 3 วินาทีระหว่างมีงานรัน · เปิดเมนูใน sidebar แล้ว | `(staff)/staff/sync/page.tsx`, `src/components/features/sync/` |
| F-DATA-09 `[~]` | `refreshStudent()` ดึงรายคนแบบบังคับเขียนทับ + บันทึก `SyncJob` ประเภท SINGLE + audit · มี `refreshStudentAction` แล้ว **เหลือวางปุ่มในหน้าพิจารณาคำขอ (F-REG-02, Phase 4)** | `sync.service.ts`, `src/actions/sync.ts` |
| F-DATA-10 | seed นำเข้าข้อมูล Mock ทั้ง 240 ราย (ใช้ mapper ตัวเดียวกับ sync) + พิมพ์ตารางเคสทดสอบพร้อมผลที่คาดหวังของ Phase 3 | `prisma/seed.ts`, `mapper.ts` |

## การตัดสินใจเชิงออกแบบ

- **Mock 2 ทาง ข้อมูลชุดเดียว:** `MockRegistryClient` เรียกข้อมูลในโปรเซสเดียวกัน (เร็ว ไม่พึ่ง HTTP) ส่วน route `/api/mock/registry` ใช้ข้อมูลชุดเดียวกัน — ตั้ง `REGISTRY_CLIENT=http` + `REGISTRY_API_URL` ชี้ไปที่ route นี้ ก็ทดสอบเส้นทาง `HttpRegistryClient` จริงได้ครบ และรูปแบบ response ของ route นี้ใช้เป็นร่างเอกสารขอ API จากฝ่ายทะเบียน (F-OPS-08)
- **จำลองระบบทะเบียนล่ม:** ตั้ง `MOCK_REGISTRY_ENABLED=false` → sync บันทึกเป็น FAILED (`UNAVAILABLE`) และหน้าเว็บยังค้นหาจากข้อมูลที่ซิงก์ไว้ได้ (ข้อ 9.3)
- **ไม่ลบระเบียน** ที่หายไปจากต้นทางระหว่าง full sync — คำขอตรวจสอบในอดีตยังอ้างอิงอยู่ ถ้าฝ่ายทะเบียนต้องการยกเลิกวุฒิ ให้ส่งสถานะ `REVOKED` แทน
- **Incremental** ใช้เวลาเริ่มของ sync (เต็มหรือ incremental) ที่สำเร็จครั้งล่าสุดเป็น `updatedSince` · ถ้ายังไม่เคยสำเร็จจะดึงทั้งหมด
- **PDPA:** DTO มีเลขบัตรเต็มเฉพาะระหว่างทาง — ก่อนลงฐานข้อมูลแปลงเป็น HMAC + AES-GCM เสมอ · log ของระเบียนรูปแบบผิดมีเฉพาะรหัสนักศึกษาและชื่อฟิลด์ ไม่มีค่าข้อมูล
- **Prisma 7 ไม่รัน `generate` ให้หลัง `migrate dev`** → หลังแก้ schema ต้องรัน `pnpm db:generate` ด้วยทุกครั้ง

## ✅ รายการที่ต่างจาก spec — อนุมัติแล้ว (2026-09-15)

| # | ใน spec | สิ่งที่ทำ | เหตุผล |
|---|---------|-----------|--------|
| 1 | `SyncJob`: `type`, `status`, `recordsFetched`, `recordsUpserted`, `errorMessage`, timestamps | **เพิ่ม** `runLock` (unique), `studentCode`, `triggeredById`, `recordsInvalid`, `errorCode` + enum `SyncType`, `SyncStatus` (`RUNNING/SUCCESS/FAILED`) | กันรันซ้อนในระดับฐานข้อมูล · ระบุคนที่สั่ง (cron = null) · แสดงสาเหตุสองภาษาจากรหัส error |
| 2 | ไม่ได้ระบุ | **env ใหม่ 2 ตัว:** `SYNC_PAGE_SIZE` (ค่าเริ่มต้น 500), `SYNC_CRON_SCHEDULE` (แสดงบนหน้าเว็บเท่านั้น ตั้งเวลาจริงที่ system cron) | ปรับขนาดหน้าตามโหลดของ API จริง · หน้า Sync ในดีไซน์มีช่อง "ตารางงาน cron" |
| 3 | `/api/cron/sync` (ไม่ระบุพฤติกรรม) | `POST` เท่านั้น ตอบ `202` แล้วทำงานเบื้องหลัง ไม่รอจนเสร็จ | full sync ข้อมูลจริงหลักหมื่นระเบียนใช้เวลาหลายนาที cron/reverse proxy อาจ timeout ก่อน |
| 4 | Mock Registry | `MOCK_REGISTRY_ENABLED=false` ปิดทั้ง route **และ** `MockRegistryClient` | ใช้จำลองระบบทะเบียนล่มตามแผนทวนสอบข้อ 9.3 |

## ผลการทวนสอบ

| ตรวจ | ผล |
|------|----|
| `pnpm typecheck` / `pnpm lint` / `format:check` | ✅ ผ่าน |
| Unit test (Vitest) | ✅ 104/104 (+25 ข้อ) — ข้อมูล mock ครอบคลุมทุกเคส + checksum + deterministic, แบ่งหน้า/`updatedSince`, HTTP client (retry, backoff, timeout, 401, 404, response ผิดรูปแบบ), mapper ไม่มีเลขบัตรเต็มในแถว, cron secret, รูปแบบระยะเวลา |
| E2E (Playwright บน production build) | ✅ 16 passed — Mock API ตามสัญญา, **เจ้าหน้าที่กดซิงก์ทั้งหมด → เห็นความคืบหน้า → ประวัติสำเร็จ**, หน่วยงานภายนอกเข้าหน้า sync ไม่ได้, cron ไม่มี/ผิด secret → 401, type ผิด → 400, สั่ง incremental → 202 · ชุดเดิมของ Phase 0–1 ผ่านครบ |
| `pnpm build` | ✅ ผ่าน |
| `prisma migrate dev` (`sync_jobs`) + `db:seed` | ✅ ผ่าน · นำเข้า 240 ระเบียน |

## วิธีทดสอบด้วยตนเอง

```bash
# สั่ง sync เหมือน system cron (ใช้ CRON_SECRET จาก .env)
curl -X POST -H "x-cron-secret: $CRON_SECRET" "http://localhost:3000/api/cron/sync?type=full"

# ดูข้อมูลจาก Mock API
curl "http://localhost:3000/api/mock/registry/students?page=1&pageSize=5"
```

ล็อกอิน `registrar@krirk.ac.th` แล้วเปิด **ซิงก์ข้อมูล** ในเมนู · ตาราง "เคสทดสอบ" พร้อมเลขบัตร/พาสปอร์ตแสดงตอนรัน `pnpm db:seed`

## ข้อจำกัดที่ทราบ / ส่งต่อ Phase ถัดไป

- **ปุ่มดึงข้อมูลรายคน** จะวางในหน้าพิจารณาคำขอ (F-REG-02 · Phase 4)
- **ยังไม่มี e2e อัตโนมัติ** สำหรับกรณีระบบทะเบียนล่ม (ทดสอบในระดับ unit ของ client แล้ว) และหน้า sync บน viewport มือถือ
- **ตัวอย่าง crontab + คู่มือ** อยู่ใน F-OPS-05 (Phase 10) — ตอนนี้มีตัวอย่าง `curl` ในคอมเมนต์ของ route
- **โครงสร้าง DTO เป็นสมมติฐาน** (เช่น `educationLevel` = `BACHELOR/MASTER/DOCTORAL`) ต้องยืนยันกับ spec จริงจากฝ่ายทะเบียน (spec ข้อ 10 รายการ 1–2)
