# Krirk Verify — ระบบตรวจสอบวุฒิการศึกษาออนไลน์

ระบบให้หน่วยงานภายนอกและศิษย์เก่าตรวจสอบวุฒิการศึกษากับฐานข้อมูลทะเบียนของมหาวิทยาลัยเกริก:

- คำขอที่ข้อมูลตรงชัดเจนจะได้ผลทันที
- คำขอที่กำกวมจะเข้าคิวให้เจ้าหน้าที่ทะเบียนพิจารณา
- ผลที่อนุมัติแล้วเป็น snapshot ถาวร พร้อม permalink ที่ตรวจซ้ำได้
- ทุกการเข้าถึงข้อมูลบันทึกใน Audit Log ตาม PDPA

| เอกสาร                                                                   | สำหรับ                                                     |
| ------------------------------------------------------------------------ | ---------------------------------------------------------- |
| [`docs/spec.md`](docs/spec.md)                                           | ข้อกำหนดระบบ (SRS) และสถานะของแต่ละฟีเจอร์                 |
| [`docs/phases/`](docs/phases/)                                           | บันทึกสรุปการพัฒนาแต่ละเฟส                                 |
| [`docs/operations/deployment.md`](docs/operations/deployment.md)         | ติดตั้งบนเซิร์ฟเวอร์ production, ตั้ง cron, อัปเดตเวอร์ชัน |
| [`docs/operations/backup-restore.md`](docs/operations/backup-restore.md) | สำรองและกู้คืนฐานข้อมูล                                    |
| [`docs/registry-api-spec.md`](docs/registry-api-spec.md)                 | สเปก API ที่ขอจากฝ่ายทะเบียน / IT มหาวิทยาลัย              |
| [`docs/manual/staff-guide.md`](docs/manual/staff-guide.md)               | คู่มือเจ้าหน้าที่ทะเบียนและผู้ดูแลระบบ                     |
| [`docs/manual/requester-guide.md`](docs/manual/requester-guide.md)       | คู่มือหน่วยงานภายนอกและศิษย์เก่า                           |

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Prisma 7 + PostgreSQL 16 · Tailwind CSS v4 + shadcn/ui · Auth.js v5 · next-intl (ไทย/อังกฤษ) · Nodemailer · Vitest + Playwright + axe · Docker Compose + nginx

## เริ่มพัฒนาบนเครื่อง (development)

### สิ่งที่ต้องมี

- Node.js 24 LTS (ขั้นต่ำ 22.12) และ pnpm 11 — เปิดด้วย `corepack enable` (เวอร์ชันถูกล็อกใน `package.json`)
- Docker Desktop หรือ Docker Engine + Compose v2 — สำหรับ PostgreSQL, Adminer และ Mailpit

### ขั้นตอน

```bash
pnpm install
cp .env.example .env          # สร้างค่า AUTH_SECRET / IDENTIFIER_PEPPER / ENCRYPTION_KEY / CRON_SECRET ตามคำแนะนำในไฟล์
pnpm db:up                    # PostgreSQL (พอร์ต 5435) + Adminer (8080) + Mailpit (8025)
pnpm db:migrate               # สร้างตาราง
pnpm db:generate              # สร้าง Prisma client ใหม่หลัง migrate (migrate ไม่ได้ทำให้)
pnpm db:seed                  # ค่าตั้งต้น + ข้อมูลทะเบียนสมมติ 240 ราย + บัญชีทดสอบ
pnpm dev                      # http://localhost:3000
```

> ห้ามสร้างไฟล์ `.env.production` ที่รากโปรเจกต์: `next build` / `next start` จะอ่านไฟล์นั้นเองและทับค่าใน `.env` เช่น `ENCRYPTION_KEY` จนถอดรหัสข้อมูลไม่ได้ ไฟล์ของ production ใช้ชื่อ `.env.prod`

### บัญชีทดสอบ (สร้างโดย `pnpm db:seed` เมื่อ `NODE_ENV` ไม่ใช่ production)

ทุกบัญชีใช้รหัสผ่านตาม `SEED_DEMO_PASSWORD` (ค่าเริ่มต้น `Krirk2569`) · อีเมลที่ระบบส่งดูได้ที่ Mailpit http://localhost:8025

| อีเมล                   | บทบาท     | หมายเหตุ                              |
| ----------------------- | --------- | ------------------------------------- |
| `admin@krirk.ac.th`     | ADMIN     | ผู้ดูแลระบบ                           |
| `registrar@krirk.ac.th` | REGISTRAR | เจ้าหน้าที่ทะเบียน                    |
| `hr@thaihr.co.th`       | EXTERNAL  | หน่วยงานที่อนุมัติแล้ว                |
| `pending@newcorp.co.th` | EXTERNAL  | หน่วยงานรออนุมัติ (เข้าสู่ระบบไม่ได้) |
| `alumni@example.com`    | ALUMNI    | ศิษย์เก่า                             |

`pnpm db:seed` จะแสดงตารางเคสทดสอบในข้อมูลสมมติด้วย เช่น เลขบัตรที่อนุมัติอัตโนมัติ, ชื่อซ้ำ, วุฒิถูกเพิกถอน

### คำสั่งที่ใช้บ่อย

| คำสั่ง                                         | ทำอะไร                                                                                        |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `pnpm dev`                                     | dev server                                                                                    |
| `pnpm build` / `pnpm start`                    | build แบบ production (`output: "standalone"`) และรัน                                          |
| `pnpm typecheck` / `pnpm lint` / `pnpm format` | ตรวจ type / ESLint / Prettier                                                                 |
| `pnpm test`                                    | unit test (Vitest)                                                                            |
| `pnpm test:e2e`                                | E2E (Playwright) — ต้องมีฐานข้อมูล seed แล้วและ Mailpit ทำงาน · `CI=1` รันบน production build |
| `pnpm check`                                   | generate → typecheck → lint → format → unit test → build (ก่อนส่งงาน)                         |
| `pnpm db:up` / `pnpm db:down`                  | เปิด/ปิด container สำหรับ dev                                                                 |
| `pnpm db:migrate` / `pnpm db:deploy`           | สร้าง migration ใหม่ (dev) / ใช้ migration ที่มีอยู่ (production)                             |
| `pnpm db:studio`                               | Prisma Studio                                                                                 |
| `pnpm admin:create --email ... --name ...`     | สร้างผู้ดูแลระบบคนแรก (ใช้ตอนติดตั้ง production)                                              |

### โครงสร้างโดยย่อ

```
src/app/[locale]/(public|portal|account|staff)   หน้าเว็บแยกตามกลุ่มผู้ใช้ (URL เจ้าหน้าที่ขึ้นต้น /staff)
src/app/api/                                      auth, health, cron/*, batch/*, staff/*, mock/registry
src/lib/services/                                 business logic ทั้งหมด (ไม่พึ่ง React — unit test ได้)
src/lib/integrations/registry/                    adapter ระบบทะเบียน (mock | http)
src/proxy.ts                                      ตรวจภาษา + สิทธิ์ตามบทบาท (Next.js 16: เดิม middleware.ts)
prisma/                                           schema, migrations, seed.ts, create-admin.ts
docker/                                           Dockerfile, compose (dev + prod), nginx, ตัวอย่าง cron
scripts/                                          cron-run.sh, backup-db.sh, restore-db.sh
tests/unit, tests/e2e                             Vitest, Playwright (+ axe ตรวจ WCAG 2.1 AA)
```

## Deploy (สรุป)

ติดตั้งบนเซิร์ฟเวอร์ Linux ที่มี Docker ดูขั้นตอนเต็มใน [`docs/operations/deployment.md`](docs/operations/deployment.md)

```bash
cp .env.prod.example .env.prod && chmod 600 .env.prod    # แก้ค่าทุกตัวที่เป็น change-me
cp fullchain.pem privkey.pem docker/nginx/certs/          # ใบรับรอง TLS ของโดเมน
docker compose -f docker/docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker/docker-compose.prod.yml --env-file .env.prod run --rm migrate \
  tsx prisma/create-admin.ts --email admin@krirk.ac.th --name "ผู้ดูแลระบบ"
curl -fsS https://verify.krirk.ac.th/api/health
sudo cp docker/cron/krirk-verify.cron /etc/cron.d/krirk-verify    # แก้ APP_DIR และผู้ใช้ก่อน
```

สิ่งที่ compose ขึ้นให้: `nginx` (80/443, TLS, ปิด `/api/cron` และ `/api/mock` จากภายนอก) → `app` (Next.js standalone, non-root) → `postgres` (อยู่ในเครือข่ายภายในเท่านั้น) และ `migrate` จะรัน migration + seed ค่าตั้งต้นก่อนแอปเริ่มทุกครั้ง

### Health check

`GET /api/health`

| ผล                          | ความหมาย                                                       |
| --------------------------- | -------------------------------------------------------------- |
| `200 {"status":"ok"}`       | ฐานข้อมูลและระบบทะเบียนปกติ                                    |
| `200 {"status":"degraded"}` | ระบบทะเบียนเชื่อมต่อไม่ได้ แต่ยังค้นหาจากข้อมูลที่ sync ไว้ได้ |
| `503 {"status":"down"}`     | ฐานข้อมูลเชื่อมต่อไม่ได้                                       |

- `?registry=skip` ตรวจเฉพาะฐานข้อมูล (ใช้กับ HEALTHCHECK ของ Docker)

## ตัวแปรสภาพแวดล้อม

ไฟล์ตัวอย่าง: [`.env.example`](.env.example) (dev) และ [`.env.prod.example`](.env.prod.example) (production)

ค่าที่ติดป้าย "ตั้งค่าได้ในระบบ" คือค่าเริ่มต้น เมื่อผู้ดูแลบันทึกค่าในหน้า **ตั้งค่าระบบ** ค่าในหน้านั้นจะใช้แทน

### แอปพลิเคชันและความปลอดภัย

| ตัวแปร                                                |    จำเป็น    | ค่าเริ่มต้น              | คำอธิบาย                                                                                    |
| ----------------------------------------------------- | :----------: | ------------------------ | ------------------------------------------------------------------------------------------- |
| `APP_URL`                                             |      ✔       | —                        | URL สาธารณะของระบบ ใช้สร้างลิงก์ในอีเมลและ permalink                                        |
| `DEFAULT_LOCALE`                                      |              | `th`                     | ค่าเดิมจาก Phase 0 — ปัจจุบันไม่ได้ใช้ (ภาษาเริ่มต้นกำหนดใน `src/i18n/routing.ts`)          |
| `DATABASE_URL`                                        |      ✔       | —                        | PostgreSQL connection string (compose ของ production ประกอบให้จาก `POSTGRES_*`)             |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` |  ✔ (docker)  | —                        | บัญชีและชื่อฐานข้อมูลของ container postgres · รหัสผ่านใช้เฉพาะ a-z A-Z 0-9                  |
| `POSTGRES_PORT` / `ADMINER_PORT` / `MAILPIT_UI_PORT`  |              | `5435` / `8080` / `8025` | พอร์ตของ container สำหรับ dev                                                               |
| `AUTH_SECRET`                                         |      ✔       | —                        | secret เข้ารหัส session (`openssl rand -base64 32`)                                         |
| `AUTH_TRUST_HOST`                                     |      ✔       | —                        | `true` เมื่ออยู่หลัง reverse proxy                                                          |
| `AUTH_URL`                                            | dev เท่านั้น | —                        | **ห้ามตั้งบน production หลัง nginx** เพราะหน้าแรกจะตอบ 500 (ดูคู่มือ deploy)                |
| `AUTH_MAX_FAILED_LOGINS`                              |              | `5`                      | จำนวนครั้งที่ล็อกอินผิดก่อนล็อกบัญชี (ตั้งค่าได้ในระบบ)                                     |
| `AUTH_LOCKOUT_MINUTES`                                |              | `30`                     | ระยะเวลาล็อกบัญชี (นาที)                                                                    |
| `IDENTIFIER_PEPPER`                                   |      ✔       | —                        | pepper ของ HMAC เลขบัตร/พาสปอร์ต (`openssl rand -hex 32`) · **ห้ามเปลี่ยนหลังมีข้อมูลจริง** |
| `ENCRYPTION_KEY`                                      |      ✔       | —                        | คีย์ AES-256-GCM แบบ hex 64 ตัวอักษร · **ห้ามเปลี่ยน/ทำหาย และต้องสำรองแยกจาก backup**      |
| `DATA_RETENTION_DAYS`                                 |              | `1825`                   | ระยะเก็บคำขอก่อน anonymise (ตั้งค่าได้ในระบบ)                                               |
| `CRON_SECRET`                                         |      ✔       | —                        | secret ของ `/api/cron/*` ส่งมาใน header `x-cron-secret` (อย่างน้อย 16 ตัวอักษร)             |

### ระบบทะเบียนและการ sync

| ตัวแปร                  |         จำเป็น          | ค่าเริ่มต้น                   | คำอธิบาย                                                                                                                      |
| ----------------------- | :---------------------: | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `REGISTRY_CLIENT`       |                         | `mock`                        | `keystone` = Keystone Open API ของมหาวิทยาลัย · `http` = API ตามสัญญา `docs/registry-api-spec.md` · `mock` = ข้อมูลสมมติในแอป |
| `REGISTRY_API_URL`      | เมื่อ `http`/`keystone` | —                             | base URL ของ API ทะเบียน                                                                                                      |
| `REGISTRY_API_KEY`      |                         | —                             | `http` ส่งเป็น `Authorization: Bearer ...` · `keystone` ส่งเป็น header `x-api-key`                                            |
| `REGISTRY_TIMEOUT_MS`   |                         | `10000` (`keystone`: `60000`) | timeout ต่อคำขอ (retry 3 ครั้งแบบ exponential backoff)                                                                        |
| `MOCK_REGISTRY_ENABLED` |                         | —                             | `true` เปิด route `/api/mock/registry` และ mock client · production ต้องเป็น `false`                                          |
| `SYNC_PAGE_SIZE`        |                         | `500`                         | จำนวนระเบียนต่อหน้าระหว่าง sync                                                                                               |
| `SYNC_CRON_SCHEDULE`    |                         | `0 2 * * *`                   | แสดงบนหน้าซิงก์เท่านั้น — เวลาจริงตั้งที่ system cron                                                                         |

### โควตาและการตรวจสอบ

| ตัวแปร                     | ค่าเริ่มต้น | คำอธิบาย                                                                       |
| -------------------------- | ----------- | ------------------------------------------------------------------------------ |
| `RATE_LIMIT_USER_PER_HOUR` | `30`        | คำขอเดี่ยวต่อผู้ใช้ต่อชั่วโมง (ตั้งค่าได้ในระบบ)                               |
| `RATE_LIMIT_IP_PER_HOUR`   | `60`        | คำขอต่อ IP ต่อชั่วโมง (ตั้งค่าได้ในระบบ)                                       |
| `BATCH_MAX_ROWS`           | `500`       | โควตาแถวแบบชุดต่อวัน (ตั้งค่าได้ในระบบ) · ไฟล์เดียวรับได้สูงสุด 500 แถว / 2 MB |
| `RATE_LIMIT_BATCH_PER_DAY` | `5`         | ค่าเดิมจาก Phase 0 — ปัจจุบันไม่ได้ใช้ (โควตาแบบชุดนับเป็นแถว)                 |
| `RESULT_LINK_EXPIRES_DAYS` | `90`        | อายุ permalink ผลตรวจสอบ (ตั้งค่าได้ในระบบ)                                    |
| `REVIEW_SLA_HOURS`         | `24`        | SLA ของคำขอที่รอพิจารณา (ตั้งค่าได้ในระบบ)                                     |

### อีเมล

| ตัวแปร                        | ค่าเริ่มต้น                           | คำอธิบาย                                         |
| ----------------------------- | ------------------------------------- | ------------------------------------------------ |
| `SMTP_HOST` / `SMTP_PORT`     | `localhost` / `1025`                  | SMTP ของมหาวิทยาลัย (dev ใช้ Mailpit)            |
| `SMTP_SECURE`                 | `false`                               | `true` เมื่อใช้ TLS ตั้งแต่เชื่อมต่อ (พอร์ต 465) |
| `SMTP_USER` / `SMTP_PASSWORD` | —                                     | ปล่อยว่างถ้า SMTP ไม่ต้องยืนยันตัวตน             |
| `SMTP_FROM`                   | `Krirk Verify <no-reply@krirk.ac.th>` | ผู้ส่ง                                           |

### เฉพาะ Docker / สคริปต์ปฏิบัติการ (`.env.prod`)

| ตัวแปร                     | ค่าเริ่มต้น                      | คำอธิบาย                                                        |
| -------------------------- | -------------------------------- | --------------------------------------------------------------- |
| `NGINX_SERVER_NAME`        | — (จำเป็น)                       | โดเมนที่ nginx ให้บริการ · Host อื่นถูกปฏิเสธ                   |
| `HTTP_PORT` / `HTTPS_PORT` | `80` / `443`                     | พอร์ตที่เปิดบนเครื่อง host                                      |
| `APP_IMAGE` / `APP_TAG`    | `krirk-verify` / `latest`        | ชื่อและแท็กของ image                                            |
| `BACKUP_DIR`               | `./backups`                      | โฟลเดอร์เก็บไฟล์สำรอง                                           |
| `BACKUP_KEEP_DAYS`         | `30`                             | ลบไฟล์สำรองที่เก่ากว่านี้                                       |
| `ADMIN_PASSWORD`           | —                                | ใช้กับ `create-admin.ts` เท่านั้น · ถ้าไม่ตั้งจะสุ่มรหัสผ่านให้ |
| `SEED_DEMO_PASSWORD`       | `Krirk2569`                      | รหัสผ่านบัญชีทดสอบของ seed (dev)                                |
| `E2E_PORT` / `MAILPIT_URL` | `3000` / `http://localhost:8025` | ใช้ตอนรัน Playwright                                            |
