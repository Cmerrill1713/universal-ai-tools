#!/usr/bin/env python3
"""
Supabase Integration Service
Manages knowledge storage and retrieval using Supabase
"""

import asyncio
import aiohttp
import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
import os
from urllib.parse import urljoin

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SupabaseClient:
    def __init__(self, 
                 supabase_url="http://localhost:54321",
                 supabase_key="your-anon-key"):
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.session = None
        
    async def initialize(self):
        """Initialize the Supabase client"""
        self.session = aiohttp.ClientSession()
        logger.info(f"🗄️ Supabase Client initialized: {self.supabase_url}")
        
    async def store_knowledge_document(self, document: Dict[str, Any]) -> Dict[str, Any]:
        """Store a knowledge document in Supabase"""
        try:
            headers = {
                "apikey": self.supabase_key,
                "Authorization": f"Bearer {self.supabase_key}",
                "Content-Type": "application/json"
            }
            
            # Prepare document data
            doc_data = {
                "id": document.get("id", ""),
                "title": document.get("title", ""),
                "content": document.get("content", ""),
                "source": document.get("source", ""),
                "type": document.get("type", ""),
                "url": document.get("url", ""),
                "priority": document.get("priority", "medium"),
                "metadata": json.dumps(document.get("metadata", {})),
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }
            
            async with self.session.post(
                f"{self.supabase_url}/rest/v1/knowledge_documents",
                headers=headers,
                json=doc_data
            ) as response:
                
                if response.status in [200, 201]:
                    result = await response.json()
                    logger.info(f"✅ Document stored: {document.get('title', 'Unknown')}")
                    return {"success": True, "data": result}
                else:
                    error_text = await response.text()
                    logger.error(f"❌ Supabase storage failed: HTTP {response.status} - {error_text}")
                    return {"success": False, "error": f"HTTP {response.status}"}
                    
        except Exception as e:
            logger.error(f"❌ Supabase storage error: {e}")
            return {"success": False, "error": str(e)}
            
    async def store_knowledge_batch(self, documents: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Store multiple knowledge documents in batch"""
        logger.info(f"📦 Storing batch of {len(documents)} documents...")
        
        successful = 0
        failed = 0
        errors = []
        
        for doc in documents:
            result = await self.store_knowledge_document(doc)
            if result["success"]:
                successful += 1
            else:
                failed += 1
                errors.append(result.get("error", "Unknown error"))
                
        return {
            "successful": successful,
            "failed": failed,
            "total": len(documents),
            "errors": errors,
            "timestamp": datetime.now().isoformat()
        }
        
    async def search_knowledge(self, query: str, limit: int = 10) -> Dict[str, Any]:
        """Search knowledge documents in Supabase"""
        try:
            headers = {
                "apikey": self.supabase_key,
                "Authorization": f"Bearer {self.supabase_key}",
                "Content-Type": "application/json"
            }
            
            # Use Supabase's text search
            params = {
                "select": "*",
                "or": f"title.ilike.%{query}%,content.ilike.%{query}%",
                "limit": str(limit),
                "order": "created_at.desc"
            }
            
            async with self.session.get(
                f"{self.supabase_url}/rest/v1/knowledge_documents",
                headers=headers,
                params=params
            ) as response:
                
                if response.status == 200:
                    results = await response.json()
                    logger.info(f"✅ Found {len(results)} documents for query: '{query}'")
                    return {
                        "query": query,
                        "results": results,
                        "count": len(results),
                        "timestamp": datetime.now().isoformat()
                    }
                else:
                    error_text = await response.text()
                    logger.error(f"❌ Supabase search failed: HTTP {response.status} - {error_text}")
                    return {"error": f"HTTP {response.status}"}
                    
        except Exception as e:
            logger.error(f"❌ Supabase search error: {e}")
            return {"error": str(e)}
            
    async def get_knowledge_stats(self) -> Dict[str, Any]:
        """Get knowledge base statistics from Supabase"""
        try:
            headers = {
                "apikey": self.supabase_key,
                "Authorization": f"Bearer {self.supabase_key}",
                "Content-Type": "application/json"
            }
            
            # Get total count
            async with self.session.get(
                f"{self.supabase_url}/rest/v1/knowledge_documents",
                headers=headers,
                params={"select": "count", "head": "true"}
            ) as response:
                
                if response.status == 200:
                    total_count = response.headers.get("content-range", "0").split("/")[-1]
                    
                    # Get counts by source
                    async with self.session.get(
                        f"{self.supabase_url}/rest/v1/knowledge_documents",
                        headers=headers,
                        params={"select": "source"}
                    ) as source_response:
                        
                        if source_response.status == 200:
                            sources_data = await source_response.json()
                            source_counts = {}
                            for doc in sources_data:
                                source = doc.get("source", "unknown")
                                source_counts[source] = source_counts.get(source, 0) + 1
                                
                            return {
                                "total_documents": int(total_count),
                                "sources": source_counts,
                                "timestamp": datetime.now().isoformat()
                            }
                            
        except Exception as e:
            logger.error(f"❌ Supabase stats error: {e}")
            return {"error": str(e)}
            
    async def create_knowledge_tables(self):
        """Create knowledge tables in Supabase (if they don't exist)"""
        logger.info("🏗️ Creating knowledge tables in Supabase...")
        
        # This would typically be done via Supabase migrations
        # For now, we'll just log what tables we need
        required_tables = [
            "knowledge_documents",
            "knowledge_entities", 
            "knowledge_relationships",
            "knowledge_embeddings",
            "constitutional_scores"
        ]
        
        logger.info(f"📋 Required tables: {required_tables}")
        logger.info("⚠️ Note: Tables should be created via Supabase migrations")
        
    async def close(self):
        """Close the Supabase client session"""
        if self.session:
            await self.session.close()

async def main():
    """Test the Supabase client"""
    client = SupabaseClient()
    
    try:
        await client.initialize()
        
        # Test document storage
        test_doc = {
            "id": "test_001",
            "title": "Test Knowledge Document",
            "content": "This is a test document for knowledge storage",
            "source": "test_source",
            "type": "test",
            "url": "https://example.com/test",
            "priority": "medium",
            "metadata": {"test": True}
        }
        
        logger.info("🧪 Testing document storage...")
        result = await client.store_knowledge_document(test_doc)
        logger.info(f"✅ Storage result: {result}")
        
        # Test search
        logger.info("🔍 Testing knowledge search...")
        search_result = await client.search_knowledge("test")
        logger.info(f"✅ Search result: {len(search_result.get('results', []))} documents found")
        
    except Exception as e:
        logger.error(f"❌ Supabase client test failed: {e}")
        
    finally:
        await client.close()

if __name__ == "__main__":
    asyncio.run(main())
