"""
Event tracker for logging system events
"""

import logging
from datetime import datetime
from typing import Dict, Any

logger = logging.getLogger(__name__)

def log_event(event_type: str, data: Dict[str, Any] = None):
    """
    Log a system event
    
    Args:
        event_type: Type of event to log
        data: Optional data associated with the event
    """
    event_data = {
        "timestamp": datetime.now().isoformat(),
        "event_type": event_type,
        "data": data or {}
    }
    
    logger.info(f"Event: {event_type}", extra=event_data)