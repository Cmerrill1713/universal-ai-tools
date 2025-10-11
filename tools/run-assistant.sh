#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
export RUST_LOG=${RUST_LOG:-info}

GATEWAY_PORT=${PORT:-8085}
LLM_ROUTER_PORT=${LLM_ROUTER_PORT:-3033}
ASSISTANTD_PORT=${ASSISTANTD_PORT:-3034}

command -v node >/dev/null 2>&1 || { echo "node not found"; exit 1; }
command -v cargo >/dev/null 2>&1 || { echo "cargo not found"; exit 1; }

cleanup() {
  echo "\nShutting down..."
  [[ -n "${LLM_ROUTER_PID:-}" ]] && kill "$LLM_ROUTER_PID" 2>/dev/null || true
  [[ -n "${ASSISTANTD_PID:-}" ]] && kill "$ASSISTANTD_PID" 2>/dev/null || true
  [[ -n "${GATEWAY_PID:-}" ]] && kill "$GATEWAY_PID" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

wait_for() {
  local url=$1; local name=${2:-service}; local retries=${3:-60}
  for i in $(seq 1 "$retries"); do
    if curl -sSf "$url" >/dev/null 2>&1; then
      echo "✅ $name is up: $url"
      return 0
    fi
    sleep 0.5
  done
  echo "❌ Timeout waiting for $name at $url" >&2
  return 1
}

is_port_free() {
  local port=$1
  if command -v lsof >/dev/null 2>&1; then
    ! lsof -iTCP -sTCP:LISTEN -nP | awk '{print $9}' | grep -q ":$port$"
  else
    (echo > /dev/tcp/127.0.0.1/$port) >/dev/null 2>&1 && return 1 || return 0
  fi
}

pick_port() {
  local start=$1
  local p=$start
  for i in $(seq 0 20); do
    if is_port_free "$p"; then echo "$p"; return 0; fi
    p=$((p+1))
  done
  echo "$start"
}

echo "🔧 Building Rust services (llm-router, assistantd)..."
cargo build -q -p llm-router -p assistantd

LLM_ROUTER_PORT=$(pick_port "$LLM_ROUTER_PORT")
echo "🚀 Starting LLM Router on :$LLM_ROUTER_PORT"
(
  cd "$ROOT_DIR"
  LLM_ROUTER_PORT="$LLM_ROUTER_PORT" cargo run -q -p llm-router
) & LLM_ROUTER_PID=$!

wait_for "http://localhost:$LLM_ROUTER_PORT/health" "llm-router"

ASSISTANTD_PORT=$(pick_port "$ASSISTANTD_PORT")
echo "🤖 Starting assistantd (wired to LLM Router at :$LLM_ROUTER_PORT)"
(
  cd "$ROOT_DIR"
  ASSISTANTD_PORT="$ASSISTANTD_PORT" \
  LLM_ROUTER_URL="http://localhost:$LLM_ROUTER_PORT" \
  cargo run -q -p assistantd
) & ASSISTANTD_PID=$!

wait_for "http://localhost:$ASSISTANTD_PORT/health" "assistantd"

GATEWAY_PORT=$(pick_port "$GATEWAY_PORT")
echo "🧰 Starting Node gateway on :$GATEWAY_PORT"
(
  cd "$ROOT_DIR"
  PORT="$GATEWAY_PORT" ASSISTANTD_URL="http://localhost:$ASSISTANTD_PORT" node server/gateway.mjs
) & GATEWAY_PID=$!

wait_for "http://localhost:$GATEWAY_PORT/health" "gateway"

cat <<EOF

All set! Endpoints:
- Gateway:           http://localhost:$GATEWAY_PORT
- Health:            http://localhost:$GATEWAY_PORT/health
- Chat:              http://localhost:$GATEWAY_PORT/api/v1/assistant/chat
- assistantd health: http://localhost:$ASSISTANTD_PORT/health
- LLM Router:        http://localhost:$LLM_ROUTER_PORT/health

Try:
curl -s -X POST http://localhost:$GATEWAY_PORT/api/v1/assistant/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Hello!"}]}' | jq .

Press CTRL+C to stop.
EOF

wait
