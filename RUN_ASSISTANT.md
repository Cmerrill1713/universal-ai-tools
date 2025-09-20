**Overview**
- Starts a minimal end‑to‑end assistant stack locally (no Docker).
- Wires Node API, Rust assistantd, and optional Python bridges.

**Pre-reqs**
- Node 18+ installed
- Rust toolchain (`cargo`) installed
- Python 3.10+ (optional for vision/MLX bridges)

**Quick Start**
- Rust + Go stack: `./tools/run-assistant-rust-go.sh`
- Legacy Node gateway (optional): `./tools/run-assistant.sh`
- Stop with `CTRL+C` once; scripts handle cleanup.

Docker knowledge stack
- If your Knowledge services run in Docker, set `KNOWLEDGE_IN_DOCKER=1`:
- `KNOWLEDGE_IN_DOCKER=1 ./tools/run-assistant-rust-go.sh`
- This uses `docker compose -f docker-compose.knowledge-grounding.yml up -d knowledge-gateway` and waits for health.

**What it runs (Rust + Go)**
- Rust LLM Router: `crates/llm-router` on `3033`
- Rust assistantd: `crates/assistantd` on `8016` (default)
- Go API Gateway: `go-services/api-gateway` on `9999`
- Knowledge Gateway: `knowledge-grounding/gateway` on `8088`
- Knowledge Sync: `knowledge-grounding/sync` on `8089`
- Knowledge Context: `knowledge-grounding/context` on `8083` (matches compose)

**Assistant Endpoints**
- Chat (non-streaming): `POST /api/v1/assistant/chat`
- Chat (streaming/SSE passthrough): `POST /api/v1/assistant/stream` (proxied to assistantd `/chat/stream`)
- Knowledge Search: `POST /api/v1/knowledge/search`
- Knowledge Context Build: `POST /api/v1/context/context/build`

**Notes**
- Uses `.env` if present; falls back to safe defaults.
- If a port is busy, scripts pick a free port and print final URLs.

**Env Overrides**
- `API_GATEWAY_PORT` (default 9999)
- `LLM_ROUTER_PORT` (default 3033)
- `ASSISTANTD_PORT` (default 8016)
- `ASSISTANTD_URL`, `LLM_ROUTER_URL` for the gateway
- `KNOWLEDGE_GATEWAY_PORT` (default 8088)
- `KNOWLEDGE_SYNC_PORT` (default 8089)
- `KNOWLEDGE_CONTEXT_PORT` (default 8091)
- `KNOWLEDGE_GATEWAY_URL`, `KNOWLEDGE_CONTEXT_URL` for the gateway
- `REDIS_PORT` (default 6379)
