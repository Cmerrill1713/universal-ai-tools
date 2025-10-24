#!/usr/bin/env python3
"""
Family Athena Unified Configuration
Centralized configuration management for all services
"""

import json
import yaml
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime

class UnifiedConfig:
    def __init__(self):
        self.workspace = Path("/workspace")
        self.config_file = self.workspace / "family_athena_config.yaml"
        self.config = self.load_config()
        
    def load_config(self) -> Dict[str, Any]:
        """Load configuration from file"""
        default_config = {
            "family_athena": {
                "version": "1.0.0",
                "environment": "production",
                "debug": False,
                "log_level": "INFO"
            },
            "services": {
                "athena_gateway": {
                    "host": "0.0.0.0",
                    "port": 8080,
                    "enabled": True
                },
                "family_api": {
                    "host": "0.0.0.0",
                    "port": 8005,
                    "enabled": True
                },
                "family_profiles": {
                    "enabled": True,
                    "storage_type": "memory"
                },
                "family_calendar": {
                    "enabled": True,
                    "storage_type": "memory"
                },
                "family_knowledge": {
                    "enabled": True,
                    "storage_type": "memory"
                },
                "monitoring": {
                    "enabled": True,
                    "interval": 60
                },
                "dashboard": {
                    "enabled": True,
                    "port": 3000
                }
            },
            "database": {
                "type": "supabase",
                "url": "postgresql://...",
                "enabled": True
            },
            "redis": {
                "host": "localhost",
                "port": 6379,
                "enabled": True
            },
            "security": {
                "jwt_secret": "your-secret-key",
                "api_key_required": True,
                "rate_limiting": {
                    "enabled": True,
                    "requests_per_minute": 100
                }
            },
            "family": {
                "max_members": 10,
                "max_events_per_day": 50,
                "max_knowledge_items": 1000,
                "backup_enabled": True,
                "backup_interval": 24
            },
            "ai": {
                "model": "gpt-4",
                "temperature": 0.7,
                "max_tokens": 1000,
                "enabled": True
            },
            "integration": {
                "service_mesh": {
                    "enabled": True,
                    "event_processing": True
                },
                "data_sync": {
                    "enabled": True,
                    "sync_interval": 1.0
                },
                "health_monitoring": {
                    "enabled": True,
                    "check_interval": 30
                }
            }
        }
        
        if self.config_file.exists():
            try:
                with open(self.config_file, 'r') as f:
                    config = yaml.safe_load(f)
                return config
            except Exception as e:
                print(f"Error loading config: {e}, using defaults")
                return default_config
        else:
            # Create default config file
            self.save_config(default_config)
            return default_config
    
    def save_config(self, config: Dict[str, Any]):
        """Save configuration to file"""
        try:
            with open(self.config_file, 'w') as f:
                yaml.dump(config, f, default_flow_style=False, indent=2)
        except Exception as e:
            print(f"Error saving config: {e}")
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get configuration value by key"""
        keys = key.split('.')
        value = self.config
        
        for k in keys:
            if isinstance(value, dict) and k in value:
                value = value[k]
            else:
                return default
        
        return value
    
    def set(self, key: str, value: Any):
        """Set configuration value by key"""
        keys = key.split('.')
        config = self.config
        
        for k in keys[:-1]:
            if k not in config:
                config[k] = {}
            config = config[k]
        
        config[keys[-1]] = value
        self.save_config(self.config)
    
    def get_service_config(self, service_name: str) -> Dict[str, Any]:
        """Get configuration for a specific service"""
        return self.get(f"services.{service_name}", {})
    
    def is_service_enabled(self, service_name: str) -> bool:
        """Check if a service is enabled"""
        return self.get(f"services.{service_name}.enabled", False)
    
    def get_database_config(self) -> Dict[str, Any]:
        """Get database configuration"""
        return self.get("database", {})
    
    def get_redis_config(self) -> Dict[str, Any]:
        """Get Redis configuration"""
        return self.get("redis", {})
    
    def get_security_config(self) -> Dict[str, Any]:
        """Get security configuration"""
        return self.get("security", {})
    
    def get_family_config(self) -> Dict[str, Any]:
        """Get family-specific configuration"""
        return self.get("family", {})
    
    def get_ai_config(self) -> Dict[str, Any]:
        """Get AI configuration"""
        return self.get("ai", {})
    
    def get_integration_config(self) -> Dict[str, Any]:
        """Get integration configuration"""
        return self.get("integration", {})
    
    def update_family_config(self, updates: Dict[str, Any]):
        """Update family configuration"""
        family_config = self.get_family_config()
        family_config.update(updates)
        self.set("family", family_config)
    
    def get_all_config(self) -> Dict[str, Any]:
        """Get all configuration"""
        return self.config
    
    def validate_config(self) -> List[str]:
        """Validate configuration and return any errors"""
        errors = []
        
        # Check required services
        required_services = ["athena_gateway", "family_api", "family_profiles"]
        for service in required_services:
            if not self.is_service_enabled(service):
                errors.append(f"Required service {service} is disabled")
        
        # Check family limits
        max_members = self.get("family.max_members", 10)
        if max_members < 1 or max_members > 100:
            errors.append("Family max_members must be between 1 and 100")
        
        # Check security settings
        if not self.get("security.jwt_secret"):
            errors.append("JWT secret is required")
        
        return errors

# Global configuration instance
_config = None

def get_config() -> UnifiedConfig:
    """Get global configuration instance"""
    global _config
    if _config is None:
        _config = UnifiedConfig()
    return _config

# Configuration helper functions
def get_service_config(service_name: str) -> Dict[str, Any]:
    """Get configuration for a specific service"""
    config = get_config()
    return config.get_service_config(service_name)

def is_service_enabled(service_name: str) -> bool:
    """Check if a service is enabled"""
    config = get_config()
    return config.is_service_enabled(service_name)

def get_family_config() -> Dict[str, Any]:
    """Get family-specific configuration"""
    config = get_config()
    return config.get_family_config()

def get_database_config() -> Dict[str, Any]:
    """Get database configuration"""
    config = get_config()
    return config.get_database_config()

def get_redis_config() -> Dict[str, Any]:
    """Get Redis configuration"""
    config = get_config()
    return config.get_redis_config()

def get_security_config() -> Dict[str, Any]:
    """Get security configuration"""
    config = get_config()
    return config.get_security_config()

if __name__ == "__main__":
    config = get_config()
    
    print("Family Athena Configuration:")
    print(json.dumps(config.get_all_config(), indent=2))
    
    # Validate configuration
    errors = config.validate_config()
    if errors:
        print("\nConfiguration Errors:")
        for error in errors:
            print(f"  - {error}")
    else:
        print("\n✅ Configuration is valid")
