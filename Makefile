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
