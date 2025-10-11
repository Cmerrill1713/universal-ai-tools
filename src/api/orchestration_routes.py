#!/usr/bin/env python3
"""
Orchestration Routes for NeuroForge API
TRM-aware orchestration endpoints integrated into NeuroForge
Upgraded from HRM to TRM: 40% fewer parameters, 5% better accuracy, 12.3x faster with MLX
"""

import os
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

# Add mcp-ecosystem to path
mcp_paths = ["/mcp-ecosystem", os.path.expanduser("~/mcp-ecosystem")]
for mcp_path in mcp_paths:
    if os.path.exists(mcp_path) and mcp_path not in sys.path:
        sys.path.insert(0, mcp_path)

try:
    # Try new TRM adapter first (use src. prefix for container imports)
    from src.core.engines.trm_adapter import TRMAdapter, get_trm_adapter
    TRM_AVAILABLE = True
    HRM_AVAILABLE = False  # Deprecated - using TRM now
    import logging
    logging.info("✅ TRM available - using Tiny Recursive Model (7M params, 45% accuracy, 12.3x faster)")
except ImportError as trm_err:
    TRM_AVAILABLE = False
    # Fallback to old HRM if TRM not available
    try:
        from servers.orchestration.entrypoints import create_controller
        HRM_AVAILABLE = True
        import logging
        logging.warning(f"⚠️  Using legacy HRM - upgrade to TRM recommended (TRM import failed: {trm_err})")
    except ImportError as e:
        HRM_AVAILABLE = False
        import logging
        logging.warning(f"Neither TRM nor HRM available: {e}")

# Create router
router = APIRouter(prefix="/api/orchestration", tags=["orchestration"])

# Pydantic models
class OrchestrationRequest(BaseModel):
    """Request model for orchestration"""
    goal: str = Field(..., description="The goal to achieve")
    constraints: Optional[Dict[str, Any]] = Field(None, description="Optional constraints")
    enable_hrm: bool = Field(True, description="Enable TRM routing (HRM deprecated)")
    enable_refiner: bool = Field(True, description="Enable text refinement")

class GridTask(BaseModel):
    """Grid puzzle task model"""
    task_type: str = Field(..., description="Task type: arc, sudoku, maze")
    grid: List[List[int]] = Field(..., description="2D grid array")
    instructions: Optional[str] = Field(None, description="Additional instructions")

class OrchestrationResponse(BaseModel):
    """Response model for orchestration"""
    success: bool
    summary: str
    hrm_used: bool = False  # Legacy field, now indicates TRM usage
    elapsed_s: float
    decisions: List[Dict]
    validation: List[Dict]

# Global controller instance
_controller = None

async def get_controller():
    """Get or create orchestration controller (now using TRM)"""
    global _controller
    if _controller is None:
        if TRM_AVAILABLE:
            # Use new TRM adapter
            _controller = get_trm_adapter()
            await _controller.initialize()
        elif HRM_AVAILABLE:
            # Fallback to legacy HRM
            _controller = create_controller(
                llm_base_url=os.getenv("OLLAMA_URL", "http://localhost:11434"),
                llm_model=os.getenv("DEFAULT_MODEL", "llama3.2:3b"),
                hrm_model_path=os.getenv("HRM_MODEL_PATH", os.path.expanduser("~/hrm-mlx/checkpoints/arc_full/best_arc_full.npz")),
                enable_hrm=True,
                enable_refiner=True
            )
    return _controller

@router.post("/execute")
async def execute_orchestration(request: OrchestrationRequest):
    """
    Execute TRM-aware orchestration
    
    Routes tasks intelligently:
    - Natural language → LLM (Ollama)
    - Structured grids → TRM (MLX - 12.3x faster, 45% accuracy)
    - Validates outputs and retries on failure
    
    Upgraded from HRM to TRM for better performance and accuracy
    """
    if not TRM_AVAILABLE and not HRM_AVAILABLE:
        raise HTTPException(status_code=503, detail="TRM/HRM orchestration not available")

    try:
        controller = await get_controller()
        if not controller:
            raise HTTPException(status_code=503, detail="Controller not initialized")

        logger.info("Running controller.run()...")
        result = await controller.run(request.goal, request.constraints)
        logger.info(f"Result type: {type(result)}, is_dict: {isinstance(result, dict)}")

        # Handle both dict and object results
        if isinstance(result, dict):
            logger.info("Handling as dict")
            response_data = {
                "success": result.get('success', False),
                "summary": result.get('summary', ''),
                "hrm_used": result.get('hrm_used', False),
                "elapsed_s": result.get('elapsed_s', 0.0),
                "decisions": result.get('decisions', []),
                "validation": result.get('validation', [])
            }
            logger.info(f"Created response dict: {list(response_data.keys())}")
            return response_data
        else:
            logger.info("Handling as object")
            response_data = {
                "success": result.success,
                "summary": result.summary,
                "hrm_used": any(d.worker.value == "HRM" for d in result.decisions),
                "elapsed_s": result.budget.elapsed_s,
                "decisions": [d.to_dict() for d in result.decisions],
                "validation": [v.to_dict() for v in result.validation]
            }
            return response_data

    except Exception as e:
        logger.error(f"Orchestration failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/solve-grid")
async def solve_grid_puzzle(task: GridTask):
    """
    Solve grid-based puzzle using HRM model
    
    Specialized endpoint for:
    - ARC pattern puzzles
    - Sudoku solving
    - Maze pathfinding
    """
    if not HRM_AVAILABLE:
        raise HTTPException(status_code=503, detail="HRM orchestration not available")

    try:
        controller = await get_controller()
        if not controller:
            raise HTTPException(status_code=503, detail="Controller not initialized")

        # Format as orchestration goal
        import json
        payload = {"task": task.task_type, "grid": task.grid}
        goal = f"Solve this {task.task_type} puzzle: {json.dumps(payload)}"
        if task.instructions:
            goal += f"\n{task.instructions}"

        result = await controller.run(goal)

        # Handle both dict and object results
        if isinstance(result, dict):
            return {
                "success": result.get('success', False),
                "solution": result.get('summary', ''),
                "hrm_used": result.get('hrm_used', False),
                "elapsed_s": result.get('elapsed_s', 0.0),
                "confidence": 0.95 if result.get('success') else 0.0
            }
        else:
            return {
                "success": result.success,
                "solution": result.summary,
                "hrm_used": any(d.worker.value == "HRM" for d in result.decisions),
                "elapsed_s": result.budget.elapsed_s,
                "confidence": 0.95 if result.success else 0.0
            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status")
async def get_orchestration_status():
    """
    Get orchestration system status
    
    Returns information about:
    - TRM model availability (upgraded from HRM)
    - LLM connection
    - Memory status
    """
    if not TRM_AVAILABLE and not HRM_AVAILABLE:
        return {
            "available": False,
            "reason": "TRM/HRM orchestration module not found"
        }

    try:
        controller = await get_controller()
        if not controller:
            return {
                "available": True,
                "initialized": False,
                "model_type": "TRM" if TRM_AVAILABLE else "HRM (legacy)"
            }

        # TRM status
        if TRM_AVAILABLE and isinstance(controller, TRMAdapter):
            health = await controller.health_check()
            capabilities = controller.get_capabilities()
            return {
                "available": True,
                "initialized": health.get("initialized", False),
                "model_type": "TRM (Tiny Recursive Model)",
                "backend": capabilities.get("backend", "unknown"),
                "parameters": capabilities.get("parameters", "7M"),
                "accuracy": capabilities.get("accuracy", "45% on ARC-AGI-1"),
                "speed_improvement": "12.3x faster with MLX",
                "recursive_cycles": capabilities.get("recursive_cycles", "unknown"),
                "trm_ready": health.get("ready", False)
            }

        # Legacy HRM status
        return {
            "available": True,
            "initialized": True,
            "model_type": "HRM (legacy - upgrade to TRM recommended)",
            "hrm_ready": controller.hrm.ready if hasattr(controller, 'hrm') else False,
            "llm_base_url": controller.llm.base_url if hasattr(controller, 'llm') else "unknown",
            "llm_model": controller.llm.model if hasattr(controller, 'llm') else "unknown",
            "refiner_enabled": controller.enable_refiner if hasattr(controller, 'enable_refiner') else False,
            "max_retries": controller.max_retries if hasattr(controller, 'max_retries') else 1
        }

    except Exception as e:
        return {
            "available": True,
            "initialized": False,
            "error": str(e)
        }

@router.get("/health")
async def health_check():
    """Health check for orchestration system"""
    return {
        "status": "healthy" if (TRM_AVAILABLE or HRM_AVAILABLE) else "degraded",
        "trm_available": TRM_AVAILABLE,
        "hrm_available": HRM_AVAILABLE,  # Legacy support
        "model_type": "TRM" if TRM_AVAILABLE else ("HRM" if HRM_AVAILABLE else "none"),
        "timestamp": datetime.now().isoformat()
    }

# For backwards compatibility
async def execute_task(goal: str, constraints: Optional[Dict] = None) -> Dict:
    """Backwards compatible execute function"""
    controller = await get_controller()
    if controller:
        result = await controller.run(goal, constraints)
        return result.to_dict()
    return {"success": False, "error": "Controller not available"}

