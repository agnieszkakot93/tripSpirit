#!/usr/bin/env bash
# Scoped tests for risk-area files only (test-plan.md Risk #1: trip API ownership).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

INPUT="$(read_hook_input)"
FILE="$(get_edited_file "$INPUT")"

if [[ -z "$FILE" ]] || ! is_lintable_source_file "$FILE"; then
  exit 0
fi

if ! is_risk_area_file "$FILE"; then
  exit 0
fi

cd "$(project_root)"

OUTPUT=""
if ! OUTPUT="$(AI_AGENT=1 npx vitest related "$FILE" --run 2>&1)"; then
  fail_with_output "vitest related" "$OUTPUT"
fi

if [[ -n "$OUTPUT" ]]; then
  printf '%s\n' "$OUTPUT"
fi

exit 0
