# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- TRM-driven capability routing system
- Weaviate vector database integration
- Comprehensive monitoring stack (Prometheus, Grafana, Netdata)

## [1.0.0] - 2025-10-11

### Added
- Initial production release
- Native macOS app (NeuroForgeApp/Athena)
- Native iOS app (AthenaIOS)
- Multi-model LLM orchestration (MLX, Ollama)
- Knowledge grounding (RAG) with Weaviate
- TTS integration with Kokoro MLX
- Autonomous evolution system
- Multi-agent coordination
- Backend health probing (`/api/probe/e2e`)
- Docker Compose production stack
- Kubernetes deployment configs
- Security scanning (CodeQL, Dependabot)
- Comprehensive test suite (1,342 tests)

### Changed
- Migrated from Supabase to PostgreSQL + Weaviate
- Updated all dependencies to latest secure versions
- Consolidated Docker services under "athena-" naming

### Fixed
- 62 security vulnerabilities (5 critical, 14 high, 42 moderate, 1 low)
- Swift app keyboard input and focus management
- TTS audio streaming
- Backend autodiscovery

### Security
- All dependencies patched to latest secure versions
- Removed hardcoded secrets
- Added .gitignore for sensitive files
- Configured Git LFS for large files

---

## Version History

- **v1.0.0** - 2025-10-11 - Initial clean release
