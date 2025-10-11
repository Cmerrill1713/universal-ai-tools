"""
Dynamic Model-Agnostic Routing API
Frontend sends capabilities/constraints, backend selects best available model
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json

router = APIRouter()

# Import selector
try:
    from src.core.routing.model_selector import select_model, get_selector
    SELECTOR_AVAILABLE = True
except ImportError:
    SELECTOR_AVAILABLE = False
    select_model = None
    get_selector = None


class EngineConstraints(BaseModel):
    latency_budget_ms: int = 2000
    min_quality: str = "good"  # good | great | max
    min_context_tokens: int = 0
    max_cost_tier: str = "free"  # free | low | medium | any
    offline_only: bool = True
    privacy_level: str = "local_only"  # local_only | may_call_web


class EngineSpec(BaseModel):
    provider: str = "auto"
    capabilities: List[str] = ["chat"]
    constraints: EngineConstraints = EngineConstraints()


class RouterDecision(BaseModel):
    route: str  # chat_fast | reasoning_big | code | rag | web_research | vision | speech | tool_exec
    engine: EngineSpec
    params: Dict[str, Any] = {"temperature": 0.3, "max_tokens": 500}
    retrieval: Dict[str, Any] = {"level": "none", "k": 0}
    web: Dict[str, Any] = {"enabled": False, "query": ""}
    tools: List[str] = []
    safety: Dict[str, Any] = {"allow_external_calls": False, "allow_shell": False}
    explain: str = ""


@router.post("/api/route/select")
async def select_model_endpoint(decision: RouterDecision):
    """
    Given a routing decision, select the best available model
    
    Returns selected model metadata
    """
    if not SELECTOR_AVAILABLE:
        raise HTTPException(status_code=503, detail="Model selector not available")
    
    decision_dict = decision.dict()
    selected = select_model(decision_dict)
    
    if not selected:
        raise HTTPException(status_code=404, detail="No suitable model found for constraints")
    
    return {
        "decision": decision_dict,
        "selected_model": selected,
        "timestamp": "2025-10-11T00:00:00Z"
    }


@router.get("/api/route/inventory")
async def get_model_inventory():
    """
    Return current model inventory with capabilities
    """
    if not SELECTOR_AVAILABLE:
        raise HTTPException(status_code=503, detail="Model selector not available")
    
    selector = get_selector()
    return {
        "total_models": len(selector.inventory),
        "models": selector.get_inventory()
    }


@router.post("/api/route/chat-with-selection")
async def chat_with_dynamic_selection(decision: RouterDecision, message: str):
    """
    Route + select + execute chat in one call
    
    Frontend sends constraints, backend selects best model and executes
    """
    if not SELECTOR_AVAILABLE:
        raise HTTPException(status_code=503, detail="Model selector not available")
    
    # Select model
    decision_dict = decision.dict()
    selected = select_model(decision_dict)
    
    if not selected:
        raise HTTPException(status_code=404, detail="No suitable model found")
    
    # Execute chat (placeholder - integrate with your actual chat endpoint)
    return {
        "route": decision.route,
        "selected_model": selected,
        "message": f"Would execute with {selected['model']}",
        "explain": decision.explain,
        "note": "Integrate with actual chat endpoint for full execution"
    }

