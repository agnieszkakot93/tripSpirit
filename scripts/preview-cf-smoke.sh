#!/usr/bin/env bash
# Smoke-test the OpenNext / workerd runtime (production-like) on :8787.
#
# Catches layout/header/callbackUrl differences that `next dev` hides — e.g.
# `(protected)/layout.tsx` reads `x-opennext-initial-url`, which OpenNext sets
# on workerd but Playwright omits against port 3000 unless injected.
#
# Usage:
#   ./scripts/preview-cf-smoke.sh              # build:cf + preview + curl checks
#   SKIP_BUILD=1 ./scripts/preview-cf-smoke.sh # reuse an existing build:cf output
#   npm run smoke:cf
#
# CI: `.github/workflows/preview-cf-smoke.yml` (nightly + manual dispatch).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DB_NAME="tripsprint-ai-db"
PORT="${PREVIEW_CF_PORT:-8787}"
BASE_URL="http://localhost:${PORT}"
COOKIE_JAR="$(mktemp)"
PREVIEW_PID=""
CREATED_DEV_VARS=0

die() {
  echo "error: $*" >&2
  exit 1
}

cleanup() {
  if [[ -n "$PREVIEW_PID" ]] && kill -0 "$PREVIEW_PID" 2>/dev/null; then
    echo "→ stopping preview:cf (pid $PREVIEW_PID)"
    kill "$PREVIEW_PID" 2>/dev/null || true
  fi
  stop_preview_port
  rm -f "$COOKIE_JAR"
  if [[ "$CREATED_DEV_VARS" == "1" && -f .dev.vars ]]; then
    rm -f .dev.vars
  fi
}
trap cleanup EXIT INT TERM

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
  if [[ -f .dev.vars ]]; then
    return
  fi

  {
    echo "AUTH_SECRET=$(openssl rand -hex 32)"
    echo "AUTH_URL=${BASE_URL}"
    echo "AUTH_TRUST_HOST=true"
  } >.dev.vars
  CREATED_DEV_VARS=1
  echo "→ wrote temporary .dev.vars for smoke run"
}

migrate_db() {
  echo "→ applying D1 migrations to local database ($DB_NAME)…"
  npx wrangler d1 migrations apply "$DB_NAME" --local
}

build_cf() {
  if [[ "${SKIP_BUILD:-}" == "1" ]]; then
    echo "→ SKIP_BUILD=1 — skipping npm run build:cf"
    [[ -f .open-next/worker.js ]] || die ".open-next/worker.js missing; run npm run build:cf first"
    return
  fi
  echo "→ building OpenNext Cloudflare bundle…"
  npm run build:cf
}

stop_preview_port() {
  if ! command -v lsof >/dev/null 2>&1; then
    return
  fi
  local pids
  pids="$(lsof -ti tcp:"$PORT" 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "→ stopping process(es) on port $PORT: $pids"
    kill $pids 2>/dev/null || true
    sleep 1
  fi
}

start_preview() {
  stop_preview_port
  echo "→ starting preview:cf on ${BASE_URL}…"
  # Override production AUTH_URL from wrangler.jsonc for local workerd preview.
  npm run preview:cf -- --var "AUTH_URL:${BASE_URL}" --port "$PORT" >/tmp/preview-cf-smoke.log 2>&1 &
  PREVIEW_PID=$!
}

wait_for_server() {
  require_cmd curl
  local attempt
  echo "→ waiting for ${BASE_URL}/login…"
  for attempt in $(seq 1 120); do
    if curl -sf "${BASE_URL}/login" >/dev/null 2>&1; then
      echo "✓ preview server ready"
      return
    fi
    if ! kill -0 "$PREVIEW_PID" 2>/dev/null; then
      echo "--- preview:cf log (tail) ---" >&2
      tail -n 40 /tmp/preview-cf-smoke.log >&2 || true
      die "preview:cf exited before becoming ready"
    fi
    sleep 1
  done
  die "timed out waiting for preview server on port $PORT"
}

assert_login_page() {
  local body
  body="$(curl -sf "${BASE_URL}/login")"
  if ! grep -q "Sign in" <<<"$body"; then
    die "/login did not return the sign-in page"
  fi
  echo "✓ GET /login returns sign-in page"
}

assert_unauth_redirect() {
  local headers location
  headers="$(curl -sSI "${BASE_URL}/trips")"
  location="$(printf '%s' "$headers" | awk 'tolower($1)=="location:" { sub(/\r$/,"",$2); print $2; exit }')"
  if [[ -z "$location" ]]; then
    die "GET /trips did not redirect unauthenticated visitors (expected Location header)"
  fi
  if [[ "$location" != *"/login"* ]]; then
    die "unauthenticated /trips redirect expected /login, got: $location"
  fi
  if [[ "$location" != *"callbackUrl="* ]] || [[ "$location" != *"%2Ftrips"* && "$location" != *"/trips"* ]]; then
    die "unauthenticated /trips redirect missing callbackUrl=/trips (x-opennext-initial-url): $location"
  fi
  echo "✓ GET /trips redirects to login with callbackUrl (workerd OpenNext header path)"
}

register_user() {
  local email="$1" password="$2"
  local status
  status="$(curl -sS -o /tmp/preview-cf-register.json -w '%{http_code}' \
    -X POST "${BASE_URL}/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${email}\",\"password\":\"${password}\"}")"
  if [[ "$status" != "201" ]]; then
    echo "register response:" >&2
    cat /tmp/preview-cf-register.json >&2 || true
    die "POST /api/auth/register failed with HTTP $status"
  fi
  echo "✓ registered smoke user"
}

sign_in_user() {
  local email="$1" password="$2"
  local csrf_token status location

  csrf_token="$(curl -sS -c "$COOKIE_JAR" "${BASE_URL}/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')"
  [[ -n "$csrf_token" ]] || die "could not read csrfToken from /api/auth/csrf"

  status="$(curl -sS -b "$COOKIE_JAR" -c "$COOKIE_JAR" -D /tmp/preview-cf-signin-headers.txt -o /tmp/preview-cf-signin.json -w '%{http_code}' \
    -X POST "${BASE_URL}/api/auth/callback/credentials" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "csrfToken=${csrf_token}" \
    --data-urlencode "email=${email}" \
    --data-urlencode "password=${password}" \
    --data-urlencode "callbackUrl=/trips" \
    --data-urlencode "json=true")"
  location="$(awk 'tolower($1)=="location:" { sub(/\r$/,"",$2); print $2; exit }' /tmp/preview-cf-signin-headers.txt)"
  if [[ "$status" == "200" ]]; then
    echo "✓ signed in via Auth.js credentials callback"
    return
  fi
  if [[ "$status" == "302" && "$location" == *"/trips"* && ! "$location" == *"error="* ]]; then
    echo "✓ signed in via Auth.js credentials callback (302 → /trips)"
    return
  fi
  echo "sign-in response (HTTP $status, Location: $location):" >&2
  cat /tmp/preview-cf-signin.json >&2 || true
  die "credentials sign-in failed"
}

assert_authenticated_trips() {
  local body
  body="$(curl -sf -b "$COOKIE_JAR" "${BASE_URL}/trips")"
  if ! grep -qi "Plan your first city break" <<<"$body"; then
    die "GET /trips with session did not render the authenticated trips workspace"
  fi
  echo "✓ GET /trips renders authenticated workspace under workerd"
}

main() {
  require_cmd npm
  require_cmd npx
  require_cmd curl
  require_cmd openssl

  ensure_deps
  ensure_dev_vars
  migrate_db
  build_cf
  start_preview
  wait_for_server

  assert_login_page
  assert_unauth_redirect

  local email="smoke-cf-$(date +%s)@example.com"
  local password="password123"
  register_user "$email" "$password"
  sign_in_user "$email" "$password"
  assert_authenticated_trips

  echo ""
  echo "preview:cf smoke passed on ${BASE_URL}"
}

main "$@"
