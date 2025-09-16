#!/usr/bin/env python3
"""
Model Load Balancer Service
Intelligently rotates between AI services to prevent overloading
"""

import asyncio
import aiohttp
import json
import logging
import time
import random
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
from collections import deque

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ServiceType(Enum):
    OLLAMA = "ollama"
    MLX = "mlx"
    LM_STUDIO = "lm_studio"
    DSPY = "dspy"

class LoadBalanceStrategy(Enum):
    ROUND_ROBIN = "round_robin"
    LEAST_CONNECTIONS = "least_connections"
    WEIGHTED_ROUND_ROBIN = "weighted_round_robin"
    RANDOM = "random"
    HEALTH_BASED = "health_based"

@dataclass
class ModelService:
    name: str
    service_type: ServiceType
    base_url: str
    models: List[str]
    weight: int = 1
    max_concurrent: int = 10
    current_connections: int = 0
    health_score: float = 1.0
    last_used: float = 0
    response_time_avg: float = 0.0
    error_count: int = 0
    success_count: int = 0

class ModelLoadBalancer:
    """Intelligent load balancer for AI model services"""
    
    def __init__(self, port=8037):
        self.port = port
        self.services: Dict[str, ModelService] = {}
        self.strategy = LoadBalanceStrategy.HEALTH_BASED
        self.session = None
        self.round_robin_index = 0
        self.service_rotation_queue = deque()
        
        # Initialize all AI services
        self._initialize_services()
        
    def _initialize_services(self):
        """Initialize all available AI services"""
        self.services = {
            "ollama": ModelService(
                name="Ollama",
                service_type=ServiceType.OLLAMA,
                base_url="http://localhost:11434",
                models=["llama3.2:3b", "llama3.2:1b", "gemma2:2b"],
                weight=3,
                max_concurrent=5
            ),
            "mlx": ModelService(
                name="MLX (Apple Silicon)",
                service_type=ServiceType.MLX,
                base_url="http://localhost:5902",
                models=["mlx_fastvlm_7b", "mlx_llava", "mlx_qwen"],
                weight=2,
                max_concurrent=3
            ),
            "lm_studio": ModelService(
                name="LM Studio",
                service_type=ServiceType.LM_STUDIO,
                base_url="http://localhost:5901",
                models=["llama3.2:3b", "gemma2:2b", "qwen2.5:3b"],
                weight=2,
                max_concurrent=4
            ),
            "dspy": ModelService(
                name="DSPy Orchestrator",
                service_type=ServiceType.DSPY,
                base_url="http://localhost:8767",
                models=["dspy_mipro2", "dspy_sokona"],
                weight=1,
                max_concurrent=2
            )
        }
        
        # Initialize rotation queue
        self.service_rotation_queue = deque(self.services.keys())
        
    async def initialize(self):
        """Initialize the load balancer"""
        logger.info("🔄 Initializing Model Load Balancer...")
        
        # Create HTTP session with connection pooling
        connector = aiohttp.TCPConnector(
            limit=100,
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
            headers={'User-Agent': 'Universal-AI-Tools-LoadBalancer/1.0'}
        )
        
        # Health check all services
        await self._health_check_all_services()
        
        logger.info(f"✅ Model Load Balancer ready with {len(self.services)} services")
    
    async def _health_check_all_services(self):
        """Check health of all services"""
        logger.info("🔍 Checking health of all AI services...")
        
        for service_name, service in self.services.items():
            try:
                start_time = time.time()
                
                if service.service_type == ServiceType.OLLAMA:
                    # Check Ollama models endpoint
                    async with self.session.get(f"{service.base_url}/api/tags", timeout=5) as response:
                        if response.status == 200:
                            data = await response.json()
                            service.models = [model['name'] for model in data.get('models', [])]
                            service.health_score = 1.0
                            service.error_count = 0
                            service.success_count += 1
                        else:
                            service.health_score = 0.5
                            service.error_count += 1
                            
                elif service.service_type == ServiceType.MLX:
                    # Check MLX proxy health
                    async with self.session.get(f"{service.base_url}/health", timeout=5) as response:
                        if response.status == 200:
                            service.health_score = 1.0
                            service.error_count = 0
                            service.success_count += 1
                        else:
                            service.health_score = 0.3
                            service.error_count += 1
                            
                elif service.service_type == ServiceType.LM_STUDIO:
                    # Check LM Studio proxy health
                    async with self.session.get(f"{service.base_url}/health", timeout=5) as response:
                        if response.status == 200:
                            service.health_score = 1.0
                            service.error_count = 0
                            service.success_count += 1
                        else:
                            service.health_score = 0.3
                            service.error_count += 1
                            
                elif service.service_type == ServiceType.DSPY:
                    # Check DSPy models endpoint
                    async with self.session.get(f"{service.base_url}/models", timeout=5) as response:
                        if response.status == 200:
                            service.health_score = 1.0
                            service.error_count = 0
                            service.success_count += 1
                        else:
                            service.health_score = 0.7
                            service.error_count += 1
                
                # Update response time
                response_time = time.time() - start_time
                service.response_time_avg = (service.response_time_avg * 0.8) + (response_time * 0.2)
                
                logger.info(f"✅ {service.name}: Health {service.health_score:.2f}, Models: {len(service.models)}")
                
            except Exception as e:
                logger.warning(f"⚠️ {service.name}: Health check failed - {str(e)}")
                service.health_score = 0.1
                service.error_count += 1
    
    def _select_service(self, preferred_model: Optional[str] = None) -> Tuple[str, ModelService]:
        """Select the best service based on strategy"""
        
        # Filter services by health and availability
        available_services = {
            name: service for name, service in self.services.items()
            if service.health_score > 0.1 and service.current_connections < service.max_concurrent
        }
        
        if not available_services:
            # Fallback to any service if none are available
            available_services = self.services
        
        if self.strategy == LoadBalanceStrategy.ROUND_ROBIN:
            return self._round_robin_selection(available_services)
        elif self.strategy == LoadBalanceStrategy.LEAST_CONNECTIONS:
            return self._least_connections_selection(available_services)
        elif self.strategy == LoadBalanceStrategy.WEIGHTED_ROUND_ROBIN:
            return self._weighted_round_robin_selection(available_services)
        elif self.strategy == LoadBalanceStrategy.RANDOM:
            return self._random_selection(available_services)
        elif self.strategy == LoadBalanceStrategy.HEALTH_BASED:
            return self._health_based_selection(available_services, preferred_model)
        else:
            return self._health_based_selection(available_services, preferred_model)
    
    def _round_robin_selection(self, available_services: Dict[str, ModelService]) -> Tuple[str, ModelService]:
        """Round robin selection"""
        service_names = list(available_services.keys())
        if not service_names:
            return list(self.services.items())[0]
        
        service_name = service_names[self.round_robin_index % len(service_names)]
        self.round_robin_index += 1
        return service_name, available_services[service_name]
    
    def _least_connections_selection(self, available_services: Dict[str, ModelService]) -> Tuple[str, ModelService]:
        """Select service with least connections"""
        if not available_services:
            return list(self.services.items())[0]
        
        service_name = min(available_services.keys(), 
                          key=lambda x: available_services[x].current_connections)
        return service_name, available_services[service_name]
    
    def _weighted_round_robin_selection(self, available_services: Dict[str, ModelService]) -> Tuple[str, ModelService]:
        """Weighted round robin based on service weights"""
        if not available_services:
            return list(self.services.items())[0]
        
        # Create weighted list
        weighted_services = []
        for name, service in available_services.items():
            weighted_services.extend([name] * service.weight)
        
        if not weighted_services:
            return list(available_services.items())[0]
        
        service_name = weighted_services[self.round_robin_index % len(weighted_services)]
        self.round_robin_index += 1
        return service_name, available_services[service_name]
    
    def _random_selection(self, available_services: Dict[str, ModelService]) -> Tuple[str, ModelService]:
        """Random selection"""
        if not available_services:
            return list(self.services.items())[0]
        
        service_name = random.choice(list(available_services.keys()))
        return service_name, available_services[service_name]
    
    def _health_based_selection(self, available_services: Dict[str, ModelService], 
                                preferred_model: Optional[str] = None) -> Tuple[str, ModelService]:
        """Select based on health score and model availability"""
        if not available_services:
            return list(self.services.items())[0]
        
        # Score each service
        scored_services = []
        for name, service in available_services.items():
            score = service.health_score
            
            # Bonus for preferred model
            if preferred_model and preferred_model in service.models:
                score += 0.3
            
            # Penalty for high response time
            if service.response_time_avg > 2.0:
                score -= 0.2
            
            # Bonus for low error rate
            total_requests = service.error_count + service.success_count
            if total_requests > 0:
                error_rate = service.error_count / total_requests
                score += (1.0 - error_rate) * 0.2
            
            scored_services.append((score, name, service))
        
        # Sort by score (highest first)
        scored_services.sort(reverse=True)
        
        return scored_services[0][1], scored_services[0][2]
    
    async def generate_text(self, prompt: str, model: Optional[str] = None, 
                          max_tokens: int = 1000, temperature: float = 0.7) -> Dict[str, Any]:
        """Generate text using load-balanced service selection"""
        
        # Select best service
        service_name, service = self._select_service(model)
        
        # Increment connection count
        service.current_connections += 1
        service.last_used = time.time()
        
        try:
            logger.info(f"🔄 Using {service.name} for text generation...")
            
            if service.service_type == ServiceType.OLLAMA:
                return await self._generate_with_ollama(service, prompt, model, max_tokens, temperature)
            elif service.service_type == ServiceType.MLX:
                return await self._generate_with_mlx(service, prompt, model, max_tokens, temperature)
            elif service.service_type == ServiceType.LM_STUDIO:
                return await self._generate_with_lm_studio(service, prompt, model, max_tokens, temperature)
            elif service.service_type == ServiceType.DSPY:
                return await self._generate_with_dspy(service, prompt, model, max_tokens, temperature)
            else:
                raise ValueError(f"Unsupported service type: {service.service_type}")
                
        except Exception as e:
            logger.error(f"❌ Generation failed with {service.name}: {str(e)}")
            service.error_count += 1
            service.health_score = max(0.1, service.health_score - 0.1)
            raise
        finally:
            # Decrement connection count
            service.current_connections = max(0, service.current_connections - 1)
    
    async def _generate_with_ollama(self, service: ModelService, prompt: str, 
                                   model: Optional[str], max_tokens: int, temperature: float) -> Dict[str, Any]:
        """Generate text using Ollama"""
        model_name = model or service.models[0] if service.models else "llama3.2:3b"
        
        payload = {
            "model": model_name,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens
            }
        }
        
        async with self.session.post(f"{service.base_url}/api/generate", 
                                   json=payload, timeout=60) as response:
            if response.status == 200:
                data = await response.json()
                service.success_count += 1
                return {
                    "text": data.get("response", ""),
                    "model": model_name,
                    "service": service.name,
                    "tokens_used": data.get("eval_count", 0),
                    "generation_time": data.get("total_duration", 0) / 1e9
                }
            else:
                raise Exception(f"Ollama API error: {response.status}")
    
    async def _generate_with_mlx(self, service: ModelService, prompt: str, 
                                model: Optional[str], max_tokens: int, temperature: float) -> Dict[str, Any]:
        """Generate text using MLX"""
        model_name = model or service.models[0] if service.models else "mlx_fastvlm_7b"
        
        payload = {
            "prompt": prompt,
            "model": model_name,
            "max_tokens": max_tokens,
            "temperature": temperature
        }
        
        async with self.session.post(f"{service.base_url}/generate", 
                                   json=payload, timeout=60) as response:
            if response.status == 200:
                data = await response.json()
                service.success_count += 1
                return {
                    "text": data.get("text", ""),
                    "model": model_name,
                    "service": service.name,
                    "tokens_used": data.get("tokens_used", 0),
                    "generation_time": data.get("generation_time", 0)
                }
            else:
                raise Exception(f"MLX API error: {response.status}")
    
    async def _generate_with_lm_studio(self, service: ModelService, prompt: str, 
                                     model: Optional[str], max_tokens: int, temperature: float) -> Dict[str, Any]:
        """Generate text using LM Studio"""
        model_name = model or service.models[0] if service.models else "llama3.2:3b"
        
        payload = {
            "model": model_name,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
            "temperature": temperature
        }
        
        async with self.session.post(f"{service.base_url}/generate", 
                                   json=payload, timeout=60) as response:
            if response.status == 200:
                data = await response.json()
                service.success_count += 1
                return {
                    "text": data.get("text", ""),
                    "model": model_name,
                    "service": service.name,
                    "tokens_used": data.get("tokens_used", 0),
                    "generation_time": data.get("generation_time", 0)
                }
            else:
                raise Exception(f"LM Studio API error: {response.status}")
    
    async def _generate_with_dspy(self, service: ModelService, prompt: str, 
                                 model: Optional[str], max_tokens: int, temperature: float) -> Dict[str, Any]:
        """Generate text using DSPy"""
        model_name = model or service.models[0] if service.models else "dspy_mipro2"
        
        payload = {
            "prompt": prompt,
            "model": model_name,
            "max_tokens": max_tokens,
            "temperature": temperature
        }
        
        async with self.session.post(f"{service.base_url}/generate", 
                                   json=payload, timeout=60) as response:
            if response.status == 200:
                data = await response.json()
                service.success_count += 1
                return {
                    "text": data.get("response", ""),
                    "model": model_name,
                    "service": service.name,
                    "tokens_used": data.get("tokens_used", 0),
                    "generation_time": data.get("generation_time", 0)
                }
            else:
                raise Exception(f"DSPy API error: {response.status}")
    
    async def get_service_status(self) -> Dict[str, Any]:
        """Get status of all services"""
        await self._health_check_all_services()
        
        status = {
            "total_services": len(self.services),
            "available_services": sum(1 for s in self.services.values() if s.health_score > 0.1),
            "strategy": self.strategy.value,
            "services": {}
        }
        
        for name, service in self.services.items():
            status["services"][name] = {
                "name": service.name,
                "type": service.service_type.value,
                "health_score": service.health_score,
                "models": service.models,
                "current_connections": service.current_connections,
                "max_concurrent": service.max_concurrent,
                "response_time_avg": service.response_time_avg,
                "error_count": service.error_count,
                "success_count": service.success_count,
                "last_used": service.last_used
            }
        
        return status
    
    async def cleanup(self):
        """Cleanup resources"""
        if self.session:
            await self.session.close()

# FastAPI application
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel

app = FastAPI(
    title="Model Load Balancer Service",
    description="Intelligent load balancer for AI model services",
    version="1.0.0",
)

# Global service instance
load_balancer = None

class GenerationRequest(BaseModel):
    prompt: str
    model: Optional[str] = None
    max_tokens: int = 1000
    temperature: float = 0.7

class GenerationResponse(BaseModel):
    text: str
    model: str
    service: str
    tokens_used: int
    generation_time: float

@app.on_event("startup")
async def startup_event():
    global load_balancer
    load_balancer = ModelLoadBalancer(port=8037)
    await load_balancer.initialize()

@app.on_event("shutdown")
async def shutdown_event():
    global load_balancer
    if load_balancer:
        await load_balancer.cleanup()

@app.get("/health", summary="Health Check")
async def health_check():
    """Check the health of the load balancer"""
    if not load_balancer:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    status = await load_balancer.get_service_status()
    return {
        "status": "healthy",
        "message": "Model Load Balancer is running",
        "services": status
    }

@app.post("/generate", summary="Generate Text", response_model=GenerationResponse)
async def generate_text(request: GenerationRequest):
    """Generate text using load-balanced service selection"""
    if not load_balancer:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        result = await load_balancer.generate_text(
            prompt=request.prompt,
            model=request.model,
            max_tokens=request.max_tokens,
            temperature=request.temperature
        )
        return GenerationResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/services", summary="Get Service Status")
async def get_services():
    """Get detailed status of all AI services"""
    if not load_balancer:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    return await load_balancer.get_service_status()

@app.post("/health-check", summary="Force Health Check")
async def force_health_check():
    """Force a health check of all services"""
    if not load_balancer:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    await load_balancer._health_check_all_services()
    return {"message": "Health check completed"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8037)
