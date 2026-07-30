#!/usr/bin/env bash
# Starts the AI service, backend and frontend together for local demos.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

[ -f .env ] || cp .env.example .env

cleanup() { kill 0 2>/dev/null || true; }
trap cleanup EXIT INT TERM

echo "starting Python AI service on :8000"
(cd ai-service && .venv/bin/uvicorn app.main:app --port 8000) &

echo "starting Node backend on :4000"
(cd backend && npm run dev) &

echo "starting React frontend on :5173"
(cd frontend && npm run dev) &

wait
