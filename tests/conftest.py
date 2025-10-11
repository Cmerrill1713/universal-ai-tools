"""
Pytest configuration and fixtures
"""
import os
import sys

import pytest

# Add project paths
PROJECT_ROOT = os.path.dirname(os.path.dirname(__file__))
sys.path.insert(0, os.path.join(PROJECT_ROOT, 'src'))
sys.path.insert(0, os.path.join(PROJECT_ROOT, 'api'))

@pytest.fixture(scope="session")
def base_url():
    """Base URL for API tests"""
    return os.getenv("TEST_BASE_URL", "http://localhost:8013")

@pytest.fixture(scope="session")
def test_client():
    """HTTP client for testing"""
    import httpx
    return httpx.Client(timeout=10.0)

