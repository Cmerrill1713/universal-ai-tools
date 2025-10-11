"""
E2E Backend Probe - Fan-out health check for all services
Returns structured matrix of all backend service health status
"""
import asyncio
import time
from typing import Any, Dict

import httpx
from fastapi import APIRouter

router = APIRouter()

# Service registry with known health endpoints (Docker internal names)
SERVICES = [
    {"name": "chat", "url": "http://athena-evolutionary:8004/health", "critical": True},
    {"name": "tts_mlx", "url": "http://host.docker.internal:8877/health", "critical": False},
    {"name": "knowledge_gateway", "url": "http://athena-knowledge-gateway:8080/health", "critical": False},
    {"name": "knowledge_sync", "url": "http://athena-knowledge-sync:8080/health", "critical": False},
    {"name": "knowledge_context", "url": "http://athena-knowledge-context:8080/health", "critical": False},
    {"name": "weaviate", "url": "http://athena-weaviate:8080/v1/.well-known/ready", "critical": True},
    {"name": "prometheus", "url": "http://athena-prometheus:9090/-/healthy", "critical": False},
    {"name": "grafana", "url": "http://athena-grafana:3000/api/health", "critical": False},
    {"name": "searxng", "url": "http://athena-searxng:8080/", "critical": False},
    {"name": "postgres", "url": "http://athena-postgres:5432", "critical": True},
    {"name": "redis", "url": "http://athena-redis:6379", "critical": True},
]

async def probe_service(service: Dict[str, Any]) -> Dict[str, Any]:
    """Probe a single service health endpoint with timeout"""
    name = service["name"]
    url = service["url"]
    critical = service.get("critical", False)

    start = time.time()

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(url)
            latency_ms = round((time.time() - start) * 1000, 2)

            # Determine status
            if 200 <= response.status_code < 300:
                status = "pass"
            elif 500 <= response.status_code < 600:
                status = "warn"
            else:
                status = "fail"

            return {
                "service": name,
                "url": url,
                "status": status,
                "http": response.status_code,
                "latency_ms": latency_ms,
                "note": f"OK ({response.status_code})" if status == "pass" else f"HTTP {response.status_code}",
                "critical": critical
            }

    except httpx.ConnectError:
        latency_ms = round((time.time() - start) * 1000, 2)
        # If non-critical and connection fails, mark as unused
        status = "unused" if not critical else "fail"
        return {
            "service": name,
            "url": url,
            "status": status,
            "http": 0,
            "latency_ms": latency_ms,
            "note": "Not running (optional)" if status == "unused" else "Connection refused",
            "critical": critical
        }

    except httpx.TimeoutException:
        latency_ms = 3000.0
        return {
            "service": name,
            "url": url,
            "status": "fail",
            "http": 0,
            "latency_ms": latency_ms,
            "note": "Timeout (3s)",
            "critical": critical
        }

    except Exception as e:
        latency_ms = round((time.time() - start) * 1000, 2)
        status = "unused" if not critical else "fail"
        return {
            "service": name,
            "url": url,
            "status": status,
            "http": 0,
            "latency_ms": latency_ms,
            "note": f"Error: {type(e).__name__}",
            "critical": critical
        }


@router.get("/api/probe/e2e")
async def e2e_backend_probe():
    """
    Fan-out health probe to all backend services
    Returns structured matrix with status, latency, and notes
    """
    started_at = time.time()

    # Probe all services in parallel
    results = await asyncio.gather(*[probe_service(svc) for svc in SERVICES])

    # Sort by service name
    results = sorted(results, key=lambda x: x["service"])

    duration_ms = round((time.time() - started_at) * 1000, 2)

    # Count by status
    counts = {
        "pass": sum(1 for r in results if r["status"] == "pass"),
        "warn": sum(1 for r in results if r["status"] == "warn"),
        "fail": sum(1 for r in results if r["status"] == "fail"),
        "unused": sum(1 for r in results if r["status"] == "unused"),
    }

    return {
        "started_at": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(started_at)),
        "duration_ms": duration_ms,
        "total_services": len(results),
        "counts": counts,
        "services": results
    }

