# Software Requirements Specification
# ระบบตรวจสอบวุฒิการศึกษาออนไลน์ (Krirk Verify)

| รายการ | รายละเอียด |
|--------|------------|
| ชื่อโครงการ | ระบบตรวจสอบวุฒิการศึกษาออนไลน์ สำหรับสถาบันอุดมศึกษา |
| รหัสโครงการ | `krirk_verify` |
| เวอร์ชันเอกสาร | 1.0 |
| วันที่ | 12 กันยายน 2569 (2026-09-12) |
| สถานะ | รอการอนุมัติเพื่อเริ่มพัฒนา |
| ที่มา | สัมภาษณ์เก็บ Requirements ในบทบาท Product Manager / System Analyst / Software Architect |

> **ข้อตกลงการทำงาน:** ทุกครั้งที่จะมีการแก้ไข/เปลี่ยนแปลงจากเอกสารฉบับนี้ ต้องแจ้งและขออนุมัติก่อนดำเนินการทุกครั้ง

---

## 1. บทนำ (Context)

### 1.1 ปัญหาปัจจุบัน

การตรวจสอบวุฒิการศึกษาของผู้สำเร็จการศึกษาถูกร้องขอจากหน่วยงานภายนอก (ฝ่าย HR บริษัท, หน่วยงานราชการ, สถาบันการศึกษาอื่น) ผ่านช่องทาง manual — หนังสือราชการ อีเมล โทรศัพท์ ส่งผลให้:

- เจ้าหน้าที่ทะเบียนต้องค้นข้อมูลทีละราย ใช้เวลานาน
- ผู้ขอไม่ทราบสถานะคำขอของตน ต้องโทรติดตาม
- ไม่มีหลักฐานการเข้าถึงข้อมูลที่ตรวจสอบย้อนหลังได้
- เสี่ยงต่อการไม่สอดคล้องกับ พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)

### 1.2 ผลลัพธ์ที่ต้องการ

ระบบเว็บแอปพลิเคชันที่หน่วยงานภายนอกลงทะเบียนและยื่นคำขอตรวจสอบวุฒิได้ด้วยตนเอง ระบบจับคู่ข้อมูลอัตโนมัติเมื่อข้อมูลตรงชัดเจน และส่งเข้าคิวให้เจ้าหน้าที่ทะเบียนพิจารณาเมื่อข้อมูลกำกวม พร้อมบันทึก Audit Log ครบถ้วนตาม PDPA

### 1.3 ขอบเขตโครงการ

- **In scope:** การตรวจสอบวุฒิของผู้สำเร็จการศึกษา, การบริหารจัดการคำขอ, รายงานสถิติ, การตรวจสอบแบบชุด
- **Out of scope (Phase 1):** การออกเอกสาร PDF พร้อมลายเซ็นดิจิทัล, การชำระค่าธรรมเนียม, การออกทรานสคริปต์, การเชื่อมต่อ Blockchain

### 1.4 สถานะเริ่มต้น

ไดเรกทอรี `C:\Users\Lenovo\Documents\itgenius\krirk_verify` ปัจจุบันว่างเปล่า เป็นโปรเจกต์ใหม่ทั้งหมด (greenfield) ยังไม่ได้ init git

---

## 2. สรุปผลการสัมภาษณ์ (Requirements ที่ยืนยันแล้ว)

| # | หัวข้อ | ข้อสรุปจากผู้ใช้ |
|---|--------|------------------|
| R-01 | ผู้ใช้งาน | 4 บทบาท: หน่วยงานภายนอก, นักศึกษา/ศิษย์เก่า, เจ้าหน้าที่ทะเบียน, ผู้ดูแลระบบ |
| R-02 | รูปแบบผลลัพธ์ | **แสดงผลบนหน้าเว็บอย่างเดียว** — ไม่ออก PDF / ไม่ทำลายเซ็นดิจิทัลใน Phase 1 |
| R-03 | ข้อมูลนักศึกษา | รับจาก API ระบบทะเบียน แล้ว **Sync เก็บลง PostgreSQL** |
| R-04 | Authentication | Auth.js (NextAuth v5) แบบ Credentials + RBAC ภายในระบบ |
| R-05 | Flow คำขอ | **Hybrid** — auto-approve ถ้าข้อมูลตรงชัดเจน / เข้าคิวเจ้าหน้าที่ถ้ากำกวม |
| R-06 | คีย์ค้นหา | เลขบัตรประจำตัวประชาชน และ เลขที่หนังสือเดินทาง (passport) |
| R-07 | ข้อมูลที่แสดงผล | ชื่อ-นามสกุล, รหัสนักศึกษา, ระดับการศึกษา, วุฒิ/หลักสูตร/สาขาวิชา/คณะ, สถานภาพ + วันสำเร็จการศึกษา, GPA + เกียรตินิยม |
| R-08 | ค่าธรรมเนียม | ไม่มี — ฟรีทั้งหมด (ไม่ต่อ Payment Gateway) |
| R-09 | API ต้นทาง | ยังไม่มี spec → สร้าง **Mock API + Adapter Layer** ไว้ก่อน |
| R-10 | Deployment | **On-premise** เซิร์ฟเวอร์มหาวิทยาลัย ผ่าน Docker |
| R-11 | ภาษา | ไทย + อังกฤษ (i18n) |
| R-12 | โมดูลเสริม | Dashboard + รายงานสถิติ, Audit Log เต็มรูปแบบ, ตรวจสอบแบบ Batch, แจ้งเตือนทาง Email |

---

## 3. ผู้ใช้งานและสิทธิ์ (User Roles)

| บทบาท | Enum | สิทธิ์หลัก |
|-------|------|-----------|
| ผู้ดูแลระบบ | `ADMIN` | ทุกสิทธิ์ + จัดการผู้ใช้ + ตั้งค่าระบบ + ดู Audit Log |
| เจ้าหน้าที่ทะเบียน | `REGISTRAR` | พิจารณาคำขอ, ค้นหาข้อมูลนักศึกษา, อนุมัติหน่วยงาน, ดูรายงาน |
| หน่วยงานภายนอก | `EXTERNAL` | ยื่นคำขอตรวจสอบ (เดี่ยว/batch), ดูผลและประวัติคำขอของตน |
| นักศึกษา/ศิษย์เก่า | `ALUMNI` | ตรวจสอบวุฒิของตนเอง, สร้างลิงก์ยืนยันเพื่อส่งให้หน่วยงาน |

---

## 4. ข้อสังเกตเชิงวิเคราะห์ (System Analyst Notes)

### 4.1 คีย์ค้นหา vs. ข้อมูลแสดงผล

ผู้ขอค้นด้วยเลขบัตร/พาสปอร์ต แต่ได้รหัสนักศึกษาเป็นผลลัพธ์ — ถูกต้องตามสถานการณ์จริง เพราะ HR มีเพียงสำเนาบัตรจากผู้สมัครงาน ไม่ทราบรหัสนักศึกษา

### 4.2 นิยาม "auto ถ้าตรง"

ระบบจะ auto-approve ก็ต่อเมื่อครบทุกเงื่อนไขต่อไปนี้:

1. เลขบัตร/พาสปอร์ตตรงแบบ **exact match**
2. พบผลลัพธ์ **เพียง 1 รายการ**
3. สถานภาพเป็น `GRADUATED` และมีวันสำเร็จการศึกษา + วันสภาอนุมัติครบ
4. ข้อมูลไม่ถูกตั้งค่า `requiresManualReview` (เช่น ถูกเพิกถอนวุฒิ, มีข้อพิพาท, ข้อมูลเก่าก่อนระบบดิจิทัล)

**นอกเหนือจากนี้ทั้งหมด → `PENDING_REVIEW` เข้าคิวเจ้าหน้าที่**

### 4.3 ความน่าเชื่อถือเมื่อไม่มี PDF

ออกแบบให้แต่ละคำขอมี **เลขอ้างอิง (Reference No.)** และ **permalink ที่ตรวจซ้ำได้** เช่น `/verify/result/KRU-2569-000123` ผู้รับเอกสารสามารถเปิด URL เดิมเพื่อยืนยันว่าผลไม่ถูกปลอมแปลง

### 4.4 Result Snapshot

ต้องเก็บ snapshot ข้อมูล ณ เวลาที่อนุมัติแยกจากตาราง `Student` เพราะข้อมูลต้นทางอาจเปลี่ยน (เช่น แก้ชื่อ, เพิกถอนวุฒิ) แต่ผลที่เคยออกไปต้องคงเดิมและตรวจสอบย้อนหลังได้

### 4.5 ข้อกำหนด PDPA

เลขบัตรประชาชนเป็นข้อมูลอ่อนไหว ต้อง:

- เก็บเป็น **HMAC-SHA256 hash** (มี pepper จาก env) สำหรับใช้ค้นหา + เก็บ ciphertext (AES-256-GCM) สำหรับกรณีที่เจ้าหน้าที่ต้องดู
- แสดงผลแบบ mask เสมอ (`1-2345-xxxxx-xx-3`)
- มี consent checkbox บังคับก่อนยื่นคำขอ พร้อมบันทึกเวลา
- Audit ทุกการเข้าถึง พร้อม IP / User-Agent
- มี data retention policy (ลบ/anonymize คำขอที่เก่ากว่า N ปี ตั้งค่าได้)

### 4.6 Sync Strategy

ใช้ 2 จังหวะ:
- **(ก)** Full sync ตามรอบกลางคืน
- **(ข)** On-demand refresh รายคนเมื่อเจ้าหน้าที่กดปุ่ม

เพื่อให้ระบบยังใช้งานได้แม้ API ต้นทางล่ม

---

## 5. สถาปัตยกรรมระบบ (Software Architecture)

### 5.1 Tech Stack

| ชั้น | เทคโนโลยี | เหตุผล |
|------|-----------|--------|
| Framework | **Next.js 16 (App Router)** + React 19 | ตามที่กำหนด — ใช้ Server Components + Server Actions |
| ภาษา | **TypeScript** (strict mode) | ตามที่กำหนด |
| ORM | **Prisma** | ตามที่กำหนด |
| ฐานข้อมูล | **PostgreSQL 16** | ตามที่กำหนด |
| Styling | **Tailwind CSS v4** (CSS-first config) | ตามที่กำหนด |
| UI Components | **shadcn/ui** | ตามที่กำหนด |
| Package Manager | **pnpm** | ตามที่กำหนด |
| Authentication | Auth.js v5 (NextAuth) + bcrypt | R-04 |
| i18n | `next-intl` | R-11 — รองรับ App Router + Server Components ดีที่สุด |
| Validation | Zod + React Hook Form | ใช้ schema เดียวกันทั้ง client/server |
| ตาราง | TanStack Table v8 | คิวงาน/รายการนักศึกษา ต้อง sort/filter/paginate |
| กราฟ | Recharts | Dashboard สถิติ |
| Email | Nodemailer (SMTP มหาวิทยาลัย) | On-premise ใช้ SMTP ภายในได้เลย |
| Excel/CSV | `exceljs` + `papaparse` | Export รายงาน + Import batch |
| Rate Limit | `rate-limiter-flexible` (PostgreSQL backend) | กัน brute-force เลขบัตร |
| Container | Docker + Docker Compose | R-10 |
| Test | Vitest (unit) + Playwright (e2e) | ทดสอบ business rules การจับคู่เป็นหลัก |

> **หมายเหตุสถาปนิก:** ไม่ใช้ Redis ในเฟสแรก — ใช้ PostgreSQL เป็น backing store ของ rate limit และ job queue เพื่อลดจำนวน service ที่ทีม IT มหาวิทยาลัยต้องดูแล หากปริมาณโหลดสูงขึ้นค่อยเพิ่มภายหลัง

### 5.2 โครงสร้างไดเรกทอรี

```
krirk_verify/
├─ docker/
│  ├─ Dockerfile                      # multi-stage build (standalone output)
│  └─ docker-compose.yml              # app + postgres + adminer
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  └─ seed.ts                         # ผู้ใช้ตั้งต้น + ข้อมูลตัวอย่าง
├─ messages/
│  ├─ th.json
│  └─ en.json
├─ src/
│  ├─ app/
│  │  ├─ [locale]/
│  │  │  ├─ (public)/                 # ไม่ต้องล็อกอิน
│  │  │  │  ├─ page.tsx               # หน้าแรก + คำอธิบายบริการ
│  │  │  │  ├─ login/
│  │  │  │  ├─ register/              # ลงทะเบียนหน่วยงาน/ศิษย์เก่า
│  │  │  │  └─ verify/result/[refNo]/ # permalink ตรวจซ้ำ (ต้องมี access token)
│  │  │  ├─ (portal)/                 # EXTERNAL + ALUMNI
│  │  │  │  ├─ dashboard/
│  │  │  │  ├─ requests/              # รายการคำขอของฉัน
│  │  │  │  ├─ requests/new/          # ยื่นคำขอใหม่
│  │  │  │  ├─ requests/[refNo]/      # รายละเอียด + ผลตรวจสอบ
│  │  │  │  ├─ batch/                 # ตรวจสอบแบบชุด
│  │  │  │  └─ profile/
│  │  │  └─ (staff)/staff/            # REGISTRAR + ADMIN — URL ขึ้นต้น /staff (กัน /dashboard ชนกับ portal)
│  │  │     ├─ dashboard/             # สถิติ + กราฟ
│  │  │     ├─ queue/                 # คิวคำขอรออนุมัติ
│  │  │     ├─ queue/[refNo]/         # หน้าพิจารณา
│  │  │     ├─ students/              # ค้นหา/ดูข้อมูลผู้สำเร็จการศึกษา
│  │  │     ├─ organizations/         # อนุมัติหน่วยงาน
│  │  │     ├─ reports/               # รายงาน + export
│  │  │     ├─ audit-logs/            # ADMIN เท่านั้น
│  │  │     ├─ users/                 # ADMIN เท่านั้น
│  │  │     ├─ sync/                  # สถานะการ sync ข้อมูล
│  │  │     └─ settings/              # ADMIN เท่านั้น
│  │  └─ api/
│  │     ├─ auth/[...nextauth]/
│  │     ├─ cron/sync/                # เรียกจาก system cron (ป้องกันด้วย secret)
│  │     └─ mock/registry/            # Mock API ระบบทะเบียน (ปิดได้ด้วย env)
│  ├─ components/
│  │  ├─ ui/                          # shadcn/ui
│  │  ├─ forms/
│  │  ├─ layout/                      # app shell, sidebar, mobile nav
│  │  └─ features/                    # แยกตาม domain
│  ├─ lib/
│  │  ├─ auth/                        # config, rbac, guards
│  │  ├─ db/                          # prisma client singleton
│  │  ├─ crypto/                      # hashCitizenId, encrypt, mask
│  │  ├─ integrations/registry/
│  │  │  ├─ types.ts                  # RegistryClient interface + Zod DTO
│  │  │  ├─ mock-client.ts
│  │  │  ├─ http-client.ts            # ใช้เมื่อได้ spec จริง
│  │  │  └─ index.ts                  # factory เลือกตาม env
│  │  ├─ services/                    # business logic (ไม่พึ่ง React)
│  │  │  ├─ verification.service.ts   # หัวใจ: matching + auto/manual decision
│  │  │  ├─ sync.service.ts
│  │  │  ├─ batch.service.ts
│  │  │  ├─ audit.service.ts
│  │  │  └─ notification.service.ts
│  │  ├─ validations/                 # Zod schemas ใช้ร่วม client/server
│  │  └─ utils/
│  ├─ actions/                        # Server Actions (บาง — เรียก service)
│  ├─ types/
│  ├─ i18n/
│  └─ proxy.ts                        # locale + auth guard (Next.js 16 เปลี่ยนชื่อจาก middleware.ts)
└─ tests/
   ├─ unit/
   └─ e2e/
```

**หลักการแบ่งชั้น:** Server Action / Route Handler ทำหน้าที่ auth + validate + เรียก service เท่านั้น — **business logic ทั้งหมดอยู่ใน `lib/services/`** เพื่อให้เขียน unit test ได้โดยไม่ต้องผ่าน HTTP

### 5.3 Data Model (Prisma)

| Model | หน้าที่ | ฟิลด์สำคัญ |
|-------|---------|------------|
| `User` | ผู้ใช้ทุกบทบาท | `email`, `passwordHash`, `role`, `organizationId?`, `status`, `emailVerifiedAt` |
| `Organization` | หน่วยงานภายนอก | `nameTh/En`, `taxId`, `contactEmail`, `phone`, `address`, `status` (PENDING/APPROVED/SUSPENDED) |
| `Student` | ข้อมูลผู้สำเร็จการศึกษา (sync) | `studentCode`, `citizenIdHash` (unique idx), `citizenIdEnc`, `passportNoHash`, ชื่อ th/en, `educationLevel`, `degreeNameTh/En`, `programTh/En`, `majorTh/En`, `facultyTh/En`, `gpa`, `honors`, `status`, `graduationDate`, `councilApprovalDate`, `requiresManualReview`, `sourceUpdatedAt` |
| `VerificationRequest` | คำขอตรวจสอบ | `refNo` (unique), `requesterId`, `searchType`, `searchValueHash`, `purpose`, `status`, `matchedStudentId?`, `decisionType` (AUTO/MANUAL), `decidedById?`, `decidedAt?`, `rejectReason?`, `consentAt`, `ipAddress`, `userAgent`, `accessToken`, `expiresAt` |
| `VerificationResult` | Snapshot ผลที่อนุมัติแล้ว (immutable) | 1:1 กับ request — เก็บทุกฟิลด์ที่แสดงผลตาม R-07 |
| `BatchJob` / `BatchItem` | ตรวจสอบแบบชุด | `fileName`, `totalRows`, `processedRows`, `status` / `rowNo`, `searchValue`, `resultStatus`, `requestId?` |
| `AuditLog` | บันทึกการเข้าถึง | `actorId?`, `action`, `entityType`, `entityId`, `ipAddress`, `userAgent`, `metadata` (Json), `createdAt` |
| `SyncJob` | ประวัติการ sync | `type` (FULL/INCREMENTAL/SINGLE), `status`, `recordsFetched`, `recordsUpserted`, `errorMessage`, timestamps |
| `EmailLog` | ประวัติอีเมล | `to`, `template`, `status`, `sentAt`, `errorMessage` |
| `AppSetting` | ตั้งค่าระบบ | `key`, `value` (Json) — retention days, auto-approve on/off, ข้อความประกาศ |

**Enums**

| Enum | ค่า |
|------|-----|
| `Role` | `ADMIN` / `REGISTRAR` / `EXTERNAL` / `ALUMNI` |
| `RequestStatus` | `DRAFT` / `PENDING_REVIEW` / `APPROVED` / `REJECTED` / `NOT_FOUND` / `EXPIRED` |
| `StudentStatus` | `GRADUATED` / `STUDYING` / `WITHDRAWN` / `REVOKED` |
| `SearchType` | `CITIZEN_ID` / `PASSPORT` |
| `OrgStatus` | `PENDING` / `APPROVED` / `SUSPENDED` |

### 5.4 Business Rule หลัก — `verification.service.ts`

```
submitRequest(input, actor)
  1. validate input (Zod) + ตรวจ consent
  2. rate limit check (per user + per IP)
  3. hash คีย์ค้นหา → ค้นใน Student
  4. สร้าง VerificationRequest (status = PENDING_REVIEW)
  5. ประเมินเงื่อนไข auto-approve (ดูข้อ 4.2)
     ├─ ผ่าน  → status = APPROVED, decisionType = AUTO, สร้าง VerificationResult snapshot
     ├─ พบ 0 รายการ → status = PENDING_REVIEW (ยังไม่บอกผู้ขอว่า "ไม่พบ" ทันที
     │                  เพื่อกัน enumeration attack — ให้เจ้าหน้าที่ยืนยันก่อน)
     └─ อื่นๆ → status = PENDING_REVIEW + ตั้ง reviewReason
  6. บันทึก AuditLog + ส่ง Email แจ้งผู้ขอ (และแจ้งเจ้าหน้าที่ถ้าเข้าคิว)
```

---

## 6. Feature Checklist

> รูปแบบ ID: `F-<โมดูล>-<ลำดับ>` — ใช้อ้างอิงใน commit message และ PR
> สถานะ: `[ ]` ยังไม่เริ่ม · `[~]` กำลังทำ · `[x]` เสร็จ

### Phase 0 — Project Foundation
- [x] **F-SETUP-01** init Next.js 16 (App Router, TypeScript, src dir) ด้วย pnpm
- [x] **F-SETUP-02** ตั้งค่า Tailwind CSS v4 (CSS-first) + ธีมสีมหาวิทยาลัย + รองรับ dark mode
- [x] **F-SETUP-03** ติดตั้ง shadcn/ui + component พื้นฐาน (button, input, table, dialog, form, badge, card, select, sonner)
- [x] **F-SETUP-04** ตั้งค่า ESLint + Prettier + TypeScript strict + husky pre-commit
- [x] **F-SETUP-05** `docker-compose.yml` สำหรับ PostgreSQL (dev) + `.env.example` ครบทุกตัวแปร
- [x] **F-SETUP-06** ตั้งค่า Prisma + client singleton + script `db:migrate` / `db:seed` / `db:studio`
- [x] **F-SETUP-07** ตั้งค่า Vitest + Playwright + CI script

> บันทึกสรุป Phase 0: [`docs/phases/phase-0-foundation.md`](phases/phase-0-foundation.md)

### Phase 1 — Authentication & Authorization
- [x] **F-AUTH-01** Prisma schema: `User`, `Organization` + migration
- [x] **F-AUTH-02** ตั้งค่า Auth.js v5 (Credentials provider, bcrypt, JWT session, role ใน token)
- [x] **F-AUTH-03** หน้า Login + validation + error message สองภาษา
- [x] **F-AUTH-04** หน้าลงทะเบียนหน่วยงานภายนอก (ข้อมูลองค์กร + ผู้ติดต่อ) → สถานะ PENDING
- [x] **F-AUTH-05** หน้าลงทะเบียนศิษย์เก่า (ยืนยันด้วยรหัสนักศึกษา + เลขบัตรที่ตรงกับข้อมูลใน DB)
- [x] **F-AUTH-06** ยืนยันอีเมลด้วย token + หน้ายืนยันสำเร็จ
- [x] **F-AUTH-07** ลืมรหัสผ่าน / รีเซ็ตรหัสผ่านผ่านอีเมล
- [x] **F-AUTH-08** RBAC helper (`requireRole`, `requireAuth`) + `middleware.ts` ป้องกันทุก route group
- [x] **F-AUTH-09** เปลี่ยนรหัสผ่าน + หน้าโปรไฟล์ผู้ใช้
- [x] **F-AUTH-10** นโยบายรหัสผ่าน + ล็อกบัญชีเมื่อล็อกอินผิดเกินกำหนด

> บันทึกสรุป Phase 1: [`docs/phases/phase-1-auth.md`](phases/phase-1-auth.md) · F-DATA-01/02, F-VER-04, F-AUD-01, F-UX-01/03/11 ทำล่วงหน้าเพราะ Phase 1 ต้องใช้

### Phase 2 — Data Layer & Registry Integration
- [x] **F-DATA-01** Prisma schema: `Student` + index ที่จำเป็น (`citizenIdHash`, `passportNoHash`, `studentCode`)
- [x] **F-DATA-02** โมดูล crypto: `hashIdentifier()` (HMAC-SHA256 + pepper), `encrypt()/decrypt()` (AES-256-GCM), `maskCitizenId()`
- [x] **F-DATA-03** นิยาม `RegistryClient` interface + Zod DTO ของข้อมูลนักศึกษา
- [x] **F-DATA-04** `MockRegistryClient` + Mock API route พร้อมข้อมูลตัวอย่าง ≥ 200 ราย ครอบคลุมทุกเคส (จบปกติ, เกียรตินิยม, กำลังศึกษา, ถูกเพิกถอน, ชื่อซ้ำ, ต่างชาติใช้พาสปอร์ต)
- [x] **F-DATA-05** `HttpRegistryClient` โครงสร้างพร้อมใช้ (retry + timeout + error mapping) รอ spec จริง
- [x] **F-DATA-06** `sync.service.ts`: full sync + incremental sync + upsert logic + บันทึก `SyncJob`
- [x] **F-DATA-07** API route `/api/cron/sync` ป้องกันด้วย secret header (เรียกจาก system cron)
- [x] **F-DATA-08** หน้า Staff `/sync` — ดูประวัติ sync, สถานะล่าสุด, ปุ่ม trigger manual sync
- [x] **F-DATA-09** ฟังก์ชัน refresh ข้อมูลรายคน (on-demand) จากหน้าพิจารณาคำขอ
- [x] **F-DATA-10** Seed script สร้างผู้ใช้ตั้งต้นทุกบทบาท + import mock data

> บันทึกสรุป Phase 2: [`docs/phases/phase-2-data.md`](phases/phase-2-data.md) · F-DATA-09 มี service + server action แล้ว รอวางปุ่มในหน้าพิจารณาคำขอ (F-REG-02)

### Phase 3 — Core Verification (หัวใจของระบบ)
- [x] **F-VER-01** Prisma schema: `VerificationRequest`, `VerificationResult` + migration
- [x] **F-VER-02** Reference No. generator รูปแบบ `KRU-{พ.ศ.}-{running 6 หลัก}` (กัน race condition)
- [x] **F-VER-03** ฟอร์มยื่นคำขอ: เลือกประเภทคีย์ (บัตรประชาชน/พาสปอร์ต) + ช่องกรอก + วัตถุประสงค์ + PDPA consent (บังคับติ๊ก)
- [x] **F-VER-04** Validation เลขบัตรประชาชนไทย (checksum 13 หลัก) + รูปแบบพาสปอร์ต
- [x] **F-VER-05** `verification.service.ts`: matching + กฎ auto-approve (ตามข้อ 5.4)
- [x] **F-VER-06** สร้าง `VerificationResult` snapshot เมื่ออนุมัติ (immutable)
- [x] **F-VER-07** หน้าผลตรวจสอบ — แสดงข้อมูลครบตาม R-07 + ตราสัญลักษณ์ + เลขอ้างอิง + วันที่ตรวจสอบ
- [x] **F-VER-08** Permalink `/verify/result/[refNo]` — เข้าถึงด้วย access token, มีวันหมดอายุ, กันการเดา refNo
- [x] **F-VER-09** หน้ารายการคำขอของผู้ขอ (filter ตามสถานะ + ค้นหา + แบ่งหน้า)
- [x] **F-VER-10** Rate limiting ต่อ user และต่อ IP + หน้าแจ้งเตือนเมื่อเกินโควตา
- [x] **F-VER-11** ป้องกัน enumeration — ไม่เปิดเผยผล "ไม่พบข้อมูล" โดยอัตโนมัติ ให้ผ่านเจ้าหน้าที่เสมอ
- [x] **F-VER-12** Unit test ครอบคลุมทุกสาขาของกฎ auto-approve / manual-review

> บันทึกสรุป Phase 3: [`docs/phases/phase-3-verification.md`](phases/phase-3-verification.md) · ทำเพิ่มบางส่วน `[~]`: F-NOT-02 (อีเมลรับคำขอ + แจ้งผลอนุมัติ), F-UX-08 (ซ่อนปุ่มตอนพิมพ์)

### Phase 4 — Registrar Workflow
- [x] **F-REG-01** หน้าคิวงาน `/queue` — TanStack Table, filter สถานะ/ช่วงวันที่/หน่วยงาน, เรียงตามเวลารอ
- [x] **F-REG-02** หน้าพิจารณา `/queue/[refNo]` — แสดงข้อมูลคำขอ + รายการที่จับคู่ได้ + เหตุผลที่เข้าคิว
- [x] **F-REG-03** ค้นหาและเลือกจับคู่นักศึกษาด้วยตนเอง (กรณีระบบหาไม่เจอ/เจอหลายราย)
- [x] **F-REG-04** อนุมัติคำขอ → สร้าง snapshot + ส่งอีเมลแจ้งผู้ขอ
- [x] **F-REG-05** ปฏิเสธคำขอ พร้อมเหตุผล (เลือกจากรายการ + กรอกเพิ่ม) + แจ้งผู้ขอ
- [x] **F-REG-06** บันทึกหมายเหตุภายใน (internal note) ที่ผู้ขอไม่เห็น
- [x] **F-REG-07** หน้าค้นหาข้อมูลผู้สำเร็จการศึกษา `/students` (เจ้าหน้าที่เท่านั้น) + ดูรายละเอียด
- [x] **F-REG-08** หน้าจัดการหน่วยงาน `/organizations` — อนุมัติ/ระงับ/ดูประวัติการใช้งาน
- [x] **F-REG-09** ตัวชี้วัด SLA — แสดงเวลารอของแต่ละคำขอ + ไฮไลต์รายการที่ค้างเกินกำหนด

> บันทึกสรุป Phase 4: [`docs/phases/phase-4-registrar.md`](phases/phase-4-registrar.md) · ทำครบ F-DATA-09 (ปุ่มดึงข้อมูลรายคนในหน้าพิจารณาและหน้าระเบียนนักศึกษา) · ทำเพิ่มบางส่วน `[~]`: F-NOT-02 (อีเมลแจ้งปฏิเสธ + หน่วยงานได้รับอนุมัติ)

### Phase 5 — Batch Verification
- [ ] **F-BAT-01** Prisma schema: `BatchJob`, `BatchItem` + migration
- [ ] **F-BAT-02** ดาวน์โหลดเทมเพลต CSV/Excel + หน้าอธิบายรูปแบบไฟล์
- [ ] **F-BAT-03** อัปโหลดไฟล์ + parse + validate ทีละแถว + แสดงตัวอย่างก่อนยืนยัน (จำกัดจำนวนแถวสูงสุด)
- [ ] **F-BAT-04** ประมวลผลแบบ background พร้อมแถบแสดงความคืบหน้า
- [ ] **F-BAT-05** หน้าผลลัพธ์ batch — สรุปจำนวน อนุมัติ/รอพิจารณา/ไม่พบ + ลิงก์ไปแต่ละคำขอ
- [ ] **F-BAT-06** Export ผลลัพธ์ batch เป็น Excel
- [ ] **F-BAT-07** Audit + rate limit เฉพาะสำหรับ batch (โควตาแยกจากคำขอเดี่ยว)

### Phase 6 — Dashboard & Reports
- [x] **F-RPT-01** Dashboard ผู้ขอ — สรุปคำขอของตนเอง + สถานะล่าสุด
- [x] **F-RPT-02** Dashboard เจ้าหน้าที่ — การ์ดตัวเลข (คำขอวันนี้/รอพิจารณา/อนุมัติแล้ว/เวลาเฉลี่ย)
- [x] **F-RPT-03** กราฟแนวโน้มคำขอรายวัน/รายเดือน (Recharts)
- [x] **F-RPT-04** กราฟสัดส่วนตามสถานะ + Top 10 หน่วยงานที่ขอมากที่สุด
- [x] **F-RPT-05** กราฟจำแนกตามคณะ/ระดับการศึกษา
- [x] **F-RPT-06** หน้ารายงาน `/reports` — เลือกช่วงวันที่ + เงื่อนไข + แสดงตาราง
- [x] **F-RPT-07** Export รายงานเป็น Excel / CSV
- [x] **F-RPT-08** รายงานสรุปประจำเดือนส่งอีเมลอัตโนมัติถึงผู้ดูแล (ตั้งค่าเปิด/ปิดได้)

> บันทึกสรุป Phase 6: [`docs/phases/phase-6-reports.md`](phases/phase-6-reports.md)

### Phase 7 — Audit, Admin & PDPA
- [x] **F-AUD-01** Prisma schema: `AuditLog` + `audit.service.ts` (เขียน log แบบ non-blocking)
- [x] **F-AUD-02** ฝัง audit ในทุกจุดสำคัญ: login/logout, ยื่นคำขอ, ดูผล, อนุมัติ/ปฏิเสธ, แก้ไขผู้ใช้, sync, export
- [x] **F-AUD-03** หน้า `/audit-logs` (ADMIN) — filter ตามผู้ใช้/action/ช่วงเวลา + ดูรายละเอียด
- [x] **F-AUD-04** Export audit log เป็น CSV สำหรับการตรวจสอบภายนอก
- [x] **F-AUD-05** หน้าจัดการผู้ใช้ `/users` (ADMIN) — สร้าง/แก้ไข/ระงับ/รีเซ็ตรหัสผ่าน/เปลี่ยนบทบาท
- [x] **F-AUD-06** หน้าตั้งค่าระบบ `/settings` — เปิด/ปิด auto-approve, โควตา rate limit, retention days, ข้อความประกาศหน้าแรก
- [~] **F-AUD-07** หน้านโยบายความเป็นส่วนตัว (PDPA) + ข้อกำหนดการใช้บริการ สองภาษา
- [x] **F-AUD-08** งาน retention — anonymize/ลบคำขอที่เกินระยะเวลาเก็บรักษาโดยอัตโนมัติ
- [x] **F-AUD-09** Security headers (CSP, HSTS, X-Frame-Options) ใน `next.config`

> บันทึกสรุป Phase 7: [`docs/phases/phase-7-audit-admin.md`](phases/phase-7-audit-admin.md) · F-AUD-07 `[~]` — หน้าและโครงครบสองภาษา แต่ข้อความยังเป็นร่างรอฝ่ายกฎหมายอนุมัติ (ข้อ 10 รายการที่ 5)

### Phase 8 — i18n, Responsive & Accessibility
- [x] **F-UX-01** ตั้งค่า `next-intl` + routing `[locale]` + middleware ตรวจภาษา
- [x] **F-UX-02** ไฟล์แปล `th.json` / `en.json` ครบทุกข้อความ (ไม่มี hardcoded string)
- [x] **F-UX-03** ปุ่มสลับภาษาบน header + จำค่าที่ผู้ใช้เลือก
- [x] **F-UX-04** Format วันที่แบบไทย (พ.ศ.) และอังกฤษ (ค.ศ.) ตามภาษาที่เลือก
- [x] **F-UX-05** App shell responsive — sidebar บนเดสก์ท็อป / bottom nav หรือ drawer บนมือถือ
- [x] **F-UX-06** ตารางทุกหน้าแสดงผลบนมือถือได้ (card view หรือ horizontal scroll)
- [x] **F-UX-07** ฟอร์มทุกหน้าใช้งานบนมือถือได้สะดวก (touch target ≥ 44px)
- [x] **F-UX-08** หน้าผลตรวจสอบอ่านง่ายบนมือถือ + พิมพ์จากเบราว์เซอร์ได้สวยงาม (print stylesheet)
- [x] **F-UX-09** Loading / Empty / Error state ครบทุกหน้า (skeleton + error boundary)
- [~] **F-UX-10** Accessibility — keyboard navigation, ARIA labels, contrast ผ่าน WCAG AA

> บันทึกสรุป Phase 8: [`docs/phases/phase-8-ux.md`](phases/phase-8-ux.md) · F-UX-10 `[~]` — keyboard/ARIA/heading ทำแล้ว แต่ยังไม่ได้ตรวจ contrast ด้วยเครื่องมืออัตโนมัติ (axe) · หน้าที่ยังไม่มี (Phase 5, 6, 9) ต้องทำตามข้อกำหนดนี้เมื่อสร้าง
- [x] **F-UX-11** โหลดฟอนต์ไทยที่อ่านง่าย (เช่น Noto Sans Thai / Sarabun) แบบ self-host

### Phase 9 — Notifications
- [x] **F-NOT-01** ตั้งค่า Nodemailer + SMTP มหาวิทยาลัย + `EmailLog`
- [x] **F-NOT-02** เทมเพลตอีเมลสองภาษา: ยืนยันอีเมล, รีเซ็ตรหัสผ่าน, รับคำขอแล้ว, อนุมัติ, ปฏิเสธ, หน่วยงานได้รับอนุมัติ
- [x] **F-NOT-03** แจ้งเตือนเจ้าหน้าที่เมื่อมีคำขอเข้าคิว (สรุปรวมรายวัน เพื่อไม่ให้อีเมลท่วม)
- [x] **F-NOT-04** ระบบ retry เมื่อส่งอีเมลล้มเหลว + หน้าดูสถานะการส่ง (ADMIN)
- [x] **F-NOT-05** การแจ้งเตือนในระบบ (in-app notification bell)

> บันทึกสรุป Phase 9: [`docs/phases/phase-9-notifications.md`](phases/phase-9-notifications.md)

### Phase 10 — Deployment & Documentation
- [ ] **F-OPS-01** `Dockerfile` multi-stage ใช้ `output: 'standalone'`
- [ ] **F-OPS-02** `docker-compose.yml` production (app + postgres + nginx reverse proxy)
- [ ] **F-OPS-03** Health check endpoint `/api/health` (ตรวจ DB + registry API)
- [ ] **F-OPS-04** สคริปต์สำรอง/กู้คืนฐานข้อมูล + คู่มือ
- [ ] **F-OPS-05** ตัวอย่างการตั้ง system cron สำหรับ sync + retention job
- [ ] **F-OPS-06** `README.md` — วิธีติดตั้ง/พัฒนา/deploy + ตาราง env vars
- [ ] **F-OPS-07** คู่มือผู้ใช้ (เจ้าหน้าที่ / หน่วยงานภายนอก) ภาษาไทย
- [ ] **F-OPS-08** เอกสาร API spec ที่ต้องขอจากฝ่ายทะเบียน (ส่งให้ IT มหาวิทยาลัย)
- [ ] **F-OPS-09** E2E test ครอบคลุม flow หลัก (ยื่นคำขอ → auto-approve, ยื่นคำขอ → เข้าคิว → อนุมัติ)

**รวมทั้งสิ้น 78 รายการ ใน 11 เฟส**

---

## 7. ลำดับการทำงานที่แนะนำ

```
Phase 0 → Phase 1 → Phase 2 → Phase 3  ← MVP ใช้งานได้จริง (ยื่นคำขอ + ดูผล)
                                 ↓
                              Phase 4  ← ครบ workflow เจ้าหน้าที่
                                 ↓
              Phase 7 + Phase 8 (ทำคู่ขนานไปตลอด ไม่ทิ้งไว้ท้าย)
                                 ↓
                    Phase 6 → Phase 9 → Phase 5 → Phase 10
```

**เหตุผล:** Phase 8 (i18n + responsive) ต้องทำไปพร้อมกับทุกหน้าตั้งแต่แรก ไม่ใช่มาไล่แก้ทีหลัง เช่นเดียวกับ Audit Log ที่ต้องฝังตอนเขียนแต่ละฟีเจอร์ ส่วน Batch (Phase 5) เลื่อนไปท้ายเพราะขึ้นกับ core verification ที่ต้องนิ่งก่อน

---

## 8. ความเสี่ยงและข้อควรระวัง

| ความเสี่ยง | ผลกระทบ | แนวทางรับมือ |
|-----------|---------|-------------|
| ยังไม่มี spec API จริงจากฝ่ายทะเบียน | โครงสร้างข้อมูลอาจต้องปรับ | ใช้ Adapter pattern + Zod DTO — เปลี่ยนเฉพาะ `http-client.ts` และ mapper ไม่กระทบ service อื่น |
| ข้อมูลเก่าก่อนยุคดิจิทัลไม่ครบ | auto-approve ไม่ได้ ต้องพึ่งเจ้าหน้าที่มาก | ตั้ง flag `requiresManualReview` + Phase 4 ต้องใช้งานง่ายจริง |
| Brute-force เดาเลขบัตรประชาชน | ข้อมูลส่วนบุคคลรั่ว | Rate limit หลายชั้น + ต้องล็อกอิน + audit ทุกครั้ง + ไม่เปิดเผยผล "ไม่พบ" อัตโนมัติ |
| ไม่มี PDF/ลายเซ็นดิจิทัล | ความน่าเชื่อถือของผลลัพธ์ | ใช้ permalink + เลขอ้างอิงที่ตรวจซ้ำได้ — **แนะนำให้พิจารณาเพิ่ม PDF + QR ใน Phase 2 ของโครงการ** |
| Next.js 16 / Tailwind v4 ยังใหม่ | บาง library อาจยังไม่รองรับเต็มที่ | ตรวจ compatibility ตั้งแต่ Phase 0 ก่อนลงแรงเขียนฟีเจอร์ |

---

## 9. แผนการทวนสอบ (Verification Plan)

### 9.1 Unit Test (Vitest)
- กฎ auto-approve ทุกสาขา: พบ 1 ราย + GRADUATED → AUTO; พบ 0 ราย → PENDING; พบหลายราย → PENDING; สถานะ REVOKED → PENDING; `requiresManualReview` → PENDING
- Checksum เลขบัตรประชาชนไทย (ถูก/ผิด/ความยาวไม่ครบ)
- `hashIdentifier` ให้ค่าเดิมทุกครั้ง และ `encrypt`/`decrypt` ได้ค่าเดิมกลับมา
- `maskCitizenId` ไม่หลุดเลขเต็ม
- RBAC guard ปฏิเสธทุกบทบาทที่ไม่มีสิทธิ์

### 9.2 E2E Test (Playwright)
1. ลงทะเบียนหน่วยงาน → Admin อนุมัติ → ล็อกอินได้
2. ยื่นคำขอด้วยเลขบัตรที่ตรง 1 ราย → เห็นผลทันที → เปิด permalink ซ้ำได้
3. ยื่นคำขอด้วยข้อมูลที่ไม่พบ → เข้าคิว → เจ้าหน้าที่ปฏิเสธ → ผู้ขอเห็นเหตุผล
4. อัปโหลด batch 10 รายการ → ผลลัพธ์ครบ → export Excel ได้
5. สลับภาษา th/en ทุกหน้าหลักไม่มีข้อความตกหล่น
6. ทดสอบ viewport มือถือ (390×844) ทุกหน้าหลัก ไม่มี horizontal scroll

### 9.3 Manual Verification
- `pnpm build` ผ่านโดยไม่มี type error
- `docker compose up` แล้วเข้าใช้งานได้จริง + health check เขียว
- ตรวจ Audit Log ว่าบันทึกครบทุก action ที่ระบุใน F-AUD-02
- ทดสอบ sync เมื่อ Mock API ล่ม → ระบบยังค้นหาจากข้อมูลที่ sync ไว้ได้

---

## 10. สิ่งที่ต้องขอจากมหาวิทยาลัยระหว่างพัฒนา

| # | รายการ | จำเป็นก่อนเฟส |
|---|--------|---------------|
| 1 | **API Spec ระบบทะเบียน** — endpoint, วิธี authentication, โครงสร้าง response, นโยบาย rate limit | Phase 2 (ใช้ Mock ไปก่อนได้) |
| 2 | **ข้อมูลตัวอย่างจริง (ปกปิดข้อมูลส่วนบุคคล)** เพื่อตรวจสอบความถูกต้องของ mapping | Phase 2 |
| 3 | **ข้อมูล SMTP** สำหรับส่งอีเมล | Phase 9 |
| 4 | **โลโก้ + Brand guideline** (สี, ฟอนต์) ของมหาวิทยาลัย | Phase 0 |
| 5 | **ข้อความนโยบาย PDPA + ข้อกำหนดการใช้บริการ** ที่ผ่านการอนุมัติจากฝ่ายกฎหมาย | Phase 7 |
| 6 | **ข้อกำหนดเซิร์ฟเวอร์ On-premise** — spec, OS, มี Docker หรือไม่, นโยบาย SSL/โดเมน | Phase 10 |

---

## ภาคผนวก — ประวัติการแก้ไขเอกสาร

| เวอร์ชัน | วันที่ | ผู้แก้ไข | รายละเอียด |
|---------|-------|---------|-----------|
| 1.0 | 2026-09-12 | PM / SA / Architect | เอกสารฉบับแรก จากการสัมภาษณ์เก็บ Requirements 3 รอบ |
| 1.1 | 2026-09-14 | ทีมพัฒนา | อนุมัติแล้ว: `middleware.ts` → `proxy.ts` (Next.js 16), `toast` → `sonner`, เพิ่ม `prisma.config.ts` + `src/generated/prisma`, route เจ้าหน้าที่ใช้ prefix `/staff` |
| 1.2 | 2026-09-15 | ทีมพัฒนา | อนุมัติแล้ว: `Student.citizenIdHash` เป็น index ธรรมดา (ไม่ unique), เพิ่ม model `AuthToken` + ฟิลด์เสริมใน `User`/`Organization`/`Student` + enum `UserStatus`/`OrgType`/`AuthTokenType`/`Honors`, เพิ่มส่วนตั้งรหัสผ่านในฟอร์มลงทะเบียนหน่วยงาน |
| 1.3 | 2026-09-15 | ทีมพัฒนา | อนุมัติแล้ว (Phase 2): `SyncJob` เพิ่ม `runLock`/`studentCode`/`triggeredById`/`recordsInvalid`/`errorCode` + enum `SyncType`/`SyncStatus`, env `SYNC_PAGE_SIZE`/`SYNC_CRON_SCHEDULE`, `/api/cron/sync` ตอบ 202 แล้วทำงานเบื้องหลัง, `MOCK_REGISTRY_ENABLED=false` ปิดทั้ง route และ `MockRegistryClient` |
| 1.4     | 2026-09-15 | ทีมพัฒนา            | อนุมัติแล้ว (Phase 3): `accessToken` เก็บเป็น `accessTokenHash` + `accessTokenEnc`, `VerificationRequest` เพิ่ม `organizationId`/`searchValueEnc`/`requesterReference`/`note`/`reviewReason` + enum `RequestPurpose`/`DecisionType`/`ReviewReason`, ตาราง `ref_no_counters`/`rate_limits`, trigger กันแก้ `verification_results`, ศิษย์เก่าตรวจเฉพาะวุฒิตนเอง, หน่วยงานเห็นคำขอทั้งหน่วยงาน, เลื่อนปุ่มฉบับร่าง/Export/ช่วงวันที่, จำกัดเปิด permalink ผิด 20 ครั้ง/IP/ชม. |
| 1.5     | 2026-09-15 | ทีมพัฒนา            | อนุมัติแล้ว (Phase 4): ตาราง `request_notes`, `rejectReason` เก็บรหัสเหตุผล + `rejectDetail`, `Organization` เพิ่ม `suspendedAt`/`suspendedById`/`statusReason`, ปฏิเสธการลงทะเบียนหน่วยงาน = `SUSPENDED` พร้อมเหตุผล, เหตุผล "ไม่พบข้อมูลที่ตรงกัน" → `NOT_FOUND`, env `REVIEW_SLA_HOURS`, เลื่อนปุ่ม Export/เลือกหลายแถว/กระดิ่ง/ตัวเลขคิว/สถานะอีเมลในไทม์ไลน์ |
| 1.6     | 2026-09-15 | ทีมพัฒนา            | อนุมัติแล้ว (Phase 7): ค่าตั้งค่าเพิ่ม SLA/แถวแบบชุดต่อวัน/จำนวนครั้งล็อกบัญชี/ระยะเก็บ Audit Log/อายุ permalink (env เป็นค่าเริ่มต้น), `VerificationRequest.anonymizedAt`, retention = anonymise คำขอ + ลบ Audit Log ที่พ้นกำหนดผ่าน `/api/cron/retention`, CSP แบบ `'unsafe-inline'` (ไม่ใช้ nonce), สร้างบัญชีเฉพาะ ADMIN/REGISTRAR ด้วยอีเมลเชิญ, route `/privacy` + `/terms`, ตัวกรองผู้ใช้เป็นช่องค้นหา + เลื่อนหน้า Email Log ไป Phase 9, ข้อความนโยบายเป็นร่างรอฝ่ายกฎหมาย, `pnpm build` ต้องเชื่อมต่อฐานข้อมูล |
| 1.7     | 2026-09-15 | ทีมพัฒนา            | อนุมัติแล้ว (Phase 8): bottom nav แสดง 3 เมนูแรก + drawer "เมนู" เมื่อมีเมนูมากกว่า 4, ช่อง `input type="date"` แสดงตามปฏิทินของเบราว์เซอร์, skeleton โครงกลางเดียว + `global-error` ข้อความสองภาษาแบบคงที่, เลื่อนการตรวจ contrast ด้วย axe ไป Phase 10, แก้ shadcn `dialog.tsx`/`form.tsx` |
| 1.8     | 2026-09-15 | ทีมพัฒนา            | อนุมัติแล้ว (Phase 6): KPI แดชบอร์ดเจ้าหน้าที่ตามดีไซน์ (ช่วง 7 วัน/30 วัน/1 ปี + อัตราอนุมัติอัตโนมัติ), route `/staff/dashboard` + `/staff/reports`, แนวโน้มจัดกลุ่มตามวันที่ยื่นและสถานะปัจจุบัน, Export = Excel/CSV รายการคำขอ (จำกัด 100,000 แถว / 366 วัน), อีเมลสรุปรายเดือนแบบตัวเลข + ลิงก์ผ่าน `/api/cron/monthly-report` + ค่าตั้งค่า `report.monthlyEmailEnabled`/`report.monthlyLastSent`, ซ่อนทางลัดตรวจสอบแบบชุดจนถึง Phase 5, เพิ่ม `recharts` + `exceljs` |
| 1.9 | 2026-09-16 | ทีมพัฒนา | อนุมัติแล้ว (Phase 9): `EmailLog` เพิ่ม `subject`/`locale`/`payload`/`attempts`/`lastError`/`nextRetryAt`/`userId`/`entityType`/`entityId` + enum `EmailStatus` (เก็บ payload ของเทมเพลตแทน HTML เพื่อ render ใหม่ตอน retry), เพิ่ม model `Notification` + enum `NotificationType` 6 ค่า, ค่าตั้งค่า `notify.queueDigestEnabled` (เปิดเป็นค่าเริ่มต้น) + `notify.queueDigestLastSent` + กลุ่ม "การแจ้งเตือน" ในหน้าตั้งค่า, retry ผ่าน system cron `/api/cron/email-retry` 4 ครั้ง (5/30/120/360 นาที) แล้วรอผู้ดูแลกดส่งซ้ำ, `/api/cron/queue-digest` ส่งสรุปคิววันละครั้ง, หน้าใหม่ `/notifications` และ `/staff/email-logs`, แจ้งเตือนฝั่งผู้ขอเพิ่ม 2 ชนิด (คำขออนุมัติ/ปฏิเสธ), audit action ใหม่ `notification.digest_sent` + `email.resent` |
