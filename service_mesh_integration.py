#!/usr/bin/env python3
"""
Universal AI Tools - Service Mesh Integration
Connect all Family Athena and Enterprise Platform services
"""

import asyncio
import json
import time
from typing import Dict, Any, List, Optional
from datetime import datetime
from pathlib import Path
import httpx

class ServiceMeshIntegration:
    def __init__(self):
        self.services = {}
        self.connections = {}
        self.message_queue = asyncio.Queue()
        self.running = False
        
    def log(self, message, level="INFO"):
        """Log with timestamp"""
        timestamp = time.strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    async def register_service(self, service_name: str, service_url: str, service_type: str):
        """Register a service in the mesh"""
        self.services[service_name] = {
            "url": service_url,
            "type": service_type,
            "status": "registered",
            "last_heartbeat": datetime.now().isoformat()
        }
        self.log(f"✅ Service registered: {service_name} ({service_type})")
        
    async def connect_services(self):
        """Connect all services in the mesh"""
        self.log("🔗 Connecting all services...")
        
        # Family Athena Services
        await self.register_service("family_profiles", "http://localhost:8005", "family")
        await self.register_service("family_calendar", "http://localhost:8006", "family")
        await self.register_service("family_knowledge", "http://localhost:8007", "family")
        await self.register_service("athena_gateway", "http://localhost:8080", "family")
        
        # Enterprise Go Services
        await self.register_service("go_api_gateway", "http://localhost:8081", "enterprise")
        await self.register_service("message_broker", "http://localhost:8082", "enterprise")
        await self.register_service("load_balancer", "http://localhost:8083", "enterprise")
        await self.register_service("cache_coordinator", "http://localhost:8084", "enterprise")
        await self.register_service("stream_processor", "http://localhost:8085", "enterprise")
        await self.register_service("monitoring_service", "http://localhost:8086", "enterprise")
        await self.register_service("orchestration_service", "http://localhost:8087", "enterprise")
        await self.register_service("auth_service", "http://localhost:8088", "enterprise")
        await self.register_service("chat_service", "http://localhost:8089", "enterprise")
        await self.register_service("knowledge_gateway", "http://localhost:8090", "enterprise")
        
        # Rust Services
        await self.register_service("llm_router", "http://localhost:3033", "rust")
        await self.register_service("ml_inference", "http://localhost:8091", "rust")
        await self.register_service("vector_db", "http://localhost:8092", "rust")
        await self.register_service("assistantd", "http://localhost:8080", "rust")
        
        self.log(f"✅ Connected {len(self.services)} services")
        
    async def send_message(self, from_service: str, to_service: str, message: Dict[str, Any]):
        """Send message between services"""
        if to_service not in self.services:
            self.log(f"❌ Target service not found: {to_service}", "ERROR")
            return False
        
        try:
            service_url = self.services[to_service]["url"]
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{service_url}/api/mesh/message",
                    json={
                        "from": from_service,
                        "message": message,
                        "timestamp": datetime.now().isoformat()
                    },
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    self.log(f"📨 Message sent from {from_service} to {to_service}")
                    return True
                else:
                    self.log(f"❌ Message failed: {response.status_code}", "ERROR")
                    return False
        except Exception as e:
            self.log(f"❌ Message error: {e}", "ERROR")
            return False
    
    async def broadcast_message(self, from_service: str, message: Dict[str, Any], service_type: str = None):
        """Broadcast message to all services or specific type"""
        targets = []
        
        for service_name, service_info in self.services.items():
            if service_type is None or service_info["type"] == service_type:
                if service_name != from_service:
                    targets.append(service_name)
        
        self.log(f"📢 Broadcasting message from {from_service} to {len(targets)} services")
        
        tasks = []
        for target in targets:
            tasks.append(self.send_message(from_service, target, message))
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        successful = sum(1 for r in results if r is True)
        
        self.log(f"✅ Broadcast complete: {successful}/{len(targets)} successful")
        return successful
    
    async def health_check_all_services(self) -> Dict[str, Any]:
        """Check health of all services in the mesh"""
        health_tasks = []
        
        for service_name, service_info in self.services.items():
            health_tasks.append(self.check_service_health(service_name, service_info["url"]))
        
        health_results = await asyncio.gather(*health_tasks, return_exceptions=True)
        
        healthy_count = 0
        service_health = {}
        
        for i, service_name in enumerate(self.services):
            result = health_results[i]
            if isinstance(result, dict) and result.get("healthy", False):
                healthy_count += 1
                service_health[service_name] = result
            else:
                service_health[service_name] = {
                    "healthy": False,
                    "error": str(result) if isinstance(result, Exception) else "Unknown error"
                }
        
        return {
            "total_services": len(self.services),
            "healthy_services": healthy_count,
            "unhealthy_services": len(self.services) - healthy_count,
            "services": service_health,
            "timestamp": datetime.now().isoformat()
        }
    
    async def check_service_health(self, service_name: str, service_url: str) -> Dict[str, Any]:
        """Check health of a specific service"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{service_url}/health", timeout=5.0)
                return {
                    "healthy": response.status_code == 200,
                    "status_code": response.status_code,
                    "response_time": response.elapsed.total_seconds(),
                    "service_name": service_name,
                    "timestamp": datetime.now().isoformat()
                }
        except Exception as e:
            return {
                "healthy": False,
                "error": str(e),
                "service_name": service_name,
                "timestamp": datetime.now().isoformat()
            }
    
    async def start_mesh(self):
        """Start the service mesh"""
        self.running = True
        self.log("🕸️ Starting service mesh integration...")
        
        # Connect all services
        await self.connect_services()
        
        # Start health monitoring
        asyncio.create_task(self.health_monitoring_loop())
        
        # Start message processing
        asyncio.create_task(self.message_processing_loop())
        
        self.log("✅ Service mesh integration started")
    
    async def health_monitoring_loop(self):
        """Continuous health monitoring"""
        while self.running:
            try:
                health_report = await self.health_check_all_services()
                
                healthy_count = health_report["healthy_services"]
                total_count = health_report["total_services"]
                
                if healthy_count == total_count:
                    self.log("✅ All services healthy")
                else:
                    self.log(f"⚠️ {total_count - healthy_count} services unhealthy")
                
                await asyncio.sleep(30)  # Check every 30 seconds
                
            except Exception as e:
                self.log(f"❌ Health monitoring error: {e}", "ERROR")
                await asyncio.sleep(30)
    
    async def message_processing_loop(self):
        """Process messages in the mesh"""
        while self.running:
            try:
                if not self.message_queue.empty():
                    message = await self.message_queue.get()
                    # Process message
                    self.log(f"📨 Processing message: {message}")
                
                await asyncio.sleep(0.1)
            except Exception as e:
                self.log(f"❌ Message processing error: {e}", "ERROR")
                await asyncio.sleep(1)
    
    async def stop_mesh(self):
        """Stop the service mesh"""
        self.running = False
        self.log("🛑 Service mesh integration stopped")

async def main():
    """Main execution"""
    mesh = ServiceMeshIntegration()
    await mesh.start_mesh()
    
    # Keep running
    try:
        while True:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        await mesh.stop_mesh()

if __name__ == "__main__":
    asyncio.run(main())
