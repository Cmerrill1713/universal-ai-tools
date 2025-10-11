#!/usr/bin/env python3
"""
Conversation Storage - Persistent storage for chat history in Postgres
"""

import logging
import os
from typing import Dict, Any, Optional, List
from datetime import datetime
import asyncpg
import json

logger = logging.getLogger(__name__)


class ConversationStorage:
    """Persistent conversation storage using Postgres"""
    
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
        # Use knowledge_base database (the one that exists)
        self.database_url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/knowledge_base")
        
    async def initialize(self):
        """Initialize database connection and create tables"""
        try:
            # Create connection pool
            self.pool = await asyncpg.create_pool(
                self.database_url,
                min_size=2,
                max_size=10,
                command_timeout=60
            )
            
            # Create tables if they don't exist
            await self._create_tables()
            
            logger.info("✅ Conversation storage initialized with Postgres")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize conversation storage: {e}")
            return False
    
    async def _create_tables(self):
        """Create conversation tables if they don't exist"""
        async with self.pool.acquire() as conn:
            # Conversation threads table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS conversation_threads (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(255) NOT NULL,
                    thread_id VARCHAR(255) UNIQUE NOT NULL,
                    title VARCHAR(500),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    metadata JSONB DEFAULT '{}'::jsonb,
                    message_count INTEGER DEFAULT 0,
                    INDEX idx_user_id (user_id),
                    INDEX idx_thread_id (thread_id),
                    INDEX idx_created_at (created_at)
                )
            """)
            
            # Conversation messages table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS conversation_messages (
                    id SERIAL PRIMARY KEY,
                    thread_id VARCHAR(255) NOT NULL,
                    role VARCHAR(50) NOT NULL,
                    content TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    metadata JSONB DEFAULT '{}'::jsonb,
                    model_used VARCHAR(100),
                    processing_time FLOAT,
                    token_count INTEGER,
                    INDEX idx_thread_id (thread_id),
                    INDEX idx_created_at (created_at),
                    INDEX idx_role (role),
                    FOREIGN KEY (thread_id) REFERENCES conversation_threads(thread_id) ON DELETE CASCADE
                )
            """)
            
            logger.info("✅ Conversation tables created/verified")
    
    async def create_thread(
        self,
        user_id: str,
        thread_id: str,
        title: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> bool:
        """Create a new conversation thread"""
        try:
            async with self.pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO conversation_threads (user_id, thread_id, title, metadata)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (thread_id) DO NOTHING
                """, user_id, thread_id, title or "New Conversation", json.dumps(metadata or {}))
                
                logger.info(f"Created thread {thread_id} for user {user_id}")
                return True
                
        except Exception as e:
            logger.error(f"Failed to create thread: {e}")
            return False
    
    async def add_message(
        self,
        thread_id: str,
        role: str,
        content: str,
        metadata: Optional[Dict] = None,
        model_used: Optional[str] = None,
        processing_time: Optional[float] = None
    ) -> bool:
        """Add a message to a conversation thread"""
        try:
            async with self.pool.acquire() as conn:
                # Insert message
                await conn.execute("""
                    INSERT INTO conversation_messages 
                    (thread_id, role, content, metadata, model_used, processing_time, token_count)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                """, thread_id, role, content, json.dumps(metadata or {}), 
                    model_used, processing_time, len(content.split()))
                
                # Update thread message count and updated_at
                await conn.execute("""
                    UPDATE conversation_threads 
                    SET message_count = message_count + 1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE thread_id = $1
                """, thread_id)
                
                logger.debug(f"Added {role} message to thread {thread_id}")
                return True
                
        except Exception as e:
            logger.error(f"Failed to add message: {e}")
            return False
    
    async def get_thread_history(
        self,
        thread_id: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict]:
        """Get conversation history for a thread"""
        try:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch("""
                    SELECT role, content, created_at, metadata, model_used, processing_time
                    FROM conversation_messages
                    WHERE thread_id = $1
                    ORDER BY created_at DESC
                    LIMIT $2 OFFSET $3
                """, thread_id, limit, offset)
                
                messages = []
                for row in rows:
                    messages.append({
                        "role": row["role"],
                        "content": row["content"],
                        "created_at": row["created_at"].isoformat(),
                        "metadata": json.loads(row["metadata"]) if row["metadata"] else {},
                        "model_used": row["model_used"],
                        "processing_time": row["processing_time"]
                    })
                
                # Reverse to get chronological order
                return list(reversed(messages))
                
        except Exception as e:
            logger.error(f"Failed to get thread history: {e}")
            return []
    
    async def get_recent_context(
        self,
        thread_id: str,
        max_messages: int = 10
    ) -> str:
        """Get recent conversation context as formatted string"""
        messages = await self.get_thread_history(thread_id, limit=max_messages)
        
        if not messages:
            return ""
        
        context = "\n**Recent conversation:**\n"
        for msg in messages[-max_messages:]:
            role_emoji = "👤" if msg["role"] == "user" else "🤖"
            context += f"{role_emoji} {msg['role'].capitalize()}: {msg['content'][:100]}...\n"
        
        return context
    
    async def get_user_threads(
        self,
        user_id: str,
        limit: int = 20
    ) -> List[Dict]:
        """Get all conversation threads for a user"""
        try:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch("""
                    SELECT thread_id, title, created_at, updated_at, message_count, metadata
                    FROM conversation_threads
                    WHERE user_id = $1
                    ORDER BY updated_at DESC
                    LIMIT $2
                """, user_id, limit)
                
                threads = []
                for row in rows:
                    threads.append({
                        "thread_id": row["thread_id"],
                        "title": row["title"],
                        "created_at": row["created_at"].isoformat(),
                        "updated_at": row["updated_at"].isoformat(),
                        "message_count": row["message_count"],
                        "metadata": json.loads(row["metadata"]) if row["metadata"] else {}
                    })
                
                return threads
                
        except Exception as e:
            logger.error(f"Failed to get user threads: {e}")
            return []
    
    async def delete_thread(self, thread_id: str) -> bool:
        """Delete a conversation thread and all its messages"""
        try:
            async with self.pool.acquire() as conn:
                await conn.execute("""
                    DELETE FROM conversation_threads WHERE thread_id = $1
                """, thread_id)
                
                logger.info(f"Deleted thread {thread_id}")
                return True
                
        except Exception as e:
            logger.error(f"Failed to delete thread: {e}")
            return False
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get conversation storage statistics"""
        try:
            async with self.pool.acquire() as conn:
                stats = await conn.fetchrow("""
                    SELECT 
                        COUNT(DISTINCT user_id) as total_users,
                        COUNT(*) as total_threads,
                        SUM(message_count) as total_messages
                    FROM conversation_threads
                """)
                
                return {
                    "total_users": stats["total_users"],
                    "total_threads": stats["total_threads"],
                    "total_messages": stats["total_messages"],
                    "storage_backend": "postgres"
                }
                
        except Exception as e:
            logger.error(f"Failed to get stats: {e}")
            return {}
    
    async def close(self):
        """Close database connection pool"""
        if self.pool:
            await self.pool.close()
            logger.info("Conversation storage closed")


# Global instance
_storage: Optional[ConversationStorage] = None

async def get_conversation_storage() -> ConversationStorage:
    """Get global conversation storage instance"""
    global _storage
    if _storage is None:
        _storage = ConversationStorage()
        await _storage.initialize()
    return _storage

