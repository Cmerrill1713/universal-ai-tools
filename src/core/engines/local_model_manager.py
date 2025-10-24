"""
Local model manager for handling model configurations
"""

from enum import Enum
from typing import Dict, Any

class ModelType(Enum):
    """Model type enumeration"""
    LLM = "llm"
    EMBEDDING = "embedding"
    VISION = "vision"

class LocalModelConfig:
    """Configuration for local models"""
    
    def __init__(self, name: str, model_type: ModelType, **kwargs):
        self.name = name
        self.model_type = model_type
        self.config = kwargs

class ModelManager:
    """Manager for local models"""
    
    def __init__(self):
        self.models: Dict[str, LocalModelConfig] = {}
    
    def register_model(self, config: LocalModelConfig):
        """Register a new model"""
        self.models[config.name] = config
    
    def get_model(self, name: str) -> LocalModelConfig:
        """Get a model by name"""
        return self.models.get(name)

# Global model manager instance
model_manager = ModelManager()