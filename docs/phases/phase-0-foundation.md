# Phase 0 — Project Foundation

| รายการ | รายละเอียด |
|--------|------------|
| วันที่ | 14 กันยายน 2569 (2026-09-14) |
| สถานะ | ✅ เสร็จ 7/7 รายการ |
| อ้างอิง | `docs/spec.md` หัวข้อ 6 · Design System `project-ui/Krirk Verify Design System.dc.html` |

## สรุปสั้น

วางโครงโปรเจกต์ครบพร้อมพัฒนาฟีเจอร์: Next.js 16 + Tailwind v4 (ธีมมหาวิทยาลัยเกริก + dark mode) + shadcn/ui + Prisma 7/PostgreSQL 16 ใน Docker + ชุดทดสอบ Vitest/Playwright และ pre-commit hook

## สิ่งที่ทำในแต่ละรายการ

| ID | ผลลัพธ์ | ไฟล์หลัก |
|----|---------|----------|
| F-SETUP-01 | Next.js **16.3.5** + React **19.2.8** + TypeScript, App Router, `src/`, pnpm 11 · init git (branch `main`) | `package.json`, `next.config.ts` |
| F-SETUP-02 | Tailwind **v4.3** แบบ CSS-first — token สีจาก Design System (เขียว `#1C6B21`, ทอง `#C69A2E` เฉพาะตราประทับ, สีสถานะ 6 แบบ, gradient `bg-hero` / `bg-seal` / `bg-gold-seal`) · dark mode แบบ class ผ่าน `next-themes` · ฟอนต์ Anuphan / Inter / JetBrains Mono ผ่าน `next/font` (self-host) | `src/app/globals.css`, `src/app/layout.tsx` |
| F-SETUP-03 | shadcn/ui (Radix) 18 component: button, input, label, textarea, select, checkbox, switch, radio-group, table, dialog, form, badge, card, sonner, separator, skeleton, dropdown-menu, tooltip · ตัวห่อไอคอน `<Icon name="…" />` (Hugeicons stroke-rounded) | `src/components/ui/*` |
| F-SETUP-04 | ESLint 9 (flat config + next core-web-vitals + prettier) · Prettier + plugin เรียงคลาส Tailwind · TS `strict` + `noUncheckedIndexedAccess` · husky pre-commit → `lint-staged` + `typecheck` | `eslint.config.mjs`, `.prettierrc.json`, `.husky/pre-commit` |
| F-SETUP-05 | Docker Compose (PostgreSQL 16-alpine + Adminer) · `.env.example` ครบทุกกลุ่ม: แอป, DB, Auth, PDPA crypto, Registry API, Cron, Rate limit, Email | `docker/docker-compose.yml`, `.env.example` |
| F-SETUP-06 | Prisma **7.10** + `prisma.config.ts` + driver adapter `@prisma/adapter-pg` · client singleton · migration `init` (ตาราง `AppSetting`) + seed ค่าตั้งต้น | `prisma/`, `src/lib/db/prisma.ts` |
| F-SETUP-07 | Vitest 5 (jsdom) + Testing Library · Playwright 1.63 (desktop + มือถือ 390×844) · สคริปต์รวม `pnpm check` | `vitest.config.mts`, `playwright.config.ts`, `tests/` |

## ผลการทวนสอบ

| ตรวจ | ผล |
|------|----|
| `pnpm typecheck` | ✅ ผ่าน |
| `pnpm lint` / `pnpm format:check` | ✅ ผ่าน |
| `pnpm test` (unit) | ✅ 2/2 · 2.4 วินาที |
| `pnpm test:e2e` (smoke: หน้าแรก + ไม่มี horizontal scroll) | ✅ 2/2 (desktop + mobile) |
| `pnpm build` | ✅ ผ่าน |
| `prisma migrate dev` + `db seed` | ✅ ผ่าน |

## การตัดสินใจและข้อควรรู้

- **Prisma 7** ไม่ใส่ `url` ใน `schema.prisma` แล้ว — ตั้งค่าใน `prisma.config.ts` และต้องใช้ driver adapter · import client จาก `@/generated/prisma/client`
- **Next.js 16** ถอดคำสั่ง `next lint` (ใช้ `eslint .`) · `typecheck` ต้องรัน `next typegen` ก่อน เพื่อสร้าง type `LayoutProps` / `PageProps`
- **shadcn CLI สร้างไฟล์ผิด 2 จุด** — import `cn` จากแพ็กเกจ npm ชื่อ `cn` และใช้ไอคอน lucide · แก้แล้วเป็น `@/lib/utils` + Hugeicons (`shadcn-icons.tsx`) → **ทุกครั้งที่ `shadcn add` ต้องตรวจ 2 จุดนี้**
- **พอร์ต PostgreSQL dev = 5435** เพราะเครื่อง dev มีฐานข้อมูลของโปรเจกต์อื่นใช้พอร์ต 5432–5434 อยู่
- ตาราง `AppSetting` (อยู่ใน Data Model ข้อ 5.3) ถูกสร้างก่อนกำหนด เพื่อใช้ทดสอบว่า migration/seed ทำงานได้
- หน้าแรก `/` ตอนนี้เป็น **หน้าชั่วคราว** สำหรับตรวจธีม/ฟอนต์/ไอคอน — จะแทนด้วยหน้า Public จริงตาม `project-ui/1 Public & Auth`

## ✅ รายการที่ต่างจาก spec — อนุมัติแล้ว (2026-09-14)

| # | ใน spec | สิ่งที่เสนอ | เหตุผล | กระทบ |
|---|---------|------------|--------|-------|
| 1 | `src/middleware.ts` | **`src/proxy.ts`** | Next.js 16 เลิกใช้ชื่อ `middleware` (deprecated) เปลี่ยนเป็น `proxy` และรันบน Node.js runtime | ข้อ 5.2, F-AUTH-08, F-UX-01 |
| 2 | component `toast` | **`sonner`** | shadcn/ui เลิกใช้ `toast` แล้ว แนะนำ `sonner` แทน (ใช้งานแล้วใน Phase 0) | F-SETUP-03 |
| 3 | ไม่มีในโครงสร้าง | `prisma.config.ts` + `src/generated/prisma/` | ข้อบังคับของ Prisma 7 | ข้อ 5.2 |

## วิธีเริ่มพัฒนา (เครื่องใหม่)

```bash
cp .env.example .env      # แล้วสร้าง secret ใหม่ด้วย openssl ตามคำอธิบายในไฟล์
pnpm install
pnpm db:up                # ต้องเปิด Docker Desktop ก่อน · Adminer: http://localhost:8080
pnpm db:migrate
pnpm db:seed
pnpm dev                  # http://localhost:3000
```

## ถัดไป — Phase 1 (Authentication & Authorization)

- ขออนุมัติรายการที่ต่างจาก spec ข้อ 1–3 ด้านบน
- ตรวจความเข้ากันได้ของ Auth.js v5 กับ Next.js 16 ก่อนเริ่ม (ตามตารางความเสี่ยงข้อ 8)
- UI อ้างอิง `project-ui/1 Public & Auth.dc.html` (Login, ลงทะเบียน, ยืนยันอีเมล, ลืมรหัสผ่าน)
