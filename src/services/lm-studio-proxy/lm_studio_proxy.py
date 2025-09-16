#!/usr/bin/env python3
"""
LM Studio Proxy Service
Handles connections to LM Studio service and provides fallback functionality
"""

import asyncio
import aiohttp
import json
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
from fastapi import FastAPI, HTTPException
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="LM Studio Proxy Service", version="1.0.0")

class LMStudioProxyService:
    def __init__(self, port=5901):
        self.port = port
        self.lm_studio_url = f"http://localhost:{port}"
        self.session = None
        
    async def initialize(self):
        """Initialize the service"""
        logger.info("🤖 Initializing LM Studio Proxy Service...")
        
        # Initialize HTTP session
        connector = aiohttp.TCPConnector(
            limit=100,
            limit_per_host=30,
            ttl_dns_cache=300,
            use_dns_cache=True,
            keepalive_timeout=30,
            enable_cleanup_closed=True
        )
        timeout = aiohttp.ClientTimeout(
            total=30,
            connect=10,
            sock_read=10
        )
        self.session = aiohttp.ClientSession(
            connector=connector,
            timeout=timeout,
            headers={'User-Agent': 'Universal-AI-Tools-LM-Studio-Proxy/1.0'}
        )
        
        # Check LM Studio service availability
        await self._check_lm_studio_service()
        
        logger.info("✅ LM Studio Proxy Service ready")
        
    async def _check_lm_studio_service(self):
        """Check if LM Studio service is available"""
        try:
            async with self.session.get(f"{self.lm_studio_url}/v1/models", timeout=5) as response:
                if response.status == 200:
                    logger.info("✅ LM Studio service is available")
                    return True
                else:
                    logger.warning(f"⚠️ LM Studio service returned status {response.status}")
                    return False
        except Exception as e:
            logger.warning(f"⚠️ LM Studio service not available: {e}")
            return False
    
    async def get_models(self) -> Dict[str, Any]:
        """Get available models from LM Studio"""
        try:
            async with self.session.get(f"{self.lm_studio_url}/v1/models", timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    logger.info(f"✅ Retrieved {len(data.get('data', []))} models from LM Studio")
                    return data
                else:
                    logger.warning(f"LM Studio returned status {response.status}")
                    return self._get_fallback_models()
        except Exception as e:
            logger.warning(f"Failed to get models from LM Studio: {e}")
            return self._get_fallback_models()
    
    def _get_fallback_models(self) -> Dict[str, Any]:
        """Get fallback models when LM Studio is not available"""
        return {
            "object": "list",
            "data": [
                {
                    "id": "lm_studio_llava_7b",
                    "object": "model",
                    "created": int(datetime.now().timestamp()),
                    "owned_by": "lm_studio",
                    "capabilities": ["vision", "image_analysis", "chat"]
                },
                {
                    "id": "lm_studio_qwen_vl",
                    "object": "model",
                    "created": int(datetime.now().timestamp()),
                    "owned_by": "lm_studio", 
                    "capabilities": ["vision", "multimodal", "reasoning"]
                }
            ]
        }
    
    async def cleanup(self):
        """Cleanup resources"""
        if self.session:
            await self.session.close()

# Initialize service
lm_studio_proxy = LMStudioProxyService()

@app.on_event("startup")
async def startup_event():
    await lm_studio_proxy.initialize()

@app.on_event("shutdown")
async def shutdown_event():
    await lm_studio_proxy.cleanup()

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "lm-studio-proxy",
        "port": lm_studio_proxy.port,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/v1/models")
async def get_models():
    """Get available models"""
    try:
        models = await lm_studio_proxy.get_models()
        return models
    except Exception as e:
        logger.error(f"Failed to get models: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/models")
async def get_models_alt():
    """Alternative models endpoint"""
    return await get_models()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5901)
