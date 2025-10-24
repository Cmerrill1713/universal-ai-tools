"""
Shared logging module to reduce duplication across services
"""

import logging
import sys
from typing import Optional
from src.core.config.shared_config import get_service_config

class ServiceLogger:
    """Centralized logger for all services"""
    
    def __init__(self, service_name: str):
        self.service_name = service_name
        self.logger = self._setup_logger()
    
    def _setup_logger(self) -> logging.Logger:
        """Setup logger with consistent formatting"""
        logger = logging.getLogger(f"universal-ai-tools.{self.service_name}")
        
        if not logger.handlers:
            # Create console handler
            handler = logging.StreamHandler(sys.stdout)
            handler.setLevel(logging.INFO)
            
            # Create formatter
            formatter = logging.Formatter(
                f'%(asctime)s - {self.service_name} - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            
            # Add handler to logger
            logger.addHandler(handler)
            logger.setLevel(logging.INFO)
        
        return logger
    
    def info(self, message: str, **kwargs):
        """Log info message"""
        self.logger.info(message, extra=kwargs)
    
    def warning(self, message: str, **kwargs):
        """Log warning message"""
        self.logger.warning(message, extra=kwargs)
    
    def error(self, message: str, **kwargs):
        """Log error message"""
        self.logger.error(message, extra=kwargs)
    
    def debug(self, message: str, **kwargs):
        """Log debug message"""
        self.logger.debug(message, extra=kwargs)

def get_service_logger(service_name: str) -> ServiceLogger:
    """Get logger for a specific service"""
    return ServiceLogger(service_name)

# Common loggers for quick access
api_logger = get_service_logger("api")
gateway_logger = get_service_logger("gateway")
assistant_logger = get_service_logger("assistant")