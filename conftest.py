# PyTest configuration backbone for universal-ai-tools
import os
import sys

import pytest

# Ensure project root is importable
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# Add entropy-regularization-framework to path if needed
FAIRSEQ_PATH = os.path.join(PROJECT_ROOT, "entropy-regularization-framework")
if os.path.exists(FAIRSEQ_PATH) and FAIRSEQ_PATH not in sys.path:
    sys.path.insert(0, FAIRSEQ_PATH)


# Async tests support
try:
    import asyncio

    @pytest.fixture(scope="session")
    def event_loop():
        """Create an instance of the default event loop for the test session."""
        loop = asyncio.new_event_loop()
        yield loop
        loop.close()
except ImportError:
    pass


# Common fixtures
@pytest.fixture
def temp_dir(tmp_path):
    """Provide a temporary directory for tests."""
    return tmp_path


@pytest.fixture
def sample_data_dir():
    """Provide path to sample data directory."""
    data_dir = os.path.join(PROJECT_ROOT, "tests", "data")
    os.makedirs(data_dir, exist_ok=True)
    return data_dir

