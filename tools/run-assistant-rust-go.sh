#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
export RUST_LOG=${RUST_LOG:-info}

GATEWAY_PORT=${API_GATEWAY_PORT:-9999}
LLM_ROUTER_PORT=${LLM_ROUTER_PORT:-3033}
ASSISTANTD_PORT=${ASSISTANTD_PORT:-8016}
KG_PORT=${KNOWLEDGE_GATEWAY_PORT:-8088}
KSYNC_PORT=${KNOWLEDGE_SYNC_PORT:-8089}
KCTX_PORT=${KNOWLEDGE_CONTEXT_PORT:-8091}
REDIS_PORT=${REDIS_PORT:-6379}

cleanup() {
  echo "\nShutting down..."
  [[ -n "${LLM_ROUTER_PID:-}" ]] && kill "$LLM_ROUTER_PID" 2>/dev/null || true
  [[ -n "${ASSISTANTD_PID:-}" ]] && kill "$ASSISTANTD_PID" 2>/dev/null || true
  [[ -n "${GATEWAY_PID:-}" ]] && kill "$GATEWAY_PID" 2>/dev/null || true
  [[ -n "${KG_PID:-}" ]] && kill "$KG_PID" 2>/dev/null || true
  [[ -n "${KSYNC_PID:-}" ]] && kill "$KSYNC_PID" 2>/dev/null || true
  [[ -n "${KCTX_PID:-}" ]] && kill "$KCTX_PID" 2>/dev/null || true
  [[ -n "${REDIS_PID:-}" ]] && kill "$REDIS_PID" 2>/dev/null || true
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
cargo build -q -p llm-router -p assistantd -p librarian-coordinator

echo "🔧 Building Go knowledge services (gateway, sync, context)..."
pushd "$ROOT_DIR" >/dev/null
go build ./knowledge-grounding/gateway/cmd  >/dev/null 2>&1 || true
go build ./knowledge-grounding/sync/cmd     >/dev/null 2>&1 || true
go build ./knowledge-grounding/context/cmd  >/dev/null 2>&1 || true
popd >/dev/null

LLM_ROUTER_PORT=$(pick_port "$LLM_ROUTER_PORT")
echo "🚀 Starting LLM Router on :$LLM_ROUTER_PORT"
(
  cd "$ROOT_DIR"
  LLM_ROUTER_PORT="$LLM_ROUTER_PORT" cargo run -q -p llm-router
) & LLM_ROUTER_PID=$!

wait_for "http://localhost:$LLM_ROUTER_PORT/health" "llm-router"

ASSISTANTD_PORT=$(pick_port "$ASSISTANTD_PORT")
echo "🤖 Starting assistantd on :$ASSISTANTD_PORT (LLM Router :$LLM_ROUTER_PORT)"
(
  cd "$ROOT_DIR"
  ASSISTANTD_PORT="$ASSISTANTD_PORT" \
  LLM_ROUTER_URL="http://localhost:$LLM_ROUTER_PORT" \
  KNOWLEDGE_CONTEXT_URL="http://localhost:8055" \
  cargo run -q -p assistantd
) & ASSISTANTD_PID=$!

wait_for "http://localhost:$ASSISTANTD_PORT/health" "assistantd"

GATEWAY_PORT=$(pick_port "$GATEWAY_PORT")
echo "🧰 Starting Go API gateway on :$GATEWAY_PORT"
(
  cd "$ROOT_DIR"
  API_GATEWAY_PORT="$GATEWAY_PORT" \
  ASSISTANTD_URL="http://localhost:$ASSISTANTD_PORT" \
  LLM_ROUTER_URL="http://localhost:$LLM_ROUTER_PORT" \
  KNOWLEDGE_GATEWAY_URL="http://localhost:8055" \
  KNOWLEDGE_CONTEXT_URL="http://localhost:8055" \
  go run go-services/api-gateway/main.go
) & GATEWAY_PID=$!

wait_for "http://localhost:$GATEWAY_PORT/health" "api-gateway"

echo "📚 Starting Librarian Coordinator on :8055"
(
  cd "$ROOT_DIR"
  LIBRARIAN_COORDINATOR_PORT=8055 \
  KNOWLEDGE_CONTEXT_URLS="http://localhost:8091,http://localhost:8083" \
  KNOWLEDGE_GATEWAY_URLS="http://localhost:8088" \
  cargo run -q -p librarian-coordinator
) & LIBRARIAN_PID=$!

wait_for "http://localhost:8055/health" "librarian-coordinator"

if [[ "${KNOWLEDGE_IN_DOCKER:-}" == "1" ]]; then
  echo "🐳 Starting knowledge stack via Docker Compose (docker-compose.knowledge-grounding.yml)"
  if command -v docker >/dev/null 2>&1; then
    # Use docker compose v2 if available; fallback to docker-compose
    if docker compose version >/dev/null 2>&1; then
      docker compose -f "$ROOT_DIR/docker-compose.knowledge-grounding.yml" up -d knowledge-gateway
    elif command -v docker-compose >/dev/null 2>&1; then
      docker-compose -f "$ROOT_DIR/docker-compose.knowledge-grounding.yml" up -d knowledge-gateway
    else
      echo "❌ docker compose not found"
    fi
    # Wait for gateway and redis host-mapped ports
    wait_for "http://localhost:8088/health" "knowledge-gateway" || true
    # Redis is mapped on 6379 in compose; simple wait by ping curl won't work; sleep briefly
    sleep 1
  else
    echo "❌ Docker not installed; cannot start knowledge stack in containers"
  fi
else
  REDIS_PORT=$(pick_port "$REDIS_PORT")
  if command -v redis-server >/dev/null 2>&1; then
    echo "🧠 Starting Redis on :$REDIS_PORT"
    redis-server --port "$REDIS_PORT" --save "" --appendonly no >/dev/null 2>&1 & REDIS_PID=$!
    sleep 0.5
  else
    echo "⚠️ redis-server not found; knowledge services will run without cache"
  fi

  KG_PORT=$(pick_port "$KG_PORT")
  echo "📚 Starting Knowledge Gateway on :$KG_PORT"
  (
    cd "$ROOT_DIR/knowledge-grounding/gateway"
    PORT="$KG_PORT" \
    REDIS_URL="localhost:$REDIS_PORT" \
    CHAT_SERVICE_URL="http://localhost:$GATEWAY_PORT/api/v1/assistant" \
    go run ./cmd/main.go
  ) & KG_PID=$!

  wait_for "http://localhost:$KG_PORT/health" "knowledge-gateway" || true

  KSYNC_PORT=$(pick_port "$KSYNC_PORT")
  echo "🔁 Starting Knowledge Sync on :$KSYNC_PORT"
  (
    cd "$ROOT_DIR/knowledge-grounding/sync"
    PORT="$KSYNC_PORT" \
    REDIS_URL="localhost:$REDIS_PORT" \
    go run ./cmd/main.go
  ) & KSYNC_PID=$!

  wait_for "http://localhost:$KSYNC_PORT/health" "knowledge-sync" || true

  KCTX_PORT=$(pick_port "$KCTX_PORT")
  echo "🧩 Starting Knowledge Context on :$KCTX_PORT"
  (
    cd "$ROOT_DIR/knowledge-grounding/context"
    PORT="$KCTX_PORT" \
    KNOWLEDGE_GATEWAY_URL="http://localhost:$KG_PORT" \
    go run ./cmd/main.go
  ) & KCTX_PID=$!

  wait_for "http://localhost:$KCTX_PORT/health" "knowledge-context" || true
fi

cat <<EOF

All set (Rust + Go stack)! Endpoints:
- API Gateway:       http://localhost:$GATEWAY_PORT
- Health:            http://localhost:$GATEWAY_PORT/health
- Assistant Chat:    http://localhost:$GATEWAY_PORT/api/v1/assistant/chat
- Assistant Stream:  http://localhost:$GATEWAY_PORT/api/v1/assistant/stream
- LLM Router health: http://localhost:$LLM_ROUTER_PORT/health
- assistantd health: http://localhost:$ASSISTANTD_PORT/health
- Knowledge Gateway: http://localhost:$KG_PORT/health
$( [[ "${KNOWLEDGE_IN_DOCKER:-}" == "1" ]] && echo "- Knowledge Gateway: http://localhost:8088/health" )
$( [[ "${KNOWLEDGE_IN_DOCKER:-}" == "1" ]] && echo "- Redis:             redis://localhost:6379" )
$( [[ "${KNOWLEDGE_IN_DOCKER:-}" != "1" ]] && echo "- Knowledge Sync:    http://localhost:$KSYNC_PORT/health" )
$( [[ "${KNOWLEDGE_IN_DOCKER:-}" != "1" ]] && echo "- Knowledge Context: http://localhost:$KCTX_PORT/health" )
$( [[ "${KNOWLEDGE_IN_DOCKER:-}" != "1" ]] && echo "- Redis:             redis://localhost:$REDIS_PORT" )

Try:
curl -s -X POST http://localhost:$GATEWAY_PORT/api/v1/assistant/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Hello from Rust+Go!"}]}' | jq .

Stream (SSE):
curl -N -s -X POST http://localhost:$GATEWAY_PORT/api/v1/assistant/stream \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Stream a response"}]}'

Knowledge search:
curl -s -X POST http://localhost:$KG_PORT/api/v1/search -H 'Content-Type: application/json' \
  -d '{"query":"What is knowledge grounding?","limit":3}' | jq .

Press CTRL+C to stop.
EOF

wait
