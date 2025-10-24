#!/usr/bin/env python3
"""
Redis Caching Service for Universal AI Tools
Production-ready Redis implementation with circuit breaker
"""

import redis
import json
import time
import logging
from typing import Any, Optional, Dict
from contextlib import asynccontextmanager

class RedisService:
    def __init__(self, host='localhost', port=6379, db=0, password=None):
        self.host = host
        self.port = port
        self.db = db
        self.password = password
        self.client = None
        self.connected = False
        self.circuit_breaker = {
            'failures': 0,
            'last_failure': 0,
            'threshold': 5,
            'timeout': 60
        }
        
    async def connect(self):
        """Connect to Redis with circuit breaker"""
        try:
            if self._is_circuit_open():
                raise Exception("Circuit breaker is open")
                
            self.client = redis.Redis(
                host=self.host,
                port=self.port,
                db=self.db,
                password=self.password,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            
            # Test connection
            await self.client.ping()
            self.connected = True
            self.circuit_breaker['failures'] = 0
            self.log("✅ Redis connected successfully")
            
        except Exception as e:
            self._record_failure()
            self.log(f"❌ Redis connection failed: {e}", "ERROR")
            raise
            
    async def disconnect(self):
        """Disconnect from Redis"""
        if self.client:
            await self.client.close()
            self.connected = False
            self.log("Redis disconnected")
            
    def _is_circuit_open(self):
        """Check if circuit breaker is open"""
        if self.circuit_breaker['failures'] < self.circuit_breaker['threshold']:
            return False
            
        time_since_failure = time.time() - self.circuit_breaker['last_failure']
        return time_since_failure < self.circuit_breaker['timeout']
        
    def _record_failure(self):
        """Record a failure for circuit breaker"""
        self.circuit_breaker['failures'] += 1
        self.circuit_breaker['last_failure'] = time.time()
        
    async def set(self, key: str, value: Any, ttl: int = 3600) -> bool:
        """Set a key-value pair with TTL"""
        try:
            if not self.connected or self._is_circuit_open():
                return False
                
            serialized_value = json.dumps(value) if not isinstance(value, str) else value
            result = await self.client.setex(key, ttl, serialized_value)
            return result
            
        except Exception as e:
            self._record_failure()
            self.log(f"Redis set failed: {e}", "ERROR")
            return False
            
    async def get(self, key: str) -> Optional[Any]:
        """Get a value by key"""
        try:
            if not self.connected or self._is_circuit_open():
                return None
                
            value = await self.client.get(key)
            if value:
                try:
                    return json.loads(value)
                except json.JSONDecodeError:
                    return value
            return None
            
        except Exception as e:
            self._record_failure()
            self.log(f"Redis get failed: {e}", "ERROR")
            return None
            
    async def delete(self, key: str) -> bool:
        """Delete a key"""
        try:
            if not self.connected or self._is_circuit_open():
                return False
                
            result = await self.client.delete(key)
            return bool(result)
            
        except Exception as e:
            self._record_failure()
            self.log(f"Redis delete failed: {e}", "ERROR")
            return False
            
    async def health_check(self) -> Dict[str, Any]:
        """Check Redis health"""
        try:
            if not self.connected:
                return {"healthy": False, "error": "Not connected"}
                
            start_time = time.time()
            await self.client.ping()
            latency = (time.time() - start_time) * 1000
            
            return {
                "healthy": True,
                "latency": latency,
                "circuit_breaker": self.circuit_breaker
            }
            
        except Exception as e:
            self._record_failure()
            return {"healthy": False, "error": str(e)}
            
    def log(self, message: str, level: str = "INFO"):
        """Log message"""
        print(f"[RedisService] {level}: {message}")

# Global Redis service instance
_redis_service = None

def get_redis_service() -> RedisService:
    """Get global Redis service instance"""
    global _redis_service
    if _redis_service is None:
        _redis_service = RedisService()
    return _redis_service

if __name__ == "__main__":
    # Test Redis service
    async def test_redis():
        redis_service = get_redis_service()
        await redis_service.connect()
        
        # Test operations
        await redis_service.set("test_key", {"message": "Hello Redis!"})
        value = await redis_service.get("test_key")
        print(f"Retrieved value: {value}")
        
        health = await redis_service.health_check()
        print(f"Health check: {health}")
        
        await redis_service.disconnect()
    
    import asyncio
    asyncio.run(test_redis())
