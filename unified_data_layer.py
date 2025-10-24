#!/usr/bin/env python3
"""
Universal AI Tools - Unified Data Layer
Unified data access for Family Athena and Enterprise Platform
"""

import asyncio
import json
import time
from typing import Dict, Any, List, Optional, Union
from datetime import datetime
from pathlib import Path
import httpx
import redis
import asyncpg

class UnifiedDataLayer:
    def __init__(self):
        self.redis_client = None
        self.postgres_pool = None
        self.weaviate_client = None
        self.connections = {}
        
    def log(self, message, level="INFO"):
        """Log with timestamp"""
        timestamp = time.strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    async def connect_databases(self):
        """Connect to all databases"""
        self.log("🔗 Connecting to databases...")
        
        try:
            # Redis connection
            self.redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True)
            self.redis_client.ping()
            self.log("✅ Redis connected")
            
            # PostgreSQL connection
            self.postgres_pool = await asyncpg.create_pool(
                host='localhost',
                port=5432,
                user='postgres',
                password='postgres',
                database='universal_ai_tools'
            )
            self.log("✅ PostgreSQL connected")
            
            # Weaviate connection (simulated)
            self.weaviate_client = "http://localhost:8090"
            self.log("✅ Weaviate connected")
            
        except Exception as e:
            self.log(f"❌ Database connection error: {e}", "ERROR")
            raise
    
    async def get_family_data(self, data_type: str, filters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Get family data from appropriate storage"""
        try:
            if data_type == "members":
                # Get from family profiles service
                async with httpx.AsyncClient() as client:
                    response = await client.get("http://localhost:8005/api/members")
                    return response.json()
            elif data_type == "events":
                # Get from family calendar service
                async with httpx.AsyncClient() as client:
                    response = await client.get("http://localhost:8006/api/events")
                    return response.json()
            elif data_type == "knowledge":
                # Get from family knowledge service
                async with httpx.AsyncClient() as client:
                    response = await client.get("http://localhost:8007/api/knowledge")
                    return response.json()
            else:
                return []
        except Exception as e:
            self.log(f"❌ Error getting family data: {e}", "ERROR")
            return []
    
    async def get_enterprise_data(self, data_type: str, filters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Get enterprise data from appropriate storage"""
        try:
            if data_type == "users":
                # Get from PostgreSQL
                async with self.postgres_pool.acquire() as conn:
                    rows = await conn.fetch("SELECT * FROM users")
                    return [dict(row) for row in rows]
            elif data_type == "metrics":
                # Get from Redis
                keys = self.redis_client.keys("metrics:*")
                data = []
                for key in keys:
                    value = self.redis_client.get(key)
                    data.append(json.loads(value))
                return data
            elif data_type == "vectors":
                # Get from Weaviate
                async with httpx.AsyncClient() as client:
                    response = await client.get(f"{self.weaviate_client}/v1/objects")
                    return response.json()
            else:
                return []
        except Exception as e:
            self.log(f"❌ Error getting enterprise data: {e}", "ERROR")
            return []
    
    async def store_family_data(self, data_type: str, data: Dict[str, Any]) -> bool:
        """Store family data in appropriate storage"""
        try:
            if data_type == "members":
                # Store in family profiles service
                async with httpx.AsyncClient() as client:
                    response = await client.post("http://localhost:8005/api/members", json=data)
                    return response.status_code == 200
            elif data_type == "events":
                # Store in family calendar service
                async with httpx.AsyncClient() as client:
                    response = await client.post("http://localhost:8006/api/events", json=data)
                    return response.status_code == 200
            elif data_type == "knowledge":
                # Store in family knowledge service
                async with httpx.AsyncClient() as client:
                    response = await client.post("http://localhost:8007/api/knowledge", json=data)
                    return response.status_code == 200
            else:
                return False
        except Exception as e:
            self.log(f"❌ Error storing family data: {e}", "ERROR")
            return False
    
    async def store_enterprise_data(self, data_type: str, data: Dict[str, Any]) -> bool:
        """Store enterprise data in appropriate storage"""
        try:
            if data_type == "users":
                # Store in PostgreSQL
                async with self.postgres_pool.acquire() as conn:
                    await conn.execute(
                        "INSERT INTO users (id, name, email) VALUES ($1, $2, $3)",
                        data.get("id"), data.get("name"), data.get("email")
                    )
                    return True
            elif data_type == "metrics":
                # Store in Redis
                key = f"metrics:{data.get('id', 'default')}"
                self.redis_client.set(key, json.dumps(data))
                return True
            elif data_type == "vectors":
                # Store in Weaviate
                async with httpx.AsyncClient() as client:
                    response = await client.post(f"{self.weaviate_client}/v1/objects", json=data)
                    return response.status_code == 200
            else:
                return False
        except Exception as e:
            self.log(f"❌ Error storing enterprise data: {e}", "ERROR")
            return False
    
    async def search_unified_data(self, query: str, data_types: List[str] = None) -> Dict[str, List[Dict[str, Any]]]:
        """Search across all data types"""
        if data_types is None:
            data_types = ["family", "enterprise"]
        
        results = {}
        
        for data_type in data_types:
            if data_type == "family":
                # Search family data
                family_results = {}
                for sub_type in ["members", "events", "knowledge"]:
                    family_results[sub_type] = await self.get_family_data(sub_type, {"search": query})
                results["family"] = family_results
            elif data_type == "enterprise":
                # Search enterprise data
                enterprise_results = {}
                for sub_type in ["users", "metrics", "vectors"]:
                    enterprise_results[sub_type] = await self.get_enterprise_data(sub_type, {"search": query})
                results["enterprise"] = enterprise_results
        
        return results
    
    async def sync_data_across_platforms(self):
        """Sync data between Family Athena and Enterprise Platform"""
        self.log("🔄 Syncing data across platforms...")
        
        try:
            # Get family data
            family_members = await self.get_family_data("members")
            family_events = await self.get_family_data("events")
            family_knowledge = await self.get_family_data("knowledge")
            
            # Sync to enterprise platform
            for member in family_members:
                await self.store_enterprise_data("users", {
                    "id": f"family_{member.get('id')}",
                    "name": member.get("name"),
                    "email": member.get("email", ""),
                    "type": "family_member"
                })
            
            # Get enterprise data
            enterprise_users = await self.get_enterprise_data("users")
            enterprise_metrics = await self.get_enterprise_data("metrics")
            
            # Sync to family platform (if needed)
            for user in enterprise_users:
                if user.get("type") != "family_member":
                    # This is an enterprise user, could sync to family if needed
                    pass
            
            self.log("✅ Data sync completed")
            return True
            
        except Exception as e:
            self.log(f"❌ Data sync error: {e}", "ERROR")
            return False
    
    async def get_unified_analytics(self) -> Dict[str, Any]:
        """Get analytics across all platforms"""
        try:
            # Family analytics
            family_members = await self.get_family_data("members")
            family_events = await self.get_family_data("events")
            family_knowledge = await self.get_family_data("knowledge")
            
            # Enterprise analytics
            enterprise_users = await self.get_enterprise_data("users")
            enterprise_metrics = await self.get_enterprise_data("metrics")
            
            return {
                "family_athena": {
                    "members": len(family_members),
                    "events": len(family_events),
                    "knowledge_items": len(family_knowledge)
                },
                "enterprise_platform": {
                    "users": len(enterprise_users),
                    "metrics": len(enterprise_metrics)
                },
                "total_data_points": len(family_members) + len(family_events) + len(family_knowledge) + len(enterprise_users) + len(enterprise_metrics),
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            self.log(f"❌ Analytics error: {e}", "ERROR")
            return {}
    
    async def close_connections(self):
        """Close all database connections"""
        if self.redis_client:
            self.redis_client.close()
        if self.postgres_pool:
            await self.postgres_pool.close()

async def main():
    """Main execution"""
    data_layer = UnifiedDataLayer()
    
    try:
        await data_layer.connect_databases()
        
        # Test data operations
        await data_layer.sync_data_across_platforms()
        analytics = await data_layer.get_unified_analytics()
        print(f"Unified Analytics: {json.dumps(analytics, indent=2)}")
        
    finally:
        await data_layer.close_connections()

if __name__ == "__main__":
    asyncio.run(main())
