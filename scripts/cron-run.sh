#!/usr/bin/env bash
# F-OPS-05 — เรียกงานตามรอบของระบบจาก system cron
# ยิงคำขอจาก "ภายใน" container ของแอป (nginx ปิด /api/cron/ จากภายนอก)
# และ CRON_SECRET ไม่ปรากฏใน command line ของเครื่อง host
#
# ใช้งาน:  scripts/cron-run.sh <งาน>
#   sync-full         ดึงข้อมูลผู้สำเร็จการศึกษาทั้งหมดจากระบบทะเบียน (ตอบ 202 แล้วทำต่อเบื้องหลัง)
#   sync-incremental  ดึงเฉพาะระเบียนที่เปลี่ยนตั้งแต่ครั้งล่าสุด
#   retention         anonymise คำขอ + ลบ Audit Log และประวัติอีเมลที่พ้นระยะเก็บรักษา
#   email-retry       ส่งอีเมลที่ล้มเหลวซ้ำตามรอบ backoff (และเก็บกวาดอีเมลที่ค้างสถานะรอส่ง)
#   batch-recovery    ทำงานแบบชุดที่ค้าง (process ถูกรีสตาร์ตระหว่างประมวลผล) ต่อจนจบ
#   queue-digest      อีเมลสรุปคิวรอพิจารณาถึงเจ้าหน้าที่ (วันละครั้ง)
#   monthly-report    อีเมลสรุปรายเดือน (ส่งจริงเมื่อเปิดในหน้าตั้งค่า)
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"

job="${1:-}"
case "$job" in
  sync-full) path="/api/cron/sync?type=full" ;;
  sync-incremental) path="/api/cron/sync?type=incremental" ;;
  retention) path="/api/cron/retention" ;;
  email-retry) path="/api/cron/email-retry" ;;
  batch-recovery) path="/api/cron/batch-recovery" ;;
  queue-digest) path="/api/cron/queue-digest" ;;
  monthly-report) path="/api/cron/monthly-report" ;;
  *)
    echo "ใช้งาน: $0 {sync-full|sync-incremental|retention|email-retry|batch-recovery|queue-digest|monthly-report}" >&2
    exit 2
    ;;
esac

# สคริปต์ที่รันภายใน container: $CRON_SECRET มาจาก env ของ container, $1 คือ path
# -T 900 = รอได้ 15 นาทีสำหรับงาน retention ที่ทำเสร็จก่อนตอบกลับ
remote='wget -q -O - -T 900 --header "x-cron-secret: $CRON_SECRET" --post-data "" "http://127.0.0.1:3000$1"'

log "เริ่ม $job"
status=0
output="$(compose exec -T app sh -c "$remote" cron-run "$path" 2>&1)" || status=$?
if [[ $status -eq 0 ]]; then
  log "สำเร็จ $job: $output"
else
  log "ล้มเหลว $job (exit $status): $output"
  exit "$status"
fi
