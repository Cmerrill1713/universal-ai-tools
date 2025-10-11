#!/usr/bin/env python3
"""
Browser Automation Controller
Opens real browser windows on the host Mac using native 'open' command
"""

import asyncio
import logging
import subprocess
from typing import Optional, Dict, Any
import httpx

logger = logging.getLogger(__name__)


class BrowserController:
    """Controller for browser automation - Opens REAL browser windows on Mac"""
    
    def __init__(self):
        self.last_url: Optional[str] = None
    
    async def navigate(self, url: str, wait_for: str = "networkidle") -> Dict[str, Any]:
        """
        Navigate to URL by opening a NEW BROWSER WINDOW on the Mac
        
        Args:
            url: URL to navigate to
            wait_for: Ignored (for API compatibility)
        
        Returns:
            Dict with success status, URL, and message
        """
        try:
            logger.info(f"🌐 Opening browser window to: {url}")
            
            # Call host browser opener service (running on Mac at port 9876)
            import httpx
            async with httpx.AsyncClient(timeout=5.0) as client:
                try:
                    # Try to call the host service
                    response = await client.post(
                        "http://host.docker.internal:9876/open",
                        json={"url": url}
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        if data.get("success"):
                            self.last_url = url
                            logger.info(f"✅ Browser window opened via host service: {url}")
                            
                            # Fetch page content for AI
                            page_content = await self._fetch_page_content(url)
                            
                            return {
                                "success": True,
                                "url": url,
                                "message": f"Navigated to {url}",
                                "content": page_content
                            }
                
                except httpx.ConnectError:
                    # Host service not running - try fallback
                    logger.warning("Browser opener service not running on host")
                    pass
            
            # Fallback: return URL for frontend to open with window.open()
            logger.info(f"📤 Sending URL to frontend for opening: {url}")
            page_content = await self._fetch_page_content(url)
            
            return {
                "success": True,
                "url": url,
                "message": f"Opening browser to {url}",
                "content": page_content,
                "frontend_action": "open_url"  # Signal to frontend
            }
        
        except Exception as e:
            logger.error(f"Navigation failed: {e}")
            return {
                "success": False,
                "url": url,
                "error": str(e),
                "message": f"Failed to navigate to {url}: {str(e)}"
            }
    
    async def _fetch_page_content(self, url: str) -> Optional[str]:
        """Fetch page content for AI summarization (without rendering)"""
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                response = await client.get(url, headers={
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                })
                
                if response.status_code == 200:
                    # Extract text from HTML (simple version)
                    html = response.text
                    # Remove scripts and styles
                    import re
                    html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
                    html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL)
                    html = re.sub(r'<[^>]+>', ' ', html)
                    # Clean up whitespace
                    html = ' '.join(html.split())
                    return html[:2000]  # First 2000 chars
                
        except Exception as e:
            logger.warning(f"Failed to fetch page content: {e}")
        
        return None
    
    async def click(self, selector: str) -> Dict[str, Any]:
        """Click operation (not supported for native browser opening)"""
        return {
            "success": False,
            "error": "Click operations require Playwright automation (not available in container)"
        }
    
    async def type_text(self, selector: str, text: str) -> Dict[str, Any]:
        """Type operation (not supported for native browser opening)"""
        return {
            "success": False,
            "error": "Type operations require Playwright automation (not available in container)"
        }
    
    async def screenshot(self, path: Optional[str] = None) -> Dict[str, Any]:
        """Screenshot (not supported for native browser opening)"""
        return {
            "success": False,
            "error": "Screenshot requires Playwright automation (not available in container)"
        }
    
    async def get_page_content(self) -> Dict[str, Any]:
        """Get text content from the last opened page"""
        try:
            if not self.last_url:
                raise Exception("No page opened yet")
            
            content = await self._fetch_page_content(self.last_url)
            
            return {
                "success": True,
                "text": content or "",
                "url": self.last_url
            }
        
        except Exception as e:
            logger.error(f"Get content failed: {e}")
            return {"success": False, "error": str(e)}
    
    async def search_in_page(self, text: str) -> Dict[str, Any]:
        """Search for text (uses HTTP fetch, not browser automation)"""
        try:
            if not self.last_url:
                raise Exception("No page opened yet")
            
            content = await self._fetch_page_content(self.last_url)
            count = content.lower().count(text.lower()) if content else 0
            
            return {
                "success": True,
                "text": text,
                "count": count,
                "found": count > 0,
                "message": f"Found {count} occurrences of '{text}'"
            }
        
        except Exception as e:
            logger.error(f"Search failed: {e}")
            return {"success": False, "error": str(e)}
    
    async def close(self):
        """Close is handled by user (browser opened natively on Mac)"""
        logger.info("🌐 Browser opened natively - user can close it manually")
        self.last_url = None


# Global singleton instance
_browser_controller = None


def get_browser_controller() -> BrowserController:
    """Get the global browser controller instance"""
    global _browser_controller
    if _browser_controller is None:
        _browser_controller = BrowserController()
    return _browser_controller

