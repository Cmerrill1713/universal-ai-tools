#!/usr/bin/env python3
"""
Sakana AI Service
Main service for Sakana AI evolutionary algorithms with MLX integration
"""

import asyncio
import json
import logging
import time
from datetime import datetime
from typing import Dict, List, Any, Optional
from aiohttp import web

from sakana_mlx_integration import SakanaMLXIntegration

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SakanaAIService:
    """Main Sakana AI service with HTTP API"""
    
    def __init__(self, port: int = 8032):
        self.port = port
        self.app = web.Application()
        self.integration = SakanaMLXIntegration()
        self.setup_routes()
        
    def setup_routes(self):
        """Setup HTTP routes"""
        self.app.router.add_post('/start-evolution', self.start_evolution_handler)
        self.app.router.add_get('/evolution-status/{evolution_id}', self.evolution_status_handler)
        self.app.router.add_get('/mlx-model/{evolution_id}', self.mlx_model_handler)
        self.app.router.add_post('/benchmark/{evolution_id}', self.benchmark_handler)
        self.app.router.add_get('/status', self.status_handler)
        self.app.router.add_get('/health', self.health_handler)
        
    async def start_evolution_handler(self, request):
        """Start evolutionary fine-tuning"""
        try:
            data = await request.json()
            
            base_model = data.get('base_model', 'llama3.2:3b')
            task_description = data.get('task_description', 'general')
            training_data = data.get('training_data', [])
            evolution_config = data.get('evolution_config', {})
            
            if not training_data:
                return web.json_response({
                    'error': 'Training data is required'
                }, status=400)
                
            evolution_id = await self.integration.start_evolutionary_finetuning(
                base_model=base_model,
                task_description=task_description,
                training_data=training_data,
                evolution_config=evolution_config
            )
            
            return web.json_response({
                'evolution_id': evolution_id,
                'status': 'started',
                'message': 'Evolutionary fine-tuning started',
                'base_model': base_model,
                'task_description': task_description
            })
            
        except Exception as e:
            logger.error(f"❌ Start evolution failed: {e}")
            return web.json_response({
                'error': str(e)
            }, status=500)
            
    async def evolution_status_handler(self, request):
        """Get evolution status"""
        try:
            evolution_id = request.match_info['evolution_id']
            status = await self.integration.get_evolution_status(evolution_id)
            
            # Clean up any non-serializable objects
            if 'task' in status:
                del status['task']  # Remove the Task object
            
            return web.json_response(status)
            
        except Exception as e:
            logger.error(f"❌ Get evolution status failed: {e}")
            return web.json_response({
                'error': str(e)
            }, status=500)
            
    async def mlx_model_handler(self, request):
        """Get MLX model information"""
        try:
            evolution_id = request.match_info['evolution_id']
            model_info = await self.integration.get_mlx_model_info(evolution_id)
            
            return web.json_response(model_info)
            
        except Exception as e:
            logger.error(f"❌ Get MLX model info failed: {e}")
            return web.json_response({
                'error': str(e)
            }, status=500)
            
    async def benchmark_handler(self, request):
        """Benchmark MLX model performance"""
        try:
            evolution_id = request.match_info['evolution_id']
            benchmarks = await self.integration.benchmark_mlx_performance(evolution_id)
            
            return web.json_response(benchmarks)
            
        except Exception as e:
            logger.error(f"❌ Benchmark failed: {e}")
            return web.json_response({
                'error': str(e)
            }, status=500)
            
    async def status_handler(self, request):
        """Get overall service status"""
        try:
            status = await self.integration.get_integration_status()
            
            return web.json_response({
                'service': 'sakana-ai',
                'status': 'healthy',
                'integration_status': status,
                'timestamp': datetime.now().isoformat()
            })
            
        except Exception as e:
            logger.error(f"❌ Get status failed: {e}")
            return web.json_response({
                'error': str(e)
            }, status=500)
            
    async def health_handler(self, request):
        """Health check endpoint"""
        try:
            mlx_available = await self.integration._check_mlx_server()
            
            return web.json_response({
                'service': 'sakana-ai',
                'status': 'healthy',
                'mlx_available': mlx_available,
                'timestamp': datetime.now().isoformat()
            })
            
        except Exception as e:
            logger.error(f"❌ Health check failed: {e}")
            return web.json_response({
                'error': str(e)
            }, status=500)
            
    async def start_server(self):
        """Start the Sakana AI service"""
        await self.integration.initialize()
        
        runner = web.AppRunner(self.app)
        await runner.setup()
        site = web.TCPSite(runner, 'localhost', self.port)
        await site.start()
        
        logger.info(f"🧬 Sakana AI Service started on port {self.port}")
        logger.info(f"🔗 Health check: http://localhost:{self.port}/health")
        logger.info(f"📊 Status: http://localhost:{self.port}/status")
        
        # Keep the server running
        try:
            while True:
                await asyncio.sleep(3600)
        except asyncio.CancelledError:
            logger.info("Sakana AI Service stopped")
        finally:
            await self.integration.close()

async def main():
    """Start the Sakana AI service"""
    service = SakanaAIService(port=8032)
    await service.start_server()

if __name__ == "__main__":
    asyncio.run(main())
