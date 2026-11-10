#!/usr/bin/env bash
# Cập nhật server Cờ Tỷ Phú trên VPS: kéo code mới, cài thư viện, khởi động lại.
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
cd server
npm install --omit=dev --no-audit --no-fund
systemctl restart monopoly
sleep 1
curl -fsS http://127.0.0.1:8387/health && echo
