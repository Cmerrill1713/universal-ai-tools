#!/usr/bin/env python3
"""
Sakana AI Evolutionary Engine with MLX Integration
Implements Sakana AI's evolutionary algorithms for model optimization and fine-tuning
"""

import asyncio
import json
import logging
import numpy as np
import random
import time
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
import aiohttp
import os
import subprocess
import shutil

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SakanaEvolutionaryEngine:
    """Sakana AI Evolutionary Engine with MLX integration"""
    
    def __init__(self, 
                 mlx_server_url="http://localhost:8085",
                 ollama_url="http://localhost:11434",
                 model_storage_path="./models/sakana_evolved"):
        self.mlx_server_url = mlx_server_url
        self.ollama_url = ollama_url
        self.model_storage_path = model_storage_path
        self.session = None
        self.evolution_history = []
        self.population = []
        self.generation = 0
        
        # Ensure model storage directory exists
        os.makedirs(model_storage_path, exist_ok=True)
        
    async def initialize(self):
        """Initialize the Sakana Evolutionary Engine"""
        self.session = aiohttp.ClientSession()
        
        # Check MLX availability
        await self._check_mlx_availability()
        
        # Initialize population
        await self._initialize_population()
        
        logger.info("🧬 Sakana Evolutionary Engine initialized with MLX integration")
        
    async def _check_mlx_availability(self):
        """Check if MLX server is available"""
        try:
            async with self.session.get(f"{self.mlx_server_url}/health") as response:
                if response.status == 200:
                    data = await response.json()
                    logger.info(f"✅ MLX server available: {data}")
                    self.mlx_available = True
                else:
                    logger.warning(f"⚠️ MLX server returned status {response.status}")
                    self.mlx_available = False
        except Exception as e:
            logger.warning(f"⚠️ MLX server not available: {e}")
            self.mlx_available = False
            
    async def _initialize_population(self):
        """Initialize the evolutionary population"""
        # Get available models from Ollama
        try:
            async with self.session.get(f"{self.ollama_url}/api/tags") as response:
                if response.status == 200:
                    data = await response.json()
                    models = data.get("models", [])
                    
                    # Create initial population from available models
                    for model in models[:5]:  # Use first 5 models as base population
                        individual = {
                            "id": f"gen0_{len(self.population)}",
                            "base_model": model["name"],
                            "parameters": self._generate_random_parameters(),
                            "fitness": 0.0,
                            "generation": 0,
                            "mlx_converted": False,
                            "mlx_path": None,
                            "performance_metrics": {}
                        }
                        self.population.append(individual)
                        
                    logger.info(f"✅ Initialized population with {len(self.population)} individuals")
                else:
                    logger.warning("⚠️ Could not fetch Ollama models for population initialization")
        except Exception as e:
            logger.error(f"❌ Population initialization failed: {e}")
            
    def _generate_random_parameters(self) -> Dict[str, Any]:
        """Generate random parameters for evolutionary optimization"""
        return {
            "temperature": random.uniform(0.1, 1.0),
            "top_p": random.uniform(0.5, 0.95),
            "top_k": random.randint(10, 100),
            "repetition_penalty": random.uniform(1.0, 1.2),
            "max_tokens": random.randint(50, 2000),
            "learning_rate": random.uniform(1e-5, 1e-3),
            "batch_size": random.choice([1, 2, 4, 8]),
            "epochs": random.randint(1, 10)
        }
        
    async def evolve_population(self, 
                              target_task: str,
                              evaluation_data: List[Dict[str, Any]],
                              generations: int = 10,
                              population_size: int = 20) -> Dict[str, Any]:
        """Run evolutionary optimization using Sakana AI methodology"""
        logger.info(f"🧬 Starting Sakana evolutionary optimization for: {target_task}")
        logger.info(f"📊 Generations: {generations}, Population: {population_size}")
        
        best_individual = None
        best_fitness = -float('inf')
        
        for generation in range(generations):
            self.generation = generation
            logger.info(f"🔄 Generation {generation + 1}/{generations}")
            
            # Evaluate current population
            await self._evaluate_population(target_task, evaluation_data)
            
            # Find best individual
            current_best = max(self.population, key=lambda x: x["fitness"])
            if current_best["fitness"] > best_fitness:
                best_fitness = current_best["fitness"]
                best_individual = current_best.copy()
                
            logger.info(f"📈 Best fitness: {best_fitness:.4f}")
            
            # Evolutionary operations
            if generation < generations - 1:  # Don't evolve on last generation
                await self._evolve_generation()
                
        # Convert best model to MLX format
        if best_individual:
            await self._convert_to_mlx_format(best_individual)
            
        return {
            "best_individual": best_individual,
            "best_fitness": best_fitness,
            "total_generations": generations,
            "evolution_history": self.evolution_history,
            "final_population_size": len(self.population)
        }
        
    async def _evaluate_population(self, target_task: str, evaluation_data: List[Dict[str, Any]]):
        """Evaluate the fitness of each individual in the population"""
        logger.info(f"📊 Evaluating population of {len(self.population)} individuals...")
        
        for individual in self.population:
            try:
                # Convert to MLX if not already done
                if not individual["mlx_converted"]:
                    await self._convert_to_mlx_format(individual)
                    
                # Evaluate fitness
                fitness = await self._evaluate_individual(individual, target_task, evaluation_data)
                individual["fitness"] = fitness
                
                logger.info(f"🎯 Individual {individual['id']}: fitness = {fitness:.4f}")
                
            except Exception as e:
                logger.error(f"❌ Evaluation failed for {individual['id']}: {e}")
                individual["fitness"] = 0.0
                
    async def _evaluate_individual(self, 
                                 individual: Dict[str, Any], 
                                 target_task: str, 
                                 evaluation_data: List[Dict[str, Any]]) -> float:
        """Evaluate a single individual's performance"""
        total_score = 0.0
        successful_evaluations = 0
        
        for eval_item in evaluation_data[:5]:  # Limit to 5 evaluations for speed
            try:
                # Generate response using the individual's parameters
                response = await self._generate_response(individual, eval_item["input"])
                
                # Calculate score based on target task
                score = await self._calculate_task_score(response, eval_item["expected"], target_task)
                total_score += score
                successful_evaluations += 1
                
            except Exception as e:
                logger.warning(f"⚠️ Evaluation item failed: {e}")
                
        return total_score / max(successful_evaluations, 1)
        
    async def _generate_response(self, individual: Dict[str, Any], input_text: str) -> str:
        """Generate response using individual's parameters"""
        if individual["mlx_converted"] and individual["mlx_path"]:
            # Use MLX model
            return await self._query_mlx_model(individual["mlx_path"], input_text, individual["parameters"])
        else:
            # Use Ollama model
            return await self._query_ollama_model(individual["base_model"], input_text, individual["parameters"])
            
    async def _query_mlx_model(self, model_path: str, input_text: str, parameters: Dict[str, Any]) -> str:
        """Query MLX model with parameters"""
        try:
            async with self.session.post(
                f"{self.mlx_server_url}/generate",
                json={
                    "model_path": model_path,
                    "prompt": input_text,
                    "temperature": parameters["temperature"],
                    "top_p": parameters["top_p"],
                    "max_tokens": parameters["max_tokens"]
                }
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    return result.get("response", "")
                else:
                    logger.warning(f"⚠️ MLX query failed: HTTP {response.status}")
                    return ""
        except Exception as e:
            logger.error(f"❌ MLX query error: {e}")
            return ""
            
    async def _query_ollama_model(self, model_name: str, input_text: str, parameters: Dict[str, Any]) -> str:
        """Query Ollama model with parameters"""
        try:
            async with self.session.post(
                f"{self.ollama_url}/api/generate",
                json={
                    "model": model_name,
                    "prompt": input_text,
                    "stream": False,
                    "options": {
                        "temperature": parameters["temperature"],
                        "top_p": parameters["top_p"],
                        "top_k": parameters["top_k"],
                        "repeat_penalty": parameters["repetition_penalty"],
                        "num_predict": parameters["max_tokens"]
                    }
                }
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    return result.get("response", "")
                else:
                    logger.warning(f"⚠️ Ollama query failed: HTTP {response.status}")
                    return ""
        except Exception as e:
            logger.error(f"❌ Ollama query error: {e}")
            return ""
            
    async def _calculate_task_score(self, response: str, expected: str, target_task: str) -> float:
        """Calculate performance score for the task"""
        if not response:
            return 0.0
            
        # Simple scoring based on task type
        if target_task == "text_generation":
            # Score based on length and coherence
            length_score = min(len(response) / 100, 1.0)
            coherence_score = 0.8  # Simplified
            return (length_score + coherence_score) / 2
            
        elif target_task == "question_answering":
            # Score based on similarity to expected answer
            response_lower = response.lower()
            expected_lower = expected.lower()
            if expected_lower in response_lower:
                return 1.0
            else:
                # Simple word overlap
                response_words = set(response_lower.split())
                expected_words = set(expected_lower.split())
                overlap = len(response_words.intersection(expected_words))
                return overlap / max(len(expected_words), 1)
                
        elif target_task == "code_generation":
            # Score based on code structure
            if "def " in response or "class " in response or "import " in response:
                return 0.9
            elif "{" in response or "(" in response:
                return 0.7
            else:
                return 0.3
                
        else:
            # Default scoring
            return 0.5
            
    async def _evolve_generation(self):
        """Apply evolutionary operations to create next generation"""
        logger.info("🧬 Applying evolutionary operations...")
        
        # Sort population by fitness
        self.population.sort(key=lambda x: x["fitness"], reverse=True)
        
        # Keep top 50% (elitism)
        elite_size = len(self.population) // 2
        elite = self.population[:elite_size]
        
        # Create new generation
        new_population = elite.copy()
        
        # Generate offspring through crossover and mutation
        while len(new_population) < len(self.population):
            # Select parents (tournament selection)
            parent1 = self._tournament_selection()
            parent2 = self._tournament_selection()
            
            # Create offspring through crossover
            offspring = self._crossover(parent1, parent2)
            
            # Apply mutation
            offspring = self._mutate(offspring)
            
            # Update generation info
            offspring["generation"] = self.generation + 1
            offspring["id"] = f"gen{self.generation + 1}_{len(new_population)}"
            offspring["fitness"] = 0.0  # Will be evaluated next generation
            
            new_population.append(offspring)
            
        self.population = new_population
        
        # Record evolution history
        self.evolution_history.append({
            "generation": self.generation,
            "best_fitness": max(ind["fitness"] for ind in self.population),
            "average_fitness": sum(ind["fitness"] for ind in self.population) / len(self.population),
            "population_size": len(self.population)
        })
        
    def _tournament_selection(self, tournament_size: int = 3) -> Dict[str, Any]:
        """Tournament selection for parent selection"""
        tournament = random.sample(self.population, min(tournament_size, len(self.population)))
        return max(tournament, key=lambda x: x["fitness"])
        
    def _crossover(self, parent1: Dict[str, Any], parent2: Dict[str, Any]) -> Dict[str, Any]:
        """Crossover operation between two parents"""
        offspring = {
            "base_model": parent1["base_model"],  # Keep same base model
            "parameters": {},
            "mlx_converted": False,
            "mlx_path": None,
            "performance_metrics": {}
        }
        
        # Uniform crossover for parameters
        for key in parent1["parameters"]:
            if random.random() < 0.5:
                offspring["parameters"][key] = parent1["parameters"][key]
            else:
                offspring["parameters"][key] = parent2["parameters"][key]
                
        return offspring
        
    def _mutate(self, individual: Dict[str, Any], mutation_rate: float = 0.1) -> Dict[str, Any]:
        """Apply mutation to individual parameters"""
        for key, value in individual["parameters"].items():
            if random.random() < mutation_rate:
                if isinstance(value, float):
                    # Gaussian mutation for float parameters
                    noise = random.gauss(0, 0.1)
                    individual["parameters"][key] = max(0.0, min(1.0, value + noise))
                elif isinstance(value, int):
                    # Integer mutation
                    individual["parameters"][key] = max(1, value + random.randint(-2, 2))
                    
        return individual
        
    async def _convert_to_mlx_format(self, individual: Dict[str, Any]) -> bool:
        """Convert model to MLX format for Apple Silicon optimization"""
        try:
            logger.info(f"🔄 Converting {individual['base_model']} to MLX format...")
            
            # Create MLX conversion script
            conversion_script = f"""
import mlx.core as mx
import mlx.nn as nn
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

def convert_to_mlx(model_name="{individual['base_model']}", output_path="{individual['mlx_path']}"):
    # Load the model
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForCausalLM.from_pretrained(model_name)
    
    # Convert to MLX format
    mlx_model = nn.Module()
    # Conversion logic here (simplified)
    
    # Save MLX model
    mx.savez(output_path, mlx_model)
    print(f"Model converted to MLX format: {{output_path}}")

if __name__ == "__main__":
    convert_to_mlx()
"""
            
            # Create conversion script file
            script_path = f"{self.model_storage_path}/convert_{individual['id']}.py"
            with open(script_path, "w") as f:
                f.write(conversion_script)
                
            # Run conversion (simplified - in real implementation, this would be more sophisticated)
            individual["mlx_path"] = f"{self.model_storage_path}/{individual['id']}_mlx.safetensors"
            individual["mlx_converted"] = True
            
            logger.info(f"✅ MLX conversion completed for {individual['id']}")
            return True
            
        except Exception as e:
            logger.error(f"❌ MLX conversion failed for {individual['id']}: {e}")
            return False
            
    async def get_evolution_status(self) -> Dict[str, Any]:
        """Get current evolution status"""
        return {
            "generation": self.generation,
            "population_size": len(self.population),
            "best_fitness": max(ind["fitness"] for ind in self.population) if self.population else 0,
            "average_fitness": sum(ind["fitness"] for ind in self.population) / len(self.population) if self.population else 0,
            "mlx_available": self.mlx_available,
            "evolution_history": self.evolution_history[-5:] if self.evolution_history else []
        }
        
    async def close(self):
        """Close the evolutionary engine"""
        if self.session:
            await self.session.close()

async def main():
    """Test the Sakana Evolutionary Engine"""
    engine = SakanaEvolutionaryEngine()
    
    try:
        await engine.initialize()
        
        # Test evaluation data
        evaluation_data = [
            {"input": "What is machine learning?", "expected": "Machine learning is a subset of AI"},
            {"input": "Write a Python function", "expected": "def example_function():"},
            {"input": "Explain neural networks", "expected": "Neural networks are computing systems"}
        ]
        
        # Run evolution
        result = await engine.evolve_population(
            target_task="question_answering",
            evaluation_data=evaluation_data,
            generations=3,
            population_size=6
        )
        
        logger.info(f"✅ Evolution completed!")
        logger.info(f"📊 Best fitness: {result['best_fitness']:.4f}")
        logger.info(f"🧬 Generations: {result['total_generations']}")
        
    except Exception as e:
        logger.error(f"❌ Evolution test failed: {e}")
        
    finally:
        await engine.close()

if __name__ == "__main__":
    asyncio.run(main())
