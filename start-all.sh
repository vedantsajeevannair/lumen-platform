#!/bin/bash
# Start all LUMEN platform tiers:
#   1) AI computer vision service (FastAPI) -> http://localhost:8100
#   2) Backend REST API (Express + Prisma)   -> http://localhost:4000
#   3) Web Frontend (Vite + React)          -> http://localhost:5173
#   4) Mobile Application (Expo Web/Native) -> http://localhost:8081 or Expo Go

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "================================================="
echo "   🚀 STARTING FULL LUMEN PLATFORM + MOBILE"
echo "================================================="

# 1. Start AI service
echo "→ [1/4] Starting AI Service on :8100..."
( cd "$ROOT/backend/ai-service" && .venv/bin/python3 -m uvicorn main:app --port 8100 ) > /tmp/lumen-ai.log 2>&1 &
AI_PID=$!

# 2. Start Backend
echo "→ [2/4] Starting Express Backend on :4000..."
( cd "$ROOT/backend" && npm run start ) > /tmp/lumen-backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to be ready
echo "→ Waiting for backend to initialize..."
for i in $(seq 1 30); do
  curl -s http://localhost:4000/api/ping >/dev/null 2>&1 && break
  sleep 1
done

# 3. Start Frontend in background
echo "→ [3/4] Starting Web Frontend on :5173..."
( cd "$ROOT/frontend" && npm run dev ) > /tmp/lumen-frontend.log 2>&1 &
FRONTEND_PID=$!

echo "================================================="
echo "  ✅ Web Platform Running:"
echo "     • Web Frontend : http://localhost:5173"
echo "     • Backend API  : http://localhost:4000"
echo "     • AI Vision    : http://localhost:8100"
echo "================================================="
echo "→ [4/4] Launching Mobile App (Expo)..."
echo "================================================="

cleanup() {
  echo ""
  echo "🛑 Stopping all LUMEN services..."
  kill $AI_PID $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  exit 0
}

trap cleanup SIGINT SIGTERM

cd "$ROOT/mobile" && npm start
