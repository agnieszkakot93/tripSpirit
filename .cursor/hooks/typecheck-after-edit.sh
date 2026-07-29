#!/usr/bin/env bash
# Per-edit typecheck: full-project tsc (small MVP; move to pre-commit if it slows the agent).
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
if ! OUTPUT="$(npx tsc --noEmit 2>&1)"; then
  fail_with_output "typecheck" "$OUTPUT"
fi

exit 0
