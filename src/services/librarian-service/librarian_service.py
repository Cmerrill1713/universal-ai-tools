#!/usr/bin/env python3
"""
Librarian Service
Manages knowledge embeddings and provides intelligent information retrieval
"""

import asyncio
import aiohttp
import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
import numpy as np
from sentence_transformers import SentenceTransformer
import sqlite3
import os
import hashlib
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
import uvicorn

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LibrarianService:
    def __init__(self, port=8029):
        self.port = port
        self.embedding_model = None
        self.db_path = "knowledge_embeddings.db"
        self.session = None
        self.db_conn = None  # SQLite connection
        self.knowledge_base = {}
        
        # Docker service endpoints for knowledge routing
        self.storage_systems = {
            'postgresql': {
                'url': 'http://localhost:5432',
                'type': 'relational',
                'capabilities': ['structured_data', 'transactions', 'complex_queries'],
                'status': 'unknown'
            },
            'redis': {
                'url': 'http://localhost:6379',
                'type': 'cache',
                'capabilities': ['fast_access', 'session_data', 'temporary_storage'],
                'status': 'unknown'
            },
            'weaviate': {
                'url': 'http://localhost:8090',
                'type': 'vector',
                'capabilities': ['semantic_search', 'vector_embeddings', 'similarity_search'],
                'status': 'unknown'
            },
            'supabase': {
                'url': 'http://localhost:54321',
                'type': 'relational_with_auth',
                'capabilities': ['structured_data', 'authentication', 'real_time', 'vault'],
                'status': 'unknown'
            },
            'searxng': {
                'url': 'http://localhost:8080',
                'type': 'search_engine',
                'capabilities': ['web_crawling', 'metasearch', 'knowledge_discovery'],
                'status': 'unknown'
            }
        }
        
    async def initialize(self):
        """Initialize the librarian service"""
        logger.info("📚 Initializing Librarian Service...")
        
        # Initialize embedding model
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        logger.info("✅ Embedding model loaded")
        
        # Initialize database
        await self._init_database()
        
        # Initialize HTTP session with connection pooling
        connector = aiohttp.TCPConnector(
            limit=100,  # Total connection pool size
            limit_per_host=30,  # Per-host connection limit
            ttl_dns_cache=300,  # DNS cache TTL
            use_dns_cache=True,
            keepalive_timeout=30,
            enable_cleanup_closed=True
        )
        timeout = aiohttp.ClientTimeout(
            total=30,  # Total timeout
            connect=10,  # Connection timeout
            sock_read=10  # Socket read timeout
        )
        self.session = aiohttp.ClientSession(
            connector=connector,
            timeout=timeout,
            headers={'User-Agent': 'Universal-AI-Tools-Librarian/1.0'}
        )
        
        # Check storage system health
        await self._check_storage_systems()
        
        logger.info("📖 Librarian Service ready")
    
    async def cleanup(self):
        """Cleanup resources"""
        if self.db_conn:
            self.db_conn.close()
            logger.info("✅ Database connection closed")
        if self.session:
            await self.session.close()
            logger.info("✅ HTTP session closed")
        
    async def _init_database(self):
        """Initialize SQLite database for embeddings"""
        self.db_conn = sqlite3.connect(self.db_path)
        cursor = self.db_conn.cursor()
        
        # Create embeddings table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS knowledge_embeddings (
                id TEXT PRIMARY KEY,
                title TEXT,
                content TEXT,
                source TEXT,
                type TEXT,
                url TEXT,
                priority TEXT,
                embedding BLOB,
                metadata TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create search index
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_source ON knowledge_embeddings(source)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_type ON knowledge_embeddings(type)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_priority ON knowledge_embeddings(priority)
        ''')
        
        self.db_conn.commit()
        
        logger.info("✅ Database initialized")
        
    async def _check_storage_systems(self):
        """Check health of all Docker storage systems"""
        logger.info("🔍 Checking Docker storage systems...")
        
        for system_name, system_info in self.storage_systems.items():
            try:
                if system_name in ['weaviate', 'searxng']:
                    # HTTP-based services
                    health_url = self._get_health_endpoint(system_name, system_info['url'])
                    async with self.session.get(health_url, timeout=5) as response:
                        if response.status == 200:
                            self.storage_systems[system_name]['status'] = 'healthy'
                            logger.info(f"✅ {system_name}: {system_info['type']} - Healthy")
                        else:
                            self.storage_systems[system_name]['status'] = 'unhealthy'
                            logger.warning(f"⚠️ {system_name}: {system_info['type']} - Unhealthy (status: {response.status})")
                else:
                    # Database services - use TCP connection check
                    is_healthy = await self._check_database_connection(system_name, system_info)
                    if is_healthy:
                        self.storage_systems[system_name]['status'] = 'healthy'
                        logger.info(f"✅ {system_name}: {system_info['type']} - Healthy")
                    else:
                        self.storage_systems[system_name]['status'] = 'unhealthy'
                        logger.warning(f"⚠️ {system_name}: {system_info['type']} - Unhealthy")
                        
            except Exception as e:
                self.storage_systems[system_name]['status'] = 'unreachable'
                logger.warning(f"❌ {system_name}: {system_info['type']} - Unreachable ({str(e)})")
                
        # Log summary
        healthy_count = sum(1 for s in self.storage_systems.values() if s['status'] == 'healthy')
        total_count = len(self.storage_systems)
        logger.info(f"📊 Storage Systems: {healthy_count}/{total_count} healthy")
        
    async def _check_database_connection(self, system_name: str, system_info: Dict[str, Any]) -> bool:
        """Check database connection using TCP socket"""
        import socket
        
        try:
            # Extract host and port from URL
            url = system_info['url'].replace('http://', '').replace('https://', '')
            if ':' in url:
                host, port = url.split(':')
                port = int(port)
            else:
                host = url
                port = self._get_default_port(system_name)
            
            # Create socket connection
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)
            result = sock.connect_ex((host, port))
            sock.close()
            
            return result == 0
            
        except Exception as e:
            logger.error(f"Database connection check failed for {system_name}: {e}")
            return False
            
    def _get_default_port(self, system_name: str) -> int:
        """Get default port for database services"""
        default_ports = {
            'postgresql': 5432,
            'redis': 6379,
            'supabase': 54321,
        }
        return default_ports.get(system_name, 5432)
        
    def _get_health_endpoint(self, system_name: str, base_url: str) -> str:
        """Get appropriate health check endpoint for each system"""
        health_endpoints = {
            'postgresql': f"{base_url}/health",  # PostgreSQL health endpoint
            'redis': f"{base_url}/ping",  # Redis PING command
            'weaviate': f"{base_url}/v1/meta",  # Weaviate meta endpoint
            'supabase': f"{base_url}/rest/v1/",  # Supabase REST API
            'searxng': f"{base_url}/",  # SearXNG main page
        }
        return health_endpoints.get(system_name, f"{base_url}/health")
        
    def _determine_storage_system(self, document: Dict[str, Any]) -> str:
        """Intelligently determine the best storage system for a document"""
        doc_type = document.get('type', 'unknown')
        content = document.get('content', '')
        priority = document.get('priority', 'normal')
        
        # Routing logic based on document characteristics
        if doc_type in ['structured_data', 'transaction', 'user_data']:
            if self.storage_systems['supabase']['status'] == 'healthy':
                return 'supabase'
            elif self.storage_systems['postgresql']['status'] == 'healthy':
                return 'postgresql'
                
        elif doc_type in ['vector_embedding', 'semantic_search', 'similarity']:
            if self.storage_systems['weaviate']['status'] == 'healthy':
                return 'weaviate'
                
        elif doc_type in ['cache', 'session', 'temporary']:
            if self.storage_systems['redis']['status'] == 'healthy':
                return 'redis'
                
        elif doc_type in ['web_content', 'crawled_data', 'search_result']:
            if self.storage_systems['searxng']['status'] == 'healthy':
                return 'searxng'
                
        # Fallback to local SQLite for everything else
        return 'sqlite'
        
    async def _store_in_system(self, document: Dict[str, Any], system: str) -> bool:
        """Store document in the specified storage system"""
        try:
            if system == 'sqlite':
                return await self._store_in_sqlite(document)
            elif system == 'weaviate':
                return await self._store_in_weaviate(document)
            elif system == 'redis':
                return await self._store_in_redis(document)
            elif system == 'supabase':
                return await self._store_in_supabase(document)
            elif system == 'postgresql':
                return await self._store_in_postgresql(document)
            elif system == 'searxng':
                return await self._store_in_searxng(document)
            else:
                logger.warning(f"Unknown storage system: {system}")
                return False
        except Exception as e:
            logger.error(f"Failed to store in {system}: {str(e)}")
            return False
            
    async def _store_in_weaviate(self, document: Dict[str, Any]) -> bool:
        """Store document in Weaviate vector database"""
        try:
            # Generate embedding
            embedding = self.embedding_model.encode(document['content']).tolist()
            
            # Create Weaviate object
            weaviate_object = {
                "class": "Document",
                "properties": {
                    "title": document.get('title', ''),
                    "content": document['content'],
                    "source": document.get('source', ''),
                    "type": document.get('type', ''),
                    "url": document.get('url', ''),
                    "priority": document.get('priority', 'normal'),
                    "metadata": json.dumps(document.get('metadata', {}))
                },
                "vector": embedding
            }
            
            # Store in Weaviate
            async with self.session.post(
                f"{self.storage_systems['weaviate']['url']}/v1/objects",
                json=weaviate_object,
                headers={"Content-Type": "application/json"}
            ) as response:
                return response.status == 201
                
        except Exception as e:
            logger.error(f"Weaviate storage error: {str(e)}")
            return False
            
    async def _store_in_redis(self, document: Dict[str, Any]) -> bool:
        """Store document in Redis cache"""
        try:
            # Redis is typically used for temporary/cache data
            key = f"doc:{document.get('id', 'unknown')}"
            value = json.dumps(document)
            
            # Store with TTL based on priority
            ttl = 3600 if document.get('priority') == 'high' else 1800
            
            async with self.session.post(
                f"{self.storage_systems['redis']['url']}/set",
                params={'key': key, 'value': value, 'ex': ttl}
            ) as response:
                return response.status == 200
                
        except Exception as e:
            logger.error(f"Redis storage error: {str(e)}")
            return False
            
    async def _store_in_supabase(self, document: Dict[str, Any]) -> bool:
        """Store document in Supabase"""
        try:
            # Store in Supabase documents table
            supabase_object = {
                "title": document.get('title', ''),
                "content": document['content'],
                "source": document.get('source', ''),
                "type": document.get('type', ''),
                "url": document.get('url', ''),
                "priority": document.get('priority', 'normal'),
                "metadata": document.get('metadata', {})
            }
            
            async with self.session.post(
                f"{self.storage_systems['supabase']['url']}/rest/v1/documents",
                json=supabase_object,
                headers={
                    "Content-Type": "application/json",
                    "apikey": "your-anon-key",  # Should be from environment
                    "Authorization": "Bearer your-anon-key"
                }
            ) as response:
                return response.status == 201
                
        except Exception as e:
            logger.error(f"Supabase storage error: {str(e)}")
            return False
            
    async def _store_in_postgresql(self, document: Dict[str, Any]) -> bool:
        """Store document in PostgreSQL"""
        # Implementation would depend on PostgreSQL REST API or direct connection
        logger.info("PostgreSQL storage not yet implemented")
        return False
        
    async def _store_in_searxng(self, document: Dict[str, Any]) -> bool:
        """Store document in SearXNG (for web content)"""
        # SearXNG is primarily for search, not storage
        logger.info("SearXNG is for search, not storage")
        return False
    
    async def _store_in_sqlite(self, document: Dict[str, Any]) -> bool:
        """Store document in local SQLite database"""
        try:
            # Create embeddings for the document
            content = document.get('content', '')
            if not content:
                logger.warning("No content to embed")
                return False
            
            if not self.embedding_model:
                logger.error("Embedding model not initialized")
                return False
            
            # Generate embedding
            embedding = self.embedding_model.encode(content, convert_to_tensor=False).tolist()
            
            # Store in SQLite
            cursor = self.db_conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO knowledge_embeddings 
                (id, title, content, source, type, url, priority, embedding, metadata, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                document.get('id', f"doc_{hashlib.md5(content.encode()).hexdigest()[:8]}"),
                document.get('title', ''),
                content,
                document.get('source', 'unknown'),
                document.get('type', 'general'),
                document.get('url', ''),
                document.get('priority', 'normal'),
                json.dumps(embedding),  # Store as JSON string
                json.dumps(document.get('metadata', {})),
                datetime.now().isoformat(),
                datetime.now().isoformat()
            ))
            
            self.db_conn.commit()
            logger.info(f"✅ Stored document in SQLite: {document.get('title', 'Untitled')}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to store in sqlite: {e}")
            return False
        
    async def embed_documents(self, documents: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Embed documents and store in knowledge base with intelligent routing"""
        logger.info(f"📝 Processing {len(documents)} documents for embedding...")
        
        embedded_count = 0
        skipped_count = 0
        routing_stats = {}
        
        for doc in documents:
            try:
                # Generate document ID if not provided
                doc_id = doc.get('id', f"doc_{hashlib.md5(doc['content'].encode()).hexdigest()[:8]}")
                
                # Check if already embedded
                if await self._document_exists(doc_id):
                    skipped_count += 1
                    continue
                    
                # Determine best storage system for this document
                storage_system = self._determine_storage_system(doc)
                logger.info(f"📋 Routing document '{doc.get('title', doc_id)}' to {storage_system}")
                
                # Store in appropriate system
                success = await self._store_in_system(doc, storage_system)
                
                if success:
                    embedded_count += 1
                    routing_stats[storage_system] = routing_stats.get(storage_system, 0) + 1
                    logger.info(f"✅ Stored in {storage_system}")
                else:
                    logger.warning(f"❌ Failed to store in {storage_system}")
                    
                # Create embedding
                embedding = await self._create_embedding(doc['content'])
                
                # Store in database
                await self._store_embedding(doc_id, doc, embedding)
                
                # Store in memory cache
                self.knowledge_base[doc_id] = {
                    'title': doc['title'],
                    'content': doc['content'],
                    'source': doc['source'],
                    'type': doc['type'],
                    'priority': doc['priority'],
                    'embedding': embedding,
                    'metadata': doc.get('metadata', {})
                }
                
                embedded_count += 1
                
            except Exception as e:
                logger.error(f"❌ Failed to embed document {doc.get('id', 'unknown')}: {e}")
                
        result = {
            'embedded_count': embedded_count,
            'skipped_count': skipped_count,
            'total_documents': len(documents),
            'routing_stats': routing_stats,
            'timestamp': datetime.now().isoformat()
        }
        
        logger.info(f"✅ Embedding complete: {embedded_count} new, {skipped_count} skipped")
        return result
        
    async def get_storage_status(self) -> Dict[str, Any]:
        """Get status of all storage systems"""
        return {
            'storage_systems': self.storage_systems,
            'healthy_count': sum(1 for s in self.storage_systems.values() if s['status'] == 'healthy'),
            'total_count': len(self.storage_systems),
            'timestamp': datetime.now().isoformat()
        }
        
    async def get_knowledge_base_stats(self) -> Dict[str, Any]:
        """Get knowledge base statistics"""
        try:
            # Get document count from SQLite
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Count total documents
            cursor.execute("SELECT COUNT(*) FROM knowledge_embeddings")
            total_documents = cursor.fetchone()[0]
            
            # Count by source
            cursor.execute("SELECT source, COUNT(*) FROM knowledge_embeddings GROUP BY source")
            source_counts = dict(cursor.fetchall())
            
            # Count by type
            cursor.execute("SELECT type, COUNT(*) FROM knowledge_embeddings GROUP BY type")
            type_counts = dict(cursor.fetchall())
            
            conn.close()
            
            return {
                'total_documents': total_documents,
                'source_breakdown': source_counts,
                'type_breakdown': type_counts,
                'storage_systems_healthy': sum(1 for s in self.storage_systems.values() if s['status'] == 'healthy'),
                'storage_systems_total': len(self.storage_systems),
                'embedding_model': 'all-MiniLM-L6-v2',
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to get knowledge base stats: {str(e)}")
            return {
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
        
    async def _create_embedding(self, text: str) -> np.ndarray:
        """Create embedding for text"""
        try:
            # Clean and truncate text
            clean_text = text.strip()[:1000]  # Limit to 1000 chars
            
            # Generate embedding
            embedding = self.embedding_model.encode(clean_text)
            
            return embedding
            
        except Exception as e:
            logger.error(f"❌ Failed to create embedding: {e}")
            # Return zero vector as fallback
            return np.zeros(384)  # all-MiniLM-L6-v2 dimension
            
    async def _store_embedding(self, doc_id: str, doc: Dict[str, Any], embedding: np.ndarray):
        """Store embedding in database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                INSERT OR REPLACE INTO knowledge_embeddings 
                (id, title, content, source, type, url, priority, embedding, metadata, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                doc_id,
                doc['title'],
                doc['content'],
                doc['source'],
                doc['type'],
                doc.get('url', ''),
                doc['priority'],
                embedding.tobytes(),
                json.dumps(doc.get('metadata', {})),
                datetime.now().isoformat()
            ))
            
            conn.commit()
            
        except Exception as e:
            logger.error(f"❌ Failed to store embedding: {e}")
            
        finally:
            conn.close()
            
    async def _document_exists(self, doc_id: str) -> bool:
        """Check if document already exists"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute('SELECT id FROM knowledge_embeddings WHERE id = ?', (doc_id,))
            return cursor.fetchone() is not None
            
        finally:
            conn.close()
            
    async def search_knowledge(self, query: str, limit: int = 10, source_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        """Search knowledge base using semantic similarity"""
        logger.info(f"🔍 Searching knowledge base for: '{query}'")
        
        try:
            # Create query embedding
            query_embedding = await self._create_embedding(query)
            
            # Search in database
            results = await self._semantic_search(query_embedding, limit, source_filter)
            
            logger.info(f"✅ Found {len(results)} relevant documents")
            return results
            
        except Exception as e:
            logger.error(f"❌ Search failed: {e}")
            return []
            
    async def _semantic_search(self, query_embedding: np.ndarray, limit: int, source_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        """Perform semantic search using cosine similarity"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Build query
            query = '''
                SELECT id, title, content, source, type, url, priority, embedding, metadata
                FROM knowledge_embeddings
            '''
            params = []
            
            if source_filter:
                query += ' WHERE source = ?'
                params.append(source_filter)
                
            query += ' ORDER BY created_at DESC LIMIT 100'  # Get recent documents first
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            
            # Calculate similarities
            similarities = []
            for row in rows:
                doc_id, title, content, source, doc_type, url, priority, embedding_bytes, metadata = row
                
                # Convert bytes back to numpy array
                doc_embedding = np.frombuffer(embedding_bytes, dtype=np.float32)
                
                # Calculate cosine similarity
                similarity = np.dot(query_embedding, doc_embedding) / (
                    np.linalg.norm(query_embedding) * np.linalg.norm(doc_embedding)
                )
                
                similarities.append({
                    'id': doc_id,
                    'title': title,
                    'content': content,
                    'source': source,
                    'type': doc_type,
                    'url': url,
                    'priority': priority,
                    'similarity': float(similarity),
                    'metadata': json.loads(metadata) if metadata else {}
                })
                
            # Sort by similarity and return top results
            similarities.sort(key=lambda x: x['similarity'], reverse=True)
            return similarities[:limit]
            
        finally:
            conn.close()
            
    async def get_knowledge_stats(self) -> Dict[str, Any]:
        """Get knowledge base statistics"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Total documents
            cursor.execute('SELECT COUNT(*) FROM knowledge_embeddings')
            total_docs = cursor.fetchone()[0]
            
            # Documents by source
            cursor.execute('''
                SELECT source, COUNT(*) 
                FROM knowledge_embeddings 
                GROUP BY source
            ''')
            sources = dict(cursor.fetchall())
            
            # Documents by type
            cursor.execute('''
                SELECT type, COUNT(*) 
                FROM knowledge_embeddings 
                GROUP BY type
            ''')
            types = dict(cursor.fetchall())
            
            # Recent activity
            cursor.execute('''
                SELECT COUNT(*) 
                FROM knowledge_embeddings 
                WHERE created_at > datetime('now', '-1 day')
            ''')
            recent_docs = cursor.fetchone()[0]
            
            return {
                'total_documents': total_docs,
                'sources': sources,
                'types': types,
                'recent_documents': recent_docs,
                'memory_cache_size': len(self.knowledge_base),
                'timestamp': datetime.now().isoformat()
            }
            
        finally:
            conn.close()
            
    async def health_check(self) -> Dict[str, Any]:
        """Health check endpoint"""
        return {
            'service': 'librarian-service',
            'status': 'healthy',
            'embedding_model': 'all-MiniLM-L6-v2',
            'database': 'connected',
            'memory_cache': len(self.knowledge_base),
            'timestamp': datetime.now().isoformat()
        }

# HTTP Server
from aiohttp import web

class LibrarianHTTPServer:
    def __init__(self, librarian_service: LibrarianService):
        self.librarian = librarian_service
        self.app = web.Application()
        self._setup_routes()
        
    def _setup_routes(self):
        """Setup HTTP routes"""
        self.app.router.add_post('/embed', self.embed_handler)
        self.app.router.add_post('/search', self.search_handler)
        self.app.router.add_get('/stats', self.stats_handler)
        self.app.router.add_get('/health', self.health_handler)
        
    async def embed_handler(self, request):
        """Handle document embedding requests"""
        try:
            data = await request.json()
            documents = data.get('documents', [])
            
            result = await self.librarian.embed_documents(documents)
            return web.json_response(result)
            
        except Exception as e:
            logger.error(f"❌ Embed handler error: {e}")
            return web.json_response({'error': str(e)}, status=500)
            
    async def search_handler(self, request):
        """Handle knowledge search requests"""
        try:
            data = await request.json()
            query = data.get('query', '')
            limit = data.get('limit', 10)
            source_filter = data.get('source_filter')
            
            results = await self.librarian.search_knowledge(query, limit, source_filter)
            return web.json_response({
                'query': query,
                'results': results,
                'count': len(results),
                'timestamp': datetime.now().isoformat()
            })
            
        except Exception as e:
            logger.error(f"❌ Search handler error: {e}")
            return web.json_response({'error': str(e)}, status=500)
            
    async def stats_handler(self, request):
        """Handle stats requests"""
        try:
            stats = await self.librarian.get_knowledge_stats()
            return web.json_response(stats)
            
        except Exception as e:
            logger.error(f"❌ Stats handler error: {e}")
            return web.json_response({'error': str(e)}, status=500)
            
    async def health_handler(self, request):
        """Handle health check requests"""
        try:
            health = await self.librarian.health_check()
            return web.json_response(health)
            
        except Exception as e:
            logger.error(f"❌ Health handler error: {e}")
            return web.json_response({'error': str(e)}, status=500)

async def main():
    """Main function to run the librarian service"""
    librarian = LibrarianService(port=8029)
    server = LibrarianHTTPServer(librarian)
    
    try:
        await librarian.initialize()
        
        logger.info(f"🚀 Starting Librarian Service on port {librarian.port}")
        
        runner = web.AppRunner(server.app)
        await runner.setup()
        site = web.TCPSite(runner, 'localhost', librarian.port)
        await site.start()
        
        logger.info(f"📚 Librarian Service running at http://localhost:{librarian.port}")
        logger.info("📖 Ready to embed and search knowledge!")
        
        # Keep running
        await asyncio.Future()
        
    except Exception as e:
        logger.error(f"❌ Librarian service failed: {e}")
        
    finally:
        if librarian.session:
            await librarian.session.close()

# FastAPI app
app = FastAPI(title="Librarian Service", version="1.0.0")
librarian = LibrarianService()

@app.on_event("startup")
async def startup_event():
    await librarian.initialize()

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "service": "librarian-service",
        "status": "healthy",
        "embedding_model": "all-MiniLM-L6-v2",
        "database": "connected",
        "memory_cache": len(librarian.knowledge_base),
        "timestamp": datetime.now().isoformat()
    }

@app.get("/storage-status")
async def get_storage_status():
    """Get status of all Docker storage systems"""
    return await librarian.get_storage_status()

@app.post("/embed")
async def embed_documents(documents: List[Dict[str, Any]]):
    """Embed documents with intelligent routing"""
    try:
        result = await librarian.embed_documents(documents)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/search")
async def search_knowledge(query: str, limit: int = 10):
    """Search knowledge base"""
    try:
        results = await librarian.search_knowledge(query, limit)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/knowledge-base")
async def get_knowledge_base():
    """Get knowledge base statistics"""
    try:
        stats = await librarian.get_knowledge_base_stats()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8032)
