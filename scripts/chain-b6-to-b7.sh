#!/usr/bin/env bash
# Watches B6 (PID $1); when it exits, gates on GATE GREEN + pnpm verify,
# then pushes and launches B7. Logs to chain.log.
set -u
cd "$(dirname "$0")/.."
PID="${1:?usage: chain-b6-to-b7.sh <b6-pid>}"
log() { echo "[$(date '+%H:%M:%S')] $*" >> chain.log; }

log "watcher started for B6 pid $PID"
while ps -p "$PID" >/dev/null 2>&1; do sleep 60; done
log "B6 process exited"

if ! grep -q "B6 COMPLETE — GATE GREEN" b6.log; then
  log "GATE FAILED: no GATE GREEN in b6.log — NOT launching B7"; exit 1
fi
if ! pnpm verify >> chain.log 2>&1; then
  log "GATE FAILED: independent pnpm verify red — NOT launching B7"; exit 1
fi
git push -q origin main && log "pushed B6 to origin"

log "launching B7"
env -u CLAUDECODE -u CLAUDE_CODE_ENTRYPOINT nohup claude -p "$(cat prompts/B7.md)" \
  --model sonnet --permission-mode acceptEdits \
  --allowedTools "Edit,Write,Read,Glob,Grep,Bash,Task" > b7.log 2>&1 &
log "B7 launched: $!"
