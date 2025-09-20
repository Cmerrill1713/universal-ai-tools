# Repository Audit and Coverage Report
Purpose: Provide auditable evidence of a full-repo pass, list major areas, and capture current build health and integration points. This complements existing docs and avoids duplicated work by making the landscape explicit.
## Top-Level Directories (surveyed)
- PRPs: Product requirements and planning notes

- UniversalAICompanionPackage, UniversalAITools, UniversalAIToolsPackage, UniversalAIToolsMac*: Swift app/workspace/package variants

- crates: Rust workspace crates (routing, orchestration, vision, vector-db, redis, etc.)

- go-services, go-api-gateway: Go microservices and gateway

- nodejs-api-server: Legacy Node/MCP server for UI and Claude tools

- rust-services: Additional Rust services (ab-mcts-service, parameter analytics, etc.)

- docker, k8s, kubernetes, nginx, kong: Infra and deployment

- supabase: Migrations, functions, local stack integration

- scripts, enterprise-dev-toolkit, project-manager-assistant: Tooling and automation

- python-services: Experimental Python services (e.g., vector-db service)

- monitoring (via docker-compose + prom/grafana configs under monitoring/* and docker/)

- data, datasets, models, public, uploads, logs: Assets and runtime data

- searxng, swift-companion-app, working-todo-app, projects: ancillary apps/samples
See `ls -1d */` output in shell history for the full list (captured at time of audit).
## Rust Workspace — Crates and Status
- fast-llm-coordinator: OK (cargo check) — Coordinator lib with routing/load-balancing/HTTP execution to Ollama/LM Studio

- vision-service: OK — Axum server with mock Vision/OCR/generation

- voice-processing: OK — N-API addon, placeholders for ASR/TTS

- vector-db: OK — In-memory index with API, needs embeddings integration

- redis-service: OK — Redis client/cache with in-memory fallback, warnings only

- llm-router: bin fails (format string in src/main.rs:44); library scaffolding present (providers/config/context/streaming)

- agent-orchestrator: compiles (as lib), rich configs; missing integrated execution endpoints

- ai-orchestration-platform: does not compile (missing types & absent bins); treat as design scaffold

- Disabled/parked crates present: vision-processor, monitoring-system, testing-framework, ml-inference, vision-resource-manager (disabled), etc.
## Go Services — Overview
- API Gateway, Auth, Chat, Memory, Load Balancer, Cache Coordinator, Metrics Aggregator, WebSocket Hub

- Orchestrated via docker-compose and `main.go` service manager (supervision + health checks)

- Weaviate client presence (`go-services/weaviate-client`) and memory-service integration points
## Node — Legacy Bridge
- nodejs-api-server: Legacy UI/MCP tools; used for quick testing and Claude Desktop integration
## Swift — macOS UI
- UniversalAITools* packages and workspaces; `UniversalAICompanionPackage` contains feature code

- Backend integration requires `API_BASE_URL` to point to local services (e.g., `http://localhost:3033`)
## Data & Persistence
- Postgres/Supabase (Docker): dev stack and migrations under `supabase/`

- Redis: cache/session; volume `redis_data` in compose

- Vector DB: Weaviate optional (via docker), `WEAVIATE_URL` env; pgvector alternative via Supabase
## Docker/K8s
- docker-compose.yml: Dev full stack (Postgres, Redis, Ollama, Nginx, Prom/Grafana, optional tools)

- docker-compose.prod.yml: Minimal production services; run DB/LLM separately

- docker/production.env includes `WEAVIATE_URL`; k8s manifests under `k8s/`
## Key Mismatches / Action Items (Docs reflected)
- llm-router bin compile error — fix format string or disable bin to keep workspace green

- ai-orchestration-platform not buildable — remove from workspace or gate; design-only for now

- Swift `API_BASE_URL` must be set to local backend

- Documented attach points for Docker host vs service DNS names across Postgres/Redis/Weaviate/LLM
## References to Updated Docs
- README.md — Monorepo overview and quick links

- LOCAL_ASSISTANT_VISION_AND_ROADMAP.md — Build status, attach points, and next actions

- ENVIRONMENT_VARIABLES.md — Vector DB envs and pgvector alternative

- DOCKER_INFRASTRUCTURE.md — Optional Weaviate snippet and prod vs dev note

- AGENT_COORDINATION.md / AGENT_HANDOFF_TEMPLATE.md — Docs review rules

- docs/DOCS_REVIEW_RULES.md — No-duplication policy and discovery recipes

- .github/pull_request_template.md and .github/workflows/docs-review-check.yml — Enforcement
## Suggested Next Technical Steps
1) Fix/disable llm-router bin to green the workspace

2) Gate ai-orchestration-platform or remove from workspace

3) Scaffold assistantd (Axum) and wire Redis/Postgres/Weaviate

4) Implement Ollama provider + SSE streaming and embeddings in llm-router

5) Add vector-db snapshot/persistence for dev fallback
(See LOCAL_ASSISTANT_VISION_AND_ROADMAP.md for the full roadmap.)
