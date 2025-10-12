.PHONY: venv install test lint fmt clean help

PYTHON := python3
VENV := .venv
VENV_BIN := $(VENV)/bin

help:
	@echo "Universal AI Tools - Makefile Commands"
	@echo "======================================="
	@echo "venv       - Create Python 3.11 virtual environment"
	@echo "install    - Install dependencies from requirements.txt"
	@echo "test       - Run pytest"
	@echo "lint       - Run ruff linter"
	@echo "fmt        - Format code with ruff"
	@echo "clean      - Remove venv and cache files"
	@echo ""

venv:
	@echo "🐍 Creating Python 3.11 virtual environment..."
	command -v uv >/dev/null && uv venv --python 3.11 $(VENV) || $(PYTHON) -m venv $(VENV)
	@echo "✓ Virtual environment created at $(VENV)"
	@echo "  Activate with: source $(VENV_BIN)/activate"

install: venv
	@echo "📦 Installing dependencies..."
	@if [ -f requirements.txt ]; then \
		$(VENV_BIN)/pip install --upgrade pip wheel setuptools; \
		$(VENV_BIN)/pip install -r requirements.txt; \
	else \
		$(VENV_BIN)/pip install --upgrade pip wheel setuptools; \
		$(VENV_BIN)/pip install pytest ruff numpy torch; \
	fi
	@echo "✓ Dependencies installed"

test:
	@echo "🧪 Running tests..."
	@if [ -f $(VENV_BIN)/pytest ]; then \
		$(VENV_BIN)/pytest -q || true; \
	else \
		echo "⚠ pytest not found. Run 'make install' first."; \
	fi

lint:
	@echo "🔍 Running linter..."
	@if [ -f $(VENV_BIN)/ruff ]; then \
		$(VENV_BIN)/ruff check . || true; \
	else \
		echo "⚠ ruff not found. Run 'make install' first."; \
	fi

fmt:
	@echo "✨ Formatting code..."
	@if [ -f $(VENV_BIN)/ruff ]; then \
		$(VENV_BIN)/ruff format . || true; \
	else \
		echo "⚠ ruff not found. Run 'make install' first."; \
	fi

clean:
	@echo "🧹 Cleaning up..."
	rm -rf $(VENV)
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	@echo "✓ Cleanup complete"

# Docker utilities
.PHONY: docker-df prune lint-fix
docker-df:
	@docker system df

prune:
	@echo "🧹 Cleaning Docker (keeps running containers)..."
	@docker system prune -a --volumes --filter "until=24h"

lint-fix:
	@echo "🧹 Auto-fixing Python linting..."
	@ruff check . --fix || true
	@ruff format . || true

# Backup volumes safely
backup-volumes:
	@echo "💾 Backing up Docker volumes..."
	@mkdir -p ~/backups/docker-volumes
	@for v in $$(docker volume ls -q); do \
		echo "  Backing up volume: $$v"; \
		docker run --rm -v $$v:/v -v $$HOME/backups/docker-volumes:/b alpine \
			sh -c "cd /v && tar -czf /b/$${v}_$$(date +%F).tgz . 2>/dev/null || true"; \
	done
	@echo "✅ Volumes backed up to ~/backups/docker-volumes/"

# Local-only setup
local-mode:
	@./scripts/setup_local_mode.sh

# Offline build (Python)
offline-install:
	@echo "📦 Installing from offline cache..."
	@pip install --no-index --find-links ./wheelhouse -r requirements.txt
	@npm ci --cache ./.npm-cache --prefer-offline

# Grafana dashboard import
dash-import:
	@bash scripts/monitoring/import_grafana_dashboard.sh

# Initialize routing outcomes database
init-routing-db:
	@echo "🗄️  Creating routing_outcomes table..."
	@docker exec -i athena-postgres psql -U postgres -d athena < sql/routing_outcomes_table.sql
	@docker exec -i athena-postgres psql -U postgres -d athena < sql/routing_outcomes_indexes.sql
	@echo "✅ Database initialized"
