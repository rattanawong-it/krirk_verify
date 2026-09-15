# Phase 1 — Authentication & Authorization

| รายการ | รายละเอียด |
|--------|------------|
| วันที่ | 14 กันยายน 2569 (2026-09-14) |
| สถานะ | ✅ เสร็จ 10/10 รายการ (+ ทำล่วงหน้า 7 รายการจาก Phase อื่น) |
| UI อ้างอิง | `project-ui/1 Public & Auth` (หน้าแรก, login, ลงทะเบียน) · `5 Emails & Policy` (ลืม/ตั้งรหัสผ่าน, ยืนยันอีเมล, เทมเพลตอีเมล) · `2 Requester Portal` (app shell) |

## สรุปสั้น

ผู้ใช้ 4 บทบาทล็อกอินด้วย Auth.js v5 (Credentials + JWT) ได้แล้ว หน่วยงานภายนอกและศิษย์เก่าลงทะเบียนเองได้ มีการยืนยันอีเมล ลืมรหัสผ่าน โปรไฟล์และเปลี่ยนรหัสผ่าน ป้องกันทุก route ตามบทบาททั้งใน `proxy.ts` และฝั่ง server ทุกหน้าใช้ได้ทั้งภาษาไทยและอังกฤษ

## สิ่งที่ตกลงกันใน Phase นี้

| เรื่อง | ข้อสรุป |
|--------|---------|
| รายการต่างจาก spec ของ Phase 0 | ✅ อนุมัติทั้ง 3 ข้อ (proxy.ts, sonner, prisma.config.ts) |
| `(portal)/dashboard` ชนกับ `(staff)/dashboard` | ✅ เลือกให้หน้าเจ้าหน้าที่ใช้ prefix **`/staff`** (เช่น `/staff/dashboard`, `/staff/queue`) |

## สิ่งที่ทำในแต่ละรายการ

| ID | ผลลัพธ์ | ไฟล์หลัก |
|----|---------|----------|
| F-AUTH-01 | ตาราง `User`, `Organization`, `AuthToken` + migration | `prisma/schema.prisma` |
| F-AUTH-02 | Auth.js v5 Credentials + bcrypt (cost 12) + JWT มี `role` · "จำการเข้าสู่ระบบ" = 30 วัน / ไม่ติ๊ก = 8 ชม. | `src/lib/auth/` |
| F-AUTH-03 | หน้า login ตามดีไซน์ + ข้อความ error สองภาษา | `(public)/login` |
| F-AUTH-04 | ลงทะเบียนหน่วยงาน → องค์กร `PENDING` · มือถือแบ่ง 3 ขั้นตามดีไซน์ | `(public)/register/organization` |
| F-AUTH-05 | ลงทะเบียนศิษย์เก่า — จับคู่รหัสนักศึกษา + HMAC ของเลขบัตร กับตาราง `Student` | `(public)/register/alumni` |
| F-AUTH-06 | token ยืนยันอีเมล (24 ชม.) + หน้าสำเร็จ/ลิงก์เสีย + ส่งอีเมลซ้ำ | `(public)/verify-email`, `register/check-email` |
| F-AUTH-07 | ลืมรหัสผ่าน / ตั้งรหัสผ่านใหม่ (ลิงก์ 30 นาที ใช้ครั้งเดียว) | `(public)/forgot-password`, `reset-password` |
| F-AUTH-08 | `rbac.ts` (pure) + `requireAuth` / `requireRole` + `src/proxy.ts` | `src/lib/auth/`, `src/proxy.ts` |
| F-AUTH-09 | หน้าโปรไฟล์ + แก้ข้อมูล + เปลี่ยนรหัสผ่าน (ออกจากระบบทุกอุปกรณ์) | `(account)/profile` |
| F-AUTH-10 | รหัสผ่าน ≥ 8 ตัว มีตัวอักษรและตัวเลข · ล็อกบัญชี 30 นาทีเมื่อผิด 5 ครั้ง | `lockout.ts`, `password.ts` |

**ทำล่วงหน้าเพราะ Phase 1 ต้องใช้:** F-DATA-01 (`Student`), F-DATA-02 (crypto: HMAC/AES-GCM/mask), F-VER-04 (checksum เลขบัตร + รูปแบบพาสปอร์ต), F-AUD-01 (`AuditLog` + service แบบ non-blocking), F-UX-01 (`next-intl` + `[locale]`), F-UX-03 (ปุ่มสลับภาษา จำค่าใน cookie), F-UX-11 (ฟอนต์ self-host) · **ทำบางส่วน `[~]`:** F-AUD-02, F-UX-02, F-UX-05 (app shell), F-NOT-01/02 (ส่งอีเมลยืนยันและรีเซ็ตรหัสผ่าน)

## การตัดสินใจด้านความปลอดภัย

- **ไม่ให้เดาบัญชีได้:** ถ้าอีเมลไม่มีในระบบ ก็ยังเทียบกับ bcrypt hash หลอก ทำให้ใช้เวลาตอบเท่ากัน · สถานะบัญชี (ยังไม่ยืนยัน/รออนุมัติ) จะบอกหลังรหัสผ่านถูกเท่านั้น · หน้าลืมรหัสผ่านตอบข้อความเดียวกันทุกกรณี
- **Token ในอีเมล:** เก็บเฉพาะ SHA-256 hash ใช้ได้ครั้งเดียว · ลิงก์ยืนยันอีเมลที่ถูกระบบสแกนลิงก์เปิดไปก่อน ผู้ใช้จริงยังเห็นหน้าสำเร็จ
- **Session ตรวจกับฐานข้อมูลทุกครั้ง:** ถ้าบัญชีถูกระงับ หรือเปลี่ยนรหัสผ่านหลังล็อกอิน session เดิมใช้ไม่ได้ทันที
- **กัน open redirect:** `callbackUrl` รับเฉพาะ path ภายใน และต้องเป็นหน้าที่บทบาทนั้นมีสิทธิ์
- **Audit Log:** บันทึกล็อกอินสำเร็จ/ล้มเหลว, ล็อกบัญชี, ลงทะเบียน, ยืนยันอีเมล, ขอ/ตั้งรหัสผ่านใหม่, เปลี่ยนรหัสผ่าน, แก้โปรไฟล์ และออกจากระบบ พร้อม IP + User-Agent

## ✅ รายการที่ต่างจาก spec — อนุมัติแล้ว (2026-09-15)

| # | ใน spec | สิ่งที่ทำ | เหตุผล |
|---|---------|-----------|--------|
| 1 | `Student.citizenIdHash` เป็น unique index | ใช้ **index ธรรมดา** | คนเดียวอาจมีหลายระเบียน (เช่น ป.ตรี + ป.โท) — ตรงกับกฎข้อ 4.2 ที่ต้องรองรับกรณี "พบหลายรายการ" |
| 2 | ฟิลด์ใน Data Model ข้อ 5.3 | **เพิ่ม** model `AuthToken` · `User`: name, position, phone, locale, studentId, failedLoginCount, lockedUntil, lastLoginAt, passwordChangedAt · `Organization`: orgType, approvedAt, approvedById · `Student`: passportNoEnc · enum `UserStatus`, `OrgType`, `AuthTokenType`, `Honors` | จำเป็นต่อ F-AUTH-05/06/07/10 และให้เจ้าหน้าที่ดูเลขพาสปอร์ตได้เหมือนเลขบัตร |
| 3 | ดีไซน์ฟอร์มลงทะเบียนหน่วยงานไม่มีช่องรหัสผ่าน | **เพิ่มส่วน "ตั้งรหัสผ่าน"** ในฟอร์ม | ให้ใช้ขั้นตอนเดียวกับศิษย์เก่า ไม่ต้องมีขั้นตั้งรหัสผ่านแยกหลังยืนยันอีเมล |

## ผลการทวนสอบ

| ตรวจ | ผล |
|------|----|
| `pnpm typecheck` / `pnpm lint` / `format:check` | ✅ ผ่าน |
| Unit test (Vitest) | ✅ 79/79 — RBAC ทุกบทบาท × ทุกกลุ่มหน้า, lockout, checksum, crypto, นโยบายรหัสผ่าน, callbackUrl, เทมเพลตอีเมล, เมนูเทียบกับ RBAC |
| E2E (Playwright บน production build) | ✅ 12 passed — redirect เมื่อยังไม่ล็อกอิน, รหัสผิด, หน่วยงานรออนุมัติ, สิทธิ์ 403, ออกจากระบบ, callbackUrl, checksum, หน้าอังกฤษ, **ลงทะเบียน → รับอีเมล → ยืนยัน**, **ลืมรหัสผ่าน → รับอีเมล → ตั้งใหม่ → ล็อกอินได้** |
| `pnpm build` | ✅ ผ่าน |

## บัญชีทดสอบ (dev)

รหัสผ่านทุกบัญชี = ค่า `SEED_DEMO_PASSWORD` (ค่าเริ่มต้น `Krirk2569`) · ดูอีเมลที่ระบบส่งได้ที่ Mailpit http://localhost:8025

| อีเมล | บทบาท | หมายเหตุ |
|-------|-------|----------|
| admin@krirk.ac.th | ADMIN | |
| registrar@krirk.ac.th | REGISTRAR | |
| hr@thaihr.co.th | EXTERNAL | หน่วยงานอนุมัติแล้ว |
| pending@newcorp.co.th | EXTERNAL | หน่วยงานรออนุมัติ (ล็อกอินไม่ได้) |
| alumni@example.com | ALUMNI | |

ลองลงทะเบียนศิษย์เก่าได้ด้วยรหัสนักศึกษา `6112345679` + เลขบัตร `3101500451201` (ข้อมูลสมมติ)

## ข้อจำกัดที่ทราบ / ส่งต่อ Phase ถัดไป

- **ยังไม่มีหน้าอนุมัติหน่วยงาน** (F-REG-08 · Phase 4) — ระหว่างนี้แก้ `organizations.status` ผ่าน Adminer หรือ `pnpm db:studio`
- **Rate limit ต่อ IP** (F-VER-10 · Phase 3) — ตอนนี้กัน brute-force ด้วยการล็อกบัญชีอย่างเดียว
- **`EmailLog` + ส่งซ้ำอัตโนมัติ** (Phase 9) — ถ้าส่งไม่สำเร็จ ผู้ใช้ต้องกด "ส่งอีกครั้ง" เอง
- **ลิงก์ที่ยังเปิดไม่ได้:** นโยบายความเป็นส่วนตัว/ข้อกำหนด (Phase 7) และช่อง "เปิดผลด้วยเลขอ้างอิง" บนหน้าแรก (Phase 3) ยังขึ้น 404
- **ยังไม่มี e2e อัตโนมัติ** สำหรับศิษย์เก่าที่ลงทะเบียนสำเร็จ และการเปลี่ยนรหัสผ่านในหน้าโปรไฟล์ (ทดสอบ logic ในระดับ service/unit แล้ว)
