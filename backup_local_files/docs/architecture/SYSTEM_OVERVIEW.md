# Local Assistant Vision and Roadmap — SLM > Frontier (On‑Device)
## North Star
- Build a local‑first assistant that outperforms “frontier” cloud LLM usage for everyday and coding tasks through speed, privacy, reliability, and superior tool use/orchestration.

- Optimize end‑to‑end task completion, not single‑turn generation quality. Favor specialized SLM ensembles, retrieval, and tools over brute‑force model size.
Success Criteria (v1):

- p50 < 250ms for short actions (classify, route, recall, file ops); p95 < 1.2s for 30–60 token completions on device.

- >80% task success on our everyday + coding acceptance suites without external APIs.

- Zero network dependency for core flows; graceful degradation when optional services unavailable.
---
## Product Pillars
- Local‑First: Private by default; no external calls for core tasks.

- Fast/Interactive: Sub‑second, streaming, responsive UIs; predictive prefetching and caching.

- Tool‑Centric: Reliable, structured tool use (files, shell, git, search, calendar, notes, memory).

- Dev‑Ready: Deep code assistance in the user’s workspace; repo awareness; patch generation.

- Multimodal On‑Device: Voice (ASR/TTS) and Vision (OCR/captioning) with lightweight models.

- Observability: Metrics, traces, and test harnesses to measure “task completion quality”.
---
## Current Architecture (as‑is)
Rust Workspace (selected crates enabled in `Cargo.toml`):

- `fast-llm-coordinator`: Low‑latency routing among on‑device providers (Ollama, LM Studio, LFM2 placeholder). Metrics, load balancing, timeouts. N‑API is optional; the core library compiles independently.

- `llm-router`: Policy router scaffolding (providers/capabilities/context/caching) with mock routing; needs concrete provider implementations + streaming. Bin target currently has a minor formatting bug that prevents compile (see Build Status).

- `agent-orchestrator`: AB‑MCTS planning + hierarchical workflows skeleton with rich configs and result/metrics types.

- `vision-service`: Axum service for analyze/OCR/generate (mock models now), base64 image I/O, CORS, health.

- `voice-processing`: N-API native module for audio chunking/VAD/ASR/TTS placeholders; processing metrics.

- `vector-db`: Simple in‑memory HNSW‑like index with distance metrics; Axum API for collections/search; placeholder embeddings.

- `redis-service`: Robust cache/session client with fallback, strategies, TTLs, compression; N-API optional.
Other runtime pieces:

- Swift App (`UniversalAITools` + `UniversalAICompanionPackage`): macOS UI shell and feature package with Vision endpoints. Note: default `API_BASE_URL` is `https://api.example.com/v1`; set it to the local service (e.g., `http://localhost:3033`) to integrate.

- NodeJS API server: Removed. The platform now runs without a Node/TS backend. Use the Rust `assistantd` and related services directly.

- Go services and orchestrator: Legacy microservices plus a Go-based service manager (`main.go`) and a compiled binary `universal-ai-tools` that supervises processes and performs health checks.
Environment (`.env`): OLLAMA/LM STUDIO URLs, LFM2 toggles, SSL dev, feature flags; Supabase/Redis (optional). LM Studio defaults to port `5901`.
---
## Database & Storage
- Primary DB: PostgreSQL runs in Docker (Supabase local recommended). Use the appropriate `DATABASE_URL` depending on where the client runs:

  - From host: `postgresql://postgres:postgres@localhost:54322/postgres` (as in `.env`).

  - From another container: `postgresql://postgres:postgres@postgres:5432/universal_ai_tools` (see `ENVIRONMENT_VARIABLES.md:26`).

- Start/Manage (local):

  - `supabase start` (brings up Postgres + APIs on `127.0.0.1:54321`) and sets `DATABASE_URL`.

  - Apply migrations: `npx supabase db push` or `npx supabase db reset` (see repo `supabase/migrations/`).
  - Rust DB CLI: validate/seed/cleanup using `crates/db-cli`:
    - `cargo run -p db-cli -- validate`
    - `cargo run -p db-cli -- seed`
    - `cargo run -p db-cli -- cleanup`

- Volumes: Ensure Postgres container uses a named volume for persistence. For Redis, `docker-compose.prod.yml` mounts `redis_data:` already.

- Vector store: `vector-db` currently in‑memory; add snapshot/persistence path and mount a volume in subsequent phases.

- Guidance: Services running on host should target `localhost:54322`; services inside Docker should target the `postgres` service DNS name on port `5432`.
- Vector DB (Weaviate): External Weaviate in Docker for persistent vector search.

  - Env: `WEAVIATE_URL` (Docker: `http://weaviate:8080`, Host: `http://localhost:8080`), `WEAVIATE_API_KEY` (optional).

  - Presence: Go memory-service and Rust retriever clients in repo; default in `docker/production.env:48`.

  - Alternative: Supabase with `pgvector` when Weaviate is unavailable.
---
## Docker Attach Points (Core Services)
- Redis: `redis:6379` (Docker) or `localhost:6379` (host) — volume `redis_data` for persistence.

- Supabase/Postgres: `postgres:5432` (Docker) or `localhost:54322` (host). Use Supabase CLI for local stack.

- Weaviate: `weaviate:8080` (Docker) or `localhost:8080` (host). Ready endpoint: `/v1/.well-known/ready`.

- LLM Providers: `ollama:11434` (Docker) or `localhost:11434` (host); LM Studio `lmstudio:5901` or `localhost:5901`.
Context (“epoch”) model:

- Redis for short‑term session context (TTL), Supabase for durable rollups.

- Weaviate/pgvector for long‑term semantic memory, partitioned by epoch (day/week/project) and namespace per user/project.

- Nightly summarization promotes hot context; router enforces token budgets by mixing recency + semantic recall.
---
## Build Status and Reality Checks
- `fast-llm-coordinator`: cargo check OK (lib).

- `vision-service`: cargo check OK (Axum server; mock models).

- `voice-processing`: cargo check OK (N‑API addon; placeholders).

- `vector-db`: cargo check OK; in‑memory index; embeddings placeholder.

- `redis-service`: cargo check OK; Redis client + fallback; warnings only.

- `llm-router`: bin fails to compile due to a format string mismatch in `crates/llm-router/src/main.rs:44`; library components are present but crate build fails because the bin errors.

- `ai-orchestration-platform`: does not compile (missing types like `MonitoringConfig`, `FastLLMCoordinator`, `TestingFramework`, `DashboardServer`; trait/object mismatches). Declared bins (`src/bin/platform.rs`, `src/bin/cli.rs`) are absent.

- Duplicate crates: `crates/agent-orchestrator` (workspace member) and `crates/agent-orchestration` (not in workspace) both exist; recommend consolidation to avoid confusion.
---
## Gaps vs. Goal
- Router cohesion: Two routing layers (`fast-llm-coordinator` and `llm-router`) overlap; `llm-router` lacks concrete providers/streaming; coordinator contains working HTTP flows to Ollama/LM Studio (independent of N‑API) but is packaged as a lib.

- Orchestrator depth: `agent-orchestrator` exposes rich configs but lacks integrated execution paths and tested AB‑MCTS strategies.

- End‑to‑end path: No single minimal binary that wires routing + memory + tools + UI; `ai-orchestration-platform` references modules not yet present and fails to compile; Go service manager exists but targets legacy services.

- Vision/Voice: Mock model backends; need real local models + streaming pipelines. `voice-processing` exposes placeholders only; no Whisper/TTS integration yet.

- Vector DB: Useful API, but no embeddings integration; no RAG coupling to chat.

- Testing/Benchmarks: Strong validation infra exists, but no focused “local assistant task suite” to measure success criteria.
---
## Technical Tenets
- Specialize > Scale: Use tiny specialists (classifier/router/extractor/rewriter) to pre/post‑process and compress context for a slightly larger SLM when needed.

- Structure Everywhere: JSON‑schema tool calls; strict parsers; retry/repair strategies; deterministic templates.

- Memory as a First‑Class System: Typed stores (short‑term session, long‑term KB, project memory) with summarization and TTLs.

- Stream and Speculate: Always stream; pre‑compute candidates (classification, next‑tool guess) to hide latency.

- Measure to Improve: Track task success, latency budget by stage (route→retrieve→generate→act), and cache hit rates.
---
## Model Strategy (Local)
- Routing classes:

  - Classify/Route/Guard: sub‑100ms, tiny SLM (≤1–3B) quantized.

  - Summarize/Rewrite/Plan‑short: 3–7B instruct models, low temp, JSON mode.

  - Code/Reason (bounded): best local 3–7B coder tuned, strict scaffolds, iterative.

  - Multimodal: small ASR (VAD + chunking), lightweight TTS, OCR/captioning via Vision service.

- Providers: Ollama and/or LM Studio for chat/embeddings; optional direct Rust MLX bridges for “LFM2” once ready.

- Policy: Token‑aware routing, capability gating (code vs convo), and health/latency scoring.
---
## Minimal End‑to‑End (“MVP Local‑Super”) — 2 Weeks
What ships:

- Single daemon (Axum) exposing `/chat`, `/tools/*`, `/memory/*`, `/health`.

- Providers: Ollama (required), LM Studio (optional). Streaming enabled.

- Memory: `vector-db` for KB + `redis-service` fallback cache; simple session memory with TTL + nightly summarization.

- Tools: files (read/write/search), shell (safe allowlist), git, process runner, local search index.

- UI: Swift app binds to daemon; Node UI remains for quick testing.

- DB: Postgres runs in Docker (Supabase local). MVP uses DB minimally (sessions/telemetry optional) to keep offline core intact.

- Vectors: Prefer Weaviate for embeddings/search when available; fall back to in‑process `vector-db`.

 - RAG: Unified provider surface in `assistantd` with `/memory/search` (retrieval) and `/rag/r1` (agentic-RAG with citations). Provider selectable via `RAG_PROVIDER` env.
Work items:

- Choose one router path: promote `fast-llm-coordinator` as provider executor and implement a thin `llm-router` provider wrapper + streaming endpoints, or fold coordinator logic into `llm-router` and delete duplication later. Avoid touching `ai-orchestration-platform` until it compiles.

- Implement concrete Ollama provider (chat + embeddings) in `llm-router` with SSE streaming and backpressure.

- Add RAG glue: `embedding` endpoint + `vector-db` wiring; per‑session context assembly policy in router.

- Tool calling: JSON tool schema + executor with timeouts/circuit breakers; integrate into generation loop.

- Tests/benches: latency microbench; task acceptance suite (see below).
Acceptance:

- Local chat completes 10 canonical tasks under target latency; tool calls succeed deterministically; offline mode passes.
---
## Phase 2 — Developer Mode (Weeks 3–5)
- Workspace indexer (ripgrep + tags) and repo graph; code awareness in prompts.

- Patch generator: propose diff, validate build/tests via runner; auto‑retry with error summarization.

- Planning scaffolds: small planner + executor loop with guardrails; integrate AB‑MCTS later.

- Stronger memory: topic‑scoped histories; project KB with source attributions; recall API.
KPIs: higher solve rate on coding suite; fewer retries; consistent JSON outputs; no destructive ops.
---
## Phase 3 — Multimodal & Orchestration (Weeks 6–8)
- Voice: streaming VAD→ASR→intent; TTS with barge‑in.

- Vision: OCR + captioning + basic VQA locally; desktop capture pipeline (privacy‑aware).

- Orchestrator: bring `agent-orchestrator` online with tested policies; logging/metrics dashboards.
KPIs: stable voice loop, accurate OCR on common docs, orchestrated multi‑step tasks with traceability.
---
## Engineering Plan by Codebase
- `llm-router`:

  - Add `Provider` impls: Ollama chat (SSE), embeddings; LM Studio optional.

  - Add `streaming.rs` integration in main path; JSON mode and content policy hooks.

  - Wire `ContextManager` to Weaviate (primary) or Supabase pgvector (secondary) with fallback to in‑process `vector-db`; add token budgeting.

  - Fix bin compile error in `src/main.rs` or disable the bin target until endpoints are implemented; add Axum health/status later.
- `fast-llm-coordinator`:

  - Either wrap as execution backend for `llm-router` or consolidate into router; keep health checks/timeouts.
- `agent-orchestrator`:

  - Implement minimal planner→executor loop; record tree and decisions; expose `/plan` for observability.

  - Remove or merge `crates/agent-orchestration` to avoid duplication.
- `vision-service` / `voice-processing`:

  - Replace mocks: integrate small local OCR/captioning; ASR chunk pipeline with VAD; TTS baseline.

  - Add streaming endpoints; backpressure; audio chunk validation.

  - Document and set `API_BASE_URL` in the Swift app to point to local services (e.g., `http://localhost:3033`).
- `vector-db`:

  - Keep as a lightweight fallback when Weaviate isn’t available; add snapshot/persistence for dev mode.
- Daemon binary:

  - New `assistantd` (Axum): mounts chat/tools/memory endpoints, routes to router, executes tools, persists memory.

  - Env config loader; structured logs and Prometheus metrics.

  - Optionally register with the Go service manager (`main.go`) so the existing orchestrator can supervise it; or run standalone.

  - Integrate with Redis (sessions/cache), Supabase (relational), and Weaviate (vectors) via Docker service DNS.
---
## Tooling, Testing, and Metrics
- Acceptance suites:

  - Everyday: reminders, file search/edit, summarize PDF, extract table, rename files, create calendar entry (local mock), quick calc.

  - Coding: explain diff, write unit test, refactor function, scaffold CLI, fix lint, run tests and iterate.

- Bench:

  - Latency budget by stage; throughput under concurrency; cache hit rate; tool success rate; JSON validity rate.

- Observability:

  - Tracing spans for route→retrieve→generate→act; error taxonomy; retry counters.
---
## Risks and Mitigations
- Variability in SLM outputs → Strict JSON schema + repair loop + few‑shot examples; tool idempotency.

- Latency regressions → Pre‑classify, cache aggressively, speculative decoding, stream early; cap max tokens.

- Model quality gaps → Domain‑specific prompts, RAG, decomposed planning; selective larger local models when needed.

- Complexity creep → Ship MVP path first (single daemon), keep router/orchestrator surface minimal, add features behind flags.
---
## Immediate Next Actions
1) Start/verify containers: Redis, Supabase (Postgres), Weaviate; confirm host vs Docker service URLs.

2) Fix `llm-router` bin compile error (`crates/llm-router/src/main.rs:44`) or disable the bin; keep library build green.

3) Remove `ai-orchestration-platform` from the workspace or gate features until it compiles; treat it as a design scaffold for now.

4) Decide router consolidation (promote coordinator vs fold into router) and lock API.

5) Implement Ollama provider + SSE streaming in `llm-router`; move fallback logic into provider.

6) Keep unified RAG provider in `assistantd` (supabase/weaviate/fallback) and add Redis caching.

7) Wire session memory to Redis and long‑term memory to Weaviate/pgvector; add token budgeter.

8) Normalize embedding dimensions across Supabase to match `EMBEDDING_MODEL`.

9) Set Swift `API_BASE_URL` to Vision service and add Chat to `assistantd` (3030); verify round‑trip.

10) Stand up acceptance harness and run baseline; track KPIs.
Owner Notes:

- `.env` already includes `OLLAMA_URL`, `LM_STUDIO_URL`, `ENABLE_LFM2`. Start with Ollama only.

- Use Swift app for UI once daemon is stable; keep Node UI as dev surface.

- Set `API_BASE_URL` for the Swift app to your local backend (e.g., `http://localhost:3033`).
