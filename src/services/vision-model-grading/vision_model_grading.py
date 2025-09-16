#!/usr/bin/env python3
"""
Vision Model Grading System
Implements constitutional AI training methodology for vision models (-1, 0, 1 scoring)
"""

import asyncio
import aiohttp
import hashlib
import json
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class VisionGrade(Enum):
    WRONG = -1  # Model gave incorrect answer
    UNCERTAIN = 0  # Model admitted uncertainty, needs research
    CORRECT = 1  # Model gave correct answer

@dataclass
class VisionGradingResult:
    model_name: str
    task_type: str
    grade: VisionGrade
    explanation: str
    confidence: float
    timestamp: str

class VisionModelGradingService:
    """Grades vision model responses using constitutional AI methodology"""
    
    def __init__(self, port=8036):
        self.port = port
        self.session = None
        self.vision_service_url = "http://localhost:8035"
        self.librarian_url = "http://localhost:8032"
        
        # Model rankings and performance tracking
        self.model_rankings = {}
        self.grading_history = []
        
    async def initialize(self):
        """Initialize the grading service"""
        logger.info("📊 Initializing Vision Model Grading Service...")
        
        # Initialize HTTP session
        connector = aiohttp.TCPConnector(
            limit=50,
            limit_per_host=20,
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
            headers={'User-Agent': 'Universal-AI-Tools-VisionGrading/1.0'}
        )
        
        # Initialize model rankings
        await self._initialize_model_rankings()
        
        logger.info("✅ Vision Model Grading Service ready")
    
    async def _initialize_model_rankings(self):
        """Initialize model rankings from knowledge base"""
        try:
            # Get vision models from vision service
            async with self.session.get(f"{self.vision_service_url}/models") as response:
                if response.status == 200:
                    data = await response.json()
                    models = data.get('models', {})
                    
                    # Initialize rankings
                    for model_name, model_info in models.items():
                        self.model_rankings[model_name] = {
                            'name': model_info['name'],
                            'provider': model_info['provider'],
                            'quality_rating': model_info['quality_rating'],
                            'total_grades': 0,
                            'correct_count': 0,
                            'uncertain_count': 0,
                            'wrong_count': 0,
                            'average_grade': 0.0,
                            'confidence_score': 0.0,
                            'last_updated': datetime.now().isoformat()
                        }
                    
                    logger.info(f"Initialized rankings for {len(self.model_rankings)} models")
                    
        except Exception as e:
            logger.error(f"Failed to initialize model rankings: {str(e)}")
    
    async def grade_vision_response(self, model_name: str, task_type: str, 
                                   response: str, expected_answer: Optional[str] = None,
                                   confidence: float = 0.5) -> VisionGradingResult:
        """Grade a vision model response using constitutional AI methodology"""
        logger.info(f"📊 Grading vision response from {model_name}...")
        
        # Analyze the response for constitutional AI patterns
        grade, explanation = await self._analyze_response(response, expected_answer, confidence)
        
        # Create grading result
        result = VisionGradingResult(
            model_name=model_name,
            task_type=task_type,
            grade=grade,
            explanation=explanation,
            confidence=confidence,
            timestamp=datetime.now().isoformat()
        )
        
        # Update model rankings
        await self._update_model_rankings(result)
        
        # Store in grading history
        self.grading_history.append(result)
        
        # Store in knowledge base
        await self._store_grading_result(result)
        
        logger.info(f"✅ Graded {model_name}: {grade.name} ({grade.value})")
        return result
    
    async def _analyze_response(self, response: str, expected_answer: Optional[str], 
                               confidence: float) -> tuple[VisionGrade, str]:
        """Analyze response for constitutional AI patterns"""
        
        # Check for uncertainty indicators
        uncertainty_phrases = [
            "i don't know", "i'm not sure", "i can't tell", "unclear", "uncertain",
            "let me research", "i need more information", "i'm not certain",
            "it's difficult to determine", "i cannot determine", "i'm unsure",
            "not entirely sure", "would need more context", "definitive answer"
        ]
        
        # Check for overconfident wrong patterns
        overconfident_phrases = [
            "definitely", "certainly", "absolutely", "without a doubt",
            "i'm certain", "i'm sure", "i know for sure", "no question"
        ]
        
        response_lower = response.lower()
        
        # Check for uncertainty (Grade 0) - prioritize this check
        if any(phrase in response_lower for phrase in uncertainty_phrases):
            return VisionGrade.UNCERTAIN, "Model properly admitted uncertainty and requested more information"
        
        # Check for overconfident responses with low confidence
        if confidence < 0.3 and any(phrase in response_lower for phrase in overconfident_phrases):
            return VisionGrade.WRONG, "Model gave overconfident answer despite low confidence"
        
        # Check against expected answer if provided
        if expected_answer:
            # Simple similarity check (in real implementation, use more sophisticated comparison)
            expected_lower = expected_answer.lower()
            response_words = set(response_lower.split())
            expected_words = set(expected_lower.split())
            
            # Calculate word overlap
            overlap = len(response_words.intersection(expected_words))
            total_words = len(expected_words)
            
            if total_words > 0:
                similarity = overlap / total_words
                if similarity > 0.7:
                    return VisionGrade.CORRECT, f"Response matches expected answer with {similarity:.2f} similarity"
                elif similarity > 0.3:
                    return VisionGrade.UNCERTAIN, f"Response partially matches expected answer ({similarity:.2f} similarity)"
                else:
                    return VisionGrade.WRONG, f"Response does not match expected answer ({similarity:.2f} similarity)"
        
        # Default grading based on confidence and response quality
        if confidence > 0.7 and len(response) > 50:
            return VisionGrade.CORRECT, "High confidence response with detailed analysis"
        elif confidence > 0.4:
            return VisionGrade.UNCERTAIN, "Medium confidence response, may need verification"
        else:
            return VisionGrade.WRONG, "Low confidence response, likely incorrect"
    
    async def _update_model_rankings(self, result: VisionGradingResult):
        """Update model rankings based on grading result"""
        if result.model_name not in self.model_rankings:
            self.model_rankings[result.model_name] = {
                'name': result.model_name,
                'provider': 'unknown',
                'quality_rating': 3,
                'total_grades': 0,
                'correct_count': 0,
                'uncertain_count': 0,
                'wrong_count': 0,
                'average_grade': 0.0,
                'confidence_score': 0.0,
                'last_updated': datetime.now().isoformat()
            }
        
        ranking = self.model_rankings[result.model_name]
        
        # Update counts
        ranking['total_grades'] += 1
        if result.grade == VisionGrade.CORRECT:
            ranking['correct_count'] += 1
        elif result.grade == VisionGrade.UNCERTAIN:
            ranking['uncertain_count'] += 1
        else:
            ranking['wrong_count'] += 1
        
        # Update average grade
        total_score = (ranking['correct_count'] * 1 + 
                      ranking['uncertain_count'] * 0 + 
                      ranking['wrong_count'] * -1)
        ranking['average_grade'] = total_score / ranking['total_grades']
        
        # Update confidence score
        ranking['confidence_score'] = result.confidence
        
        # Update timestamp
        ranking['last_updated'] = datetime.now().isoformat()
        
        logger.info(f"Updated rankings for {result.model_name}: {ranking['average_grade']:.2f} average")
    
    async def _store_grading_result(self, result: VisionGradingResult):
        """Store grading result in knowledge base"""
        try:
            document = {
                'id': f"vision_grading_{result.model_name}_{hashlib.md5(result.explanation.encode()).hexdigest()[:8]}",
                'title': f"Vision Model Grading - {result.model_name} - {result.grade.name}",
                'content': f"""
# Vision Model Grading Result

## Model Information
- **Model**: {result.model_name}
- **Task Type**: {result.task_type}
- **Grade**: {result.grade.name} ({result.grade.value})
- **Confidence**: {result.confidence:.2f}

## Explanation
{result.explanation}

## Constitutional AI Methodology
This grading follows the constitutional AI training methodology:
- **-1 (Wrong)**: Model gave incorrect answer
- **0 (Uncertain)**: Model admitted uncertainty, needs research
- **1 (Correct)**: Model gave correct answer

## Timestamp
{result.timestamp}

## Integration Notes
This grading result is stored in our knowledge base for continuous learning and model improvement.
The system uses this data to rank models and improve their performance over time.
""",
                'source': 'vision_model_grading',
                'type': 'grading_result',
                'url': f'vision_grading_{result.model_name}',
                'priority': 'high',
                'metadata': {
                    'model_name': result.model_name,
                    'task_type': result.task_type,
                    'grade': result.grade.value,
                    'grade_name': result.grade.name,
                    'confidence': result.confidence,
                    'timestamp': result.timestamp
                }
            }
            
            # Send to librarian service
            async with self.session.post(
                f"{self.librarian_url}/embed",
                json=[document],
                timeout=30
            ) as response:
                if response.status == 200:
                    logger.info(f"✅ Grading result stored in knowledge base")
                else:
                    logger.warning(f"⚠️ Failed to store grading result: {response.status}")
                    
        except Exception as e:
            logger.error(f"Failed to store grading result: {str(e)}")
    
    async def get_model_rankings(self) -> Dict[str, Any]:
        """Get current model rankings"""
        # Sort models by average grade
        sorted_models = sorted(
            self.model_rankings.items(),
            key=lambda x: x[1]['average_grade'],
            reverse=True
        )
        
        return {
            'total_models': len(self.model_rankings),
            'rankings': {
                name: {
                    'rank': i + 1,
                    'name': data['name'],
                    'provider': data['provider'],
                    'quality_rating': data['quality_rating'],
                    'total_grades': data['total_grades'],
                    'correct_count': data['correct_count'],
                    'uncertain_count': data['uncertain_count'],
                    'wrong_count': data['wrong_count'],
                    'average_grade': data['average_grade'],
                    'confidence_score': data['confidence_score'],
                    'last_updated': data['last_updated']
                }
                for i, (name, data) in enumerate(sorted_models)
            },
            'grading_history_count': len(self.grading_history),
            'timestamp': datetime.now().isoformat()
        }
    
    async def get_grading_statistics(self) -> Dict[str, Any]:
        """Get grading statistics"""
        if not self.grading_history:
            return {'message': 'No grading history available'}
        
        total_grades = len(self.grading_history)
        correct_count = sum(1 for g in self.grading_history if g.grade == VisionGrade.CORRECT)
        uncertain_count = sum(1 for g in self.grading_history if g.grade == VisionGrade.UNCERTAIN)
        wrong_count = sum(1 for g in self.grading_history if g.grade == VisionGrade.WRONG)
        
        return {
            'total_grades': total_grades,
            'correct_percentage': (correct_count / total_grades) * 100,
            'uncertain_percentage': (uncertain_count / total_grades) * 100,
            'wrong_percentage': (wrong_count / total_grades) * 100,
            'average_confidence': sum(g.confidence for g in self.grading_history) / total_grades,
            'recent_grades': [
                {
                    'model_name': g.model_name,
                    'grade': g.grade.name,
                    'confidence': g.confidence,
                    'timestamp': g.timestamp
                }
                for g in self.grading_history[-10:]  # Last 10 grades
            ]
        }
    
    async def cleanup(self):
        """Cleanup resources"""
        if self.session:
            await self.session.close()

# FastAPI integration
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Vision Model Grading Service", version="1.0.0")

# Global service instance
grading_service = None

@app.on_event("startup")
async def startup_event():
    global grading_service
    grading_service = VisionModelGradingService()
    await grading_service.initialize()

@app.on_event("shutdown")
async def shutdown_event():
    global grading_service
    if grading_service:
        await grading_service.cleanup()

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "vision-model-grading", "port": 8036}

@app.get("/rankings")
async def get_rankings():
    """Get current model rankings"""
    if not grading_service:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    return await grading_service.get_model_rankings()

@app.get("/statistics")
async def get_statistics():
    """Get grading statistics"""
    if not grading_service:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    return await grading_service.get_grading_statistics()

class VisionGradingRequest(BaseModel):
    model_name: str
    task_type: str
    response: str
    expected_answer: Optional[str] = None
    confidence: float = 0.5

@app.post("/grade")
async def grade_response(request: VisionGradingRequest):
    """Grade a vision model response"""
    if not grading_service:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    result = await grading_service.grade_vision_response(
        request.model_name,
        request.task_type,
        request.response,
        request.expected_answer,
        request.confidence
    )
    
    return {
        'model_name': result.model_name,
        'task_type': result.task_type,
        'grade': result.grade.value,
        'grade_name': result.grade.name,
        'explanation': result.explanation,
        'confidence': result.confidence,
        'timestamp': result.timestamp
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8036)
