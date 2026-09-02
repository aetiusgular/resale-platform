#!/usr/bin/env bash
# Single-server Next.js clean start.
# Prevents the recurring localhost 500 caused by multiple `next dev` processes
# (or `rm -rf .next` mid-compile) corrupting `.next/routes-manifest.json`.
#
# Usage (from repo root):
#   ./dev-clean.sh          # kill strays, wipe .next, start one server on 3000
#   ./dev-clean.sh --force  # same (alias; always forces a clean restart)
#
# Do NOT run a second `pnpm dev` in another terminal while this is up.
# Do NOT `rm -rf .next` while a server is running.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

export PATH="${PATH:-}"
# Prefer the Node the founder uses for this repo when present.
if [[ -d "$HOME/.nvm/versions/node/v24.15.0/bin" ]]; then
  export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH"
elif [[ -d "$HOME/.nvm/versions/node/v22.23.2/bin" ]]; then
  export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
fi

echo "[dev-clean] stopping Next.js on ports 3000–3003…"
# Kill by port first (precise), then by process name (catch orphans).
for p in 3000 3001 3002 3003; do
  if command -v lsof >/dev/null 2>&1; then
    lsof -tiTCP:"$p" -sTCP:LISTEN 2>/dev/null | xargs kill -9 2>/dev/null || true
  fi
done
pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
sleep 1

still="$(lsof -iTCP:3000-3003 -sTCP:LISTEN 2>/dev/null || true)"
if [[ -n "${still}" ]]; then
  echo "[dev-clean] warning: still listening after kill:"
  echo "$still"
  echo "[dev-clean] retrying kill…"
  for p in 3000 3001 3002 3003; do
    lsof -tiTCP:"$p" -sTCP:LISTEN 2>/dev/null | xargs kill -9 2>/dev/null || true
  done
  sleep 1
fi

echo "[dev-clean] removing .next cache…"
rm -rf "$ROOT/.next"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "[dev-clean] error: pnpm not on PATH. Fix PATH, then re-run." >&2
  exit 1
fi

# Record the shell PID so agents/humans can see who owns the slot.
echo "$$" > "$ROOT/.dev-server.pid"
trap 'rm -f "$ROOT/.dev-server.pid"' EXIT

echo "[dev-clean] starting single pnpm dev on :3000…"
echo "[dev-clean] tip: leave this terminal alone; restart only via ./dev-clean.sh"
exec pnpm dev --port 3000
