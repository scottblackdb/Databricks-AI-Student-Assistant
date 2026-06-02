#!/usr/bin/env bash
# Build the React frontend and copy it into backend/static so the FastAPI app
# (and the Databricks App) can serve it as a single web process.
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Building frontend…"
cd "$ROOT/frontend"
npm install
npm run build

echo "Copying dist -> backend/static …"
rm -rf "$ROOT/backend/static"
cp -r "$ROOT/frontend/dist" "$ROOT/backend/static"

echo "Done. backend/static is ready to deploy."
