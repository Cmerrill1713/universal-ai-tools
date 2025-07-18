#!/usr/bin/env python3
"""
MIPROv2 Optimization Examples
Demonstrates various optimization scenarios for the knowledge management system
"""

import asyncio
import json
import websockets
from typing import List, Dict, Any
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class OptimizationExamples:
    """Examples of using MIPROv2 optimization with the DSPy server."""
    
    def __init__(self, server_url: str = "ws://localhost:8765"):
        self.server_url = server_url
        self.request_id_counter = 0
    
    def _get_request_id(self) -> str:
        """Generate unique request ID."""
        self.request_id_counter += 1
        return f"example-{self.request_id_counter}"
    
    async def example_knowledge_extraction(self, websocket):
        """Example: Extract knowledge with MIPROv2 optimization."""
        logger.info("Running knowledge extraction example...")
        
        # Extract knowledge from technical content
        request = {
            "requestId": self._get_request_id(),
            "method": "manage_knowledge",
            "params": {
                "operation": "extract",
                "data": {
                    "content": """
                    MIPROv2 is a powerful optimization algorithm for prompt engineering.
                    Key features include:
                    1. Multi-prompt optimization across different temperature settings
                    2. Automatic hyperparameter tuning
                    3. Continuous learning from successful operations
                    4. Performance metrics tracking with confidence scores
                    
                    Best practices:
                    - Start with diverse training examples
                    - Use at least 10 iterations for initial optimization
                    - Monitor confidence scores to track improvement
                    - Leverage continuous learning after 100 operations
                    """,
                    "context": {
                        "type": "best_practice",
                        "domain": "ai_optimization",
                        "tags": ["MIPROv2", "optimization", "prompt_engineering"]
                    }
                }
            }
        }
        
        await websocket.send(json.dumps(request))
        response = json.loads(await websocket.recv())
        
        if response["success"]:
            result = response["data"]
            logger.info("Extraction successful!")
            logger.info(f"Confidence: {result.get('confidence', 0):.2f}")
            logger.info(f"Key concepts: {result.get('key_concepts', [])}")
            logger.info(f"Relationships: {result.get('relationships', [])}")
        else:
            logger.error(f"Extraction failed: {response.get('error')}")
        
        return response
    
    async def example_knowledge_search(self, websocket):
        """Example: Search knowledge with semantic understanding."""
        logger.info("Running knowledge search example...")
        
        # Search for optimization techniques
        request = {
            "requestId": self._get_request_id(),
            "method": "manage_knowledge",
            "params": {
                "operation": "search",
                "data": {
                    "query": "How to improve prompt optimization with continuous learning?",
                    "context": {
                        "type": ["best_practice", "pattern"],
                        "tags": ["optimization", "learning"],
                        "min_confidence": 0.7
                    }
                }
            }
        }
        
        await websocket.send(json.dumps(request))
        response = json.loads(await websocket.recv())
        
        if response["success"]:
            result = response["data"]
            logger.info("Search successful!")
            logger.info(f"Search strategy: {result.get('search_strategy', 'unknown')}")
            logger.info(f"Confidence: {result.get('confidence', 0):.2f}")
            logger.info(f"Found {len(result.get('relevant_items', []))} relevant items")
            
            # Show search metrics
            if "metrics" in result:
                metrics = result["metrics"]
                logger.info(f"Total searches: {metrics.get('total_searches', 0)}")
                logger.info(f"Success rate: {metrics.get('successful_searches', 0) / max(1, metrics.get('total_searches', 1)) * 100:.1f}%")
        else:
            logger.error(f"Search failed: {response.get('error')}")
        
        return response
    
    async def example_knowledge_evolution(self, websocket):
        """Example: Evolve knowledge with new information."""
        logger.info("Running knowledge evolution example...")
        
        # Evolve existing knowledge
        request = {
            "requestId": self._get_request_id(),
            "method": "manage_knowledge",
            "params": {
                "operation": "evolve",
                "data": {
                    "existing": {
                        "algorithm": "MIPROv2",
                        "features": ["multi-prompt", "hyperparameter tuning"],
                        "performance": {"baseline": 0.75}
                    },
                    "new_info": {
                        "features": ["continuous learning", "adaptive optimization"],
                        "performance": {"optimized": 0.92, "improvement": "23%"},
                        "best_practices": ["use diverse examples", "monitor metrics"]
                    },
                    "context": {
                        "source": "benchmark_results",
                        "reliability": 0.95
                    }
                }
            }
        }
        
        await websocket.send(json.dumps(request))
        response = json.loads(await websocket.recv())
        
        if response["success"]:
            result = response["data"]
            logger.info("Evolution successful!")
            logger.info(f"Evolution confidence: {result.get('confidence', 0):.2f}")
            logger.info(f"Changes summary: {result.get('changes_summary', 'N/A')}")
            logger.info(f"Evolved knowledge: {json.dumps(result.get('evolved_knowledge', {}), indent=2)}")
        else:
            logger.error(f"Evolution failed: {response.get('error')}")
        
        return response
    
    async def example_knowledge_validation(self, websocket):
        """Example: Validate knowledge for consistency."""
        logger.info("Running knowledge validation example...")
        
        # Validate a knowledge item
        request = {
            "requestId": self._get_request_id(),
            "method": "manage_knowledge",
            "params": {
                "operation": "validate",
                "data": {
                    "knowledge": {
                        "type": "solution",
                        "title": "MIPROv2 Optimization Guide",
                        "description": "Comprehensive guide for implementing MIPROv2",
                        "content": {
                            "algorithm": "MIPROv2",
                            "requirements": ["DSPy", "training examples"],
                            "benefits": ["improved accuracy", "faster convergence"],
                            "implementation_steps": [
                                "Configure DSPy settings",
                                "Prepare training examples",
                                "Initialize optimizer",
                                "Run optimization",
                                "Monitor metrics"
                            ]
                        },
                        "confidence": 0.95,
                        "tags": ["MIPROv2", "optimization", "guide"]
                    },
                    "context": {
                        "required_fields": ["type", "title", "content"],
                        "min_confidence": 0.8,
                        "domain_rules": ["must include implementation steps"]
                    }
                }
            }
        }
        
        await websocket.send(json.dumps(request))
        response = json.loads(await websocket.recv())
        
        if response["success"]:
            result = response["data"]
            logger.info("Validation completed!")
            logger.info(f"Is valid: {result.get('is_valid', False)}")
            logger.info(f"Validation score: {result.get('validation_score', 0):.2f}")
            
            if result.get("issues"):
                logger.warning(f"Issues found: {result['issues']}")
            
            if result.get("suggestions"):
                logger.info(f"Improvement suggestions: {result['suggestions']}")
            
            # Show validation stats
            if "stats" in result:
                stats = result["stats"]
                logger.info(f"Total validations: {stats.get('total_validations', 0)}")
                logger.info(f"Valid items rate: {stats.get('valid_items', 0) / max(1, stats.get('total_validations', 1)) * 100:.1f}%")
        else:
            logger.error(f"Validation failed: {response.get('error')}")
        
        return response
    
    async def example_module_optimization(self, websocket):
        """Example: Optimize knowledge modules with training examples."""
        logger.info("Running module optimization example...")
        
        # Prepare training examples
        training_examples = [
            {
                "raw_content": "Implement caching to improve performance by 50%",
                "context": {"type": "performance", "domain": "optimization"},
                "expected_concepts": ["caching", "performance improvement"]
            },
            {
                "query": "Best practices for error handling",
                "search_context": {"type": ["error", "best_practice"]},
                "expected_relevance": 0.9
            },
            {
                "knowledge_item": {
                    "type": "pattern",
                    "title": "Circuit Breaker Pattern",
                    "content": {"pattern": "circuit_breaker", "benefits": ["fault tolerance"]}
                },
                "validation_context": {"required_fields": ["type", "title", "content"]},
                "expected_valid": True
            }
        ]
        
        # Request optimization
        request = {
            "requestId": self._get_request_id(),
            "method": "optimize_knowledge_modules",
            "params": {
                "examples": training_examples,
                "iterations": 5  # Fewer iterations for demo
            }
        }
        
        await websocket.send(json.dumps(request))
        response = json.loads(await websocket.recv())
        
        if response["success"]:
            result = response["data"]
            logger.info("Module optimization successful!")
            logger.info(f"Success: {result.get('success', False)}")
            logger.info(f"Optimized modules: {json.dumps(result.get('results', {}), indent=2)}")
            logger.info(f"Performance improvement: {result.get('performance_improvement', 0):.2%}")
        else:
            logger.error(f"Optimization failed: {response.get('error')}")
        
        return response
    
    async def example_get_metrics(self, websocket):
        """Example: Get optimization metrics."""
        logger.info("Getting optimization metrics...")
        
        request = {
            "requestId": self._get_request_id(),
            "method": "get_optimization_metrics",
            "params": {}
        }
        
        await websocket.send(json.dumps(request))
        response = json.loads(await websocket.recv())
        
        if response["success"]:
            metrics = response["data"]
            logger.info("Metrics retrieved successfully!")
            
            # Display extractor metrics
            if "extractor" in metrics:
                logger.info("\nExtractor Metrics:")
                logger.info(f"  History length: {metrics['extractor'].get('history_length', 0)}")
                if metrics['extractor'].get('latest'):
                    latest = metrics['extractor']['latest']
                    logger.info(f"  Latest confidence: {latest.get('confidence', 0):.2f}")
                    logger.info(f"  Latest extraction time: {latest.get('extraction_time', 0):.3f}s")
            
            # Display searcher metrics
            if "searcher" in metrics:
                logger.info("\nSearcher Metrics:")
                searcher = metrics['searcher']
                logger.info(f"  Total searches: {searcher.get('total_searches', 0)}")
                logger.info(f"  Average confidence: {searcher.get('average_confidence', 0):.2f}")
                logger.info(f"  Successful searches: {searcher.get('successful_searches', 0)}")
            
            # Display validator metrics
            if "validator" in metrics:
                logger.info("\nValidator Metrics:")
                validator = metrics['validator']
                logger.info(f"  Total validations: {validator.get('total_validations', 0)}")
                logger.info(f"  Valid items: {validator.get('valid_items', 0)}")
                logger.info(f"  Average score: {validator.get('average_score', 0):.2f}")
            
            # Display overall performance
            logger.info(f"\nBest performance: {metrics.get('best_performance', 0):.2f}")
            logger.info(f"Optimization count: {metrics.get('optimization_count', 0)}")
        else:
            logger.error(f"Failed to get metrics: {response.get('error')}")
        
        return response
    
    async def run_all_examples(self):
        """Run all optimization examples."""
        async with websockets.connect(self.server_url) as websocket:
            logger.info("Connected to DSPy server")
            
            # Run examples in sequence
            await self.example_knowledge_extraction(websocket)
            await asyncio.sleep(1)
            
            await self.example_knowledge_search(websocket)
            await asyncio.sleep(1)
            
            await self.example_knowledge_evolution(websocket)
            await asyncio.sleep(1)
            
            await self.example_knowledge_validation(websocket)
            await asyncio.sleep(1)
            
            await self.example_module_optimization(websocket)
            await asyncio.sleep(1)
            
            await self.example_get_metrics(websocket)
            
            logger.info("\nAll examples completed!")


async def main():
    """Run the optimization examples."""
    examples = OptimizationExamples()
    
    try:
        await examples.run_all_examples()
    except Exception as e:
        logger.error(f"Error running examples: {e}")
        logger.info("Make sure the DSPy server is running on ws://localhost:8765")


if __name__ == "__main__":
    asyncio.run(main())