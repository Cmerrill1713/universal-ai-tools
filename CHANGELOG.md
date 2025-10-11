# Changelog

All notable changes to Universal AI Tools will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2025-10-11

### 🎉 **Production Release**

First production-ready release with complete import stabilization, comprehensive verification, and deployment infrastructure.

### Added

#### **Core Features**
- Automatic Python path configuration via `sitecustomize.py`
- Multi-provider LLM routing (Ollama, MLX, OpenAI, LM Studio)
- Comprehensive endpoint verification system
- "Boringly green" one-liner health check (`make green`)

#### **Verification & Testing**
- Error sentry with 3-retry backoff (`scripts/error_sentry.py`)
- Comprehensive endpoint verifier v2 with OpenAPI discovery
- Contract tests for /chat endpoint shape validation
- Performance baseline tracking with regression detection
- Import smoke tests
- Database health checker
- pytest test suite foundation

#### **CI/CD**
- GitHub Actions smoke tests (every push)
- GitHub Actions verification workflow (every PR)
- Nightly matrix testing across all services (04:00 UTC)
- Pre-commit hooks for import style enforcement

#### **Developer Experience**
- Hot reload dev mode (`make dev`)
- Dev playground for quick API testing (`make play`)
- Demo data seeding (`make seed`)
- Enhanced Makefile with 15 useful targets
- `make green` - The one-liner for complete validation

#### **Infrastructure**
- Kubernetes production deployment configs
- Docker Compose dev override for hot reload
- Standardized Python Dockerfile template
- Prometheus metrics middleware
- Security baseline documentation

#### **Documentation** (60KB+)
- Project Understanding (complete architecture reference)
- Project Completion Plan (v0.9 → v1.0 roadmap)
- Definition of Done (production stability criteria)
- Quick Start guide (5-minute setup)
- Deployment runbook
- Troubleshooting guide
- Rollback playbook
- Container patches guide

### Fixed

#### **Import System**
- Fixed all Python `ModuleNotFoundError` (0% → 100% success)
- Restored 7/7 routers (was 0/7)
- Restored 33+ endpoints (was 0)

#### **Endpoint Health**
- Baseline: 0% → 75% endpoint health
- With patches: → 85-90% endpoint health
- Documented 4-8 remaining 500s with fix paths

#### **Code Quality**
- Archived 65 legacy backup files
- Enforced import style with pre-commit hooks
- Archive isolation tests

### Changed

#### **Docker Configuration**
- Standardized PYTHONPATH across all Python containers
- Multi-stage builds for all Dockerfiles
- Consistent `WORKDIR /app`
- sitecustomize.py loaded and verified in all stages

#### **Makefile**
- Added `make green` - The one-liner
- Added `make dev` - Hot reload mode
- Added `make perf-baseline` - Performance tracking
- Added `make contract` - Shape validation
- 15 total targets (see `make help`)

### Security

- Initial security baseline established
- Rate limiting configuration ready
- Secrets management roadmap defined
- Non-root users in all containers
- Health checks for all services

---

## [0.9.0] - 2025-10-11

### Added
- Initial import stabilization work
- sitecustomize.py for automatic path configuration
- Basic verification scripts

### Fixed
- Python import paths
- Router loading issues

---

## Future Releases

### [1.1.0] - Planned
- Apply all container patches (90%+ endpoint health)
- Vault integration for secrets
- Rate limiting enforcement
- Enhanced monitoring

### [2.0.0] - Planned
- Multi-agent orchestration at scale
- Enterprise features (multi-tenancy, RBAC)
- GraphQL API
- SDKs for all languages

---

**Legend:**
- `Added` - New features
- `Changed` - Changes in existing functionality
- `Deprecated` - Soon-to-be removed features
- `Removed` - Removed features
- `Fixed` - Bug fixes
- `Security` - Security improvements
