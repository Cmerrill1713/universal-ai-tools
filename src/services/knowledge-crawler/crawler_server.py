#!/usr/bin/env python3
"""
Knowledge Crawler HTTP Server
Provides REST API for the knowledge crawler service
"""

import asyncio
import aiohttp
import json
import logging
from aiohttp import web
from datetime import datetime
from knowledge_crawler import KnowledgeCrawler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CrawlerHTTPServer:
    def __init__(self, port=8030):
        self.port = port
        self.crawler = None
        self.app = web.Application()
        self._setup_routes()
        
    def _setup_routes(self):
        """Setup HTTP routes"""
        self.app.router.add_post('/crawl', self.crawl_handler)
        self.app.router.add_get('/health', self.health_handler)
        self.app.router.add_get('/status', self.status_handler)
        
    async def crawl_handler(self, request):
        """Handle crawl requests"""
        try:
            logger.info("🕷️ Starting crawl request...")
            
            # Initialize crawler if not already done
            if not self.crawler:
                self.crawler = KnowledgeCrawler()
                await self.crawler.initialize()
                
            # Start crawling
            crawled_data = await self.crawler.crawl_knowledge_centers()
            
            result = {
                'status': 'success',
                'total_documents': len(crawled_data),
                'documents': crawled_data,
                'sources': list(set(doc['source'] for doc in crawled_data)),
                'timestamp': datetime.now().isoformat()
            }
            
            logger.info(f"✅ Crawl completed: {len(crawled_data)} documents")
            return web.json_response(result)
            
        except Exception as e:
            logger.error(f"❌ Crawl handler error: {e}")
            return web.json_response({'error': str(e)}, status=500)
            
    async def health_handler(self, request):
        """Handle health check requests"""
        try:
            health = {
                'service': 'knowledge-crawler',
                'status': 'healthy',
                'crawler_initialized': self.crawler is not None,
                'timestamp': datetime.now().isoformat()
            }
            return web.json_response(health)
            
        except Exception as e:
            logger.error(f"❌ Health handler error: {e}")
            return web.json_response({'error': str(e)}, status=500)
            
    async def status_handler(self, request):
        """Handle status requests"""
        try:
            status = {
                'service': 'knowledge-crawler',
                'status': 'running',
                'crawler_initialized': self.crawler is not None,
                'knowledge_sources': len(self.crawler.knowledge_sources) if self.crawler else 0,
                'timestamp': datetime.now().isoformat()
            }
            return web.json_response(status)
            
        except Exception as e:
            logger.error(f"❌ Status handler error: {e}")
            return web.json_response({'error': str(e)}, status=500)

async def main():
    """Main function to run the crawler HTTP server"""
    server = CrawlerHTTPServer(port=8030)
    
    try:
        logger.info(f"🚀 Starting Knowledge Crawler Server on port {server.port}")
        
        runner = web.AppRunner(server.app)
        await runner.setup()
        site = web.TCPSite(runner, 'localhost', server.port)
        await site.start()
        
        logger.info(f"🕷️ Knowledge Crawler Server running at http://localhost:{server.port}")
        logger.info("📚 Ready to crawl knowledge centers!")
        
        # Keep running
        await asyncio.Future()
        
    except Exception as e:
        logger.error(f"❌ Crawler server failed: {e}")
        
    finally:
        if server.crawler:
            await server.crawler.close()

if __name__ == "__main__":
    asyncio.run(main())
