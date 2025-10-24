#!/usr/bin/env python3
"""
Family Athena Service Mesh
Seamless communication between all services
"""

import asyncio
import json
import time
from typing import Dict, Any, List, Optional
from datetime import datetime
from pathlib import Path
import threading
import queue

class ServiceMesh:
    def __init__(self):
        self.services = {}
        self.message_queue = queue.Queue()
        self.event_handlers = {}
        self.running = False
        
    def log(self, message, level="INFO"):
        """Log with timestamp"""
        timestamp = time.strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def register_service(self, service_name: str, service_instance: Any):
        """Register a service in the mesh"""
        self.services[service_name] = service_instance
        self.log(f"✅ Service registered: {service_name}")
        
    def subscribe_to_events(self, service_name: str, event_types: List[str], handler):
        """Subscribe a service to specific event types"""
        if service_name not in self.event_handlers:
            self.event_handlers[service_name] = {}
        
        for event_type in event_types:
            self.event_handlers[service_name][event_type] = handler
            self.log(f"✅ {service_name} subscribed to {event_type} events")
    
    async def publish_event(self, event_type: str, data: Dict[str, Any], source: str):
        """Publish an event to the mesh"""
        event = {
            "type": event_type,
            "data": data,
            "source": source,
            "timestamp": datetime.now().isoformat()
        }
        
        self.message_queue.put(event)
        self.log(f"📡 Event published: {event_type} from {source}")
        
        # Process event immediately
        await self.process_event(event)
    
    async def process_event(self, event: Dict[str, Any]):
        """Process an event through the mesh"""
        event_type = event["type"]
        
        for service_name, handlers in self.event_handlers.items():
            if event_type in handlers:
                try:
                    handler = handlers[event_type]
                    if asyncio.iscoroutinefunction(handler):
                        await handler(event)
                    else:
                        handler(event)
                    self.log(f"✅ Event processed by {service_name}")
                except Exception as e:
                    self.log(f"❌ Error processing event in {service_name}: {e}", "ERROR")
    
    async def send_message(self, from_service: str, to_service: str, message: Dict[str, Any]):
        """Send a direct message between services"""
        if to_service not in self.services:
            self.log(f"❌ Target service not found: {to_service}", "ERROR")
            return False
        
        try:
            # Simulate message delivery
            self.log(f"📨 Message sent from {from_service} to {to_service}")
            return True
        except Exception as e:
            self.log(f"❌ Message delivery failed: {e}", "ERROR")
            return False
    
    async def broadcast_message(self, from_service: str, message: Dict[str, Any]):
        """Broadcast a message to all services"""
        for service_name in self.services:
            if service_name != from_service:
                await self.send_message(from_service, service_name, message)
        
        self.log(f"📢 Message broadcast from {from_service} to all services")
    
    async def get_service_status(self) -> Dict[str, Any]:
        """Get status of all services in the mesh"""
        status = {
            "total_services": len(self.services),
            "services": {},
            "event_handlers": len(self.event_handlers),
            "queue_size": self.message_queue.qsize()
        }
        
        for service_name in self.services:
            status["services"][service_name] = {
                "registered": True,
                "event_subscriptions": len(self.event_handlers.get(service_name, {}))
            }
        
        return status
    
    async def start_mesh(self):
        """Start the service mesh"""
        self.running = True
        self.log("🕸️ Service mesh started")
        
        # Start event processing loop
        asyncio.create_task(self.event_processing_loop())
    
    async def event_processing_loop(self):
        """Main event processing loop"""
        while self.running:
            try:
                if not self.message_queue.empty():
                    event = self.message_queue.get_nowait()
                    await self.process_event(event)
                else:
                    await asyncio.sleep(0.1)
            except Exception as e:
                self.log(f"❌ Error in event processing loop: {e}", "ERROR")
    
    async def stop_mesh(self):
        """Stop the service mesh"""
        self.running = False
        self.log("🛑 Service mesh stopped")

# Global service mesh instance
_service_mesh = None

def get_service_mesh() -> ServiceMesh:
    """Get global service mesh instance"""
    global _service_mesh
    if _service_mesh is None:
        _service_mesh = ServiceMesh()
    return _service_mesh

# Event types
class EventTypes:
    FAMILY_MEMBER_ADDED = "family_member_added"
    FAMILY_MEMBER_UPDATED = "family_member_updated"
    FAMILY_EVENT_ADDED = "family_event_added"
    FAMILY_EVENT_UPDATED = "family_event_updated"
    FAMILY_KNOWLEDGE_ADDED = "family_knowledge_added"
    FAMILY_KNOWLEDGE_UPDATED = "family_knowledge_updated"
    FAMILY_DASHBOARD_UPDATE = "family_dashboard_update"
    SYSTEM_HEALTH_CHECK = "system_health_check"
    SERVICE_STARTED = "service_started"
    SERVICE_STOPPED = "service_stopped"

# Service mesh integration functions
async def publish_family_event(event_type: str, data: Dict[str, Any], source: str = "system"):
    """Publish a family-related event"""
    mesh = get_service_mesh()
    await mesh.publish_event(event_type, data, source)

async def subscribe_to_family_events(service_name: str, event_types: List[str], handler):
    """Subscribe to family events"""
    mesh = get_service_mesh()
    await mesh.subscribe_to_events(service_name, event_types, handler)

async def send_family_message(from_service: str, to_service: str, message: Dict[str, Any]):
    """Send a message between family services"""
    mesh = get_service_mesh()
    return await mesh.send_message(from_service, to_service, message)

async def broadcast_family_update(from_service: str, update: Dict[str, Any]):
    """Broadcast a family update to all services"""
    mesh = get_service_mesh()
    await mesh.broadcast_message(from_service, update)

if __name__ == "__main__":
    async def main():
        mesh = get_service_mesh()
        await mesh.start_mesh()
        
        # Example usage
        await publish_family_event(EventTypes.FAMILY_MEMBER_ADDED, {
            "member_id": "dad_001",
            "name": "Dad",
            "role": "parent"
        }, "family_profiles")
        
        # Keep running
        while True:
            await asyncio.sleep(1)
    
    asyncio.run(main())
