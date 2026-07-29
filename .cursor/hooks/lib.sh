#!/usr/bin/env bash
# Shared helpers for Cursor afterFileEdit hooks (m3l3).
set -euo pipefail

read_hook_input() {
  cat
}

get_edited_file() {
  local input="$1"
  echo "$input" | jq -r '.file_path // empty'
}

is_lintable_source_file() {
  local file="$1"
  case "$file" in
    *.ts | *.tsx | *.js | *.jsx | *.mjs | *.cjs) return 0 ;;
    *) return 1 ;;
  esac
}

# Risk #1 (trip API ownership) + adjacent trip/auth modules from test-plan.md §2.
is_risk_area_file() {
  local file="$1"
  case "$file" in
    */src/app/api/trips/* | */src/lib/trips/* | */src/lib/auth-credentials.ts | */src/lib/password.ts | */src/app/api/auth/*)
      return 0
      ;;
    *) return 1 ;;
  esac
}

project_root() {
  cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd
}

fail_with_output() {
  local label="$1"
  local output="$2"
  printf '%s\n' "$output"
  printf '\n[%s] Fix the issues above before continuing.\n' "$label" >&2
  exit 2
}
