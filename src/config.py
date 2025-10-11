"""
Application configuration
"""

import os
from typing import Any, Dict


class Config:
    """Application configuration"""

    APP_NAME = "Universal AI Tools API"
    VERSION = "1.0.0"
    DEBUG = os.getenv("DEBUG", "false").lower() == "true"
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", "8000"))

    # Database
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")

    # API
    API_PREFIX = "/api"

    @classmethod
    def to_dict(cls) -> Dict[str, Any]:
        """Convert config to dictionary"""
        return {
            "app_name": cls.APP_NAME,
            "version": cls.VERSION,
            "debug": cls.DEBUG,
            "host": cls.HOST,
            "port": cls.PORT,
        }


config = Config()

