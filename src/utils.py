"""
Utility functions for the application
"""

import logging
from typing import Any, Dict

logger = logging.getLogger(__name__)


def format_response(data: Any, status: str = "success") -> Dict[str, Any]:
    """Format API response"""
    return {
        "status": status,
        "data": data
    }


def log_request(path: str, method: str) -> None:
    """Log incoming request"""
    logger.info(f"{method} {path}")

