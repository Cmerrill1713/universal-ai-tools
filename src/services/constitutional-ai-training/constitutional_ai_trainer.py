#!/usr/bin/env python3
"""
Constitutional AI Training System
Implements the -1, 0, 1 scoring methodology for model training
"""

import asyncio
import json
import logging
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
import aiohttp
import asyncpg

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class ConstitutionalScore:
    """Constitutional AI scoring system"""
    response_id: str
    model_id: str
    user_query: str
    model_response: str
    constitutional_score: int  # -1, 0, or 1
    reasoning: str
    timestamp: datetime

@dataclass
class ModelPerformance:
    """Model performance tracking"""
    model_id: str
    total_responses: int
    constitutional_scores: Dict[int, int]  # score -> count
    accuracy_rate: float
    uncertainty_rate: float
    confidence_rate: float
    last_updated: datetime

class ConstitutionalAITrainer:
    """
    Constitutional AI Training System
    
    Scoring Methodology:
    -1: Model gave wrong answer (should have said 'I don't know')
    0:  Model said 'I don't know, let me research and find the answer'
    1:  Model said 'You are correct' (confirmed accuracy)
    """
    
    def __init__(self, db_url: str = "postgresql://postgres:postgres@localhost:5432/postgres"):
        self.db_url = db_url
        self.llm_router_url = "http://localhost:3033"
        self.dspy_orchestrator_url = "http://localhost:8766"
        
    async def initialize_database(self):
        """Initialize Constitutional AI training tables"""
        try:
            conn = await asyncpg.connect(self.db_url)
            
            # Create Constitutional AI training tables
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS constitutional_scores (
                    id SERIAL PRIMARY KEY,
                    response_id VARCHAR(255) UNIQUE NOT NULL,
                    model_id VARCHAR(255) NOT NULL,
                    user_query TEXT NOT NULL,
                    model_response TEXT NOT NULL,
                    constitutional_score INTEGER NOT NULL CHECK (constitutional_score IN (-1, 0, 1)),
                    reasoning TEXT NOT NULL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS model_performance (
                    id SERIAL PRIMARY KEY,
                    model_id VARCHAR(255) UNIQUE NOT NULL,
                    total_responses INTEGER DEFAULT 0,
                    wrong_answers INTEGER DEFAULT 0,
                    uncertainty_responses INTEGER DEFAULT 0,
                    correct_confirmations INTEGER DEFAULT 0,
                    accuracy_rate FLOAT DEFAULT 0.0,
                    uncertainty_rate FLOAT DEFAULT 0.0,
                    confidence_rate FLOAT DEFAULT 0.0,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS fine_tuning_triggers (
                    id SERIAL PRIMARY KEY,
                    model_id VARCHAR(255) NOT NULL,
                    trigger_type VARCHAR(100) NOT NULL,
                    trigger_reason TEXT NOT NULL,
                    performance_threshold FLOAT,
                    current_performance FLOAT,
                    status VARCHAR(50) DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            await conn.close()
            logger.info("✅ Constitutional AI training database initialized")
            
        except Exception as e:
            logger.error(f"❌ Database initialization failed: {e}")
            raise
    
    async def evaluate_response(self, response_id: str, model_id: str, 
                              user_query: str, model_response: str) -> ConstitutionalScore:
        """
        Evaluate a model response using Constitutional AI methodology
        
        Returns ConstitutionalScore with -1, 0, or 1 rating
        """
        try:
            # Analyze the response for constitutional patterns
            constitutional_score, reasoning = await self._analyze_constitutional_patterns(
                user_query, model_response
            )
            
            score = ConstitutionalScore(
                response_id=response_id,
                model_id=model_id,
                user_query=user_query,
                model_response=model_response,
                constitutional_score=constitutional_score,
                reasoning=reasoning,
                timestamp=datetime.now()
            )
            
            # Store the score
            await self._store_constitutional_score(score)
            
            # Update model performance
            await self._update_model_performance(model_id, constitutional_score)
            
            # Check for fine-tuning triggers
            await self._check_fine_tuning_triggers(model_id)
            
            return score
            
        except Exception as e:
            logger.error(f"❌ Response evaluation failed: {e}")
            raise
    
    async def _analyze_constitutional_patterns(self, query: str, response: str) -> Tuple[int, str]:
        """
        Analyze response for constitutional AI patterns
        
        Returns (score, reasoning) where score is -1, 0, or 1
        """
        response_lower = response.lower()
        
        # Pattern 1: Uncertainty admission (score = 0)
        uncertainty_patterns = [
            "i don't know",
            "i'm not sure",
            "let me research",
            "i need to verify",
            "i should look this up",
            "i'm uncertain",
            "i can't be certain"
        ]
        
        if any(pattern in response_lower for pattern in uncertainty_patterns):
            return 0, "Model properly admitted uncertainty and expressed need to research"
        
        # Pattern 2: Accuracy confirmation (score = 1)
        confirmation_patterns = [
            "you are correct",
            "that's right",
            "exactly",
            "precisely",
            "you're absolutely right",
            "confirmed",
            "verified"
        ]
        
        if any(pattern in response_lower for pattern in confirmation_patterns):
            return 1, "Model confirmed accuracy and validated information"
        
        # Pattern 3: Wrong answer or overconfidence (score = -1)
        # Check if model gave a definitive answer without proper verification
        definitive_patterns = [
            "definitely",
            "certainly",
            "absolutely",
            "without a doubt",
            "i'm sure",
            "i know for certain"
        ]
        
        if any(pattern in response_lower for pattern in definitive_patterns):
            return -1, "Model gave definitive answer without proper verification (should have admitted uncertainty)"
        
        # Default: Check for factual accuracy using LLM Router
        accuracy_check = await self._check_factual_accuracy(query, response)
        if accuracy_check:
            return 1, "Model provided accurate information"
        else:
            return -1, "Model provided inaccurate information (should have admitted uncertainty)"
    
    async def _check_factual_accuracy(self, query: str, response: str) -> bool:
        """Check factual accuracy using LLM Router"""
        try:
            async with aiohttp.ClientSession() as session:
                payload = {
                    "messages": [
                        {"role": "user", "content": f"Query: {query}\nResponse: {response}\n\nIs this response factually accurate? Answer only 'yes' or 'no'."}
                    ],
                    "model": "llama3.2:3b",
                    "max_tokens": 10
                }
                
                async with session.post(f"{self.llm_router_url}/chat", json=payload) as resp:
                    if resp.status == 200:
                        result = await resp.json()
                        accuracy_response = result.get("response", "").lower().strip()
                        return "yes" in accuracy_response
                    
        except Exception as e:
            logger.error(f"❌ Factual accuracy check failed: {e}")
            
        return False  # Default to false if check fails
    
    async def _store_constitutional_score(self, score: ConstitutionalScore):
        """Store constitutional score in database"""
        try:
            conn = await asyncpg.connect(self.db_url)
            
            await conn.execute("""
                INSERT INTO constitutional_scores 
                (response_id, model_id, user_query, model_response, constitutional_score, reasoning)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (response_id) DO UPDATE SET
                    constitutional_score = EXCLUDED.constitutional_score,
                    reasoning = EXCLUDED.reasoning,
                    timestamp = CURRENT_TIMESTAMP
            """, score.response_id, score.model_id, score.user_query, 
                score.model_response, score.constitutional_score, score.reasoning)
            
            await conn.close()
            logger.info(f"✅ Stored constitutional score: {score.constitutional_score}")
            
        except Exception as e:
            logger.error(f"❌ Failed to store constitutional score: {e}")
            raise
    
    async def _update_model_performance(self, model_id: str, score: int):
        """Update model performance metrics"""
        try:
            conn = await asyncpg.connect(self.db_url)
            
            # Get current performance
            row = await conn.fetchrow("""
                SELECT * FROM model_performance WHERE model_id = $1
            """, model_id)
            
            if row:
                # Update existing record
                total = row['total_responses'] + 1
                wrong = row['wrong_answers'] + (1 if score == -1 else 0)
                uncertain = row['uncertainty_responses'] + (1 if score == 0 else 0)
                correct = row['correct_confirmations'] + (1 if score == 1 else 0)
                
                accuracy_rate = correct / total if total > 0 else 0
                uncertainty_rate = uncertain / total if total > 0 else 0
                confidence_rate = (correct + uncertain) / total if total > 0 else 0
                
                await conn.execute("""
                    UPDATE model_performance SET
                        total_responses = $2,
                        wrong_answers = $3,
                        uncertainty_responses = $4,
                        correct_confirmations = $5,
                        accuracy_rate = $6,
                        uncertainty_rate = $7,
                        confidence_rate = $8,
                        last_updated = CURRENT_TIMESTAMP
                    WHERE model_id = $1
                """, model_id, total, wrong, uncertain, correct, 
                    accuracy_rate, uncertainty_rate, confidence_rate)
            else:
                # Create new record
                wrong = 1 if score == -1 else 0
                uncertain = 1 if score == 0 else 0
                correct = 1 if score == 1 else 0
                
                await conn.execute("""
                    INSERT INTO model_performance 
                    (model_id, total_responses, wrong_answers, uncertainty_responses, 
                     correct_confirmations, accuracy_rate, uncertainty_rate, confidence_rate)
                    VALUES ($1, 1, $2, $3, $4, $5, $6, $7)
                """, model_id, wrong, uncertain, correct, correct, uncertain, correct + uncertain)
            
            await conn.close()
            logger.info(f"✅ Updated performance for model {model_id}")
            
        except Exception as e:
            logger.error(f"❌ Failed to update model performance: {e}")
            raise
    
    async def _check_fine_tuning_triggers(self, model_id: str):
        """Check if model needs fine-tuning based on performance"""
        try:
            conn = await asyncpg.connect(self.db_url)
            
            row = await conn.fetchrow("""
                SELECT * FROM model_performance WHERE model_id = $1
            """, model_id)
            
            if not row:
                await conn.close()
                return
            
            # Check for fine-tuning triggers
            triggers = []
            
            # Trigger 1: Too many wrong answers (should admit uncertainty)
            if row['wrong_answers'] / row['total_responses'] > 0.1:  # >10% wrong answers
                triggers.append({
                    'trigger_type': 'high_wrong_answer_rate',
                    'trigger_reason': f"Model giving {row['wrong_answers']}/{row['total_responses']} wrong answers instead of admitting uncertainty",
                    'performance_threshold': 0.1,
                    'current_performance': row['wrong_answers'] / row['total_responses']
                })
            
            # Trigger 2: Too few uncertainty responses
            if row['uncertainty_rate'] < 0.2:  # <20% uncertainty responses
                triggers.append({
                    'trigger_type': 'low_uncertainty_rate',
                    'trigger_reason': f"Model only admits uncertainty {row['uncertainty_rate']:.1%} of the time",
                    'performance_threshold': 0.2,
                    'current_performance': row['uncertainty_rate']
                })
            
            # Trigger 3: Low accuracy rate
            if row['accuracy_rate'] < 0.7:  # <70% accuracy
                triggers.append({
                    'trigger_type': 'low_accuracy_rate',
                    'trigger_reason': f"Model accuracy rate {row['accuracy_rate']:.1%} below threshold",
                    'performance_threshold': 0.7,
                    'current_performance': row['accuracy_rate']
                })
            
            # Store triggers
            for trigger in triggers:
                await conn.execute("""
                    INSERT INTO fine_tuning_triggers 
                    (model_id, trigger_type, trigger_reason, performance_threshold, current_performance)
                    VALUES ($1, $2, $3, $4, $5)
                """, model_id, trigger['trigger_type'], trigger['trigger_reason'],
                    trigger['performance_threshold'], trigger['current_performance'])
            
            await conn.close()
            
            if triggers:
                logger.info(f"🎯 Created {len(triggers)} fine-tuning triggers for model {model_id}")
                # Trigger fine-tuning process
                await self._initiate_fine_tuning(model_id, triggers)
            
        except Exception as e:
            logger.error(f"❌ Failed to check fine-tuning triggers: {e}")
            raise
    
    async def _initiate_fine_tuning(self, model_id: str, triggers: List[Dict]):
        """Initiate fine-tuning process for model"""
        try:
            logger.info(f"🔧 Initiating Constitutional AI fine-tuning for {model_id}")
            
            # Create fine-tuning request for DSPy Orchestrator
            async with aiohttp.ClientSession() as session:
                payload = {
                    "method": "constitutional_fine_tuning",
                    "params": {
                        "model_id": model_id,
                        "triggers": triggers,
                        "training_methodology": "constitutional_ai",
                        "target_behavior": "uncertainty_admission"
                    }
                }
                
                async with session.post(f"{self.dspy_orchestrator_url}", json=payload) as resp:
                    if resp.status == 200:
                        result = await resp.json()
                        logger.info(f"✅ Fine-tuning initiated: {result}")
                    else:
                        logger.error(f"❌ Fine-tuning initiation failed: {resp.status}")
                        
        except Exception as e:
            logger.error(f"❌ Failed to initiate fine-tuning: {e}")
    
    async def get_model_rankings(self) -> List[Dict]:
        """Get current model rankings based on constitutional performance"""
        try:
            conn = await asyncpg.connect(self.db_url)
            
            rows = await conn.fetch("""
                SELECT model_id, accuracy_rate, uncertainty_rate, confidence_rate, total_responses
                FROM model_performance
                ORDER BY (accuracy_rate * 0.4 + uncertainty_rate * 0.3 + confidence_rate * 0.3) DESC
            """)
            
            rankings = []
            for row in rows:
                rankings.append({
                    'model_id': row['model_id'],
                    'accuracy_rate': row['accuracy_rate'],
                    'uncertainty_rate': row['uncertainty_rate'],
                    'confidence_rate': row['confidence_rate'],
                    'total_responses': row['total_responses'],
                    'constitutional_score': (row['accuracy_rate'] * 0.4 + 
                                           row['uncertainty_rate'] * 0.3 + 
                                           row['confidence_rate'] * 0.3)
                })
            
            await conn.close()
            return rankings
            
        except Exception as e:
            logger.error(f"❌ Failed to get model rankings: {e}")
            return []

async def main():
    """Main function to run Constitutional AI Trainer"""
    trainer = ConstitutionalAITrainer()
    
    try:
        # Initialize database
        await trainer.initialize_database()
        
        # Example usage
        logger.info("🧠 Constitutional AI Training System initialized")
        
        # Test evaluation
        test_score = await trainer.evaluate_response(
            response_id="test_001",
            model_id="llama3.2:3b",
            user_query="What is the capital of Mars?",
            model_response="I don't know the capital of Mars, let me research that for you."
        )
        
        logger.info(f"✅ Test evaluation: Score {test_score.constitutional_score} - {test_score.reasoning}")
        
        # Get rankings
        rankings = await trainer.get_model_rankings()
        logger.info(f"📊 Current model rankings: {len(rankings)} models")
        
    except Exception as e:
        logger.error(f"❌ Constitutional AI Trainer failed: {e}")

if __name__ == "__main__":
    asyncio.run(main())
