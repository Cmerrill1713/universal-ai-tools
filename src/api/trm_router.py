"""
TRM-Driven Capability Router
Uses Tiny Recursive Model for intelligent routing decisions
No hard-coded model names - selects based on capabilities/constraints
"""
import os
import time
from typing import Any, Dict, List

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/trm")

# Feature flag
TRM_ENABLED = os.getenv("TRM_ENABLED", "true").lower() == "true"
ROUTER_MODE = os.getenv("ROUTER_MODE", "heuristic")  # trm | heuristic


class RouteInput(BaseModel):
    prompt: str
    meta: Dict[str, Any] = {}


class RAGConfig(BaseModel):
    enabled: bool = False
    k: int = 4


class SafetyConfig(BaseModel):
    allow_web: bool = False
    allow_shell: bool = False


class RoutePolicy(BaseModel):
    """TRM routing decision - capabilities, not model names"""
    engine: str = "mlx"  # mlx | ollama | openai | local_tool | hybrid
    mode: str = "chat"   # chat | reason | tool | rag | vision
    reason_loops: int = 0
    max_ctx: int = 8192
    latency_budget_ms: int = 1200
    rag: RAGConfig = RAGConfig()
    tools: List[str] = []
    safety: SafetyConfig = SafetyConfig()
    fallbacks: List[str] = []
    explain: str = ""


def heuristic_route(prompt: str, meta: Dict[str, Any]) -> RoutePolicy:
    """
    Heuristic-based routing (placeholder for TRM)
    Analyzes prompt to determine optimal routing policy
    """
    text = prompt.lower()

    # Detect intent from keywords
    wants_web = any(k in text for k in ["latest", "search", "news", "prices", "today", "current", "recent"])
    has_img = any(k in text for k in ["image", "photo", "vision", "screenshot", "picture"])
    needs_rag = any(k in text for k in ["from my files", "from docs", "summarize our", "what did we"]) or \
                meta.get("hasFiles", False)
    is_code = any(k in text for k in ["code", "function", "class", "debug", "refactor", "implement", "swift", "python"])
    is_reasoning = any(k in text for k in ["prove", "why", "explain", "step by step", "reasoning", "logic"])
    is_math = any(k in text for k in ["calculate", "solve", "equation", "math", "proof"])
    is_quick = len(text) < 50 and "?" in text and not is_code and not is_reasoning

    # Determine engine
    if wants_web:
        engine = "ollama"  # May need web access
    elif is_code or needs_rag:
        engine = "mlx"  # Best for coding and local tasks
    else:
        engine = "mlx"  # Default to local MLX

    # Determine mode
    if has_img:
        mode = "vision"
    elif needs_rag:
        mode = "rag"
    elif is_code:
        mode = "code"
    elif is_reasoning or is_math:
        mode = "reason"
    else:
        mode = "chat"

    # Reasoning loops
    if is_reasoning or is_math:
        reason_loops = 4
    elif is_code:
        reason_loops = 2
    else:
        reason_loops = 1

    # Latency budget
    if is_quick:
        latency_budget = 150
    elif is_code:
        latency_budget = 1200
    elif is_reasoning:
        latency_budget = 2500
    else:
        latency_budget = 1000

    # Context window
    if is_code or needs_rag:
        max_ctx = 32768
    elif is_reasoning:
        max_ctx = 8192
    else:
        max_ctx = 4096

    # RAG configuration
    rag_config = RAGConfig(
        enabled=needs_rag,
        k=10 if needs_rag else 0
    )

    # Tools
    tools = []
    if wants_web:
        tools.append("web_search")
    if needs_rag:
        tools.append("filesystem")
    if "tts" in text or "speak" in text or "voice" in text:
        tools.append("tts")

    # Safety
    safety = SafetyConfig(
        allow_web=wants_web,
        allow_shell=False  # Never allow shell by default
    )

    # Fallbacks
    fallbacks = [
        "ollama:llama3.1:8b",
        "mlx:qwen2.5-coder:7b",
        "mlx:llama3.1:8b"
    ]

    # Explanation
    if is_quick:
        explain = "Quick factual question - fast local chat"
    elif is_code:
        explain = f"Coding task - using {engine} with {reason_loops} refinement loops"
    elif is_reasoning:
        explain = f"Multi-step reasoning - {reason_loops} loops for thorough analysis"
    elif needs_rag:
        explain = "Internal knowledge query - RAG with heavy retrieval"
    elif wants_web:
        explain = "External/recent information - web search enabled"
    else:
        explain = "General chat - balanced local execution"

    return RoutePolicy(
        engine=engine,
        mode=mode,
        reason_loops=reason_loops,
        max_ctx=max_ctx,
        latency_budget_ms=latency_budget,
        rag=rag_config,
        tools=tools,
        safety=safety,
        fallbacks=fallbacks,
        explain=explain
    )


def trm_route(prompt: str, meta: Dict[str, Any]) -> RoutePolicy:
    """
    TRM-based routing (future implementation)
    
    Will use Tiny Recursive Model to iteratively refine routing decision
    through multiple reasoning loops
    """
    # TODO: Load TRM model
    # TODO: Embed prompt + meta
    # TODO: Run TRM forward pass with recursive refinement
    # TODO: Decode logits to policy JSON

    # For now, fall back to heuristics
    return heuristic_route(prompt, meta)


@router.post("/route", response_model=RoutePolicy)
async def route_request(inp: RouteInput):
    """
    Route a request using TRM (or heuristics if TRM not ready)
    
    Returns optimal execution policy based on prompt analysis
    """
    start = time.time()

    # Choose routing method
    if ROUTER_MODE == "trm" and TRM_ENABLED:
        policy = trm_route(inp.prompt, inp.meta)
    else:
        policy = heuristic_route(inp.prompt, inp.meta)

    latency_ms = round((time.time() - start) * 1000, 2)

    # Log routing decision (for training data)
    log_routing_decision(inp.prompt, policy, latency_ms)

    return policy


@router.get("/status")
async def router_status():
    """Return router configuration and status"""
    return {
        "trm_enabled": TRM_ENABLED,
        "router_mode": ROUTER_MODE,
        "available_engines": ["mlx", "ollama", "local_tool", "hybrid"],
        "available_modes": ["chat", "reason", "tool", "rag", "vision"],
        "status": "operational"
    }


def log_routing_decision(prompt: str, policy: RoutePolicy, latency_ms: float):
    """
    Log routing decision for training and telemetry
    
    Future: Store in PostgreSQL routing_outcomes table
    """
    # TODO: Store in database for training dataset
    # TODO: Export to Prometheus metrics
    pass


# Example policy validation
def validate_policy_examples():
    """Test routing with example prompts"""
    examples = [
        ("What's a CPU?", {}),
        ("Refactor this SwiftUI code", {"hasFiles": True}),
        ("What's the latest on Swift?", {"wantsWeb": True}),
        ("Summarize our architecture docs", {"hasFiles": True}),
        ("Prove f(x) is monotonic", {}),
    ]

    results = []
    for prompt, meta in examples:
        policy = heuristic_route(prompt, meta)
        results.append({
            "prompt": prompt[:50],
            "engine": policy.engine,
            "mode": policy.mode,
            "reason_loops": policy.reason_loops,
            "rag_enabled": policy.rag.enabled,
            "tools": policy.tools,
            "explain": policy.explain
        })

    return results


if __name__ == "__main__":
    # Test routing
    examples = validate_policy_examples()
    for ex in examples:
        print(f"Prompt: {ex['prompt']}")
        print(f"  → {ex['engine']}/{ex['mode']} (loops={ex['reason_loops']})")
        print(f"  → RAG={ex['rag_enabled']}, Tools={ex['tools']}")
        print(f"  → {ex['explain']}")
        print()

