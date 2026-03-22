#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  ./pause.sh [project_id] [team_id_or_slug]

You can also provide values via env vars:
  VERCEL_PROJECT_ID=<project_id>
  VERCEL_TEAM_ID=<team_id>      # Example: team_xxxxx
  VERCEL_TEAM_SLUG=<team_slug>  # Example: my-team
  VERCEL_TOKEN=<bearer_token>

If .env exists in the repo root, values are loaded automatically.
USAGE
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "${value}"
}

if [[ -f "${ENV_FILE}" ]]; then
  while IFS= read -r line; do
    [[ -z "${line}" ]] && continue
    [[ "${line}" =~ ^[[:space:]]*# ]] && continue
    [[ "${line}" != *"="* ]] && continue

    key="$(trim "${line%%=*}")"
    value="$(trim "${line#*=}")"

    if [[ "${value}" == \"*\" && "${value}" == *\" ]]; then
      value="${value#\"}"
      value="${value%\"}"
    elif [[ "${value}" == \'*\' && "${value}" == *\' ]]; then
      value="${value#\'}"
      value="${value%\'}"
    fi

    case "${key}" in
      VERCEL_PROJECT_ID|VERCEL_TEAM_ID|VERCEL_TEAM_SLUG|VERCEL_TOKEN)
        export "${key}=${value}"
        ;;
    esac
  done < "${ENV_FILE}"
fi

PROJECT_ID="${1:-${VERCEL_PROJECT_ID:-}}"
TEAM_HINT="${2:-${VERCEL_TEAM_ID:-${VERCEL_TEAM_SLUG:-}}}"
VERCEL_TOKEN="${VERCEL_TOKEN:-}"

if [[ -z "${PROJECT_ID}" || -z "${VERCEL_TOKEN}" ]]; then
  usage
  echo "Error: both project ID and VERCEL_TOKEN are required." >&2
  exit 1
fi

QUERY=""
if [[ -n "${TEAM_HINT}" ]]; then
  if [[ "${TEAM_HINT}" == team_* ]]; then
    QUERY="?teamId=${TEAM_HINT}"
  else
    QUERY="?slug=${TEAM_HINT}"
  fi
fi

URL="https://api.vercel.com/v1/projects/${PROJECT_ID}/pause${QUERY}"

RESPONSE="$(
  curl --silent --show-error --write-out $'\n%{http_code}' \
    --request POST "${URL}" \
    --header "Authorization: Bearer ${VERCEL_TOKEN}" \
    --header "Content-Type: application/json"
)"

STATUS="$(printf '%s\n' "${RESPONSE}" | tail -n1)"
BODY="$(printf '%s\n' "${RESPONSE}" | sed '$d')"

if [[ "${STATUS}" == 2* ]]; then
  echo "Paused project ${PROJECT_ID}."
  exit 0
fi

echo "Failed to pause project ${PROJECT_ID}. HTTP ${STATUS}." >&2
if [[ -n "${BODY}" ]]; then
  echo "${BODY}" >&2
fi
exit 1
