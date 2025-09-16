#!/usr/bin/env python3
"""
Knowledge Crawler Coordinator
Orchestrates the knowledge crawling and embedding process
"""

import asyncio
import aiohttp
import json
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any
import schedule
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CrawlerCoordinator:
    def __init__(self, 
                 crawler_service_url="http://localhost:8030",
                 librarian_service_url="http://localhost:8029",
                 hrm_service_url="http://localhost:8027"):
        self.crawler_service_url = crawler_service_url
        self.librarian_service_url = librarian_service_url
        self.hrm_service_url = hrm_service_url
        self.session = None
        self.crawl_schedule = {
            "high_priority": "0 */6 * * *",  # Every 6 hours
            "medium_priority": "0 */12 * * *",  # Every 12 hours
            "low_priority": "0 0 * * *"  # Daily
        }
        
    async def initialize(self):
        """Initialize the coordinator"""
        self.session = aiohttp.ClientSession()
        logger.info("🎯 Knowledge Crawler Coordinator initialized")
        
    async def start_crawling_session(self) -> Dict[str, Any]:
        """Start a comprehensive crawling session"""
        logger.info("🕷️ Starting comprehensive knowledge crawling session...")
        
        session_id = f"crawl_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        results = {
            "session_id": session_id,
            "start_time": datetime.now().isoformat(),
            "crawl_results": {},
            "embedding_results": {},
            "total_documents": 0,
            "status": "running"
        }
        
        try:
            # Step 1: Start knowledge crawler
            logger.info("📚 Step 1: Starting knowledge crawler...")
            crawl_result = await self._start_crawler()
            results["crawl_results"] = crawl_result
            
            # Step 2: Send to librarian for embedding
            logger.info("📖 Step 2: Sending documents to librarian...")
            embedding_result = await self._send_to_librarian(crawl_result.get("documents", []))
            results["embedding_results"] = embedding_result
            
            # Step 3: Update HRM with new knowledge
            logger.info("🧠 Step 3: Updating HRM with new knowledge...")
            hrm_update = await self._update_hrm_knowledge(embedding_result)
            results["hrm_update"] = hrm_update
            
            # Step 4: Generate knowledge summary
            logger.info("📊 Step 4: Generating knowledge summary...")
            summary = await self._generate_knowledge_summary(results)
            results["summary"] = summary
            
            results["total_documents"] = len(crawl_result.get("documents", []))
            results["status"] = "completed"
            results["end_time"] = datetime.now().isoformat()
            
            logger.info(f"✅ Crawling session completed: {results['total_documents']} documents processed")
            
        except Exception as e:
            logger.error(f"❌ Crawling session failed: {e}")
            results["status"] = "failed"
            results["error"] = str(e)
            
        return results
        
    async def _start_crawler(self) -> Dict[str, Any]:
        """Start the knowledge crawler"""
        try:
            async with self.session.post(f"{self.crawler_service_url}/crawl") as response:
                if response.status == 200:
                    result = await response.json()
                    logger.info(f"✅ Crawler completed: {result.get('total_documents', 0)} documents")
                    return result
                else:
                    logger.error(f"❌ Crawler failed: HTTP {response.status}")
                    return {"error": f"HTTP {response.status}"}
                    
        except Exception as e:
            logger.error(f"❌ Crawler request failed: {e}")
            return {"error": str(e)}
            
    async def _send_to_librarian(self, documents: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Send documents to librarian for embedding"""
        if not documents:
            logger.warning("⚠️ No documents to send to librarian")
            return {"error": "No documents"}
            
        try:
            async with self.session.post(
                f"{self.librarian_service_url}/embed",
                json={
                    "documents": documents,
                    "batch_id": f"coordinator_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                    "source": "crawler_coordinator"
                }
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    logger.info(f"✅ Librarian embedding completed: {result.get('embedded_count', 0)} documents")
                    return result
                else:
                    logger.error(f"❌ Librarian embedding failed: HTTP {response.status}")
                    return {"error": f"HTTP {response.status}"}
                    
        except Exception as e:
            logger.error(f"❌ Librarian request failed: {e}")
            return {"error": str(e)}
            
    async def _update_hrm_knowledge(self, embedding_result: Dict[str, Any]) -> Dict[str, Any]:
        """Update HRM with new knowledge information"""
        try:
            # Send knowledge update to HRM Decision Engine
            update_data = {
                "knowledge_update": {
                    "new_documents": embedding_result.get("embedded_count", 0),
                    "total_documents": embedding_result.get("total_documents", 0),
                    "sources": ["ArXiv", "GitHub", "Stack Overflow", "AI Blogs", "Papers with Code", "Hugging Face"],
                    "domains": ["artificial_intelligence", "machine_learning", "nlp_models", "software_development"],
                    "timestamp": datetime.now().isoformat()
                },
                "reasoning": "Update HRM with new knowledge for better decision making"
            }
            
            async with self.session.post(
                f"{self.hrm_service_url}/decide",
                json=update_data
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    logger.info("✅ HRM updated with new knowledge")
                    return result
                else:
                    logger.error(f"❌ HRM update failed: HTTP {response.status}")
                    return {"error": f"HTTP {response.status}"}
                    
        except Exception as e:
            logger.error(f"❌ HRM update request failed: {e}")
            return {"error": str(e)}
            
    async def _generate_knowledge_summary(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Generate a summary of the knowledge crawling session"""
        try:
            # Get librarian stats
            async with self.session.get(f"{self.librarian_service_url}/stats") as response:
                if response.status == 200:
                    stats = await response.json()
                    
                    summary = {
                        "session_summary": {
                            "documents_crawled": results.get("total_documents", 0),
                            "documents_embedded": results.get("embedding_results", {}).get("embedded_count", 0),
                            "sources_crawled": len(results.get("crawl_results", {}).get("sources", [])),
                            "session_duration": self._calculate_duration(
                                results.get("start_time"),
                                results.get("end_time")
                            )
                        },
                        "knowledge_base_stats": stats,
                        "recommendations": self._generate_recommendations(stats),
                        "timestamp": datetime.now().isoformat()
                    }
                    
                    return summary
                else:
                    return {"error": "Failed to get librarian stats"}
                    
        except Exception as e:
            logger.error(f"❌ Summary generation failed: {e}")
            return {"error": str(e)}
            
    def _calculate_duration(self, start_time: str, end_time: str) -> str:
        """Calculate session duration"""
        try:
            start = datetime.fromisoformat(start_time)
            end = datetime.fromisoformat(end_time)
            duration = end - start
            return str(duration)
        except:
            return "unknown"
            
    def _generate_recommendations(self, stats: Dict[str, Any]) -> List[str]:
        """Generate recommendations based on knowledge base stats"""
        recommendations = []
        
        total_docs = stats.get("total_documents", 0)
        recent_docs = stats.get("recent_documents", 0)
        
        if total_docs < 100:
            recommendations.append("Consider crawling more knowledge sources to expand the knowledge base")
            
        if recent_docs < 10:
            recommendations.append("Increase crawling frequency for more up-to-date information")
            
        sources = stats.get("sources", {})
        if len(sources) < 3:
            recommendations.append("Add more diverse knowledge sources for better coverage")
            
        recommendations.append("Schedule regular crawling sessions to keep knowledge base current")
        recommendations.append("Monitor HRM decision quality improvements with new knowledge")
        
        return recommendations
        
    async def schedule_regular_crawling(self):
        """Schedule regular crawling sessions"""
        logger.info("⏰ Setting up scheduled crawling...")
        
        # Schedule high-priority sources every 6 hours
        schedule.every(6).hours.do(self._run_scheduled_crawl, "high_priority")
        
        # Schedule medium-priority sources every 12 hours
        schedule.every(12).hours.do(self._run_scheduled_crawl, "medium_priority")
        
        # Schedule low-priority sources daily
        schedule.every().day.at("00:00").do(self._run_scheduled_crawl, "low_priority")
        
        logger.info("✅ Scheduled crawling configured")
        
        # Run scheduler
        while True:
            schedule.run_pending()
            await asyncio.sleep(60)  # Check every minute
            
    async def _run_scheduled_crawl(self, priority: str):
        """Run a scheduled crawl"""
        logger.info(f"⏰ Running scheduled crawl: {priority}")
        try:
            results = await self.start_crawling_session()
            logger.info(f"✅ Scheduled crawl completed: {results.get('total_documents', 0)} documents")
        except Exception as e:
            logger.error(f"❌ Scheduled crawl failed: {e}")
            
    async def close(self):
        """Close the coordinator session"""
        if self.session:
            await self.session.close()

async def main():
    """Main function to run the crawler coordinator"""
    coordinator = CrawlerCoordinator()
    
    try:
        await coordinator.initialize()
        
        # Run initial crawling session
        logger.info("🚀 Starting initial knowledge crawling session...")
        results = await coordinator.start_crawling_session()
        
        logger.info("🎉 Initial crawling session completed!")
        logger.info(f"📊 Results: {json.dumps(results, indent=2)}")
        
        # Start scheduled crawling
        logger.info("⏰ Starting scheduled crawling...")
        await coordinator.schedule_regular_crawling()
        
    except KeyboardInterrupt:
        logger.info("🛑 Crawler coordinator stopped by user")
        
    except Exception as e:
        logger.error(f"❌ Coordinator failed: {e}")
        
    finally:
        await coordinator.close()

if __name__ == "__main__":
    asyncio.run(main())
