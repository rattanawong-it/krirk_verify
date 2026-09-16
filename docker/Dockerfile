# syntax=docker/dockerfile:1
# =============================================================
# Krirk Verify — production image (F-OPS-01)
# build:  docker build -f docker/Dockerfile -t krirk-verify:latest .
# target:
#   runner  (ค่าเริ่มต้น) แอป Next.js แบบ standalone · ไม่มี devDependencies · ผู้ใช้ non-root
#   migrate เครื่องมือฐานข้อมูล — prisma migrate deploy + seed ค่าตั้งต้น + สร้างผู้ดูแลคนแรก
# =============================================================

ARG NODE_VERSION=24-alpine

# ---------- base: pnpm ตามเวอร์ชันใน package.json (corepack) ----------
FROM node:${NODE_VERSION} AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    HUSKY=0 \
    NEXT_TELEMETRY_DISABLED=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

# ---------- deps: ติดตั้ง dependency ทั้งหมด (cache แยกจากซอร์สโค้ด) ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma/schema.prisma ./prisma/schema.prisma
# postinstall รัน prisma generate — prisma.config.ts ต้องมี DATABASE_URL แต่ไม่ได้เชื่อมต่อจริง
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    DATABASE_URL=postgresql://build:build@localhost:5432/build \
    pnpm install --frozen-lockfile

# ---------- builder: next build (ไม่ต้องเชื่อมต่อฐานข้อมูล) ----------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# ค่าหลอกสำหรับขั้น build เท่านั้น — ค่าจริงส่งเข้า container ตอนรันผ่าน env_file
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build \
    NODE_ENV=production
RUN pnpm db:generate && pnpm build

# ---------- migrate: prisma CLI + tsx สำหรับ migration/seed/สร้างผู้ดูแล (tsx prisma/create-admin.ts) ----------
# เรียกคำสั่งจาก node_modules/.bin โดยตรง — ไม่ต้องให้ corepack ดาวน์โหลด pnpm ตอนรัน
FROM base AS migrate
ENV NODE_ENV=production \
    TZ=Asia/Bangkok \
    PATH=/app/node_modules/.bin:$PATH
RUN apk add --no-cache tzdata
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-workspace.yaml prisma.config.ts tsconfig.json ./
COPY prisma ./prisma
COPY src/lib ./src/lib
COPY --from=builder /app/src/generated ./src/generated
USER node
CMD ["sh", "-c", "prisma migrate deploy && prisma db seed"]

# ---------- runner: แอปจริง ----------
FROM node:${NODE_VERSION} AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    TZ=Asia/Bangkok
RUN apk add --no-cache tzdata \
 && addgroup -S -g 1001 nodejs \
 && adduser -S -u 1001 -G nodejs nextjs
WORKDIR /app

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# ตรวจเฉพาะฐานข้อมูล — ไม่ยิง API ทะเบียนทุก 30 วินาที (ดู /api/health)
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO /dev/null "http://127.0.0.1:3000/api/health?registry=skip" || exit 1

CMD ["node", "server.js"]
