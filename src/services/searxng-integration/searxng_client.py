#!/usr/bin/env python3
"""
SearXNG Integration Service
Integrates with SearXNG for privacy-respecting knowledge search
"""

import asyncio
import aiohttp
import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
import urllib.parse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SearXNGClient:
    def __init__(self, searxng_url="http://localhost:8080"):
        self.searxng_url = searxng_url
        self.session = None
        
    async def initialize(self):
        """Initialize the SearXNG client"""
        self.session = aiohttp.ClientSession()
        logger.info(f"🔍 SearXNG Client initialized: {self.searxng_url}")
        
    async def search_knowledge(self, 
                             query: str, 
                             categories: List[str] = None,
                             engines: List[str] = None,
                             max_results: int = 20) -> Dict[str, Any]:
        """Search for knowledge using SearXNG"""
        
        if not categories:
            categories = ["general", "science", "it"]
            
        if not engines:
            engines = ["google", "bing", "duckduckgo", "wikipedia"]
            
        params = {
            "q": query,
            "categories": ",".join(categories),
            "engines": ",".join(engines),
            "format": "json",
            "pageno": 1,
            "time_range": "",
            "safesearch": "1"
        }
        
        try:
            async with self.session.get(
                f"{self.searxng_url}/search",
                params=params,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                
                if response.status == 200:
                    data = await response.json()
                    return await self._process_search_results(data, query)
                else:
                    logger.error(f"❌ SearXNG search failed: HTTP {response.status}")
                    return {"error": f"HTTP {response.status}"}
                    
        except Exception as e:
            logger.error(f"❌ SearXNG search error: {e}")
            return {"error": str(e)}
            
    async def _process_search_results(self, data: Dict[str, Any], query: str) -> Dict[str, Any]:
        """Process SearXNG search results"""
        results = data.get("results", [])
        
        processed_results = []
        for result in results:
            processed_result = {
                "id": f"searxng_{hash(result.get('url', ''))}",
                "title": result.get("title", ""),
                "content": result.get("content", ""),
                "url": result.get("url", ""),
                "source": result.get("engine", "unknown"),
                "type": self._categorize_result(result),
                "priority": self._calculate_priority(result, query),
                "timestamp": datetime.now().isoformat(),
                "metadata": {
                    "domain": self._extract_domain(result.get("url", "")),
                    "language": "en",
                    "quality_score": self._calculate_quality_score(result),
                    "relevance_score": self._calculate_relevance(result, query)
                }
            }
            processed_results.append(processed_result)
            
        return {
            "query": query,
            "total_results": len(processed_results),
            "results": processed_results,
            "search_time": data.get("search_time", 0),
            "timestamp": datetime.now().isoformat()
        }
        
    def _categorize_result(self, result: Dict[str, Any]) -> str:
        """Categorize search result"""
        url = result.get("url", "").lower()
        title = result.get("title", "").lower()
        content = result.get("content", "").lower()
        
        # Research papers
        if any(domain in url for domain in ["arxiv.org", "paperswithcode.com", "scholar.google.com"]):
            return "research_paper"
            
        # Documentation
        if any(domain in url for domain in ["github.com", "docs.", "documentation"]):
            return "documentation"
            
        # Q&A Forums
        if any(domain in url for domain in ["stackoverflow.com", "stackexchange.com", "reddit.com"]):
            return "qa_forum"
            
        # Blogs/Articles
        if any(domain in url for domain in ["medium.com", "blog.", "news."]):
            return "blog_post"
            
        # Wikipedia
        if "wikipedia.org" in url:
            return "encyclopedia"
            
        return "general"
        
    def _calculate_priority(self, result: Dict[str, Any], query: str) -> str:
        """Calculate result priority"""
        url = result.get("url", "").lower()
        title = result.get("title", "").lower()
        
        # High priority sources
        if any(domain in url for domain in ["arxiv.org", "paperswithcode.com", "scholar.google.com"]):
            return "high"
            
        # Medium priority sources
        if any(domain in url for domain in ["github.com", "stackoverflow.com", "wikipedia.org"]):
            return "medium"
            
        return "low"
        
    def _extract_domain(self, url: str) -> str:
        """Extract domain from URL"""
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            domain = parsed.netloc.lower()
            
            # Map domains to categories
            domain_mapping = {
                "arxiv.org": "artificial_intelligence",
                "paperswithcode.com": "machine_learning",
                "github.com": "software_development",
                "stackoverflow.com": "programming",
                "wikipedia.org": "general_knowledge",
                "scholar.google.com": "academic_research"
            }
            
            for key, value in domain_mapping.items():
                if key in domain:
                    return value
                    
            return "general"
            
        except:
            return "unknown"
            
    def _calculate_quality_score(self, result: Dict[str, Any]) -> float:
        """Calculate quality score for result"""
        score = 0.5  # Base score
        
        # Title quality
        title = result.get("title", "")
        if len(title) > 10:
            score += 0.1
            
        # Content quality
        content = result.get("content", "")
        if len(content) > 50:
            score += 0.1
            
        # URL quality
        url = result.get("url", "")
        if any(domain in url.lower() for domain in ["arxiv.org", "paperswithcode.com", "scholar.google.com"]):
            score += 0.2
            
        return min(score, 1.0)
        
    def _calculate_relevance(self, result: Dict[str, Any], query: str) -> float:
        """Calculate relevance score"""
        title = result.get("title", "").lower()
        content = result.get("content", "").lower()
        query_words = query.lower().split()
        
        relevance = 0.0
        
        # Check title relevance
        for word in query_words:
            if word in title:
                relevance += 0.3
                
        # Check content relevance
        for word in query_words:
            if word in content:
                relevance += 0.1
                
        return min(relevance, 1.0)
        
    async def search_ai_knowledge(self, query: str) -> Dict[str, Any]:
        """Specialized search for AI-related knowledge"""
        ai_categories = ["science", "it"]
        ai_engines = ["google", "bing", "duckduckgo", "wikipedia", "arxiv"]
        
        # Enhance query for AI search
        enhanced_query = f"{query} artificial intelligence machine learning"
        
        return await self.search_knowledge(
            query=enhanced_query,
            categories=ai_categories,
            engines=ai_engines,
            max_results=15
        )
        
    async def search_research_papers(self, query: str) -> Dict[str, Any]:
        """Search specifically for research papers"""
        research_engines = ["arxiv", "scholar", "paperswithcode"]
        
        return await self.search_knowledge(
            query=query,
            categories=["science"],
            engines=research_engines,
            max_results=10
        )
        
    async def search_documentation(self, query: str) -> Dict[str, Any]:
        """Search for technical documentation"""
        doc_engines = ["google", "bing", "duckduckgo"]
        
        # Enhance query for documentation
        enhanced_query = f"{query} documentation tutorial guide"
        
        return await self.search_knowledge(
            query=enhanced_query,
            categories=["it"],
            engines=doc_engines,
            max_results=10
        )
        
    async def close(self):
        """Close the SearXNG client session"""
        if self.session:
            await self.session.close()

async def main():
    """Test the SearXNG client"""
    client = SearXNGClient()
    
    try:
        await client.initialize()
        
        # Test AI knowledge search
        logger.info("🔍 Testing AI knowledge search...")
        results = await client.search_ai_knowledge("machine learning optimization")
        
        logger.info(f"✅ Found {results.get('total_results', 0)} results")
        
        # Test research papers search
        logger.info("📚 Testing research papers search...")
        papers = await client.search_research_papers("neural networks")
        
        logger.info(f"✅ Found {papers.get('total_results', 0)} research papers")
        
    except Exception as e:
        logger.error(f"❌ SearXNG client test failed: {e}")
        
    finally:
        await client.close()

if __name__ == "__main__":
    asyncio.run(main())
