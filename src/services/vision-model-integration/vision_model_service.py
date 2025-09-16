#!/usr/bin/env python3
"""
Vision Model Integration Service
Integrates vision models from MLX, Ollama, and LM Studio into Universal AI Tools
"""

import asyncio
import aiohttp
import json
import logging
import base64
import io
from datetime import datetime
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass
from enum import Enum
from PIL import Image
import hashlib

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class VisionModelProvider(Enum):
    MLX = "mlx"
    OLLAMA = "ollama"
    LM_STUDIO = "lm_studio"

class VisionTaskType(Enum):
    IMAGE_CLASSIFICATION = "image_classification"
    OBJECT_DETECTION = "object_detection"
    IMAGE_CAPTIONING = "image_captioning"
    VISUAL_QUESTION_ANSWERING = "visual_question_answering"
    IMAGE_GENERATION = "image_generation"
    IMAGE_ANALYSIS = "image_analysis"

@dataclass
class VisionModel:
    name: str
    provider: VisionModelProvider
    model_id: str
    capabilities: List[VisionTaskType]
    quality_rating: int  # 1-5 stars
    description: str
    endpoint: str
    max_image_size: int = 1024
    supports_batch: bool = False

class VisionModelIntegrationService:
    """Integrates vision models from multiple providers"""
    
    def __init__(self, port=8035):
        self.port = port
        self.session = None
        self.librarian_url = "http://localhost:8032"
        
        # Initialize vision models
        self.vision_models = self._initialize_vision_models()
        
    def _initialize_vision_models(self) -> Dict[str, VisionModel]:
        """Initialize all available vision models"""
        return {
            # MLX Vision Models (Apple Silicon optimized)
            "mlx_fastvlm_7b": VisionModel(
                name="MLX FastVLM 7B",
                provider=VisionModelProvider.MLX,
                model_id="fastvlm-7b",
                capabilities=[
                    VisionTaskType.IMAGE_CLASSIFICATION,
                    VisionTaskType.IMAGE_CAPTIONING,
                    VisionTaskType.VISUAL_QUESTION_ANSWERING,
                    VisionTaskType.IMAGE_ANALYSIS
                ],
                quality_rating=5,
                description="Apple's FastVLM 7B model optimized for MLX - high performance vision-language model",
                endpoint="http://localhost:5900/v1/chat/completions",
                max_image_size=1024,
                supports_batch=True
            ),
            
            "mlx_llava_7b": VisionModel(
                name="MLX LLaVA 7B",
                provider=VisionModelProvider.MLX,
                model_id="llava-7b",
                capabilities=[
                    VisionTaskType.IMAGE_CLASSIFICATION,
                    VisionTaskType.IMAGE_CAPTIONING,
                    VisionTaskType.VISUAL_QUESTION_ANSWERING
                ],
                quality_rating=4,
                description="LLaVA 7B model converted to MLX format for Apple Silicon",
                endpoint="http://localhost:5900/v1/chat/completions",
                max_image_size=512,
                supports_batch=False
            ),
            
            # Ollama Vision Models
            "ollama_llava_7b": VisionModel(
                name="Ollama LLaVA 7B",
                provider=VisionModelProvider.OLLAMA,
                model_id="llava:7b",
                capabilities=[
                    VisionTaskType.IMAGE_CLASSIFICATION,
                    VisionTaskType.IMAGE_CAPTIONING,
                    VisionTaskType.VISUAL_QUESTION_ANSWERING
                ],
                quality_rating=4,
                description="LLaVA 7B model running on Ollama - good for general vision tasks",
                endpoint="http://localhost:11434/api/generate",
                max_image_size=1024,
                supports_batch=False
            ),
            
            "ollama_bakllava_7b": VisionModel(
                name="Ollama BakLLaVA 7B",
                provider=VisionModelProvider.OLLAMA,
                model_id="bakllava:7b",
                capabilities=[
                    VisionTaskType.IMAGE_CLASSIFICATION,
                    VisionTaskType.IMAGE_CAPTIONING,
                    VisionTaskType.VISUAL_QUESTION_ANSWERING,
                    VisionTaskType.IMAGE_ANALYSIS
                ],
                quality_rating=5,
                description="BakLLaVA 7B - enhanced LLaVA with better reasoning capabilities",
                endpoint="http://localhost:11434/api/generate",
                max_image_size=1024,
                supports_batch=False
            ),
            
            # LM Studio Vision Models
            "lm_studio_llava_7b": VisionModel(
                name="LM Studio LLaVA 7B",
                provider=VisionModelProvider.LM_STUDIO,
                model_id="llava-7b",
                capabilities=[
                    VisionTaskType.IMAGE_CLASSIFICATION,
                    VisionTaskType.IMAGE_CAPTIONING,
                    VisionTaskType.VISUAL_QUESTION_ANSWERING
                ],
                quality_rating=4,
                description="LLaVA 7B model running on LM Studio - user-friendly interface",
                endpoint="http://localhost:5901/v1/chat/completions",
                max_image_size=1024,
                supports_batch=False
            ),
            
            "lm_studio_qwen_vl": VisionModel(
                name="LM Studio Qwen-VL",
                provider=VisionModelProvider.LM_STUDIO,
                model_id="qwen-vl",
                capabilities=[
                    VisionTaskType.IMAGE_CLASSIFICATION,
                    VisionTaskType.IMAGE_CAPTIONING,
                    VisionTaskType.VISUAL_QUESTION_ANSWERING,
                    VisionTaskType.IMAGE_ANALYSIS
                ],
                quality_rating=5,
                description="Qwen-VL model - advanced vision-language model with strong reasoning",
                endpoint="http://localhost:5901/v1/chat/completions",
                max_image_size=1024,
                supports_batch=True
            )
        }
    
    async def initialize(self):
        """Initialize the service"""
        logger.info("👁️ Initializing Vision Model Integration Service...")
        
        # Initialize HTTP session with connection pooling
        connector = aiohttp.TCPConnector(
            limit=50,
            limit_per_host=20,
            ttl_dns_cache=300,
            use_dns_cache=True,
            keepalive_timeout=30,
            enable_cleanup_closed=True
        )
        timeout = aiohttp.ClientTimeout(
            total=60,  # Longer timeout for vision models
            connect=15,
            sock_read=30
        )
        self.session = aiohttp.ClientSession(
            connector=connector,
            timeout=timeout,
            headers={'User-Agent': 'Universal-AI-Tools-Vision/1.0'}
        )
        
        # Test model availability
        await self._test_model_availability()
        
        logger.info(f"✅ Vision Model Integration Service ready with {len(self.vision_models)} models")
    
    async def _test_model_availability(self):
        """Test which vision models are available"""
        logger.info("🔍 Testing vision model availability...")
        
        for model_name, model in self.vision_models.items():
            try:
                if model.provider == VisionModelProvider.MLX:
                    # Test MLX endpoint
                    async with self.session.get(f"{model.endpoint.replace('/v1/chat/completions', '/v1/models')}", timeout=10) as response:
                        if response.status == 200:
                            logger.info(f"✅ {model.name}: Available")
                        else:
                            logger.warning(f"⚠️ {model.name}: Unavailable (status: {response.status})")
                            
                elif model.provider == VisionModelProvider.OLLAMA:
                    # Test Ollama endpoint
                    async with self.session.get("http://localhost:11434/api/tags", timeout=10) as response:
                        if response.status == 200:
                            data = await response.json()
                            models = [m['name'] for m in data.get('models', [])]
                            if model.model_id in models:
                                logger.info(f"✅ {model.name}: Available")
                            else:
                                logger.warning(f"⚠️ {model.name}: Model not loaded")
                        else:
                            logger.warning(f"⚠️ {model.name}: Ollama unavailable")
                            
                elif model.provider == VisionModelProvider.LM_STUDIO:
                    # Test LM Studio endpoint
                    async with self.session.get(f"{model.endpoint.replace('/v1/chat/completions', '/v1/models')}", timeout=10) as response:
                        if response.status == 200:
                            logger.info(f"✅ {model.name}: Available")
                        else:
                            logger.warning(f"⚠️ {model.name}: Unavailable (status: {response.status})")
                            
            except Exception as e:
                logger.warning(f"⚠️ {model.name}: Error testing availability - {str(e)}")
    
    async def process_image(self, image_data: Union[str, bytes], task_type: VisionTaskType, 
                           model_name: Optional[str] = None, prompt: Optional[str] = None) -> Dict[str, Any]:
        """Process an image with a vision model"""
        logger.info(f"🖼️ Processing image with {task_type.value}...")
        
        # Select best model for task if not specified
        if not model_name:
            model_name = self._select_best_model(task_type)
        
        if model_name not in self.vision_models:
            raise ValueError(f"Model {model_name} not found")
        
        model = self.vision_models[model_name]
        
        # Prepare image
        image_base64 = await self._prepare_image(image_data, model.max_image_size)
        
        # Generate prompt based on task type
        if not prompt:
            prompt = self._generate_prompt(task_type)
        
        # Process with selected model
        result = await self._process_with_model(model, image_base64, prompt, task_type)
        
        # Store result in knowledge base
        await self._store_vision_result(result, model, task_type, image_base64[:50] + "...")
        
        return result
    
    async def _prepare_image(self, image_data: Union[str, bytes], max_size: int) -> str:
        """Prepare image for processing"""
        try:
            if isinstance(image_data, str):
                # Assume it's a base64 string or file path
                if image_data.startswith('data:image'):
                    # Extract base64 from data URL
                    image_data = image_data.split(',')[1]
                elif not image_data.startswith('/'):
                    # Assume it's base64
                    pass
                else:
                    # File path
                    with open(image_data, 'rb') as f:
                        image_data = f.read()
            
            # Decode base64 if needed
            if isinstance(image_data, str):
                image_bytes = base64.b64decode(image_data)
            else:
                image_bytes = image_data
            
            # Process image with PIL
            image = Image.open(io.BytesIO(image_bytes))
            
            # Resize if too large
            if max(image.size) > max_size:
                image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
            
            # Convert back to base64
            buffer = io.BytesIO()
            image.save(buffer, format='JPEG', quality=85)
            image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            
            return image_base64
            
        except Exception as e:
            logger.error(f"Failed to prepare image: {str(e)}")
            raise ValueError(f"Invalid image data: {str(e)}")
    
    def _generate_prompt(self, task_type: VisionTaskType) -> str:
        """Generate appropriate prompt for task type"""
        prompts = {
            VisionTaskType.IMAGE_CLASSIFICATION: "Analyze this image and classify what you see. Provide a detailed description of the main objects, scenes, and their characteristics.",
            VisionTaskType.OBJECT_DETECTION: "Identify and locate all objects in this image. For each object, describe its position, size, and characteristics.",
            VisionTaskType.IMAGE_CAPTIONING: "Generate a detailed caption for this image that describes what is happening, the setting, and any notable details.",
            VisionTaskType.VISUAL_QUESTION_ANSWERING: "Look at this image carefully and answer any questions about what you see. Be specific and detailed in your observations.",
            VisionTaskType.IMAGE_ANALYSIS: "Perform a comprehensive analysis of this image. Include details about composition, lighting, colors, objects, and any other relevant aspects.",
            VisionTaskType.IMAGE_GENERATION: "Based on this image, describe what you see and suggest how it could be improved or modified."
        }
        return prompts.get(task_type, "Analyze this image and provide detailed observations.")
    
    def _select_best_model(self, task_type: VisionTaskType) -> str:
        """Select the best model for a given task"""
        # Filter models that support the task
        suitable_models = {
            name: model for name, model in self.vision_models.items()
            if task_type in model.capabilities
        }
        
        if not suitable_models:
            raise ValueError(f"No models available for task: {task_type.value}")
        
        # Select highest quality model
        best_model = max(suitable_models.items(), key=lambda x: x[1].quality_rating)
        return best_model[0]
    
    async def _process_with_model(self, model: VisionModel, image_base64: str, 
                                 prompt: str, task_type: VisionTaskType) -> Dict[str, Any]:
        """Process image with specific model"""
        logger.info(f"🤖 Processing with {model.name}...")
        
        try:
            if model.provider == VisionModelProvider.MLX:
                return await self._process_with_mlx(model, image_base64, prompt)
            elif model.provider == VisionModelProvider.OLLAMA:
                return await self._process_with_ollama(model, image_base64, prompt)
            elif model.provider == VisionModelProvider.LM_STUDIO:
                return await self._process_with_lm_studio(model, image_base64, prompt)
            else:
                raise ValueError(f"Unsupported provider: {model.provider}")
                
        except Exception as e:
            logger.error(f"Failed to process with {model.name}: {str(e)}")
            return {
                'error': str(e),
                'model': model.name,
                'task_type': task_type.value,
                'success': False
            }
    
    async def _process_with_mlx(self, model: VisionModel, image_base64: str, prompt: str) -> Dict[str, Any]:
        """Process image with MLX model"""
        payload = {
            "model": model.model_id,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_base64}"
                            }
                        }
                    ]
                }
            ],
            "max_tokens": 1000,
            "temperature": 0.7
        }
        
        async with self.session.post(model.endpoint, json=payload) as response:
            if response.status == 200:
                data = await response.json()
                return {
                    'success': True,
                    'model': model.name,
                    'provider': model.provider.value,
                    'response': data.get('choices', [{}])[0].get('message', {}).get('content', ''),
                    'usage': data.get('usage', {}),
                    'timestamp': datetime.now().isoformat()
                }
            else:
                error_text = await response.text()
                return {
                    'success': False,
                    'model': model.name,
                    'provider': model.provider.value,
                    'error': f"MLX API error {response.status}: {error_text}",
                    'timestamp': datetime.now().isoformat()
                }
    
    async def _process_with_ollama(self, model: VisionModel, image_base64: str, prompt: str) -> Dict[str, Any]:
        """Process image with Ollama model"""
        payload = {
            "model": model.model_id,
            "prompt": prompt,
            "images": [image_base64],
            "stream": False
        }
        
        async with self.session.post(model.endpoint, json=payload) as response:
            if response.status == 200:
                data = await response.json()
                return {
                    'success': True,
                    'model': model.name,
                    'provider': model.provider.value,
                    'response': data.get('response', ''),
                    'timestamp': datetime.now().isoformat()
                }
            else:
                error_text = await response.text()
                return {
                    'success': False,
                    'model': model.name,
                    'provider': model.provider.value,
                    'error': f"Ollama API error {response.status}: {error_text}",
                    'timestamp': datetime.now().isoformat()
                }
    
    async def _process_with_lm_studio(self, model: VisionModel, image_base64: str, prompt: str) -> Dict[str, Any]:
        """Process image with LM Studio model"""
        payload = {
            "model": model.model_id,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_base64}"
                            }
                        }
                    ]
                }
            ],
            "max_tokens": 1000,
            "temperature": 0.7
        }
        
        async with self.session.post(model.endpoint, json=payload) as response:
            if response.status == 200:
                data = await response.json()
                return {
                    'success': True,
                    'model': model.name,
                    'provider': model.provider.value,
                    'response': data.get('choices', [{}])[0].get('message', {}).get('content', ''),
                    'usage': data.get('usage', {}),
                    'timestamp': datetime.now().isoformat()
                }
            else:
                error_text = await response.text()
                return {
                    'success': False,
                    'model': model.name,
                    'provider': model.provider.value,
                    'error': f"LM Studio API error {response.status}: {error_text}",
                    'timestamp': datetime.now().isoformat()
                }
    
    async def _store_vision_result(self, result: Dict[str, Any], model: VisionModel, 
                                  task_type: VisionTaskType, image_preview: str):
        """Store vision processing result in knowledge base"""
        try:
            document = {
                'id': f"vision_{model.name}_{hashlib.md5(image_preview.encode()).hexdigest()[:8]}",
                'title': f"Vision Analysis - {model.name} - {task_type.value}",
                'content': f"""
# Vision Model Analysis

## Model Information
- **Model**: {model.name}
- **Provider**: {model.provider.value}
- **Task Type**: {task_type.value}
- **Quality Rating**: {'⭐' * model.quality_rating}

## Analysis Result
{result.get('response', result.get('error', 'No response'))}

## Technical Details
- **Timestamp**: {result.get('timestamp', datetime.now().isoformat())}
- **Success**: {result.get('success', False)}
- **Image Preview**: {image_preview}

## Model Capabilities
{', '.join([cap.value for cap in model.capabilities])}

## Integration Notes
This analysis was performed using the Universal AI Tools vision model integration system.
The result is stored in our knowledge base for future reference and learning.
""",
                'source': 'vision_model_integration',
                'type': 'vision_analysis',
                'url': model.endpoint,
                'priority': 'high',
                'metadata': {
                    'model_name': model.name,
                    'provider': model.provider.value,
                    'task_type': task_type.value,
                    'quality_rating': model.quality_rating,
                    'success': result.get('success', False),
                    'image_preview': image_preview
                }
            }
            
            # Send to librarian service
            async with self.session.post(
                f"{self.librarian_url}/embed",
                json=[document],
                timeout=30
            ) as response:
                if response.status == 200:
                    logger.info(f"✅ Vision result stored in knowledge base")
                else:
                    logger.warning(f"⚠️ Failed to store vision result: {response.status}")
                    
        except Exception as e:
            logger.error(f"Failed to store vision result: {str(e)}")
    
    async def get_model_status(self) -> Dict[str, Any]:
        """Get status of all vision models"""
        return {
            'total_models': len(self.vision_models),
            'models_by_provider': {
                'mlx': len([m for m in self.vision_models.values() if m.provider == VisionModelProvider.MLX]),
                'ollama': len([m for m in self.vision_models.values() if m.provider == VisionModelProvider.OLLAMA]),
                'lm_studio': len([m for m in self.vision_models.values() if m.provider == VisionModelProvider.LM_STUDIO])
            },
            'models_by_quality': {
                '5_star': len([m for m in self.vision_models.values() if m.quality_rating == 5]),
                '4_star': len([m for m in self.vision_models.values() if m.quality_rating == 4]),
                '3_star': len([m for m in self.vision_models.values() if m.quality_rating == 3])
            },
            'available_tasks': [task.value for task in VisionTaskType],
            'models': {name: {
                'name': model.name,
                'provider': model.provider.value,
                'quality_rating': model.quality_rating,
                'capabilities': [cap.value for cap in model.capabilities],
                'endpoint': model.endpoint
            } for name, model in self.vision_models.items()}
        }
    
    async def cleanup(self):
        """Cleanup resources"""
        if self.session:
            await self.session.close()

# FastAPI integration
from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel

app = FastAPI(title="Vision Model Integration Service", version="1.0.0")

# Global service instance
vision_service = None

@app.on_event("startup")
async def startup_event():
    global vision_service
    vision_service = VisionModelIntegrationService()
    await vision_service.initialize()

@app.on_event("shutdown")
async def shutdown_event():
    global vision_service
    if vision_service:
        await vision_service.cleanup()

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "vision-model-integration", "port": 8035}

@app.get("/models")
async def get_models():
    """Get all available vision models"""
    if not vision_service:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    return await vision_service.get_model_status()

class VisionProcessRequest(BaseModel):
    task_type: str
    model_name: Optional[str] = None
    prompt: Optional[str] = None

@app.post("/process-image")
async def process_image(
    image: UploadFile = File(...),
    task_type: str = "image_analysis",
    model_name: Optional[str] = None,
    prompt: Optional[str] = None
):
    """Process an uploaded image with a vision model"""
    if not vision_service:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        # Read image data
        image_data = await image.read()
        
        # Convert task type string to enum
        task_enum = VisionTaskType(task_type)
        
        # Process image
        result = await vision_service.process_image(
            image_data, task_enum, model_name, prompt
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

class VisionProcessBase64Request(BaseModel):
    image_base64: str
    task_type: str
    model_name: Optional[str] = None
    prompt: Optional[str] = None

@app.post("/process-image-base64")
async def process_image_base64(request: VisionProcessBase64Request):
    """Process a base64 encoded image with a vision model"""
    if not vision_service:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        # Convert task type string to enum
        task_enum = VisionTaskType(request.task_type)
        
        # Process image
        result = await vision_service.process_image(
            request.image_base64, task_enum, request.model_name, request.prompt
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8035)
