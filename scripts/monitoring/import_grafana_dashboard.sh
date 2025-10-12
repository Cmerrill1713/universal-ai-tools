#!/usr/bin/env bash
set -euo pipefail

GRAFANA_URL="${GRAFANA_URL:-http://127.0.0.1:3001}"
GRAFANA_USER="${GRAFANA_USER:-admin}"
GRAFANA_PASS="${GRAFANA_PASS:-admin}"

echo "📊 Importing TRM Evolution Dashboard to Grafana..."

# Import dashboard using basic auth
curl -sS -X POST "${GRAFANA_URL}/api/dashboards/db" \
  -u "${GRAFANA_USER}:${GRAFANA_PASS}" \
  -H "Content-Type: application/json" \
  --data "{\"dashboard\": $(cat dashboards/trm_evolution_overview.json), \"folderId\": 0, \"overwrite\": true}" \
  | jq -r '.url // .message'

echo "✅ Imported TRM Evolution Overview"
echo "   View at: ${GRAFANA_URL}/d/trm-evolution"

