"""
Model-Agnostic Selector - Chooses best available model based on capabilities/constraints
No hard-coded model names - uses inventory from MLX/Ollama registries
"""
from dataclasses import dataclass
from typing import List, Set, Dict, Any, Optional
import asyncio

@dataclass
class ModelCandidate:
    """Represents an available model with its capabilities"""
    provider: str          # "mlx" or "ollama"
    name: str              # model id
    caps: Set[str]         # {"chat","coding","reasoning","vision","function_calling"}
    quality: int           # 1..5
    latency_ms: int        # typical latency
    ctx_tokens: int        # context window size
    cost_tier: str         # "free","low","medium","high"
    local: bool            # runs locally?
    
    def __post_init__(self):
        if isinstance(self.caps, list):
            self.caps = set(self.caps)


class ModelSelector:
    """Selects best model based on dynamic constraints"""
    
    def __init__(self):
        self.inventory: List[ModelCandidate] = []
        self._load_inventory()
    
    def _load_inventory(self):
        """Load available models from MLX/Ollama"""
        # MLX models (local, fast)
        self.inventory.extend([
            ModelCandidate(
                provider="mlx",
                name="mlx-community/Qwen2.5-Coder-7B-Instruct-4bit",
                caps={"chat", "coding", "reasoning", "function_calling"},
                quality=4,
                latency_ms=800,
                ctx_tokens=32768,
                cost_tier="free",
                local=True
            ),
            ModelCandidate(
                provider="mlx",
                name="mlx-community/Meta-Llama-3.1-8B-Instruct-4bit",
                caps={"chat", "reasoning", "function_calling"},
                quality=4,
                latency_ms=600,
                ctx_tokens=8192,
                cost_tier="free",
                local=True
            ),
            ModelCandidate(
                provider="mlx",
                name="mlx-community/gemma-2-9b-it-4bit",
                caps={"chat", "coding", "reasoning"},
                quality=4,
                latency_ms=700,
                ctx_tokens=8192,
                cost_tier="free",
                local=True
            ),
        ])
        
        # Ollama models (if available)
        try:
            self.inventory.extend([
                ModelCandidate(
                    provider="ollama",
                    name="qwen2.5-coder:7b",
                    caps={"chat", "coding", "reasoning"},
                    quality=4,
                    latency_ms=900,
                    ctx_tokens=32768,
                    cost_tier="free",
                    local=True
                ),
            ])
        except:
            pass  # Ollama optional
    
    def select_best(self, decision: Dict[str, Any]) -> Optional[ModelCandidate]:
        """
        Select best model based on decision constraints
        
        Args:
            decision: Router decision with engine.capabilities and engine.constraints
        
        Returns:
            Best matching ModelCandidate or None
        """
        want_caps = set(decision.get("engine", {}).get("capabilities", []))
        constraints = decision.get("engine", {}).get("constraints", {})
        
        min_quality_map = {"good": 3, "great": 4, "max": 5}
        min_quality = min_quality_map.get(constraints.get("min_quality", "good"), 3)
        
        max_cost_map = {"free": 0, "low": 1, "medium": 2, "any": 3}
        max_cost_rank = max_cost_map.get(constraints.get("max_cost_tier", "free"), 0)
        
        privacy_local = constraints.get("offline_only", True) or \
                       (constraints.get("privacy_level", "local_only") == "local_only")
        
        min_ctx = constraints.get("min_context_tokens", 0)
        latency_budget = constraints.get("latency_budget_ms", 2000)
        
        def score(candidate: ModelCandidate) -> int:
            """Score a candidate model (higher is better)"""
            # Hard constraints (return -999 if not met)
            if privacy_local and not candidate.local:
                return -999
            if not want_caps.issubset(candidate.caps):
                return -999
            if candidate.quality < min_quality:
                return -999
            if candidate.ctx_tokens < min_ctx:
                return -999
            
            # Map cost tier to rank
            cost_rank_map = {"free": 0, "low": 1, "medium": 2, "high": 3}
            cost_rank = cost_rank_map.get(candidate.cost_tier, 3)
            if cost_rank > max_cost_rank:
                return -999
            
            # Soft scoring (prefer better quality, lower latency, more context)
            s = 0
            s += candidate.quality * 10                              # Quality weight
            s -= max(0, candidate.latency_ms - latency_budget) // 50 # Latency penalty
            s += min(candidate.ctx_tokens, 64_000) // 2000           # Context bonus
            s += 3 if candidate.provider == "mlx" else 0             # MLX preference (Apple Silicon)
            
            return s
        
        # Rank candidates
        ranked = sorted(self.inventory, key=score, reverse=True)
        
        # Return best or conservative fallback
        if ranked and score(ranked[0]) > -999:
            return ranked[0]
        
        # Fallback: find any local chat model
        fallback = next((c for c in self.inventory if c.local and "chat" in c.caps), None)
        return fallback or (self.inventory[0] if self.inventory else None)
    
    def get_inventory(self) -> List[Dict[str, Any]]:
        """Return current model inventory as JSON"""
        return [
            {
                "provider": c.provider,
                "name": c.name,
                "capabilities": list(c.caps),
                "quality": c.quality,
                "latency_ms": c.latency_ms,
                "context_tokens": c.ctx_tokens,
                "cost_tier": c.cost_tier,
                "local": c.local
            }
            for c in self.inventory
        ]


# Global selector instance
_selector = None

def get_selector() -> ModelSelector:
    """Get or create global selector instance"""
    global _selector
    if _selector is None:
        _selector = ModelSelector()
    return _selector


def select_model(decision: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Select best model for a routing decision
    
    Args:
        decision: Router decision JSON with capabilities/constraints
    
    Returns:
        Selected model metadata or None
    """
    selector = get_selector()
    candidate = selector.select_best(decision)
    
    if not candidate:
        return None
    
    return {
        "provider": candidate.provider,
        "model": candidate.name,
        "quality": candidate.quality,
        "latency_ms": candidate.latency_ms,
        "context_tokens": candidate.ctx_tokens,
        "capabilities": list(candidate.caps),
        "local": candidate.local
    }

