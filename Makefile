.PHONY: verify smoke test clean sentry

BASE ?= http://localhost:8013

verify:
	python3 -m scripts.independent_verifier --base $(BASE)

smoke:
	python3 scripts/import_smoke.py && python3 scripts/check_endpoints.py

sentry:
	@BASE=$(BASE) python3 scripts/error_sentry.py && echo "✅ No 500 errors on $(BASE)"

test: smoke verify sentry
	@echo "✅ All tests passed"

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
