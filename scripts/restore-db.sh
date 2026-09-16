#!/usr/bin/env bash
# F-OPS-04 — กู้คืนฐานข้อมูล production จากไฟล์ที่ได้จาก scripts/backup-db.sh
#
# ใช้งาน:  scripts/restore-db.sh backups/krirk_verify-20260916-013000.dump [--yes]
# ขั้นตอน: ตรวจ checksum → หยุดแอป → สำรองสถานะปัจจุบันไว้ก่อน → ล้างแล้วกู้คืน → migrate → เปิดแอป → ตรวจ health
# ⚠ เขียนทับข้อมูลทั้งหมดในฐานข้อมูล — ต้องใช้ ENCRYPTION_KEY และ IDENTIFIER_PEPPER ชุดเดียวกับตอนสำรอง
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"

file="${1:-}"
confirm="${2:-}"
if [[ -z "$file" || ! -f "$file" ]]; then
  echo "ใช้งาน: $0 <ไฟล์ .dump> [--yes]" >&2
  exit 2
fi

if [[ -f "$file.sha256" ]]; then
  if ! (cd "$(dirname "$file")" && sha256sum --check --status "$(basename "$file").sha256"); then
    log "✖ checksum ไม่ตรง — ไฟล์อาจเสียหาย"
    exit 1
  fi
  log "✔ checksum ถูกต้อง"
else
  log "⚠ ไม่พบไฟล์ .sha256 — ข้ามการตรวจ checksum"
fi

if ! compose exec -T postgres pg_restore --list <"$file" >/dev/null; then
  log "✖ ไฟล์นี้ไม่ใช่ pg_dump custom format ที่อ่านได้"
  exit 1
fi

db_name="$(env_value POSTGRES_DB krirk_verify)"
if [[ "$confirm" != "--yes" ]]; then
  echo "จะเขียนทับฐานข้อมูล \"$db_name\" ด้วย $file"
  read -r -p "พิมพ์ชื่อฐานข้อมูลเพื่อยืนยัน: " answer
  if [[ "$answer" != "$db_name" ]]; then
    echo "ยกเลิก"
    exit 1
  fi
fi

log "หยุดแอปและ nginx ระหว่างกู้คืน"
compose stop nginx app

log "สำรองสถานะปัจจุบันก่อนกู้คืน (เผื่อต้องย้อนกลับ)"
"$(dirname "${BASH_SOURCE[0]}")/backup-db.sh"

log "กู้คืนจาก $file"
# shellcheck disable=SC2016 # ตัวแปรขยายภายใน container
compose exec -T postgres sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --exit-on-error --single-transaction' \
  <"$file"

log "ใช้ migration ที่ใหม่กว่าไฟล์สำรอง (ถ้ามี)"
compose run --rm migrate

log "เปิดแอป"
compose up -d app nginx

for _ in $(seq 1 30); do
  if compose exec -T app wget -q -O - "http://127.0.0.1:3000/api/health?registry=skip" >/dev/null 2>&1; then
    log "✔ กู้คืนเสร็จ และ health check ผ่าน"
    exit 0
  fi
  sleep 5
done
log "✖ แอปยังไม่ผ่าน health check ภายใน 150 วินาที — ตรวจด้วย: docker compose logs app"
exit 1
