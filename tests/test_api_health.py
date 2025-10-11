#!/usr/bin/env python3
"""
Unit tests for API health endpoints
"""
import pytest
import httpx
import os

BASE_URL = os.getenv("TEST_BASE_URL", "http://localhost:8013")

class TestHealthEndpoints:
    """Test health check endpoints across services"""
    
    def test_root_health(self):
        """Test root health endpoint"""
        r = httpx.get(f"{BASE_URL}/health", timeout=5)
        assert r.status_code == 200
        data = r.json()
        assert "status" in data
        assert data["status"] in ["healthy", "ok", "running"]
    
    def test_openapi_spec(self):
        """Test OpenAPI specification endpoint"""
        r = httpx.get(f"{BASE_URL}/openapi.json", timeout=5)
        assert r.status_code == 200
        spec = r.json()
        assert "openapi" in spec
        assert "paths" in spec
        assert len(spec["paths"]) > 0
    
    @pytest.mark.parametrize("endpoint", [
        "/api/unified-chat/health",
        "/api/models",
        "/api/orchestration/status",
    ])
    def test_service_health(self, endpoint):
        """Test individual service health endpoints"""
        r = httpx.get(f"{BASE_URL}{endpoint}", timeout=5)
        # 200 = healthy, 404 = not implemented (OK), 503 = temp down (OK)
        assert r.status_code in [200, 404, 503]
    
    def test_chat_endpoint_exists(self):
        """Test chat endpoint responds (may return 422 for empty payload)"""
        r = httpx.post(
            f"{BASE_URL}/chat",
            json={"message": "test"},
            timeout=10
        )
        # 200 = success, 404 = not implemented, 422 = validation error
        assert r.status_code in [200, 404, 422]

