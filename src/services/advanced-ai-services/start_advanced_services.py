#!/usr/bin/env python3
"""
Advanced AI Services Starter
Starts Constitutional AI Training and A2A Communication services
"""

import asyncio
import logging
import subprocess
import sys
import os
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class AdvancedAIServices:
    """Advanced AI Services Manager"""
    
    def __init__(self):
        self.base_dir = Path(__file__).parent.parent.parent
        self.services = {}
        
    async def start_constitutional_ai_trainer(self):
        """Start Constitutional AI Training System"""
        try:
            logger.info("🧠 Starting Constitutional AI Training System...")
            
            trainer_script = self.base_dir / "src" / "services" / "constitutional-ai-training" / "constitutional_ai_trainer.py"
            
            if not trainer_script.exists():
                logger.error(f"❌ Constitutional AI trainer script not found: {trainer_script}")
                return False
            
            # Start the trainer as a subprocess
            process = await asyncio.create_subprocess_exec(
                sys.executable, str(trainer_script),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(self.base_dir)
            )
            
            self.services['constitutional_ai_trainer'] = process
            logger.info("✅ Constitutional AI Training System started")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to start Constitutional AI Training System: {e}")
            return False
    
    async def start_a2a_communication_hub(self):
        """Start A2A Communication Hub"""
        try:
            logger.info("🤝 Starting A2A Communication Hub...")
            
            a2a_script = self.base_dir / "src" / "services" / "a2a-communication" / "a2a_protocol.py"
            
            if not a2a_script.exists():
                logger.error(f"❌ A2A protocol script not found: {a2a_script}")
                return False
            
            # Start the A2A hub as a subprocess
            process = await asyncio.create_subprocess_exec(
                sys.executable, str(a2a_script),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(self.base_dir)
            )
            
            self.services['a2a_communication_hub'] = process
            logger.info("✅ A2A Communication Hub started")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to start A2A Communication Hub: {e}")
            return False
    
    async def start_model_grading_service(self):
        """Start Model Grading Service"""
        try:
            logger.info("📊 Starting Model Grading Service...")
            
            # Create a simple model grading service
            grading_script = self.base_dir / "src" / "services" / "model-grading" / "model_grading_service.py"
            grading_script.parent.mkdir(parents=True, exist_ok=True)
            
            # Create the model grading service
            grading_service_code = '''#!/usr/bin/env python3
"""
Model Grading Service
Provides REST API for model grading and performance tracking
"""

import asyncio
import json
import logging
from aiohttp import web, ClientSession
from datetime import datetime
import asyncpg

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ModelGradingService:
    def __init__(self):
        self.db_url = "postgresql://postgres:postgres@localhost:5432/postgres"
        self.app = web.Application()
        self.app.router.add_post('/grade', self.grade_model_response)
        self.app.router.add_get('/rankings', self.get_model_rankings)
        self.app.router.add_get('/health', self.health_check)
    
    async def grade_model_response(self, request):
        """Grade a model response using Constitutional AI methodology"""
        try:
            data = await request.json()
            
            response_id = data.get('response_id')
            model_id = data.get('model_id')
            user_query = data.get('user_query')
            model_response = data.get('model_response')
            
            # Analyze response for constitutional patterns
            score, reasoning = await self._analyze_response(user_query, model_response)
            
            # Store the grade
            await self._store_grade(response_id, model_id, score, reasoning)
            
            return web.json_response({
                'response_id': response_id,
                'model_id': model_id,
                'constitutional_score': score,
                'reasoning': reasoning,
                'timestamp': datetime.now().isoformat()
            })
            
        except Exception as e:
            logger.error(f"❌ Grading failed: {e}")
            return web.json_response({'error': str(e)}, status=500)
    
    async def _analyze_response(self, query: str, response: str):
        """Analyze response for constitutional patterns"""
        response_lower = response.lower()
        
        # Check for uncertainty admission (score = 0)
        uncertainty_patterns = [
            "i don't know", "i'm not sure", "let me research",
            "i need to verify", "i should look this up"
        ]
        
        if any(pattern in response_lower for pattern in uncertainty_patterns):
            return 0, "Model properly admitted uncertainty"
        
        # Check for accuracy confirmation (score = 1)
        confirmation_patterns = [
            "you are correct", "that's right", "exactly", "precisely"
        ]
        
        if any(pattern in response_lower for pattern in confirmation_patterns):
            return 1, "Model confirmed accuracy"
        
        # Default to -1 for overconfident responses
        return -1, "Model gave definitive answer without proper verification"
    
    async def _store_grade(self, response_id: str, model_id: str, score: int, reasoning: str):
        """Store model grade in database"""
        try:
            conn = await asyncpg.connect(self.db_url)
            await conn.execute("""
                INSERT INTO constitutional_scores 
                (response_id, model_id, constitutional_score, reasoning)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (response_id) DO UPDATE SET
                    constitutional_score = EXCLUDED.constitutional_score,
                    reasoning = EXCLUDED.reasoning
            """, response_id, model_id, score, reasoning)
            await conn.close()
        except Exception as e:
            logger.error(f"❌ Failed to store grade: {e}")
    
    async def get_model_rankings(self, request):
        """Get current model rankings"""
        try:
            conn = await asyncpg.connect(self.db_url)
            rows = await conn.fetch("""
                SELECT model_id, 
                       COUNT(*) as total_responses,
                       AVG(constitutional_score) as avg_score,
                       COUNT(CASE WHEN constitutional_score = 0 THEN 1 END) as uncertainty_count,
                       COUNT(CASE WHEN constitutional_score = 1 THEN 1 END) as correct_count
                FROM constitutional_scores
                GROUP BY model_id
                ORDER BY avg_score DESC
            """)
            
            rankings = []
            for row in rows:
                rankings.append({
                    'model_id': row['model_id'],
                    'total_responses': row['total_responses'],
                    'average_score': float(row['avg_score']),
                    'uncertainty_rate': row['uncertainty_count'] / row['total_responses'] if row['total_responses'] > 0 else 0,
                    'accuracy_rate': row['correct_count'] / row['total_responses'] if row['total_responses'] > 0 else 0
                })
            
            await conn.close()
            return web.json_response({'rankings': rankings})
            
        except Exception as e:
            logger.error(f"❌ Failed to get rankings: {e}")
            return web.json_response({'error': str(e)}, status=500)
    
    async def health_check(self, request):
        """Health check endpoint"""
        return web.json_response({
            'service': 'model-grading-service',
            'status': 'healthy',
            'timestamp': datetime.now().isoformat()
        })
    
    async def start(self, port=8025):
        """Start the model grading service"""
        logger.info(f"🚀 Starting Model Grading Service on port {port}")
        runner = web.AppRunner(self.app)
        await runner.setup()
        site = web.TCPSite(runner, 'localhost', port)
        await site.start()
        logger.info(f"✅ Model Grading Service running on port {port}")
        
        # Keep running
        try:
            await asyncio.Future()
        except KeyboardInterrupt:
            logger.info("🛑 Model Grading Service shutting down")

if __name__ == "__main__":
    service = ModelGradingService()
    asyncio.run(service.start())
'''
            
            with open(grading_script, 'w') as f:
                f.write(grading_service_code)
            
            # Make it executable
            os.chmod(grading_script, 0o755)
            
            # Start the service
            process = await asyncio.create_subprocess_exec(
                sys.executable, str(grading_script),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(self.base_dir)
            )
            
            self.services['model_grading_service'] = process
            logger.info("✅ Model Grading Service started on port 8025")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to start Model Grading Service: {e}")
            return False
    
    async def start_all_services(self):
        """Start all advanced AI services"""
        logger.info("🚀 Starting Advanced AI Services...")
        
        services_started = 0
        
        # Start Constitutional AI Training System
        if await self.start_constitutional_ai_trainer():
            services_started += 1
        
        # Start A2A Communication Hub
        if await self.start_a2a_communication_hub():
            services_started += 1
        
        # Start Model Grading Service
        if await self.start_model_grading_service():
            services_started += 1
        
        logger.info(f"✅ Started {services_started}/3 advanced AI services")
        
        if services_started > 0:
            logger.info("🎯 Advanced AI Services are running!")
            logger.info("📊 Constitutional AI Training System: Active")
            logger.info("🤝 A2A Communication Hub: Active")
            logger.info("📈 Model Grading Service: Active on port 8025")
        
        return services_started > 0
    
    async def stop_all_services(self):
        """Stop all advanced AI services"""
        logger.info("🛑 Stopping Advanced AI Services...")
        
        for service_name, process in self.services.items():
            try:
                process.terminate()
                await process.wait()
                logger.info(f"✅ Stopped {service_name}")
            except Exception as e:
                logger.error(f"❌ Failed to stop {service_name}: {e}")
        
        self.services.clear()
        logger.info("🛑 All Advanced AI Services stopped")

async def main():
    """Main function"""
    services = AdvancedAIServices()
    
    try:
        await services.start_all_services()
        
        # Keep running until interrupted
        logger.info("🔄 Advanced AI Services running... Press Ctrl+C to stop")
        await asyncio.Future()  # Run forever
        
    except KeyboardInterrupt:
        logger.info("🛑 Shutting down Advanced AI Services...")
        await services.stop_all_services()
    except Exception as e:
        logger.error(f"❌ Advanced AI Services failed: {e}")

if __name__ == "__main__":
    asyncio.run(main())
