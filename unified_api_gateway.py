#!/usr/bin/env python3
"""
Universal AI Tools - Unified API Gateway
Single entry point for all Family Athena and Enterprise Platform services
"""

import asyncio
import json
import time
from typing import Dict, Any, List, Optional
from datetime import datetime
from pathlib import Path
import httpx
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

class UnifiedAPIGateway:
    def __init__(self):
        self.app = FastAPI(
            title="Universal AI Tools - Unified API Gateway",
            description="Single entry point for all AI services",
            version="1.0.0"
        )
        self.setup_middleware()
        self.setup_routes()
        
        # Service registry
        self.services = {
            # Family Athena Services
            "family_profiles": "http://localhost:8005",
            "family_calendar": "http://localhost:8006", 
            "family_knowledge": "http://localhost:8007",
            "athena_gateway": "http://localhost:8080",
            
            # Enterprise Go Services
            "go_api_gateway": "http://localhost:8081",
            "message_broker": "http://localhost:8082",
            "load_balancer": "http://localhost:8083",
            "cache_coordinator": "http://localhost:8084",
            "stream_processor": "http://localhost:8085",
            "monitoring_service": "http://localhost:8086",
            "orchestration_service": "http://localhost:8087",
            "auth_service": "http://localhost:8088",
            "chat_service": "http://localhost:8089",
            "knowledge_gateway": "http://localhost:8090",
            
            # Rust Services
            "llm_router": "http://localhost:3033",
            "ml_inference": "http://localhost:8091",
            "vector_db": "http://localhost:8092",
            "assistantd": "http://localhost:8080",
            
            # Data Services
            "redis": "redis://localhost:6379",
            "postgresql": "postgresql://localhost:5432",
            "weaviate": "http://localhost:8090"
        }
        
        # Health status
        self.health_status = {}
        self.last_health_check = None
        
    def setup_middleware(self):
        """Setup CORS and other middleware"""
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
        
    def setup_routes(self):
        """Setup all API routes"""
        
        @self.app.get("/")
        async def root():
            return {
                "message": "Universal AI Tools - Unified API Gateway",
                "version": "1.0.0",
                "status": "operational",
                "services": len(self.services),
                "timestamp": datetime.now().isoformat()
            }
        
        @self.app.get("/health")
        async def health_check():
            """Comprehensive health check for all services"""
            health_report = await self.check_all_services_health()
            return health_report
        
        @self.app.get("/services")
        async def list_services():
            """List all available services"""
            return {
                "services": self.services,
                "total": len(self.services),
                "categories": {
                    "family_athena": ["family_profiles", "family_calendar", "family_knowledge", "athena_gateway"],
                    "enterprise_go": ["go_api_gateway", "message_broker", "load_balancer", "cache_coordinator", "stream_processor", "monitoring_service", "orchestration_service", "auth_service", "chat_service", "knowledge_gateway"],
                    "rust_services": ["llm_router", "ml_inference", "vector_db", "assistantd"],
                    "data_services": ["redis", "postgresql", "weaviate"]
                }
            }
        
        # Family Athena Routes
        @self.app.post("/api/family/chat")
        async def family_chat(request: Request):
            """Route to Family Athena chat"""
            return await self.route_request("athena_gateway", "/api/chat", request)
        
        @self.app.get("/api/family/members")
        async def get_family_members():
            """Get family members"""
            return await self.route_request("family_profiles", "/api/members", None, method="GET")
        
        @self.app.post("/api/family/members")
        async def create_family_member(request: Request):
            """Create family member"""
            return await self.route_request("family_profiles", "/api/members", request)
        
        @self.app.get("/api/family/calendar")
        async def get_family_calendar():
            """Get family calendar"""
            return await self.route_request("family_calendar", "/api/calendar", None, method="GET")
        
        @self.app.post("/api/family/calendar")
        async def create_family_event(request: Request):
            """Create family event"""
            return await self.route_request("family_calendar", "/api/events", request)
        
        @self.app.get("/api/family/knowledge")
        async def get_family_knowledge():
            """Get family knowledge"""
            return await self.route_request("family_knowledge", "/api/knowledge", None, method="GET")
        
        @self.app.post("/api/family/knowledge")
        async def create_family_knowledge(request: Request):
            """Create family knowledge"""
            return await self.route_request("family_knowledge", "/api/knowledge", request)
        
        # Enterprise Platform Routes
        @self.app.post("/api/enterprise/chat")
        async def enterprise_chat(request: Request):
            """Route to Enterprise chat service"""
            return await self.route_request("chat_service", "/api/chat", request)
        
        @self.app.post("/api/enterprise/orchestrate")
        async def enterprise_orchestrate(request: Request):
            """Route to Enterprise orchestration"""
            return await self.route_request("orchestration_service", "/api/orchestrate", request)
        
        @self.app.get("/api/enterprise/monitoring")
        async def get_enterprise_monitoring():
            """Get enterprise monitoring data"""
            return await self.route_request("monitoring_service", "/api/metrics", None, method="GET")
        
        @self.app.post("/api/enterprise/llm/infer")
        async def enterprise_llm_infer(request: Request):
            """Route to LLM inference"""
            return await self.route_request("llm_router", "/api/infer", request)
        
        @self.app.get("/api/enterprise/models")
        async def get_enterprise_models():
            """Get available models"""
            return await self.route_request("llm_router", "/api/models", None, method="GET")
        
        # Unified Routes (combine both platforms)
        @self.app.post("/api/unified/chat")
        async def unified_chat(request: Request):
            """Unified chat that can route to family or enterprise"""
            body = await request.json()
            context = body.get("context", {})
            
            # Determine routing based on context
            if context.get("type") == "family":
                return await self.route_request("athena_gateway", "/api/chat", request)
            else:
                return await self.route_request("chat_service", "/api/chat", request)
        
        @self.app.post("/api/unified/orchestrate")
        async def unified_orchestrate(request: Request):
            """Unified orchestration for both platforms"""
            body = await request.json()
            task_type = body.get("task_type", "general")
            
            if task_type == "family":
                return await self.route_request("athena_gateway", "/api/orchestrate", request)
            else:
                return await self.route_request("orchestration_service", "/api/orchestrate", request)
        
        @self.app.get("/api/unified/health")
        async def unified_health():
            """Unified health check for both platforms"""
            family_health = await self.check_service_health("athena_gateway")
            enterprise_health = await self.check_service_health("go_api_gateway")
            
            return {
                "unified_status": "operational" if family_health["healthy"] and enterprise_health["healthy"] else "degraded",
                "family_athena": family_health,
                "enterprise_platform": enterprise_health,
                "timestamp": datetime.now().isoformat()
            }
    
    async def route_request(self, service_name: str, endpoint: str, request: Request = None, method: str = "POST"):
        """Route request to appropriate service"""
        if service_name not in self.services:
            raise HTTPException(status_code=404, detail=f"Service {service_name} not found")
        
        service_url = self.services[service_name]
        full_url = f"{service_url}{endpoint}"
        
        try:
            async with httpx.AsyncClient() as client:
                if method == "GET":
                    response = await client.get(full_url, timeout=30.0)
                else:
                    body = await request.json() if request else {}
                    response = await client.post(full_url, json=body, timeout=30.0)
                
                return response.json()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Service {service_name} error: {str(e)}")
    
    async def check_service_health(self, service_name: str) -> Dict[str, Any]:
        """Check health of a specific service"""
        if service_name not in self.services:
            return {"healthy": False, "error": "Service not found"}
        
        service_url = self.services[service_name]
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{service_url}/health", timeout=5.0)
                return {
                    "healthy": response.status_code == 200,
                    "status_code": response.status_code,
                    "response_time": response.elapsed.total_seconds(),
                    "timestamp": datetime.now().isoformat()
                }
        except Exception as e:
            return {
                "healthy": False,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    async def check_all_services_health(self) -> Dict[str, Any]:
        """Check health of all services"""
        health_tasks = []
        for service_name in self.services:
            health_tasks.append(self.check_service_health(service_name))
        
        health_results = await asyncio.gather(*health_tasks, return_exceptions=True)
        
        healthy_services = 0
        total_services = len(self.services)
        
        service_health = {}
        for i, service_name in enumerate(self.services):
            result = health_results[i]
            if isinstance(result, dict):
                service_health[service_name] = result
                if result.get("healthy", False):
                    healthy_services += 1
            else:
                service_health[service_name] = {
                    "healthy": False,
                    "error": str(result),
                    "timestamp": datetime.now().isoformat()
                }
        
        return {
            "overall_status": "healthy" if healthy_services == total_services else "degraded",
            "healthy_services": healthy_services,
            "total_services": total_services,
            "services": service_health,
            "timestamp": datetime.now().isoformat()
        }
    
    async def start_gateway(self):
        """Start the unified API gateway"""
        self.log("🚀 Starting Unified API Gateway...")
        
        config = uvicorn.Config(
            app=self.app,
            host="0.0.0.0",
            port=9000,
            log_level="info"
        )
        server = uvicorn.Server(config)
        await server.serve()

async def main():
    """Main execution"""
    gateway = UnifiedAPIGateway()
    await gateway.start_gateway()

if __name__ == "__main__":
    asyncio.run(main())
