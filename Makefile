.PHONY: verify smoke test sentry validate validate-all notify contract green clean

BASE ?= http://localhost:8013
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

# "Boringly green" check (run anytime, anywhere)
green: sentry validate validate-all contract
	@echo "════════════════════════════════════════════════════════════════════════════════"
	@echo "                        🟢 BORINGLY GREEN - ALL CHECKS PASS"
	@echo "════════════════════════════════════════════════════════════════════════════════"

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	@echo "✅ Cleaned Python cache files"

help:
	@echo "Available targets:"
	@echo "  verify BASE=<url>  - Run independent verification (default: http://localhost:8013)"
	@echo "  smoke              - Run smoke tests (imports + endpoints)"
	@echo "  test               - Run all tests (smoke + verify)"
	@echo "  clean              - Clean Python cache files"
	@echo ""
	@echo "Examples:"
	@echo "  make verify"
	@echo "  make verify BASE=http://localhost:8000"
	@echo "  make smoke"
