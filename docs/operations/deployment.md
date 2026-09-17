# คู่มือติดตั้งและดูแลระบบ Production — Krirk Verify

> สำหรับทีม IT มหาวิทยาลัย · ครอบคลุม F-OPS-01 ถึง F-OPS-05
> ข้อกำหนดเซิร์ฟเวอร์จริง (spec, OS, นโยบาย SSL/โดเมน) ยังรอจากมหาวิทยาลัย (spec ข้อ 10 รายการที่ 6) — ค่าในคู่มือนี้เป็นค่าแนะนำ

## 1. ภาพรวม

```
อินเทอร์เน็ต ──443──▶ nginx ──3000──▶ app (Next.js standalone) ──5432──▶ postgres
                    │                 │                                    ▲
                    │                 ├──▶ API ระบบทะเบียน (HTTPS)          │
                    │                 └──▶ SMTP มหาวิทยาลัย                 │
                    │                                                       │
   system cron ─────┴── scripts/cron-run.sh (docker compose exec app) ──────┘
                        scripts/backup-db.sh (docker compose exec postgres)
```

| Service | Image | หน้าที่ |
|---------|-------|---------|
| `nginx` | `nginx:1.28-alpine` | TLS, redirect HTTP→HTTPS, HSTS, จำกัดขนาดไฟล์อัปโหลด 3 MB, ปิด `/api/cron/*` และ `/api/mock/*` จากภายนอก, ปฏิเสธ Host ที่ไม่ใช่โดเมนของระบบ |
| `app` | `krirk-verify:<tag>` (target `runner`) | แอป Next.js แบบ standalone · ผู้ใช้ non-root · HEALTHCHECK ทุก 30 วินาที |
| `migrate` | `krirk-verify:<tag>-migrate` (target `migrate`) | `prisma migrate deploy` + seed ค่าตั้งต้น แล้วจบ · compose รันให้ก่อน `app` ทุกครั้ง · ใช้สร้างผู้ดูแลคนแรก |
| `postgres` | `postgres:16-alpine` | ฐานข้อมูล · อยู่ในเครือข่าย `backend` แบบ internal ไม่เปิดพอร์ตออกนอกเครื่อง |

## 2. ข้อกำหนดเซิร์ฟเวอร์ (แนะนำ)

| รายการ | ขั้นต่ำ | แนะนำ |
|--------|--------|-------|
| CPU / RAM | 2 vCPU / 4 GB | 4 vCPU / 8 GB |
| ดิสก์ | 40 GB SSD | 100 GB SSD (ฐานข้อมูล + ไฟล์สำรอง 30 วัน) |
| OS | Linux x86_64 ที่รองรับ Docker Engine (เช่น Ubuntu Server 24.04 LTS) | |
| ซอฟต์แวร์ | Docker Engine 24+ พร้อม Compose v2, git, cron, `sha256sum` | |
| เครือข่ายขาเข้า | 80, 443 | |
| เครือข่ายขาออก | API ระบบทะเบียน, SMTP ของมหาวิทยาลัย, Docker Hub (ตอน build/pull) | |
| เวลา | ตั้ง timezone เป็น `Asia/Bangkok` และเปิด NTP | |

## 3. ติดตั้งครั้งแรก

### 3.1 เตรียมเครื่อง

```bash
sudo timedatectl set-timezone Asia/Bangkok
sudo useradd --system --create-home --groups docker krirk      # ผู้ใช้สำหรับรันระบบและ cron
sudo mkdir -p /opt/krirk-verify /var/log/krirk-verify
sudo chown krirk:krirk /opt/krirk-verify /var/log/krirk-verify
sudo -iu krirk
git clone https://github.com/rattanawong-it/krirk_verify.git /opt/krirk-verify
cd /opt/krirk-verify
```

### 3.2 ตั้งค่า `.env.prod`

```bash
cp .env.prod.example .env.prod
chmod 600 .env.prod
```

แก้ทุกค่าที่เป็น `change-me` ด้วยคำสั่งสร้างค่าที่ระบุในไฟล์ แล้วตรวจอีกครั้งด้วย `grep change-me .env.prod` (ต้องไม่พบ) ตารางอธิบายตัวแปรทั้งหมดอยู่ใน [README](../../README.md#ตัวแปรสภาพแวดล้อม)

ข้อควรระวัง:

- **`ENCRYPTION_KEY` และ `IDENTIFIER_PEPPER`** — จดเก็บไว้ในที่ปลอดภัยแยกจากเซิร์ฟเวอร์ (เช่น password manager ของหน่วยงาน) ทันที ถ้าหายจะอ่านเลขบัตรที่เข้ารหัสและค้นหาข้อมูลเดิมไม่ได้อีก และห้ามเปลี่ยนหลังเปิดใช้งาน
- **ห้ามตั้ง `AUTH_URL`** — Auth.js จะแทน origin ของคำขอด้วยค่านี้ ทำให้ rewrite ภาษาของ `proxy.ts` กลายเป็นคำขอออกไปนอก container และหน้าแรกตอบ 500 · ใช้ `AUTH_TRUST_HOST=true` ซึ่งอ่าน `X-Forwarded-*` จาก nginx แทน
- **`POSTGRES_PASSWORD`** ใช้เฉพาะ a-z A-Z 0-9 (ถูกประกอบเป็น URL) — `openssl rand -hex 24`
- **`MOCK_REGISTRY_ENABLED=false`** และ `REGISTRY_CLIENT=http` บน production · เครื่อง UAT ที่ยังไม่มี API จริงใช้ `REGISTRY_CLIENT=mock` + `MOCK_REGISTRY_ENABLED=true` ได้
- ชื่อไฟล์ต้องเป็น `.env.prod` — ไม่ใช้ `.env.production` เพราะ `next build` บนเครื่อง dev จะอ่านไฟล์ชื่อนั้นเอง

### 3.3 ใบรับรอง TLS

วางไฟล์ของโดเมนตาม `NGINX_SERVER_NAME`:

```
docker/nginx/certs/fullchain.pem   # ใบรับรอง + intermediate
docker/nginx/certs/privkey.pem     # private key (chmod 600)
```

โฟลเดอร์นี้ถูก ignore ใน git แล้ว · ต่ออายุใบรับรองแล้วโหลดใหม่ด้วย `docker compose ... exec nginx nginx -s reload`

สำหรับเครื่องทดสอบที่ยังไม่มีใบรับรองจริง ใช้ self-signed ชั่วคราว:

```bash
openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj "/CN=verify-uat.krirk.ac.th" \
  -keyout docker/nginx/certs/privkey.pem -out docker/nginx/certs/fullchain.pem
```

### 3.4 Build และเริ่มระบบ

```bash
alias kv='docker compose -f docker/docker-compose.prod.yml --env-file .env.prod'
kv build                      # ~3–5 นาทีครั้งแรก
kv up -d
kv ps                         # app = healthy, migrate = exited (0)
kv logs migrate               # "All migrations have been successfully applied."
curl -fsS https://verify.krirk.ac.th/api/health
```

ถ้าเซิร์ฟเวอร์ออกอินเทอร์เน็ตไม่ได้ ให้ build บนเครื่องอื่นแล้วย้าย image:

```bash
# เครื่อง build
docker build -f docker/Dockerfile --target runner  -t krirk-verify:1.0.0 .
docker build -f docker/Dockerfile --target migrate -t krirk-verify:1.0.0-migrate .
docker save krirk-verify:1.0.0 krirk-verify:1.0.0-migrate nginx:1.28-alpine postgres:16-alpine | gzip > krirk-verify-1.0.0.tar.gz
# เซิร์ฟเวอร์: ตั้ง APP_TAG=1.0.0 ใน .env.prod
gunzip -c krirk-verify-1.0.0.tar.gz | docker load
kv up -d --no-build
```

### 3.5 สร้างผู้ดูแลระบบคนแรก

seed บน production สร้างเฉพาะค่าตั้งต้น ไม่สร้างบัญชี ให้สร้างผู้ดูแลคนแรกด้วยคำสั่ง:

```bash
kv run --rm migrate tsx prisma/create-admin.ts --email admin@krirk.ac.th --name "ผู้ดูแลระบบ"
```

- ระบบจะพิมพ์ **รหัสผ่านชั่วคราว** ออกมาครั้งเดียว — ล็อกอินแล้วเปลี่ยนที่หน้า **โปรไฟล์ → เปลี่ยนรหัสผ่าน** ทันที (หรือกำหนดเอง: `kv run --rm -e ADMIN_PASSWORD=... migrate tsx prisma/create-admin.ts ...`)
- คำสั่งนี้ทำงานเฉพาะเมื่อยังไม่มี ADMIN ที่ใช้งานอยู่ · ผู้ดูแลและเจ้าหน้าที่คนถัดไปเพิ่มจากหน้า **ผู้ใช้ระบบ → เพิ่มผู้ใช้** (ระบบส่งอีเมลเชิญตั้งรหัสผ่าน)
- การสร้างบัญชีถูกบันทึกใน Audit Log (`user.created`, `source: cli`)

### 3.6 ตรวจหลังติดตั้ง

- [ ] `https://<โดเมน>/api/health` ได้ `"status":"ok"` (ถ้า `degraded` ให้ตรวจ `REGISTRY_*`)
- [ ] `http://<โดเมน>` redirect ไป https และ response มี `Strict-Transport-Security`
- [ ] `https://<โดเมน>/api/cron/sync` และ `/api/mock/registry/health` ตอบ 404
- [ ] ล็อกอินผู้ดูแล → หน้า **ซิงก์ข้อมูล** แสดงสถานะการเชื่อมต่อระบบทะเบียนเป็นปกติ → กด **ซิงก์ทั้งหมดตอนนี้**
- [ ] หน้า **ตั้งค่าระบบ** ตรวจค่า SLA / โควตา / ระยะเก็บข้อมูล
- [ ] เพิ่มผู้ใช้ทดสอบ → ได้รับอีเมลเชิญ (ถ้าไม่ได้ ตรวจหน้า **ประวัติอีเมล**)
- [ ] ติดตั้ง cron (ข้อ 4) และทดสอบ `scripts/backup-db.sh` หนึ่งครั้ง (ข้อ 5)

## 4. งานตามรอบ (system cron) — F-OPS-05

แอปไม่มีตัวตั้งเวลาภายใน งานตามรอบทั้งหมดเรียกจาก cron ของเครื่อง host ผ่าน `scripts/cron-run.sh` ซึ่งยิงคำขอ **จากภายใน container `app`**:

- `CRON_SECRET` ไม่ปรากฏใน command line หรือ log ของเครื่อง host
- nginx ปิด `/api/cron/*` จากภายนอกได้ทั้งหมด

| งาน | คำสั่ง | รอบที่แนะนำ | หมายเหตุ |
|-----|--------|-------------|----------|
| สำรองฐานข้อมูล | `scripts/backup-db.sh` | ทุกวัน 01:30 | ดู [backup-restore.md](backup-restore.md) |
| Retention | `scripts/cron-run.sh retention` | ทุกวัน 01:45 | anonymise คำขอ + ลบ Audit Log ประวัติอีเมล และงานแบบชุดที่พ้นกำหนด (งานที่ไม่ได้ยืนยันเกิน 7 วัน) · ทำเสร็จก่อนตอบกลับ |
| Sync เต็ม | `scripts/cron-run.sh sync-full` | ทุกวัน 02:00 | ตอบ 202 แล้วทำต่อเบื้องหลัง · ดูผลที่หน้าซิงก์ข้อมูล · ต้องตรงกับ `SYNC_CRON_SCHEDULE` |
| Sync เฉพาะที่เปลี่ยน | `scripts/cron-run.sh sync-incremental` | ทุกชั่วโมงในเวลาทำการ (ไม่บังคับ) | เปิดเมื่อ API ทะเบียนรองรับ `updatedSince` |
| ส่งอีเมลซ้ำ | `scripts/cron-run.sh email-retry` | ทุก 15 นาที | retry 4 รอบ (5/30/120/360 นาที) แล้วรอผู้ดูแลกดส่งซ้ำ · อีเมลที่ค้างสถานะรอส่งเกิน 30 นาทีถูกส่งซ้ำในรอบนี้ |
| กู้คืนงานแบบชุด | `scripts/cron-run.sh batch-recovery` | ทุก 15 นาที | งานที่ค้าง "กำลังประมวลผล" เกิน 10 นาที (เช่น หลังรีสตาร์ต) ถูกทำต่อ · แถวที่ยื่นไปแล้วไม่ถูกยื่นซ้ำ |
| สรุปคิวรายวัน | `scripts/cron-run.sh queue-digest` | 08:30 จันทร์–ศุกร์ | ส่งเมื่อเปิดในตั้งค่าระบบ และมีคำขอรอพิจารณา |
| สรุปรายเดือน | `scripts/cron-run.sh monthly-report` | 06:00 วันที่ 1 | ส่งเมื่อเปิดในตั้งค่าระบบ |

ติดตั้งจากไฟล์ตัวอย่าง [`docker/cron/krirk-verify.cron`](../../docker/cron/krirk-verify.cron):

```bash
sudo cp docker/cron/krirk-verify.cron /etc/cron.d/krirk-verify
sudo chmod 644 /etc/cron.d/krirk-verify
sudoedit /etc/cron.d/krirk-verify        # ตรวจ APP_DIR และชื่อผู้ใช้ (คอลัมน์ที่ 6)
```

หมุนเวียนไฟล์ log — `/etc/logrotate.d/krirk-verify`:

```
/var/log/krirk-verify/*.log {
    weekly
    rotate 12
    compress
    missingok
    notifempty
    copytruncate
}
```

ทดสอบด้วยมือ (ผลลัพธ์เป็น JSON ของแต่ละ endpoint):

```bash
scripts/cron-run.sh retention
# [2026-09-16 21:47:08] สำเร็จ retention: {"at":"...","anonymized":0,"auditDeleted":0,"trigger":"cron"}
```

## 5. สำรองและกู้คืนข้อมูล — F-OPS-04

ดู [`backup-restore.md`](backup-restore.md)

## 6. อัปเดตเวอร์ชัน

```bash
cd /opt/krirk-verify
scripts/backup-db.sh                      # สำรองก่อนทุกครั้ง
git fetch --tags && git checkout <tag หรือ commit>
kv build
kv up -d                                  # migrate รันก่อน app เสมอ · compose หยุด app เดิมแล้วเริ่มตัวใหม่ จึงมี downtime สั้น ๆ
kv ps && curl -fsS https://<โดเมน>/api/health
docker image prune -f
```

- migration ของ Prisma เดินหน้าอย่างเดียว ถ้าเวอร์ชันใหม่มีปัญหาหลัง migrate ให้ย้อนด้วย **กู้คืนไฟล์สำรองก่อนอัปเดต + checkout เวอร์ชันเดิม** (ดู backup-restore.md ข้อ 4)
- ระหว่างอัปเดต งานเบื้องหลังที่กำลังรันอยู่จะถูกตัด แล้วกู้คืนเอง: งานแบบชุดทำต่อภายใน ~25 นาที (`batch-recovery`) · อีเมลที่ค้างถูกส่งซ้ำภายใน ~45 นาที (`email-retry`) · sync ที่ค้างปลดล็อกเองหลัง 1 ชั่วโมง — ถ้าเลี่ยงได้ ให้อัปเดตช่วงที่หน้า **ซิงก์ข้อมูล** ไม่มีสถานะ "กำลังรัน"

## 7. เฝ้าระวัง

| สิ่งที่ดู | วิธี |
|----------|------|
| ระบบล่ม | ตั้ง uptime monitor เรียก `https://<โดเมน>/api/health` ทุก 1–5 นาที · แจ้งเตือนเมื่อไม่ใช่ 200 |
| ระบบทะเบียนล่ม | `status` เป็น `degraded` ค้างนาน · หน้า **ซิงก์ข้อมูล** แสดงรหัสข้อผิดพลาด |
| sync ล้มเหลว | หน้า **ซิงก์ข้อมูล** (ประวัติ) · `grep ล้มเหลว /var/log/krirk-verify/cron.log` |
| อีเมลส่งไม่ออก | หน้า **ประวัติอีเมล** กรองสถานะ "ส่งไม่สำเร็จ" |
| สำรองข้อมูลไม่สำเร็จ | `grep "✖" /var/log/krirk-verify/cron.log` · ตรวจว่ามีไฟล์ใหม่ใน `backups/` ทุกวัน |
| log ของแอป | `kv logs --since 1h app` |
| พื้นที่ดิสก์ | `docker system df` และขนาดโฟลเดอร์ `backups/` |

## 8. แก้ปัญหาที่พบบ่อย

| อาการ | สาเหตุ / วิธีแก้ |
|-------|------------------|
| หน้าแรกตอบ 500 · log มี `Failed to proxy https://...` | ตั้ง `AUTH_URL` ไว้ → ลบออกจาก `.env.prod` แล้ว `kv up -d app` |
| กดปุ่มในฟอร์มแล้วไม่เกิดอะไร · log มี `Invalid Server Actions request` | `X-Forwarded-Host` ไม่ตรงกับ Origin ของเบราว์เซอร์ · ถ้ามี load balancer อีกชั้นหน้า nginx ต้องส่ง Host เดิมต่อมา |
| Audit Log บันทึก IP เป็น 172.x.x.x ทุกคำขอ | มี proxy/load balancer อีกชั้นหน้า nginx หรือ Docker ใช้ userland-proxy · ตั้ง `set_real_ip_from <IP ของ LB>; real_ip_header X-Forwarded-For;` ใน nginx template |
| อัปโหลดไฟล์แบบชุดแล้วได้ 413 | ไฟล์เกิน 3 MB (ระบบรับ 2 MB) |
| `migrate` exit ไม่เป็น 0 | `kv logs migrate` · ส่วนใหญ่คือ `POSTGRES_*` ไม่ตรงกับ volume เดิม (รหัสผ่านถูกตั้งตอนสร้าง volume ครั้งแรกเท่านั้น) |
| `app` ไม่ healthy | `kv logs app` · ตรวจ `ENCRYPTION_KEY` (hex 64 ตัว), `IDENTIFIER_PEPPER` (≥ 32 ตัว), ฐานข้อมูล |
| หน้าแรกไม่แสดงประกาศทันทีหลัง deploy | หน้าแรกและนโยบายสร้างตอน build ด้วยค่าเริ่มต้น แล้วสร้างใหม่ด้วยค่าจริงเมื่อมีผู้เปิดครั้งแรก (ภายใน 5 นาที) · บันทึกในหน้าตั้งค่าจะอัปเดตทันที |
| cron ไม่ทำงาน | ผู้ใช้ในคอลัมน์ที่ 6 ต้องอยู่ในกลุ่ม `docker` · ไฟล์ใน `/etc/cron.d` ต้องไม่มีจุดในชื่อและลงท้ายด้วยบรรทัดว่าง |
| `cron-run.sh` ได้ `wget: server returned error: HTTP/1.1 401` | `CRON_SECRET` ใน `.env.prod` สั้นกว่า 16 ตัวหรือยังเป็น `change-me` · แก้แล้ว `kv up -d app` |
| `cron-run.sh sync-full` ได้ `409` | มี sync กำลังรันอยู่ (ล็อกจะหลุดเองเมื่อค้างเกินกำหนด) |
