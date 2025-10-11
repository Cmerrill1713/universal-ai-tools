.PHONY: verify smoke test sentry validate validate-all notify contract green clean

BASE ?= http://localhost:8014
PYTHONPATH := $(PWD)/src:$(PWD)/api:$(PWD)

# Quick 500 check on critical pages (with retry backoff)
sentry:
	@BASE=$(BASE) python3 scripts/error_sentry.py && echo "✅ No 500 errors on $(BASE)"

# Comprehensive GET-only validation
validate:
	PYTHONPATH=$(PYTHONPATH) python3 -m scripts.independent_verifier_v2 --base $(BASE)

# Full validation including POST endpoints
validate-all:
	PYTHONPATH=$(PYTHONPATH) python3 -m scripts.independent_verifier_v2 --base $(BASE) --include-posts

# Contract test for /chat endpoint
contract:
	@python3 scripts/contract_chat.py $(BASE) && echo "✅ /chat contract validated"

# Legacy verifier (kept for compatibility)
verify:
	PYTHONPATH=$(PYTHONPATH) python3 -m scripts.independent_verifier --base $(BASE)

# Import smoke tests
smoke:
	PYTHONPATH=$(PYTHONPATH) python3 scripts/import_smoke.py && python3 scripts/check_endpoints.py

# Sentry with Telegram notifications (set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID)
notify:
	BASE=$(BASE) python3 scripts/sentry_notify.py

# Complete test suite
test: smoke sentry validate validate-all
	@echo "✅ All tests passed"

# Auto-heal (dry run)
heal-dry:
	@echo "🔧 Running auto-heal (DRY RUN)..."
	@python3 scripts/auto_heal.py --dry-run

# Auto-heal (apply fixes)
heal:
	@echo "🔧 Running auto-heal (APPLY FIXES)..."
	@python3 scripts/auto_heal.py

# "Boringly green" check (run anytime, anywhere)
green: sentry validate validate-all contract
	@echo "════════════════════════════════════════════════════════════════════════════════"
	@echo "                        🟢 BORINGLY GREEN - ALL CHECKS PASS"
	@echo "════════════════════════════════════════════════════════════════════════════════"

# Development mode (hot reload + volume mounts)
dev:
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
	@echo "⏳ Waiting for services to start..."
	@sleep 5
	@echo "🧪 Running health check..."
	@make green BASE=http://localhost:8014 || echo "⚠️  Some checks failed (expected on first run)"

# Stop all services
down:
	docker-compose down

# Seed demo data for development
seed:
	PYTHONPATH=$(PYTHONPATH) python3 scripts/seed_demo_data.py $(BASE)

# Dev playground (quick API testing)
play:
	PYTHONPATH=$(PYTHONPATH) python3 scripts/dev_playground.py $(BASE)

# Performance baseline (establish or compare)
perf-baseline:
	python3 scripts/perf_baseline.py $(BASE)

# Compare current performance against baseline
perf-compare:
	python3 scripts/perf_baseline.py $(BASE) --compare

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	@echo "✅ Cleaned Python cache files"

help:
	@echo "Available targets:"
	@echo "  green BASE=<url>   - Complete health check (sentry + validate + validate-all + contract)"
	@echo "  sentry BASE=<url>  - Quick 500 check on critical pages"
	@echo "  validate BASE=<url> - Comprehensive GET validation"
	@echo "  validate-all BASE=<url> - Full validation (GET + POST)"
	@echo "  contract BASE=<url> - /chat shape validation"
	@echo "  verify BASE=<url>  - Legacy verifier"
	@echo "  smoke              - Import smoke tests"
	@echo "  test               - Complete test suite"
	@echo "  dev                - Start services in dev mode (hot reload)"
	@echo "  down               - Stop all services"
	@echo "  seed BASE=<url>    - Seed demo data"
	@echo "  play BASE=<url>    - Dev playground (quick API test)"
	@echo "  clean              - Clean Python cache files"
	@echo ""
	@echo "Examples:"
	@echo "  make green         - Run all checks on localhost:8014"
	@echo "  make dev           - Start in dev mode with hot reload"
	@echo "  make play          - Quick API test"
	@echo "  make seed          - Populate demo data"
