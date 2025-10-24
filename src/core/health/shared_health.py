"""
Shared health check module to reduce duplication across services
"""

import asyncio
import aiohttp
import time
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from src.core.config.shared_config import get_service_url

@dataclass
class HealthStatus:
    """Health status for a service"""
    service: str
    status: str
    response_time: float
    timestamp: float
    details: Dict[str, Any] = None

class HealthChecker:
    """Centralized health checker for all services"""
    
    def __init__(self):
        self.timeout = 5.0
        self.retry_count = 3
    
    async def check_service_health(self, service_name: str, path: str = "/health") -> HealthStatus:
        """Check health of a specific service"""
        url = get_service_url(service_name, path)
        start_time = time.time()
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=self.timeout) as response:
                    response_time = time.time() - start_time
                    
                    if response.status == 200:
                        data = await response.json()
                        return HealthStatus(
                            service=service_name,
                            status="healthy",
                            response_time=response_time,
                            timestamp=time.time(),
                            details=data
                        )
                    else:
                        return HealthStatus(
                            service=service_name,
                            status="unhealthy",
                            response_time=response_time,
                            timestamp=time.time(),
                            details={"status_code": response.status}
                        )
        except Exception as e:
            return HealthStatus(
                service=service_name,
                status="error",
                response_time=time.time() - start_time,
                timestamp=time.time(),
                details={"error": str(e)}
            )
    
    async def check_multiple_services(self, services: List[str]) -> Dict[str, HealthStatus]:
        """Check health of multiple services concurrently"""
        tasks = [self.check_service_health(service) for service in services]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        health_status = {}
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                health_status[services[i]] = HealthStatus(
                    service=services[i],
                    status="error",
                    response_time=0.0,
                    timestamp=time.time(),
                    details={"error": str(result)}
                )
            else:
                health_status[result.service] = result
        
        return health_status
    
    def get_health_summary(self, health_status: Dict[str, HealthStatus]) -> Dict[str, Any]:
        """Get summary of health status"""
        total_services = len(health_status)
        healthy_services = sum(1 for status in health_status.values() if status.status == "healthy")
        unhealthy_services = total_services - healthy_services
        
        avg_response_time = sum(
            status.response_time for status in health_status.values() 
            if status.status == "healthy"
        ) / max(healthy_services, 1)
        
        return {
            "total_services": total_services,
            "healthy_services": healthy_services,
            "unhealthy_services": unhealthy_services,
            "health_percentage": (healthy_services / total_services) * 100,
            "average_response_time": avg_response_time,
            "timestamp": time.time()
        }

# Global health checker instance
health_checker = HealthChecker()

async def check_service_health(service_name: str, path: str = "/health") -> HealthStatus:
    """Check health of a service"""
    return await health_checker.check_service_health(service_name, path)

async def check_all_services() -> Dict[str, HealthStatus]:
    """Check health of all core services"""
    core_services = [
        "api_gateway",
        "assistantd", 
        "llm_router",
        "ml_inference",
        "memory_service",
        "fast_llm",
        "weaviate",
        "redis",
        "postgres"
    ]
    return await health_checker.check_multiple_services(core_services)