#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
LOG_DIR="${PROJECT_ROOT}/knowledge/experiments"
LOG_FILE="${LOG_DIR}/self-correction-$(date -u +%Y%m%dT%H%M%SZ).log"

mkdir -p "${LOG_DIR}"

pushd "${PROJECT_ROOT}" >/dev/null

{
  echo "[#] Nightly self-correction run"
  echo "timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "project_root=${PROJECT_ROOT}"
  echo
  ./test-self-correction.sh
} | tee "${LOG_FILE}"

popd >/dev/null

echo "Saved experiment log to ${LOG_FILE}"
