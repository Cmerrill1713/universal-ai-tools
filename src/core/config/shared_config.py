"""
Shared configuration module to reduce duplication across services
"""

import os
from typing import Dict, Any, Optional
from dataclasses import dataclass

@dataclass
class ServiceConfig:
    """Base configuration for all services"""
    name: str
    port: int
    host: str = "0.0.0.0"
    debug: bool = False
    log_level: str = "info"

class ConfigManager:
    """Centralized configuration manager"""
    
    def __init__(self):
        self._configs: Dict[str, ServiceConfig] = {}
        self._defaults = {
            "api_gateway": ServiceConfig("api-gateway", 8081),
            "assistantd": ServiceConfig("assistantd", 8080),
            "llm_router": ServiceConfig("llm-router", 3033),
            "ml_inference": ServiceConfig("ml-inference", 8091),
            "memory_service": ServiceConfig("memory-service", 8017),
            "fast_llm": ServiceConfig("fast-llm", 3030),
            "weaviate": ServiceConfig("weaviate", 8090),
            "redis": ServiceConfig("redis", 6379),
            "postgres": ServiceConfig("postgres", 5432),
        }
    
    def get_config(self, service_name: str) -> ServiceConfig:
        """Get configuration for a service"""
        if service_name not in self._configs:
            self._configs[service_name] = self._load_from_env(service_name)
        return self._configs[service_name]
    
    def _load_from_env(self, service_name: str) -> ServiceConfig:
        """Load configuration from environment variables"""
        default = self._defaults.get(service_name, ServiceConfig(service_name, 8000))
        
        return ServiceConfig(
            name=os.getenv(f"{service_name.upper()}_NAME", default.name),
            port=int(os.getenv(f"{service_name.upper()}_PORT", default.port)),
            host=os.getenv(f"{service_name.upper()}_HOST", default.host),
            debug=os.getenv(f"{service_name.upper()}_DEBUG", "false").lower() == "true",
            log_level=os.getenv(f"{service_name.upper()}_LOG_LEVEL", default.log_level)
        )
    
    def get_service_url(self, service_name: str, path: str = "") -> str:
        """Get full URL for a service"""
        config = self.get_config(service_name)
        return f"http://{config.host}:{config.port}{path}"

# Global configuration manager
config_manager = ConfigManager()

def get_service_config(service_name: str) -> ServiceConfig:
    """Get service configuration"""
    return config_manager.get_config(service_name)

def get_service_url(service_name: str, path: str = "") -> str:
    """Get service URL"""
    return config_manager.get_service_url(service_name, path)