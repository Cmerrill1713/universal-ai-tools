# Document Review Rules (No-Duplication Policy)
Purpose: Prevent duplicated work by requiring intentional, auditable document and code discovery before starting tasks and when completing features.
## When to Review

- Before starting a new task or feature (Pre-Task)

- Before submitting a PR or marking a feature complete (Pre-Completion)
## Required Documents to Consult

Always skim these first and search within them for relevant areas:

- LOCAL_ASSISTANT_VISION_AND_ROADMAP.md

- STRATEGIC_MIGRATION_ROADMAP.md

- README-SYSTEM.md and README-GO-RUST.md

- RUST_GO_MIGRATION_STATUS.md

- AGENT_COORDINATION.md and AGENT_COORDINATION_SUMMARY.md

- ENVIRONMENT_VARIABLES.md and DOCKER_INFRASTRUCTURE.md

- MIGRATION_COMPLETION_SUMMARY.md and CRITICAL_SERVICES_FIXED_SUMMARY.md
Then, search the code for existing implementations:

- crates/* (Rust services)

- go-services/* (legacy services in Docker)

- nodejs-api-server/* (legacy bridge/MCP)

- UniversalAICompanionPackage/* and UniversalAITools/* (Swift UI)

- docs/* and supabase/* (migrations, patterns, DB functions)
## How to Search (Fast)

Run a 2–3 minute discovery pass using ripgrep (examples):
```bash
# Replace with your feature keywords, singular/plural, and related terms

rg -n "assistantd|router|weaviate|vector-db|embedding|llm router|coordination|voice|vision" -S

# Search for APIs/paths/endpoints

rg -n "(/chat|/tools|/memory|/health|/vision|/embedding|/vectors)" -S

# Look for existing config/env wiring

rg -n "OLLAMA|LM_STUDIO|WEAVIATE|DATABASE_URL|REDIS_URL" -S

# Find similar modules or duplicated patterns

rg -n "Provider|Router|Coordinator|ContextManager|StreamingManager" crates -S

# Check Swift integration points that may already exist

rg -n "API_BASE_URL|vision|backend|analy(z|s)e|generate|refine" UniversalAICompanionPackage UniversalAITools -S

```
## Required PR Checklist (Docs Reviewed)

Include this section in every PR (template provided):
```markdown

### Docs Reviewed & Duplication Check

- [ ] LOCAL_ASSISTANT_VISION_AND_ROADMAP.md

- [ ] STRATEGIC_MIGRATION_ROADMAP.md

- [ ] README-SYSTEM.md

- [ ] RUST_GO_MIGRATION_STATUS.md

- [ ] AGENT_COORDINATION.md

- [ ] ENVIRONMENT_VARIABLES.md / DOCKER_INFRASTRUCTURE.md

- [ ] Other relevant docs: (list)
Discovery Summary:

- Potential duplicates found? (yes/no)

- If yes, references: (files/paths/lines)

- Decision: (reuse, extend, or replace) and rationale

```
## Definition of Done Additions

- Provide a brief Discovery Summary in the PR body.

- Link any docs updated due to this feature.

- If replacing an existing component, note deprecation path and update references.
## Handoff Requirements

- In the handoff report, include a "Docs Reviewed" section listing what you read and your duplication check summary.
## Exceptions

- Trivial doc typo fixes or non-functional changes may skip the full checklist (use judgment), but still add a short Discovery Summary (e.g., “no code impact”).
---
Enforcement: PR template + CI check require the "Docs Reviewed" section. See .github/workflows/docs-review-check.yml.
