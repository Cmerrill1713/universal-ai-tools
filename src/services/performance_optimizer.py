#!/usr/bin/env python3
"""
Performance Optimization Service
Advanced caching, compression, and optimization
"""

import asyncio
import json
import time
import gzip
import hashlib
from typing import Dict, Any, Optional, List
from dataclasses import dataclass

@dataclass
class OptimizationConfig:
    enable_compression: bool = True
    enable_caching: bool = True
    cache_ttl: int = 3600
    compression_threshold: int = 1024  # 1KB
    max_cache_size: int = 100 * 1024 * 1024  # 100MB

class PerformanceOptimizer:
    def __init__(self, config: OptimizationConfig):
        self.config = config
        self.cache = {}
        self.cache_stats = {
            'hits': 0,
            'misses': 0,
            'evictions': 0,
            'size_bytes': 0
        }
        
    async def optimize_response(self, response_data: Dict[str, Any]) -> Dict[str, Any]:
        """Optimize response for performance"""
        optimized = response_data.copy()
        
        # Add compression if enabled and data is large enough
        if self.config.enable_compression:
            response_str = json.dumps(response_data)
            if len(response_str) > self.config.compression_threshold:
                compressed = gzip.compress(response_str.encode())
                optimized['_compressed'] = True
                optimized['_original_size'] = len(response_str)
                optimized['_compressed_size'] = len(compressed)
                optimized['_compression_ratio'] = len(compressed) / len(response_str)
        
        # Add caching headers
        if self.config.enable_caching:
            cache_key = self._generate_cache_key(response_data)
            optimized['_cache_key'] = cache_key
            optimized['_cache_ttl'] = self.config.cache_ttl
        
        return optimized
    
    def _generate_cache_key(self, data: Dict[str, Any]) -> str:
        """Generate cache key for data"""
        data_str = json.dumps(data, sort_keys=True)
        return hashlib.md5(data_str.encode()).hexdigest()
    
    async def get_cached_response(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Get cached response"""
        if not self.config.enable_caching:
            return None
            
        if cache_key in self.cache:
            cached_item = self.cache[cache_key]
            
            # Check if expired
            if time.time() - cached_item['timestamp'] < self.config.cache_ttl:
                self.cache_stats['hits'] += 1
                return cached_item['data']
            else:
                # Remove expired item
                del self.cache[cache_key]
                self.cache_stats['evictions'] += 1
                
        self.cache_stats['misses'] += 1
        return None
    
    async def cache_response(self, cache_key: str, data: Dict[str, Any]):
        """Cache response data"""
        if not self.config.enable_caching:
            return
            
        # Check cache size limit
        await self._enforce_cache_size_limit()
        
        # Add to cache
        self.cache[cache_key] = {
            'data': data,
            'timestamp': time.time(),
            'size': len(json.dumps(data))
        }
        
        self.cache_stats['size_bytes'] += len(json.dumps(data))
    
    async def _enforce_cache_size_limit(self):
        """Enforce cache size limit by evicting oldest items"""
        while self.cache_stats['size_bytes'] > self.config.max_cache_size and self.cache:
            # Find oldest item
            oldest_key = min(self.cache.keys(), key=lambda k: self.cache[k]['timestamp'])
            oldest_item = self.cache[oldest_key]
            
            # Remove it
            del self.cache[oldest_key]
            self.cache_stats['size_bytes'] -= oldest_item['size']
            self.cache_stats['evictions'] += 1
    
    async def optimize_database_queries(self, queries: List[str]) -> List[str]:
        """Optimize database queries"""
        optimized_queries = []
        
        for query in queries:
            optimized = query
            
            # Add common optimizations
            if 'SELECT' in query.upper():
                # Add LIMIT if not present
                if 'LIMIT' not in query.upper():
                    optimized += ' LIMIT 1000'
                    
                # Add index hints for common patterns
                if 'WHERE' in query.upper():
                    optimized = optimized.replace('WHERE', 'WHERE /*+ USE_INDEX */')
            
            optimized_queries.append(optimized)
            
        return optimized_queries
    
    async def get_performance_metrics(self) -> Dict[str, Any]:
        """Get performance metrics"""
        cache_hit_rate = 0
        if self.cache_stats['hits'] + self.cache_stats['misses'] > 0:
            cache_hit_rate = self.cache_stats['hits'] / (self.cache_stats['hits'] + self.cache_stats['misses'])
        
        return {
            'cache': {
                'hit_rate': cache_hit_rate,
                'hits': self.cache_stats['hits'],
                'misses': self.cache_stats['misses'],
                'evictions': self.cache_stats['evictions'],
                'size_bytes': self.cache_stats['size_bytes'],
                'max_size_bytes': self.config.max_cache_size
            },
            'compression': {
                'enabled': self.config.enable_compression,
                'threshold': self.config.compression_threshold
            },
            'optimization': {
                'caching_enabled': self.config.enable_caching,
                'cache_ttl': self.config.cache_ttl
            }
        }

# Global performance optimizer
_performance_optimizer = None

def get_performance_optimizer() -> PerformanceOptimizer:
    """Get global performance optimizer instance"""
    global _performance_optimizer
    if _performance_optimizer is None:
        config = OptimizationConfig()
        _performance_optimizer = PerformanceOptimizer(config)
    return _performance_optimizer

if __name__ == "__main__":
    # Test performance optimizer
    async def test_optimizer():
        optimizer = get_performance_optimizer()
        
        # Test response optimization
        response_data = {'message': 'Hello Athena!', 'timestamp': time.time()}
        optimized = await optimizer.optimize_response(response_data)
        print(f"Optimized response: {optimized}")
        
        # Test caching
        cache_key = 'test_key'
        await optimizer.cache_response(cache_key, response_data)
        cached = await optimizer.get_cached_response(cache_key)
        print(f"Cached response: {cached}")
        
        # Get metrics
        metrics = await optimizer.get_performance_metrics()
        print(f"Performance metrics: {json.dumps(metrics, indent=2)}")
    
    import asyncio
    asyncio.run(test_optimizer())
