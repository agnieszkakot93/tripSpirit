#!/usr/bin/env bash
# Start TripSprint AI locally with D1 migrations applied.
#
# Usage:
#   ./scripts/dev-local.sh              # migrate + start dev server (default)
#   ./scripts/dev-local.sh migrate      # apply D1 migrations only
#   ./scripts/dev-local.sh dev          # start dev server (skip migrate)
#   ./scripts/dev-local.sh restart      # stop stale server, clear cache, start fresh
#   ./scripts/dev-local.sh repair       # fix workerd crashes (reinstall + clear runtime cache)
#   ./scripts/dev-local.sh stop         # stop dev server on port 3000
#   npm run dev:stop                    # same as stop
#
# Local dev uses wrangler.dev.jsonc (D1 + secrets only). Production deploy
# still uses wrangler.jsonc. You may see one harmless workerd line on the
# very first request after startup; ignore it if pages return 200.
#   ./scripts/dev-local.sh db [SQL]     # run SQL against local D1
#   ./scripts/dev-local.sh db-shell     # interactive sqlite3 REPL on local D1
#
# App:      http://localhost:3000
# Database: local D1 (tripsprint-ai-db) via wrangler / sqlite3

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DB_NAME="tripsprint-ai-db"
APP_URL="http://localhost:3000"
DEV_PORT="${PORT:-3000}"

die() {
  echo "error: $*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

ensure_deps() {
  if [[ ! -d node_modules ]]; then
    echo "→ installing dependencies…"
    npm install
  fi
}

ensure_dev_vars() {
  if [[ ! -f .dev.vars ]]; then
    echo "warning: .dev.vars not found — auth and AI routes need secrets"
    echo "         copy .env.example → .dev.vars and fill in values"
    return
  fi

  if ! grep -q '^AUTH_SECRET=.\+' .dev.vars 2>/dev/null; then
    echo "warning: AUTH_SECRET is missing or empty in .dev.vars — sign-in will fail"
  fi

  if grep -q '^AUTH_URL=http://localhost:8787' .dev.vars 2>/dev/null; then
    echo "warning: AUTH_URL in .dev.vars is http://localhost:8787"
    echo "         for 'next dev' it must be $APP_URL or sessions may break"
  fi
}

ensure_workerd() {
  local arch os
  os="$(uname -s)"
  arch="$(uname -m)"
  if [[ "$os" == "Darwin" && "$arch" == "arm64" ]]; then
    echo "→ aligning workerd binaries for darwin-arm64…"
    npm install workerd @cloudflare/workerd-darwin-arm64 --force
  fi
}

repair_runtime() {
  echo "→ repairing OpenNext / workerd local runtime…"
  stop_dev
  clear_dev_cache
  rm -rf .wrangler/tmp
  ensure_workerd
  migrate_db
  echo "✓ repair complete — run: $0 start"
}

stop_dev() {
  if ! command -v lsof >/dev/null 2>&1; then
    die "lsof is required to stop the dev server"
  fi

  local pids
  pids="$(lsof -ti tcp:"$DEV_PORT" 2>/dev/null || true)"
  if [[ -z "$pids" ]]; then
    echo "✓ no process listening on port $DEV_PORT"
    return
  fi

  echo "→ stopping process(es) on port $DEV_PORT: $pids"
  kill $pids 2>/dev/null || true
  sleep 1

  pids="$(lsof -ti tcp:"$DEV_PORT" 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "→ force-stopping remaining process(es): $pids"
    kill -9 $pids 2>/dev/null || true
  fi

  echo "✓ dev server stopped"
}

clear_dev_cache() {
  echo "→ clearing .next cache"
  rm -rf .next
}

migrate_db() {
  echo "→ applying D1 migrations to local database ($DB_NAME)…"
  npx wrangler d1 migrations apply "$DB_NAME" --local
  echo "✓ migrations applied"
}

find_local_d1_file() {
  local dir=".wrangler/state/v3/d1/miniflare-D1DatabaseObject"
  local f

  if [[ ! -d "$dir" ]]; then
    return 1
  fi

  for f in "$dir"/*.sqlite; do
    [[ -e "$f" ]] || continue
    [[ "$(basename "$f")" == "metadata.sqlite" ]] && continue
    if sqlite3 "$f" "SELECT 1 FROM sqlite_master WHERE type='table' AND name='trips' LIMIT 1;" 2>/dev/null | grep -q 1; then
      echo "$f"
      return 0
    fi
  done

  return 1
}

run_db_query() {
  local sql="${1:-}"
  require_cmd sqlite3

  if [[ -z "$sql" ]]; then
    die "usage: $0 db \"SELECT …\""
  fi

  migrate_db >/dev/null 2>&1 || true

  echo "→ $sql"
  npx wrangler d1 execute "$DB_NAME" --local --command "$sql"
}

open_db_shell() {
  require_cmd sqlite3
  local db_file

  migrate_db >/dev/null 2>&1 || true

  db_file="$(find_local_d1_file || true)"
  if [[ -z "$db_file" ]]; then
    echo "Local D1 file not found yet. Start the dev server once, then retry."
    echo "Or run a query with: $0 db \"SELECT * FROM trips LIMIT 5;\""
    exit 1
  fi

  echo "→ sqlite3 $db_file"
  echo "  tables: users, trips, sessions, accounts, verification_tokens"
  sqlite3 -header -column "$db_file"
}

warmup_dev() {
  require_cmd curl
  local attempt

  for attempt in $(seq 1 40); do
    if curl -sf "http://127.0.0.1:${DEV_PORT}/login" >/dev/null 2>&1; then
      echo "→ warming workerd runtime…"
      local i
      for i in 1 2 3; do
        curl -sf "http://127.0.0.1:${DEV_PORT}/login" >/dev/null 2>&1 || true
        sleep 0.3
      done
      echo "✓ runtime warm"
      return
    fi
    sleep 0.25
  done
}

start_dev() {
  ensure_dev_vars
  if [[ -f .dev-ca-bundle.pem ]]; then
    export NODE_EXTRA_CA_CERTS="$ROOT/.dev-ca-bundle.pem"
    echo "→ using corporate CA bundle (.dev-ca-bundle.pem)"
  fi
  echo "→ starting dev server at $APP_URL (webpack — avoids Turbopack flash/crash loops)"
  echo "  (Ctrl+C to stop)"
  # --webpack: Turbopack + OpenNext workerd dev often panics and reloads the page in a loop.
  warmup_dev &
  local warmup_pid=$!
  trap 'kill "$warmup_pid" 2>/dev/null || true' EXIT INT TERM
  npx next dev --webpack -p "$DEV_PORT"
}

cmd="${1:-start}"
shift || true

case "$cmd" in
  start)
    require_cmd npm
    require_cmd npx
    ensure_deps
    ensure_workerd
    migrate_db
    start_dev
    ;;
  migrate)
    require_cmd npx
    ensure_deps
    migrate_db
    ;;
  dev)
    require_cmd npm
    require_cmd npx
    ensure_deps
    ensure_workerd
    start_dev
    ;;
  restart)
    require_cmd npm
    require_cmd npx
    ensure_deps
    stop_dev
    clear_dev_cache
    ensure_workerd
    migrate_db
    start_dev
    ;;
  repair)
    require_cmd npm
    require_cmd npx
    ensure_deps
    repair_runtime
    ;;
  stop)
    stop_dev
    ;;
  db)
    require_cmd npx
    ensure_deps
    if [[ $# -eq 0 ]]; then
      die "usage: $0 db \"SELECT id, destination FROM trips LIMIT 5;\""
    fi
    run_db_query "$*"
    ;;
  db-shell)
    require_cmd npx
    ensure_deps
    open_db_shell
    ;;
  help|-h|--help)
    sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
    ;;
  *)
    die "unknown command: $cmd (try: start | restart | repair | stop | migrate | dev | db | db-shell | help)"
    ;;
esac
