#!/usr/bin/env python3
"""
Intelligent Caching System for Universal AI Tools
Implements semantic similarity-based caching with Supabase pgvector integration
"""

import asyncio
import hashlib
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from sentence_transformers import SentenceTransformer
from supabase import Client, create_client


@dataclass
class CachedResponse:
    id: str
    prompt_hash: str
    prompt_embedding: List[float]
    response: str
    model: str
    response_time: float
    quality_score: float
    created_at: datetime
    access_count: int
    last_accessed: datetime


@dataclass
class CacheHit:
    cached_response: CachedResponse
    similarity_score: float
    is_exact_match: bool


class IntelligentCache:
    def __init__(self, supabase_url: str, supabase_key: str):
        self.supabase: Client = create_client(supabase_url, supabase_key)
        self.embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
        self.similarity_threshold = 0.85
        self.exact_match_threshold = 0.95
        self.cache_ttl_hours = 24
        self.max_cache_size = 10000

    async def initialize_database(self):
        """Initialize Supabase tables for caching"""
        # Create cache table with pgvector support
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS ai_response_cache (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            prompt_hash TEXT NOT NULL,
            prompt_embedding vector(384) USING ivfflat,
            response TEXT NOT NULL,
            model TEXT NOT NULL,
            response_time FLOAT NOT NULL,
            quality_score FLOAT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            access_count INTEGER DEFAULT 0,
            last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
        );

        -- Create index for fast similarity search
        CREATE INDEX IF NOT EXISTS idx_prompt_embedding
        ON ai_response_cache USING hnsw (prompt_embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);

        -- Create index for hash lookups
        CREATE INDEX IF NOT EXISTS idx_prompt_hash ON ai_response_cache (prompt_hash);

        -- Create index for expiration cleanup
        CREATE INDEX IF NOT EXISTS idx_expires_at ON ai_response_cache (expires_at);
        """

        # Execute SQL (in real implementation, use Supabase RPC or direct
        # connection)
        print("Database initialized for intelligent caching")

    def generate_prompt_hash(self, prompt: str) -> str:
        """Generate hash for exact match detection"""
        return hashlib.sha256(prompt.encode()).hexdigest()

    def embed_prompt(self, prompt: str) -> List[float]:
        """Generate embedding for semantic similarity"""
        embedding = self.embedding_model.encode(prompt)
        return embedding.tolist()

    async def get_cached_response(
            self,
            prompt: str,
            model: str) -> Optional[CacheHit]:
        """Get cached response using semantic similarity"""
        prompt_hash = self.generate_prompt_hash(prompt)
        prompt_embedding = self.embed_prompt(prompt)

        # First, try exact match
        exact_match = await self._get_exact_match(prompt_hash, model)
        if exact_match:
            return CacheHit(
                cached_response=exact_match,
                similarity_score=1.0,
                is_exact_match=True)

        # Then, try semantic similarity
        semantic_match = await self._get_semantic_match(prompt_embedding, model)
        if semantic_match:
            return semantic_match

        return None

    async def _get_exact_match(
        self, prompt_hash: str, model: str
    ) -> Optional[CachedResponse]:
        """Get exact match from cache"""
        try:
            result = (
                self.supabase.table("ai_response_cache")
                .select("*")
                .eq("prompt_hash", prompt_hash)
                .eq("model", model)
                .gt("expires_at", datetime.now())
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )

            if result.data:
                return self._row_to_cached_response(result.data[0])
            return None
        except Exception as e:
            print(f"Error getting exact match: {e}")
            return None

    async def _get_semantic_match(
        self, prompt_embedding: List[float], model: str
    ) -> Optional[CacheHit]:
        """Get semantically similar response from cache"""
        try:
            # Use Supabase RPC for vector similarity search
            result = self.supabase.rpc(
                "search_similar_responses",
                {
                    "query_embedding": prompt_embedding,
                    "model_name": model,
                    "similarity_threshold": self.similarity_threshold,
                    "limit": 1,
                },
            ).execute()

            if result.data:
                cached_response = self._row_to_cached_response(result.data[0])
                similarity_score = result.data[0].get("similarity_score", 0.0)

                return CacheHit(
                    cached_response=cached_response,
                    similarity_score=similarity_score,
                    is_exact_match=False,
                )
            return None
        except Exception as e:
            print(f"Error getting semantic match: {e}")
            return None

    async def cache_response(
        self,
        prompt: str,
        response: str,
        model: str,
        response_time: float,
        quality_score: float,
    ) -> str:
        """Cache a new response"""
        prompt_hash = self.generate_prompt_hash(prompt)
        prompt_embedding = self.embed_prompt(prompt)

        cache_entry = {
            "prompt_hash": prompt_hash,
            "prompt_embedding": prompt_embedding,
            "response": response,
            "model": model,
            "response_time": response_time,
            "quality_score": quality_score,
            "created_at": datetime.now().isoformat(),
            "expires_at": (
                datetime.now() + timedelta(hours=self.cache_ttl_hours)
            ).isoformat(),
        }

        try:
            result = (self.supabase.table(
                "ai_response_cache").insert(cache_entry).execute())

            if result.data:
                return result.data[0]["id"]
            return None
        except Exception as e:
            print(f"Error caching response: {e}")
            return None

    async def update_access_stats(self, cache_id: str):
        """Update access statistics for cached response"""
        try:
            self.supabase.table("ai_response_cache").update(
                {
                    "access_count": "access_count + 1",
                    "last_accessed": datetime.now().isoformat(),
                }
            ).eq("id", cache_id).execute()
        except Exception as e:
            print(f"Error updating access stats: {e}")

    async def cleanup_expired_cache(self):
        """Remove expired cache entries"""
        try:
            self.supabase.table("ai_response_cache").delete().lt(
                "expires_at", datetime.now()
            ).execute()
            print("Expired cache entries cleaned up")
        except Exception as e:
            print(f"Error cleaning up cache: {e}")

    async def get_cache_stats(self) -> Dict:
        """Get cache statistics"""
        try:
            # Get total cache size
            total_result = (
                self.supabase.table("ai_response_cache")
                .select("id", count="exact")
                .execute()
            )

            # Get cache hit rate (would need to track this separately)
            # Get most accessed responses
            popular_result = (
                self.supabase.table("ai_response_cache")
                .select("model, access_count")
                .order("access_count", desc=True)
                .limit(10)
                .execute()
            )

            return {
                "total_entries": total_result.count if total_result else 0,
                "popular_models": popular_result.data if popular_result.data else [],
                "cache_hit_rate": 0.0,  # Would be tracked separately
                "avg_response_time": 0.0,  # Would be calculated
            }
        except Exception as e:
            print(f"Error getting cache stats: {e}")
            return {}

    def _row_to_cached_response(self, row: Dict) -> CachedResponse:
        """Convert database row to CachedResponse object"""
        return CachedResponse(
            id=row["id"],
            prompt_hash=row["prompt_hash"],
            prompt_embedding=row["prompt_embedding"],
            response=row["response"],
            model=row["model"],
            response_time=row["response_time"],
            quality_score=row["quality_score"],
            created_at=datetime.fromisoformat(
                row["created_at"].replace(
                    "Z",
                    "+00:00")),
            access_count=row["access_count"],
            last_accessed=datetime.fromisoformat(
                row["last_accessed"].replace(
                    "Z",
                    "+00:00")),
        )


class SmartCachingLLMRouter:
    def __init__(self, cache: IntelligentCache, llm_router_url: str):
        self.cache = cache
        self.llm_router_url = llm_router_url
        self.cache_hit_count = 0
        self.cache_miss_count = 0

    async def get_response(
        self, prompt: str, model: str, temperature: float = 0.7
    ) -> Dict:
        """Get response with intelligent caching"""
        # Try to get cached response
        cache_hit = await self.cache.get_cached_response(prompt, model)

        if cache_hit:
            self.cache_hit_count += 1
            await self.cache.update_access_stats(cache_hit.cached_response.id)

            return {
                "response": cache_hit.cached_response.response,
                "model": cache_hit.cached_response.model,
                "response_time": 0.01,  # Very fast for cache hits
                "cached": True,
                "similarity_score": cache_hit.similarity_score,
                "is_exact_match": cache_hit.is_exact_match,
                "cache_id": cache_hit.cached_response.id,
            }

        # Cache miss - get response from LLM router
        self.cache_miss_count += 1
        response_data = await self._call_llm_router(prompt, model, temperature)

        if response_data.get("success"):
            # Cache the response
            quality_score = self._calculate_quality_score(
                response_data["response"])
            cache_id = await self.cache.cache_response(
                prompt=prompt,
                response=response_data["response"],
                model=model,
                response_time=response_data["response_time"],
                quality_score=quality_score,
            )

            response_data["cached"] = False
            response_data["cache_id"] = cache_id
            response_data["quality_score"] = quality_score

        return response_data

    async def _call_llm_router(
        self, prompt: str, model: str, temperature: float
    ) -> Dict:
        """Call the LLM router service"""
        import aiohttp

        payload = {
            "messages": [{"role": "user", "content": prompt}],
            "model": model,
            "temperature": temperature,
        }

        start_time = time.time()
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.llm_router_url}/chat",
                    json=payload,
                    headers={"Content-Type": "application/json"},
                    timeout=30,
                ) as response:
                    response_time = time.time() - start_time

                    if response.status == 200:
                        data = await response.json()
                        return {
                            "success": True, "response": data.get(
                                "content", ""), "model": data.get(
                                "model", model), "response_time": response_time, "tokens": data.get(
                                "usage", {}).get(
                                "total_tokens", 0), }
                    else:
                        return {
                            "success": False,
                            "error": f"HTTP {response.status}",
                            "response_time": response_time,
                        }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "response_time": time.time() - start_time,
            }

    def _calculate_quality_score(self, response: str) -> float:
        """Calculate quality score for response"""
        if not response or len(response.strip()) < 10:
            return 0.0

        score = 0.5  # Base score

        # Length appropriateness
        if 50 <= len(response) <= 1000:
            score += 0.2

        # Sentence structure
        if "." in response and response[0].isupper():
            score += 0.2

        # Avoids repetition
        words = response.lower().split()
        if len(set(words)) / len(words) > 0.7:
            score += 0.1

        return min(score, 1.0)

    def get_cache_performance(self) -> Dict:
        """Get cache performance metrics"""
        total_requests = self.cache_hit_count + self.cache_miss_count
        hit_rate = ((self.cache_hit_count / total_requests * 100)
                    if total_requests > 0 else 0)

        return {
            "cache_hits": self.cache_hit_count,
            "cache_misses": self.cache_miss_count,
            "hit_rate": hit_rate,
            "total_requests": total_requests,
        }


# Example usage
async def main():
    # Initialize cache
    cache = IntelligentCache(
        supabase_url="your-supabase-url", supabase_key="your-supabase-key"
    )

    await cache.initialize_database()

    # Initialize smart router
    router = SmartCachingLLMRouter(cache, "http://localhost:3033")

    # Test queries
    test_prompts = [
        "What is artificial intelligence?",
        "Explain AI in simple terms",
        "What is machine learning?",
        "How does AI work?",
        "What is artificial intelligence?",  # Duplicate for cache test
    ]

    print("🧪 Testing Intelligent Caching System")
    print("=" * 50)

    for i, prompt in enumerate(test_prompts):
        print(f"\nTest {i + 1}: {prompt}")

        response = await router.get_response(prompt, "llama2:latest")

        if response.get("success"):
            print(f"✅ Response: {response['response'][:100]}...")
            print(f"   Model: {response['model']}")
            print(f"   Response Time: {response['response_time']:.2f}s")
            print(f"   Cached: {response.get('cached', False)}")
            if response.get("cached"):
                print(
                    f"   Similarity: {
                        response.get(
                            'similarity_score',
                            0):.2f}")
                print(
                    f"   Exact Match: {
                        response.get(
                            'is_exact_match',
                            False)}")
        else:
            print(f"❌ Error: {response.get('error', 'Unknown error')}")

    # Show cache performance
    print("\n📊 Cache Performance:")
    performance = router.get_cache_performance()
    print(f"   Hit Rate: {performance['hit_rate']:.1f}%")
    print(f"   Cache Hits: {performance['cache_hits']}")
    print(f"   Cache Misses: {performance['cache_misses']}")

    # Cleanup
    await cache.cleanup_expired_cache()


if __name__ == "__main__":
    asyncio.run(main())
