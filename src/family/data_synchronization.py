#!/usr/bin/env python3
"""
Family Athena Data Synchronization
Real-time data synchronization across all services
"""

import asyncio
import json
import time
from typing import Dict, Any, List, Optional
from datetime import datetime
from pathlib import Path
import threading
import queue

class DataSynchronizer:
    def __init__(self):
        self.sync_queue = queue.Queue()
        self.sync_handlers = {}
        self.running = False
        self.sync_interval = 1.0  # seconds
        
    def log(self, message, level="INFO"):
        """Log with timestamp"""
        timestamp = time.strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def register_sync_handler(self, data_type: str, handler):
        """Register a handler for data synchronization"""
        self.sync_handlers[data_type] = handler
        self.log(f"✅ Sync handler registered for {data_type}")
        
    async def sync_data(self, data_type: str, data: Dict[str, Any], source: str):
        """Synchronize data across services"""
        sync_event = {
            "type": "data_sync",
            "data_type": data_type,
            "data": data,
            "source": source,
            "timestamp": datetime.now().isoformat()
        }
        
        self.sync_queue.put(sync_event)
        self.log(f"🔄 Data sync queued: {data_type} from {source}")
        
        # Process sync immediately
        await self.process_sync(sync_event)
    
    async def process_sync(self, sync_event: Dict[str, Any]):
        """Process a data synchronization event"""
        data_type = sync_event["data_type"]
        
        if data_type in self.sync_handlers:
            try:
                handler = self.sync_handlers[data_type]
                if asyncio.iscoroutinefunction(handler):
                    await handler(sync_event)
                else:
                    handler(sync_event)
                self.log(f"✅ Data synced: {data_type}")
            except Exception as e:
                self.log(f"❌ Sync failed for {data_type}: {e}", "ERROR")
        else:
            self.log(f"⚠️ No sync handler for {data_type}")
    
    async def sync_family_member(self, member_data: Dict[str, Any], source: str):
        """Synchronize family member data"""
        await self.sync_data("family_member", member_data, source)
    
    async def sync_family_event(self, event_data: Dict[str, Any], source: str):
        """Synchronize family event data"""
        await self.sync_data("family_event", event_data, source)
    
    async def sync_family_knowledge(self, knowledge_data: Dict[str, Any], source: str):
        """Synchronize family knowledge data"""
        await self.sync_data("family_knowledge", knowledge_data, source)
    
    async def sync_dashboard_data(self, dashboard_data: Dict[str, Any], source: str):
        """Synchronize dashboard data"""
        await self.sync_data("dashboard", dashboard_data, source)
    
    async def start_sync(self):
        """Start data synchronization"""
        self.running = True
        self.log("🔄 Data synchronization started")
        
        # Start sync processing loop
        asyncio.create_task(self.sync_processing_loop())
    
    async def sync_processing_loop(self):
        """Main sync processing loop"""
        while self.running:
            try:
                if not self.sync_queue.empty():
                    sync_event = self.sync_queue.get_nowait()
                    await self.process_sync(sync_event)
                else:
                    await asyncio.sleep(self.sync_interval)
            except Exception as e:
                self.log(f"❌ Error in sync processing loop: {e}", "ERROR")
    
    async def stop_sync(self):
        """Stop data synchronization"""
        self.running = False
        self.log("🛑 Data synchronization stopped")
    
    async def get_sync_status(self) -> Dict[str, Any]:
        """Get synchronization status"""
        return {
            "running": self.running,
            "queue_size": self.sync_queue.qsize(),
            "handlers_registered": len(self.sync_handlers),
            "sync_interval": self.sync_interval
        }

# Global data synchronizer instance
_data_synchronizer = None

def get_data_synchronizer() -> DataSynchronizer:
    """Get global data synchronizer instance"""
    global _data_synchronizer
    if _data_synchronizer is None:
        _data_synchronizer = DataSynchronizer()
    return _data_synchronizer

# Data synchronization functions
async def sync_family_member_data(member_data: Dict[str, Any], source: str = "system"):
    """Synchronize family member data across services"""
    synchronizer = get_data_synchronizer()
    await synchronizer.sync_family_member(member_data, source)

async def sync_family_event_data(event_data: Dict[str, Any], source: str = "system"):
    """Synchronize family event data across services"""
    synchronizer = get_data_synchronizer()
    await synchronizer.sync_family_event(event_data, source)

async def sync_family_knowledge_data(knowledge_data: Dict[str, Any], source: str = "system"):
    """Synchronize family knowledge data across services"""
    synchronizer = get_data_synchronizer()
    await synchronizer.sync_family_knowledge(knowledge_data, source)

async def sync_dashboard_data(dashboard_data: Dict[str, Any], source: str = "system"):
    """Synchronize dashboard data across services"""
    synchronizer = get_data_synchronizer()
    await synchronizer.sync_dashboard_data(dashboard_data, source)

if __name__ == "__main__":
    async def main():
        synchronizer = get_data_synchronizer()
        await synchronizer.start_sync()
        
        # Example usage
        await sync_family_member_data({
            "id": "dad_001",
            "name": "Dad",
            "role": "parent",
            "updated_at": datetime.now().isoformat()
        }, "family_profiles")
        
        # Keep running
        while True:
            await asyncio.sleep(1)
    
    asyncio.run(main())
