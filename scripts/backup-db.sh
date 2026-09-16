#!/usr/bin/env bash
# F-OPS-04 — สำรองฐานข้อมูล production เป็นไฟล์ pg_dump (custom format บีบอัดในตัว)
#
# ใช้งาน:  scripts/backup-db.sh
# ผลลัพธ์: $BACKUP_DIR/krirk_verify-YYYYmmdd-HHMMSS.dump + .sha256 · ลบไฟล์ที่เก่ากว่า BACKUP_KEEP_DAYS วัน
# ⚠ ไฟล์ backup มีข้อมูลส่วนบุคคล — เก็บในที่จำกัดสิทธิ์ และคัดลอกออกนอกเครื่องตามนโยบายของมหาวิทยาลัย
# ⚠ ข้อมูลที่เข้ารหัสในไฟล์ใช้ไม่ได้ถ้าไม่มี ENCRYPTION_KEY และ IDENTIFIER_PEPPER ชุดเดิม — สำรองค่าทั้งสองแยกไว้
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"

backup_dir="$(env_value BACKUP_DIR ./backups)"
[[ "$backup_dir" = /* ]] || backup_dir="$ROOT_DIR/${backup_dir#./}"
keep_days="$(env_value BACKUP_KEEP_DAYS 30)"

umask 077
mkdir -p "$backup_dir"
name="krirk_verify-$(date '+%Y%m%d-%H%M%S').dump"
file="$backup_dir/$name"
partial="$file.partial"

log "เริ่มสำรองข้อมูล → $file"
# shellcheck disable=SC2016 # ตัวแปรขยายภายใน container
if ! compose exec -T postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --compress=6' >"$partial"; then
  rm -f "$partial"
  log "✖ pg_dump ล้มเหลว"
  exit 1
fi

# ตรวจว่าไฟล์อ่านกลับได้ก่อนถือว่าสำเร็จ
if ! compose exec -T postgres pg_restore --list <"$partial" >/dev/null; then
  rm -f "$partial"
  log "✖ ไฟล์สำรองอ่านกลับไม่ได้ (pg_restore --list)"
  exit 1
fi

mv "$partial" "$file"
(cd "$backup_dir" && sha256sum "$name" >"$name.sha256")
log "✔ สำเร็จ ขนาด $(du -h "$file" | cut -f1)"

if [[ "$keep_days" =~ ^[0-9]+$ && "$keep_days" -gt 0 ]]; then
  removed="$(find "$backup_dir" -maxdepth 1 -type f -name 'krirk_verify-*.dump*' -mtime +"$keep_days" -print -delete | wc -l)"
  log "ลบไฟล์สำรองที่เก่ากว่า $keep_days วัน: $removed ไฟล์"
fi
