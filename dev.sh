#!/usr/bin/env bash
# Start the FastAPI backend and the Vite frontend together.
# Ctrl-C stops both.
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cleanup() {
  echo ""
  echo "Shutting down…"
  kill 0 2>/dev/null
}
trap cleanup EXIT INT TERM

echo "Starting backend on http://127.0.0.1:8000 …"
# Bind 127.0.0.1 explicitly; the Vite proxy targets 127.0.0.1 to match (avoids the
# IPv6 ::1 vs IPv4 mismatch that causes ECONNREFUSED).
(cd "$ROOT/backend" && python3 -m uvicorn main:app --reload --host 127.0.0.1 --port 8000) &

# Wait for the backend to be ready before starting the frontend, so the first
# page load doesn't hit the proxy before uvicorn is listening.
echo -n "Waiting for backend"
for _ in $(seq 1 40); do
  if curl -sf -o /dev/null http://127.0.0.1:8000/api/health 2>/dev/null; then
    echo " — up."
    break
  fi
  echo -n "."
  sleep 0.5
done

echo "Starting frontend on http://localhost:5173 …"
(cd "$ROOT/frontend" && npm run dev) &

wait
