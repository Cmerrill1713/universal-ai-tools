"""
Input validation utilities for API endpoints
Addresses GitHub issues related to input validation and error handling
"""

import re
from typing import Any, Dict, List, Optional, Union
from urllib.parse import urlparse
from fastapi import HTTPException


class ValidationError(Exception):
    """Custom validation error with detailed information"""
    def __init__(self, message: str, field: str = None, code: str = None):
        self.message = message
        self.field = field
        self.code = code
        super().__init__(self.message)


def validate_urls(urls: List[str]) -> List[Dict[str, Any]]:
    """
    Validate a list of URLs and return validation results
    Addresses: crawler-input-validation issue
    """
    if not isinstance(urls, list):
        raise ValidationError("urls must be a list", "urls", "INVALID_TYPE")
    
    if not urls:
        raise ValidationError("urls list cannot be empty", "urls", "EMPTY_LIST")
    
    results = []
    for i, url in enumerate(urls):
        try:
            if not isinstance(url, str):
                results.append({
                    "index": i,
                    "url": url,
                    "valid": False,
                    "error": "URL must be a string"
                })
                continue
            
            # Basic URL validation
            parsed = urlparse(url)
            if not parsed.scheme or not parsed.netloc:
                results.append({
                    "index": i,
                    "url": url,
                    "valid": False,
                    "error": "Invalid URL format"
                })
                continue
            
            if parsed.scheme not in ['http', 'https']:
                results.append({
                    "index": i,
                    "url": url,
                    "valid": False,
                    "error": "URL must use http or https protocol"
                })
                continue
            
            results.append({
                "index": i,
                "url": url,
                "valid": True,
                "error": None
            })
            
        except Exception as e:
            results.append({
                "index": i,
                "url": url,
                "valid": False,
                "error": f"Validation error: {str(e)}"
            })
    
    return results


def validate_trend_value(trend: str) -> str:
    """
    Validate trend value for realtime vibe endpoints
    Addresses: realtime-vibe-trend-fix issue
    """
    if not isinstance(trend, str):
        raise ValidationError("trend must be a string", "trend", "INVALID_TYPE")
    
    valid_trends = {"bullish", "bearish", "neutral"}
    trend_lower = trend.lower().strip()
    
    if trend_lower not in valid_trends:
        raise ValidationError(
            f"Invalid trend value: {trend}. Must be one of: {', '.join(valid_trends)}",
            "trend",
            "INVALID_VALUE"
        )
    
    return trend_lower


def validate_payload_field(payload: Dict[str, Any], field: str, field_type: type, 
                          required: bool = True, default: Any = None) -> Any:
    """
    Validate a field in a payload with type checking
    Addresses: current-time-shim-fix and realtime-vibe-trend-fix issues
    """
    if field not in payload:
        if required:
            raise ValidationError(f"Missing required field: {field}", field, "MISSING_FIELD")
        return default
    
    value = payload[field]
    
    if not isinstance(value, field_type):
        raise ValidationError(
            f"Field '{field}' must be of type {field_type.__name__}, got {type(value).__name__}",
            field,
            "INVALID_TYPE"
        )
    
    return value


def validate_database_connection_string(connection_string: str) -> bool:
    """
    Validate database connection string format
    Addresses: db-auth-fix issue
    """
    if not isinstance(connection_string, str):
        raise ValidationError("Database URL must be a string", "DATABASE_URL", "INVALID_TYPE")
    
    if not connection_string:
        raise ValidationError("Database URL cannot be empty", "DATABASE_URL", "EMPTY_VALUE")
    
    # Check for PostgreSQL URL format
    if not connection_string.startswith(('postgresql://', 'postgresql+psycopg://')):
        raise ValidationError(
            "Database URL must be a valid PostgreSQL connection string",
            "DATABASE_URL",
            "INVALID_FORMAT"
        )
    
    return True


def validate_python_path(paths: List[str]) -> bool:
    """
    Validate Python path configuration
    Addresses: pythonpath-alignment issue
    """
    if not isinstance(paths, list):
        raise ValidationError("PYTHONPATH must be a list", "PYTHONPATH", "INVALID_TYPE")
    
    required_paths = ["/app/src", "/app/api", "/app"]
    
    for required_path in required_paths:
        if required_path not in paths:
            raise ValidationError(
                f"Missing required path in PYTHONPATH: {required_path}",
                "PYTHONPATH",
                "MISSING_PATH"
            )
    
    return True


def safe_get_current_time():
    """
    Safe current time utility to prevent AttributeError
    Addresses: current-time-shim-fix issue
    """
    from datetime import datetime, timezone
    return datetime.now(timezone.utc)


def validate_webhook_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate webhook payload structure
    """
    required_fields = ["object_kind", "event_type"]
    
    for field in required_fields:
        if field not in payload:
            raise ValidationError(f"Missing required webhook field: {field}", field, "MISSING_FIELD")
    
    if not isinstance(payload["object_kind"], str):
        raise ValidationError("object_kind must be a string", "object_kind", "INVALID_TYPE")
    
    if not isinstance(payload["event_type"], str):
        raise ValidationError("event_type must be a string", "event_type", "INVALID_TYPE")
    
    return payload


def create_error_response(error: ValidationError, status_code: int = 422) -> Dict[str, Any]:
    """
    Create standardized error response
    """
    return {
        "error": error.message,
        "field": error.field,
        "code": error.code,
        "status_code": status_code
    }


def handle_validation_error(error: ValidationError) -> HTTPException:
    """
    Convert ValidationError to HTTPException
    """
    status_code = 422
    if error.code == "MISSING_FIELD":
        status_code = 400
    elif error.code == "INVALID_TYPE":
        status_code = 422
    elif error.code == "INVALID_VALUE":
        status_code = 422
    
    return HTTPException(
        status_code=status_code,
        detail=create_error_response(error, status_code)
    )