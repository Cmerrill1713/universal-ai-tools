"""
Health check router
Addresses GitHub issues: db-auth-fix, current-time-shim-fix, pythonpath-alignment
"""

from datetime import datetime, timezone
from typing import Dict, Any
import sys
import logging

from fastapi import APIRouter, HTTPException

router = APIRouter()
logger = logging.getLogger(__name__)


def safe_get_current_time():
    """
    Safe current time utility to prevent AttributeError
    Addresses: current-time-shim-fix issue
    """
    return datetime.now(timezone.utc)


@router.get("/health")
async def health_check():
    """Basic health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": safe_get_current_time().isoformat(),
        "service": "universal-ai-tools-api"
    }


@router.get("/api/health")
async def api_health_check():
    """API health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": safe_get_current_time().isoformat(),
        "service": "universal-ai-tools-api",
        "path": "/api/health"
    }


@router.get("/health/detailed")
async def detailed_health_check():
    """
    Detailed health check with database and service status
    Addresses: db-auth-fix and current-time-shim-fix issues
    """
    health_status = {
        "status": "healthy",
        "timestamp": safe_get_current_time().isoformat(),
        "services": {},
        "overall_status": "healthy"
    }
    
    # Check Python path configuration
    try:
        python_paths = sys.path
        health_status["services"]["python_path"] = {
            "status": "healthy",
            "paths": python_paths[:10],  # First 10 paths
            "total_paths": len(python_paths),
            "has_src": "/app/src" in python_paths,
            "has_api": "/app/api" in python_paths,
            "has_app": "/app" in python_paths
        }
    except Exception as e:
        health_status["services"]["python_path"] = {
            "status": "error",
            "message": f"Python path check failed: {str(e)}"
        }
        health_status["overall_status"] = "degraded"
    
    # Check API dependencies
    try:
        dependencies = {
            "fastapi": "available",
            "uvicorn": "available",
            "psycopg": "available" if "psycopg" in sys.modules else "not_imported"
        }
        health_status["services"]["dependencies"] = {
            "status": "healthy",
            "details": dependencies
        }
    except Exception as e:
        health_status["services"]["dependencies"] = {
            "status": "error",
            "message": f"Dependency check failed: {str(e)}"
        }
        health_status["overall_status"] = "degraded"
    
    # Check database health (if available)
    try:
        from api.utils.database import DatabaseHealthChecker
        db_checker = DatabaseHealthChecker()
        db_health = await db_checker.check_connection()
        health_status["services"]["database"] = db_health
        
        if db_health["status"] != "healthy":
            health_status["overall_status"] = "degraded"
            
    except ImportError:
        health_status["services"]["database"] = {
            "status": "warning",
            "message": "Database utilities not available",
            "details": "psycopg package may not be installed"
        }
    except Exception as e:
        health_status["services"]["database"] = {
            "status": "error",
            "message": f"Database check failed: {str(e)}",
            "error_type": type(e).__name__
        }
        health_status["overall_status"] = "degraded"
    
    # Set HTTP status code based on overall health
    if health_status["overall_status"] == "unhealthy":
        raise HTTPException(status_code=503, detail=health_status)
    elif health_status["overall_status"] == "degraded":
        raise HTTPException(status_code=200, detail=health_status)  # 200 but with warning
    
    return health_status


@router.get("/health/validation")
async def validation_health_check():
    """
    Test validation utilities
    Addresses: crawler-input-validation and realtime-vibe-trend-fix issues
    """
    try:
        from api.utils.validation import validate_urls, validate_trend_value
        
        # Test URL validation
        test_urls = [
            "https://example.com",
            "http://test.com",
            "invalid-url",
            "ftp://not-allowed.com"
        ]
        
        url_results = validate_urls(test_urls)
        
        # Test trend validation
        trend_tests = []
        for trend in ["bullish", "bearish", "neutral", "invalid"]:
            try:
                result = validate_trend_value(trend)
                trend_tests.append({"input": trend, "result": result, "valid": True})
            except Exception as e:
                trend_tests.append({"input": trend, "result": None, "valid": False, "error": str(e)})
        
        return {
            "status": "healthy",
            "url_validation": {
                "test_urls": test_urls,
                "results": url_results
            },
            "trend_validation": {
                "test_trends": trend_tests
            },
            "timestamp": safe_get_current_time().isoformat()
        }
        
    except ImportError:
        return {
            "status": "warning",
            "message": "Validation utilities not available",
            "details": "Validation module may not be installed"
        }
    except Exception as e:
        logger.error(f"Validation health check failed: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "message": f"Validation health check failed: {str(e)}",
                "error_type": type(e).__name__
            }
        )

