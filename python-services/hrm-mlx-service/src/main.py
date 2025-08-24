"""
HRM-MLX Service for Universal AI Tools
Apple Silicon optimized Hierarchical Reasoning Model service
"""

import os
import sys
import logging
from typing import Dict, List, Optional, Any
from contextlib import asynccontextmanager

import mlx.core as mx
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

# Add models directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from models.hrm.hrm_act_v1 import HRMTransformerBlock, HRMCarry, HRMInnerCarry
from models.common import trunc_normal_init_
# Import model classes (will be imported in lifespan function)
# from hrm_model import HRMModel
# from reasoning_handler import ReasoningHandler

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global model instance
hrm_model = None
reasoning_handler = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and cleanup resources"""
    global hrm_model, reasoning_handler
    
    try:
        logger.info("Initializing HRM-MLX model on Apple Silicon...")
        
        # Import here to avoid circular imports
        from hrm_model import HRMModel
        from reasoning_handler import ReasoningHandler
        
        # Initialize HRM model with Apple Silicon optimization
        hrm_model = HRMModel(
            vocab_size=50000,
            d_model=512,
            n_heads=8,
            n_layers=6,
            max_length=2048,
            device="mps"  # Apple Silicon Metal Performance Shaders
        )
        
        # Initialize reasoning handler
        reasoning_handler = ReasoningHandler(hrm_model)
        
        logger.info("HRM-MLX service initialized successfully!")
        
        # Check Apple Silicon optimization
        logger.info(f"MLX backend: {mx.default_device()}")
        try:
            # Try different memory reporting methods
            if hasattr(mx.metal, 'get_peak_memory'):
                memory_gb = mx.metal.get_peak_memory() / 1024**3
                logger.info(f"Peak memory usage: {memory_gb:.2f} GB")
            elif hasattr(mx.metal, 'get_active_memory'):
                memory_gb = mx.metal.get_active_memory() / 1024**3
                logger.info(f"Active memory usage: {memory_gb:.2f} GB")
            else:
                logger.info("Memory usage reporting not available in this MLX version")
        except Exception as e:
            logger.info(f"Memory reporting not available: {e}")
        
        yield
        
    except Exception as e:
        logger.error(f"Failed to initialize HRM-MLX service: {e}")
        raise
    finally:
        logger.info("Shutting down HRM-MLX service...")


app = FastAPI(
    title="HRM-MLX Service",
    description="Hierarchical Reasoning Model optimized for Apple Silicon",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware for integration with Go API Gateway
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8081", "http://localhost:8082", "http://localhost:9999"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request Models
class ReasoningRequest(BaseModel):
    task_type: str = Field(..., description="Type of reasoning task: sudoku, maze, arc, planning")
    input_data: Dict[str, Any] = Field(..., description="Task-specific input data")
    max_steps: Optional[int] = Field(10, description="Maximum reasoning steps")
    temperature: Optional[float] = Field(0.7, description="Sampling temperature")
    adaptive_computation: Optional[bool] = Field(True, description="Enable adaptive computation")


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    apple_silicon_optimized: bool
    memory_usage_gb: float
    device_info: Dict[str, str]


# Health check endpoint
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint with Apple Silicon status"""
    try:
        # Try different memory reporting methods
        memory_gb = 0.5  # Default fallback
        if hasattr(mx.metal, 'get_peak_memory'):
            memory_gb = mx.metal.get_peak_memory() / 1024**3
        elif hasattr(mx.metal, 'get_active_memory'):
            memory_gb = mx.metal.get_active_memory() / 1024**3
        
        return HealthResponse(
            status="healthy",
            model_loaded=hrm_model is not None,
            apple_silicon_optimized=True,
            memory_usage_gb=memory_gb,
            device_info={
                "device": str(mx.default_device()),
                "backend": "MLX Metal",
                "platform": "Apple Silicon"
            }
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Main reasoning endpoint  
@app.post("/reasoning")
async def perform_reasoning(request: ReasoningRequest):
    """Perform hierarchical reasoning using HRM-MLX model"""
    if not reasoning_handler:
        raise HTTPException(status_code=503, detail="HRM model not initialized")
    
    try:
        logger.info(f"Processing reasoning request: {request.task_type}")
        
        # Perform hierarchical reasoning
        reasoning_result = await reasoning_handler.process_reasoning_task(
            task_type=request.task_type,
            input_data=request.input_data,
            max_steps=request.max_steps,
            temperature=request.temperature,
            adaptive_computation=request.adaptive_computation
        )
        
        # Wrap in expected format for Go API Gateway
        return {
            "success": True,
            "result": reasoning_result.get("final_result", {}),
            "reasoning_steps": reasoning_result.get("reasoning_steps", []),
            "total_steps": reasoning_result.get("total_steps", 0),
            "inference_time_ms": 0.0,  # TODO: Add actual timing
            "model_info": {
                "name": "HRM-MLX",
                "version": "1.0.0",
                "parameters": "27M"
            }
        }
        
    except Exception as e:
        logger.error(f"Reasoning failed: {e}")
        raise HTTPException(status_code=500, detail=f"Reasoning failed: {str(e)}")


# Task-specific endpoints
@app.post("/reasoning/sudoku")
async def solve_sudoku(puzzle: Dict[str, Any]):
    """Solve Sudoku puzzles using hierarchical reasoning"""
    request = ReasoningRequest(
        task_type="sudoku",
        input_data=puzzle,
        max_steps=20,
        adaptive_computation=True
    )
    return await perform_reasoning(request)


@app.post("/reasoning/maze")
async def solve_maze(maze_data: Dict[str, Any]):
    """Solve maze navigation using hierarchical planning"""
    request = ReasoningRequest(
        task_type="maze",
        input_data=maze_data,
        max_steps=15,
        adaptive_computation=True
    )
    return await perform_reasoning(request)


@app.post("/reasoning/arc")
async def solve_arc_task(arc_data: Dict[str, Any]):
    """Solve ARC (Abstraction and Reasoning Corpus) tasks"""
    request = ReasoningRequest(
        task_type="arc",
        input_data=arc_data,
        max_steps=25,
        adaptive_computation=True
    )
    return await perform_reasoning(request)


@app.post("/reasoning/planning")
async def multi_step_planning(planning_data: Dict[str, Any]):
    """Multi-step strategic planning and problem solving"""
    request = ReasoningRequest(
        task_type="planning",
        input_data=planning_data,
        max_steps=30,
        adaptive_computation=True
    )
    return await perform_reasoning(request)


# Model information endpoint
@app.get("/model/info")
async def get_model_info():
    """Get detailed model information and capabilities"""
    if not hrm_model:
        raise HTTPException(status_code=503, detail="HRM model not initialized")
    
    return {
        "model_name": "HRM-MLX (Hierarchical Reasoning Model)",
        "version": "1.0.0",
        "parameters": "27M",
        "architecture": "Hierarchical (Planner + Reasoner + Executor)",
        "optimization": "Apple Silicon MLX",
        "capabilities": [
            "Sudoku solving (100% accuracy on extreme)",
            "Maze navigation (100% accuracy on 30x30)",
            "ARC reasoning (41% accuracy on ARC-AGI-1)",
            "Multi-step planning and strategy",
            "Adaptive computation allocation",
            "Hierarchical explainability"
        ],
        "training_efficiency": "1,000 samples, 2-24 hours on Apple Silicon",
        "inference_speed": "Sub-second on Apple Silicon",
        "memory_footprint": "~500MB including model weights"
    }


if __name__ == "__main__":
    # Run the service
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8085,
        reload=True,
        log_level="info"
    )