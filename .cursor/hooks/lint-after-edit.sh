#!/usr/bin/env bash
# Per-edit lint: ESLint --fix on the edited source file (FR/test-plan gate: lint).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

INPUT="$(read_hook_input)"
FILE="$(get_edited_file "$INPUT")"

if [[ -z "$FILE" ]] || ! is_lintable_source_file "$FILE"; then
  exit 0
fi

cd "$(project_root)"

OUTPUT=""
if ! OUTPUT="$(npx eslint --fix "$FILE" --quiet 2>&1)"; then
  fail_with_output "eslint" "$OUTPUT"
fi

if [[ -n "$OUTPUT" ]]; then
  printf '%s\n' "$OUTPUT"
fi

exit 0
