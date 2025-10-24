#!/bin/bash

echo "🚀 Starting HRM Service"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${SCRIPT_DIR}"

# Use the active repository path so the script keeps working if the project is moved
HRM_ENTRY="${PROJECT_ROOT}/python-services/hrm-service.py"

if [[ ! -f "${HRM_ENTRY}" ]]; then
  echo "❌ Could not find HRM service at ${HRM_ENTRY}"
  exit 1
fi

export HRM_PORT=${HRM_PORT:-8002}
echo "⚙️  HRM service port: ${HRM_PORT}"

exec python3 "${HRM_ENTRY}" --port "${HRM_PORT}"
