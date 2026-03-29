#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  ./test.sh
  ./test.sh --coverage
  ./test.sh --unit-only

Options:
  --coverage   Run Vitest with coverage reporting.
  --unit-only  Run only the Vitest suite and skip lint/typecheck.
  --help       Show this help message.
USAGE
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

RUN_COVERAGE=false
RUN_UNIT_ONLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --coverage)
      RUN_COVERAGE=true
      ;;
    --unit-only)
      RUN_UNIT_ONLY=true
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac

  shift
done

if [[ "${RUN_UNIT_ONLY}" == false ]]; then
  echo "Running ESLint..."
  npm run lint

  echo "Running TypeScript typecheck..."
  npm run typecheck
fi

if [[ "${RUN_COVERAGE}" == true ]]; then
  echo "Running Vitest with coverage..."
  npm run test:coverage
else
  echo "Running Vitest..."
  npm test
fi

echo "All requested test checks passed."
