#!/usr/bin/env python3
"""
Import tests to ensure all modules load correctly
"""
import importlib

# Add paths if running locally
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'api'))

class TestImports:
    """Test critical module imports"""

    @pytest.mark.parametrize("module", [
        "api",
        "api.app",
        "api.routers.health",
        "src",
        "src.config",
        "src.utils",
    ])
    def test_import_module(self, module):
        """Test that critical modules can be imported"""
        try:
            importlib.import_module(module)
        except ModuleNotFoundError as e:
            pytest.fail(f"Failed to import {module}: {e}")

    def test_fastapi_app_exists(self):
        """Test that FastAPI app is properly initialized"""
        from api.app import app
        assert app is not None
        assert hasattr(app, 'routes')

    def test_routers_registered(self):
        """Test that routers are registered in the app"""
        from api.app import app
        routes = [route.path for route in app.routes]

        # Check for essential routes
        assert "/health" in routes or any("/health" in r for r in routes)
        assert "/openapi.json" in routes or any("/openapi" in r for r in routes)

    def test_middleware_loaded(self):
        """Test that middleware is properly configured"""
        try:
            from src.middleware.error_handler import attach_error_mw
            from src.middleware.metrics import attach_metrics
            assert callable(attach_error_mw)
            assert callable(attach_metrics)
        except ImportError:
            pytest.skip("Middleware modules not available")

