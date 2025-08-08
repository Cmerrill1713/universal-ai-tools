"""
DSPy Orchestrator Service

Advanced cognitive reasoning and orchestration system using DSPy with MIPROv2 optimization.
Provides intelligent model selection, agent specialization, and knowledge management.
"""

# Standard imports for DSPy orchestrator

# Internal LLM relay
from .internal_llm_relay import (
    InternalLLMRelay,
    configure_dspy_with_internal_relay,
    enhance_dspy_with_relay,
    get_best_available_lm,
)
from .llm_discovery import LLMDiscovery

# Model management
from .model_selector import ModelCapability, ModelProfile, ModelSelector, TaskComplexity

# Main orchestrator classes
from .orchestrator import (
    AdaptiveOrchestrator,
    CognitiveReasoningChain,
    KnowledgeOrchestrator,
    TaskCoordinator,
)

# Server and communication
from .server import DSPyServer, UniversalOrchestrator

# Initialize __all__ list
__all__ = [
    # Core orchestration
    "CognitiveReasoningChain",
    "AdaptiveOrchestrator",
    "TaskCoordinator",
    "KnowledgeOrchestrator",
    "UniversalOrchestrator",
    "DSPyServer",

    # Model management
    "ModelSelector",
    "TaskComplexity",
    "ModelCapability",
    "ModelProfile",
    "LLMDiscovery",

    # LLM integration
    "InternalLLMRelay",
    "configure_dspy_with_internal_relay",
    "get_best_available_lm",
    "enhance_dspy_with_relay",

    # Global instances
    "model_selector",
]

# Optional components - imports are available when needed
# These are imported conditionally by other modules
try:
    from .agent_specialization import AgentOrchestrator
    __all__.append("AgentOrchestrator")
except ImportError:
    pass

try:
    from .knowledge_optimizer import KnowledgeOptimizer
    __all__.append("KnowledgeOptimizer")
except ImportError:
    pass

try:
    from .mlx_lfm2_adapter import MLXLFM2Adapter
    __all__.append("MLXLFM2Adapter")
except ImportError:
    pass

# Global instances
model_selector = ModelSelector()
