# Phase 10 — Deployment & Documentation

| รายการ | รายละเอียด |
|--------|------------|
| วันที่ | 16 กันยายน 2569 (2026-09-16) |
| สถานะ | ✅ เสร็จ 9/9 รายการ + ปิด F-UX-10 (ตรวจ WCAG ด้วย axe ที่เลื่อนมาจาก Phase 8) |
| UI อ้างอิง | `project-ui/2 Requester Portal` (ทางลัด "ตรวจสอบแบบชุด" บนแดชบอร์ดผู้ขอ) · ไม่มีหน้าใหม่ |

## สรุปสั้น

ระบบพร้อมติดตั้งบนเซิร์ฟเวอร์ของมหาวิทยาลัยด้วยคำสั่งเดียว:

- **Docker image แบบ standalone** และ **compose production:** nginx → app → postgres + service `migrate` ที่รัน migration ก่อนแอปทุกครั้ง
- **`/api/health`** ตรวจฐานข้อมูลและระบบทะเบียน
- **สคริปต์ปฏิบัติการ:** cron, สำรองข้อมูล, กู้คืนข้อมูล และ CLI สร้างผู้ดูแลคนแรก
- **เอกสาร 6 ชุด:** README, คู่มือ deploy, คู่มือสำรอง/กู้คืน, สเปก API ทะเบียน และคู่มือผู้ใช้ 2 ฉบับ

ทดสอบ stack จริงบน Docker ครบทั้ง build → migrate → health → login ผ่าน nginx → cron → backup → restore และพบ/แก้ปัญหาที่เกิดเฉพาะเมื่ออยู่หลัง reverse proxy 3 จุด

## สิ่งที่ทำในแต่ละรายการ

| ID | ผลลัพธ์ | ไฟล์หลัก |
|----|---------|----------|
| F-OPS-01 | `output: "standalone"` · Dockerfile 4 stage (`deps` → `builder` → `migrate` / `runner`) บน `node:24-alpine` · runner ไม่มี devDependencies, ผู้ใช้ non-root, `TZ=Asia/Bangkok`, HEALTHCHECK · **build ได้โดยไม่ต้องมีฐานข้อมูล** · image 330 MB | `docker/Dockerfile`, `.dockerignore`, `next.config.ts`, `settings.service.ts` |
| F-OPS-02 | `postgres` (เครือข่าย internal ไม่เปิดพอร์ต) · `migrate` (one-shot: `prisma migrate deploy` + seed ค่าตั้งต้น) · `app` (รอ migrate สำเร็จ) · `nginx` (TLS 1.2/1.3, HTTP→HTTPS, HSTS, body 3 MB, ปิด `/api/cron/*` `/api/mock/*`, ปฏิเสธ Host แปลกปลอม, เขียนทับ `X-Forwarded-For`) · ตัวอย่าง env `.env.prod.example` | `docker/docker-compose.prod.yml`, `docker/nginx/templates/default.conf.template` |
| F-OPS-03 | `GET /api/health` → `ok` / `degraded` (ทะเบียนล่ม, 200) / `down` (DB ล่ม, 503) · จำกัดเวลาตรวจ DB 3 วินาที · ไม่ส่งข้อความ error ของ DB ออกไป · `?registry=skip` สำหรับ HEALTHCHECK · `Cache-Control: no-store` | `api/health/route.ts`, `health.service.ts`, `lib/health/summary.ts` |
| F-OPS-04 | `backup-db.sh` (pg_dump custom → ตรวจอ่านกลับ → `.sha256` → ลบไฟล์เก่ากว่า N วัน) · `restore-db.sh` (ตรวจ checksum → ยืนยันด้วยชื่อ DB → หยุดแอป → สำรองสถานะปัจจุบันก่อน → restore แบบ single transaction → migrate → รอ health) · คู่มือพร้อมเรื่องการเก็บคีย์เข้ารหัสแยก, off-site, ทดสอบกู้คืนรายเดือน, ย้ายเครื่อง | `scripts/backup-db.sh`, `scripts/restore-db.sh`, `docs/operations/backup-restore.md` |
| F-OPS-05 | `cron-run.sh <งาน>` ยิงคำขอ **จากภายใน container app** (secret ไม่อยู่ใน command line ของ host) ครบ 6 งาน · ไฟล์ `/etc/cron.d` ตัวอย่างพร้อมตารางเวลา + logrotate | `scripts/cron-run.sh`, `docker/cron/krirk-verify.cron` |
| F-OPS-06 | README ใหม่ทั้งหมด: ติดตั้ง dev, บัญชีทดสอบ, คำสั่ง, โครงสร้าง, deploy สรุป, health check, **ตาราง env vars ทุกตัว** (แยกกลุ่ม + ระบุตัวที่ตั้งค่าในระบบได้/ไม่ได้ใช้แล้ว) · คู่มือ deploy เต็ม (ข้อกำหนดเครื่อง, ติดตั้ง, ย้าย image แบบ offline, อัปเดต, เฝ้าระวัง, แก้ปัญหา) · CLI `pnpm admin:create` | `README.md`, `docs/operations/deployment.md`, `prisma/create-admin.ts` |
| F-OPS-07 | คู่มือหน่วยงาน/ศิษย์เก่า 13 หัวข้อ · คู่มือเจ้าหน้าที่/ผู้ดูแล 16 หัวข้อ (รวมข้อปฏิบัติ PDPA และสิ่งที่ควรเฝ้าดูใน Audit Log) · ชื่อปุ่ม/เมนูตรงกับ `messages/th.json` | `docs/manual/requester-guide.md`, `docs/manual/staff-guide.md` |
| F-OPS-08 | สเปก API ที่ขอจากฝ่ายทะเบียน: การยืนยันตัวตน, 3 endpoints, แบ่งหน้า + `updatedSince`, HTTP status ที่รองรับ, Student object 25 ฟิลด์, คำถามเรื่องข้อมูล 5 ข้อ, ข้อมูลตัวอย่างที่ขอ, แผนทดสอบร่วม · ยึดตาม Zod schema จริงใน `types.ts` | `docs/registry-api-spec.md` |
| F-OPS-09 | flow หลักทั้งสองมีอยู่แล้วและผ่านบน production build: **auto-approve** (`verification.spec` — ยื่น → ได้ผลทันที → เปิด permalink) · **เข้าคิว → อนุมัติ** (`review.spec` — ยื่น → เจ้าหน้าที่ค้นหา → อนุมัติ → ผู้ขอเห็นผล) · เพิ่ม `health.spec` (2) + `a11y.spec` (4) | `tests/e2e/*.spec.ts` |
| F-UX-10 | `@axe-core/playwright` ตรวจ WCAG 2.1 A/AA ทุกหน้าหลัก 24 หน้า (สาธารณะ ไทย/อังกฤษ, ผู้ขอ, เจ้าหน้าที่/ผู้ดูแล) + โหมดมืด 5 หน้า · แก้ที่พบ 7 จุด (ดูการตัดสินใจด้านล่าง) | `tests/e2e/a11y.spec.ts` |

## ปัญหาที่พบระหว่างทดสอบ stack จริง และวิธีแก้

| อาการ | สาเหตุ | แก้ |
|-------|--------|-----|
| หน้าแรกตอบ **500** หลัง nginx · log `Failed to proxy https://localhost:8443/th` | Auth.js แทน origin ของคำขอด้วย `AUTH_URL` → rewrite ภาษาของ `proxy.ts` กลายเป็น "ต่าง origin" → Next พยายามยิงออกไปนอก container | ไม่ตั้ง `AUTH_URL` บน production (ใช้ `AUTH_TRUST_HOST`) · อธิบายใน env ตัวอย่าง, README, คู่มือแก้ปัญหา |
| ล็อกอินไม่ได้ · `Invalid Server Actions request` | nginx ส่ง `X-Forwarded-Host` จาก `$host` ซึ่งตัดพอร์ต → ไม่ตรงกับ `Origin` | ใช้ `$http_host` + เพิ่ม default server ที่ปฏิเสธ Host อื่น (กัน Host header ปลอม) |
| ไม่มี HSTS ทั้งที่ `APP_URL` เป็น https | `headers()` ใน `next.config.ts` ถูกคำนวณตอน build · image ไม่รู้ `APP_URL` | ตั้ง HSTS ที่ nginx |
| unit/E2E บนเครื่อง dev ถอดรหัสไม่ได้ (`unable to authenticate data`) | ไฟล์ทดสอบ `.env.production` ที่รากโปรเจกต์ถูก `next build`/`next start` อ่านอัตโนมัติ และทับ `ENCRYPTION_KEY` | เปลี่ยนชื่อไฟล์ production เป็น **`.env.prod`** · เตือนใน README |

## การตัดสินใจเชิงออกแบบ

- **build โดยไม่มีฐานข้อมูล:** `getSettings()` คืนค่าเริ่มต้นเมื่อ `NEXT_PHASE=phase-production-build` — หน้าแรกและนโยบาย (ISR 5 นาที) ถูกสร้างใหม่ด้วยค่าจริงหลัง deploy · แทนการให้ Docker build ต่อฐานข้อมูล ซึ่งทำให้ image ผูกกับสภาพแวดล้อม
- **`migrate` แยก image target:** runner ไม่มี prisma CLI/tsx/devDependencies (เล็กและผิวโจมตีน้อยกว่า) · migrate ใช้ `node_modules/.bin` ตรง ๆ ไม่ต้องให้ corepack ดาวน์โหลด pnpm ตอนรัน
- **cron ผ่าน `docker compose exec app`:** ไม่ต้องเปิด `/api/cron/*` ผ่าน nginx เลย และไม่ต้องใส่ secret ใน crontab
- **`X-Forwarded-For` เขียนทับ ไม่ต่อท้าย:** แอปใช้ค่าแรกเป็น IP ใน Audit Log และ rate limit ถ้าต่อท้าย ผู้ใช้จะปลอม IP ได้ · ถ้ามี load balancer ชั้นนอกให้ใช้ `real_ip` (อธิบายในคู่มือ)
- **สร้างผู้ดูแลคนแรกด้วย CLI:** ไม่ใส่รหัสผ่านใน env ถาวร · สุ่มรหัสชั่วคราวและพิมพ์ครั้งเดียว · ทำได้เฉพาะเมื่อยังไม่มี ADMIN · บันทึก audit `user.created` (`source: cli`)
- **restore สำรองสถานะปัจจุบันก่อนเสมอ** และใช้ `--single-transaction` — กู้ผิดไฟล์ย้อนกลับได้ และล้มกลางทางไม่ทิ้งฐานข้อมูลครึ่ง ๆ
- **แก้ accessibility โดยคงดีไซน์:**
  - ตัวเลขข้อความจางด้วย `opacity-80/90` บนป้ายและตัวนับ (9 ไฟล์) → สีเต็ม
  - เลขลำดับขั้นตอนหน้าแรกเป็นของตกแต่ง → วาดด้วย `::before` (WCAG 1.4.3 ยกเว้นส่วนตกแต่ง และลำดับอยู่ใน `<ol>` แล้ว)
  - footer `white/40` → `white/70`
  - token มืด `--status-rejected` `#e0574f` → `#ea7069` (4.2:1 → 5.2:1)
  - input ไฟล์แบบชุดเพิ่ม `aria-label` + `tabIndex=-1`
  - หน้าโปรไฟล์ `<p>` ใน `<dl>` → `<dd>`
- **เปิดทางลัดแบบชุดบนแดชบอร์ดผู้ขอ** (ปุ่มหัวหน้า + "อัปโหลดไฟล์แบบชุด" + "ดาวน์โหลดเทมเพลต CSV" ตามดีไซน์) เฉพาะ EXTERNAL — ปิดงานที่ค้างจาก Phase 6 ข้อ 6
- **`.gitattributes`** บังคับ LF ให้ `*.sh`, `docker/**`, `*.cron` — checkout บน Windows แล้วคัดลอกไปเซิร์ฟเวอร์ยังรันได้

## ✅ รายการที่ต่างจาก spec — อนุมัติแล้ว (2026-09-16)

| # | ใน spec | สิ่งที่ทำ | เหตุผล |
|---|---------|-----------|--------|
| 1 | F-OPS-02 "`docker-compose.yml` production" · ข้อ 5.2 "app + postgres + adminer" | ไฟล์ production ชื่อ **`docker/docker-compose.prod.yml`** (nginx + app + postgres + **service `migrate`**) · `docker-compose.yml` เดิมยังเป็นของ dev (postgres + adminer + mailpit) · production **ไม่มี adminer** | ไม่ทับไฟล์ dev ที่ `pnpm db:up` ใช้ · adminer เปิดฐานข้อมูลที่มีข้อมูลส่วนบุคคลสู่เว็บ |
| 2 | — | ไฟล์ env ของ production ชื่อ **`.env.prod`** (ไม่ใช่ `.env.production`) · **ห้ามตั้ง `AUTH_URL`** หลัง nginx · `DATABASE_URL` ประกอบใน compose จาก `POSTGRES_*` | `next build` บนเครื่อง dev อ่าน `.env.production` เองจนทับคีย์เข้ารหัส · `AUTH_URL` ทำให้หน้าแรก 500 |
| 3 | F-OPS-05 + คอมเมนต์ route เดิม (`curl https://<โดเมน>/api/cron/...`) | cron เรียกผ่าน **`scripts/cron-run.sh`** ภายใน container · nginx **ปิด `/api/cron/*` และ `/api/mock/*` จากภายนอก** (ตอบ 404) | ลดผิวโจมตี และ secret ไม่อยู่ใน crontab |
| 4 | F-OPS-03 "ตรวจ DB + registry API" | ระบบทะเบียนล่ม = **`degraded` แต่ยังตอบ 200** · DB ล่ม = `down` / **503** · เพิ่ม **`?registry=skip`** สำหรับ HEALTHCHECK ของ Docker | ระบบยังค้นหาจากข้อมูลที่ sync ไว้ได้ (spec 9.3) · ไม่ให้ Docker restart แอปเพราะระบบภายนอกล่ม และไม่ยิง API ทะเบียนทุก 30 วินาที |
| 5 | Phase 7 ข้อ 9 (อนุมัติแล้ว): "`pnpm build` ต้องเชื่อมต่อฐานข้อมูล" | **ยกเลิกข้อจำกัดนี้** — ระหว่าง build ใช้ค่าตั้งค่าเริ่มต้น · หน้าแรก/นโยบายได้ค่าจริงเมื่อมีผู้เปิดครั้งแรกหลัง deploy (ภายใน 5 นาที) หรือทันทีเมื่อบันทึกในหน้าตั้งค่า | Docker build แยกจากฐานข้อมูล · image เดียวใช้ได้หลายสภาพแวดล้อม |
| 6 | F-AUD-09 (Phase 7) HSTS ใน `next.config.ts` | บน Docker **HSTS ตั้งที่ nginx** (ค่าใน `next.config.ts` ยังอยู่สำหรับการรันแบบไม่ใช้ Docker) | `headers()` ถูกคำนวณตอน build ซึ่งไม่รู้ `APP_URL` |
| 7 | spec ไม่ได้ระบุวิธีสร้างผู้ดูแลคนแรกบน production | เพิ่ม CLI **`prisma/create-admin.ts`** (`pnpm admin:create`) | seed ไม่สร้างบัญชีเมื่อ `NODE_ENV=production` จึงไม่มีทางเข้าระบบครั้งแรก |
| 8 | ข้อ 5.1 Tech stack / F-UX-10 | เพิ่ม devDependency **`@axe-core/playwright`** · ปรับสี: token มืด `--status-rejected` และ footer หน้าแรก · เลขขั้นตอนหน้าแรกวาดด้วย `::before` | เลื่อนมาตามที่อนุมัติใน v1.7 · ค่าสีเดิมไม่ผ่าน AA |
| 9 | F-OPS-09 | **ไม่เพิ่มไฟล์ E2E ใหม่สำหรับ flow หลัก** — ใช้ `verification.spec` + `review.spec` ที่ครอบคลุมแล้ว · เพิ่ม `health.spec` และ `a11y.spec` | ไม่ทดสอบ flow ซ้ำสองชุด |

## ผลการทวนสอบ

| ตรวจ | ผล |
|------|----|
| `tsc` / `pnpm lint` / `format:check` | ✅ ผ่าน |
| Unit test (Vitest) | ✅ 172/172 (+4) — สรุป health: ok / degraded ยังได้ 200 / DB ล่มได้ 503 เสมอ / ข้ามการตรวจทะเบียน |
| E2E (Playwright บน production build) | ✅ ทั้งชุด 50 passed · 44 skipped · 1 failed → แก้แล้ว: `batch.spec` หาชื่อไฟล์ซ้ำกับรายการประวัติจากการรันครั้งก่อน (test รันซ้ำบนฐานข้อมูลเดิมไม่ได้ — ไม่ได้เกิดจากโค้ดเฟสนี้) · รัน `batch.spec` ใหม่ผ่าน 3/3 · ใหม่: `a11y.spec` 4/4 (24 หน้า + โหมดมืด), `health.spec` ผ่านทั้ง desktop/mobile |
| `pnpm build` | ✅ ผ่าน · route ใหม่ `/api/health` |
| Docker build | ✅ image runner 330 MB · build โดยไม่มีฐานข้อมูล |
| Docker stack (ทดสอบจริงบนเครื่อง dev ด้วย self-signed cert) | ✅ migrate ครบ 8 migration + seed ข้าม demo · app healthy · `/api/health` ok · DB หยุด → 503 `TIMEOUT` ภายใน 3.1 วินาที → เปิดคืนเป็น ok · HTTP→HTTPS 301 · HSTS/CSP/X-Frame-Options · `/api/cron/*` `/api/mock/*` จากภายนอก = 404 · Host แปลกปลอมถูกตัดการเชื่อมต่อ · ล็อกอินผู้ดูแลผ่าน nginx + cookie `__Secure-` · หน้าเจ้าหน้าที่/ผู้ดูแล 200 · Audit Log บันทึก IP |
| สคริปต์ | ✅ `create-admin` สร้างได้ครั้งแรก และปฏิเสธครั้งที่สอง · `cron-run.sh` retention/sync-full/email-retry สำเร็จ + ชื่องานผิดได้ exit 2 · `backup-db.sh` ได้ไฟล์ + sha256 · `restore-db.sh` ยืนยันผิดแล้วยกเลิก · กู้คืนแล้วค่าที่แก้หลังสำรองย้อนกลับถูกต้อง + health ผ่าน |

## วิธีทดสอบด้วยตนเอง

1. `pnpm db:up && pnpm db:seed && pnpm dev` → ล็อกอิน `hr@thaihr.co.th` → แดชบอร์ดมีปุ่ม **ตรวจสอบแบบชุด** และทางลัด **ดาวน์โหลดเทมเพลต CSV** (ศิษย์เก่า `alumni@example.com` ไม่เห็น)
2. เปิด http://localhost:3000/api/health และ `?registry=skip`
3. ทดสอบ stack production บนเครื่องที่มี Docker (ปิด `pnpm dev` ก่อนถ้าพอร์ตชน):
   ```bash
   cp .env.prod.example .env.prod      # ตั้ง NGINX_SERVER_NAME=localhost, HTTPS_PORT=8443, REGISTRY_CLIENT=mock, MOCK_REGISTRY_ENABLED=true และสร้างคีย์ทุกตัว
   openssl req -x509 -newkey rsa:2048 -nodes -days 7 -subj "/CN=localhost" -keyout docker/nginx/certs/privkey.pem -out docker/nginx/certs/fullchain.pem
   docker compose -f docker/docker-compose.prod.yml --env-file .env.prod up -d --build
   docker compose -f docker/docker-compose.prod.yml --env-file .env.prod run --rm migrate tsx prisma/create-admin.ts --email admin@krirk.ac.th
   ```
   เปิด https://localhost:8443 → ล็อกอินด้วยรหัสชั่วคราว → `scripts/backup-db.sh` → `scripts/restore-db.sh backups/<ไฟล์>.dump`
4. `CI=1 pnpm exec playwright test tests/e2e/a11y.spec.ts --project=desktop-chromium`

> บน Windows (Git Bash) ให้ตั้ง `export MSYS2_ARG_CONV_EXCL="/api"` ก่อนรัน `cron-run.sh` — Git Bash แปลง path ที่ขึ้นต้นด้วย `/` เป็น path ของ Windows (บน Linux ไม่มีปัญหานี้)

## ข้อจำกัดที่ทราบ / ส่งต่อ

- **ยังไม่ได้ทดสอบบนเซิร์ฟเวอร์จริงของมหาวิทยาลัย** — รอข้อกำหนดเซิร์ฟเวอร์, โดเมน/ใบรับรอง, SMTP และ API ทะเบียนจริง (spec ข้อ 10 รายการ 1, 3, 6) · ทดสอบบน Docker Desktop ซึ่ง IP ใน Audit Log เป็น gateway ของ Docker (บน Linux ได้ IP จริง)
- ~~งานเบื้องหลังที่ค้างเมื่อ container รีสตาร์ต และ retention ของ `email_logs`~~ → ทำแล้วใน [งานต่อเนื่อง](phase-10-followup-recovery-retention.md) · **`batch_jobs` / `batch_items` ยังไม่อยู่ในนโยบาย retention**
- **ยังไม่มี CI pipeline** (GitHub Actions) — ตอนนี้ตรวจด้วย `pnpm check` + E2E บนเครื่อง
- **image `migrate` ใหญ่ (~1.7 GB)** เพราะใช้ node_modules ทั้งชุด (prisma CLI + tsx เป็น devDependencies) — ใช้เฉพาะตอน migrate/สร้างผู้ดูแล ไม่ได้รันค้าง · ลดขนาดได้ภายหลังด้วย `pnpm deploy --prod` + ติดตั้ง prisma/tsx แยก
- **`pnpm start` เตือน** `"next start" does not work with "output: standalone"` แต่ยังทำงานได้ (Playwright ใช้ตอน `CI=1`) · production ใช้ `node server.js` ใน image
- **ตรวจ accessibility ด้วย axe ครอบคลุมสถานะเริ่มต้นของแต่ละหน้า** — dialog, เมนูที่เปิดอยู่ และสถานะ error ของฟอร์มยังตรวจด้วยมือ (Phase 8)
- **Backup เป็น logical dump รายวัน** (RPO ~24 ชม.) และไฟล์ไม่ได้เข้ารหัสทั้งไฟล์ — ถ้ามหาวิทยาลัยต้องการมากกว่านี้ต้องเพิ่ม WAL archiving / เข้ารหัสปลายทาง
- **ข้อความนโยบาย PDPA/ข้อกำหนด** ยังเป็นร่าง (F-AUD-07 `[~]` รอฝ่ายกฎหมาย)
