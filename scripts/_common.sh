#!/usr/bin/env bash
# ตัวช่วยร่วมของสคริปต์ปฏิบัติการ (F-OPS-04/05) — source จากสคริปต์อื่น ไม่ได้เรียกตรง
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.prod}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker/docker-compose.prod.yml}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "✖ ไม่พบไฟล์ $ENV_FILE (ตั้ง ENV_FILE=... เพื่อระบุไฟล์อื่น)" >&2
  exit 1
fi

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

# อ่านค่าจาก env file โดยไม่ source ทั้งไฟล์ (ค่าบางตัวมีช่องว่างหรือเครื่องหมายคำพูด)
env_value() {
  local key="$1" default="${2:-}" line
  line="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 || true)"
  if [[ -z "$line" ]]; then
    printf '%s' "$default"
    return
  fi
  line="${line#*=}"
  line="${line%\"}"
  line="${line#\"}"
  printf '%s' "$line"
}

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}
