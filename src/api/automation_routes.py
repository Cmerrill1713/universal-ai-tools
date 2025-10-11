#!/usr/bin/env python3
"""
Automation API Routes
Desktop and browser automation endpoints
"""

from typing import Optional

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = structlog.get_logger()

router = APIRouter(prefix="/api/automation", tags=["automation"])


class MacOSCommandRequest(BaseModel):
    action: str
    app_name: Optional[str] = None
    command: Optional[str] = None
    path: Optional[str] = None
    content: Optional[str] = None


class BrowserCommandRequest(BaseModel):
    action: str
    url: Optional[str] = None
    selector: Optional[str] = None
    text: Optional[str] = None
    path: Optional[str] = None


@router.post("/macos/execute")
async def execute_macos_command(request: MacOSCommandRequest):
    """
    Execute MacOS desktop automation commands
    
    Actions:
    - open_app: Open an application
    - close_app: Close an application
    - screenshot: Take a screenshot
    - system_info: Get system information
    - open_settings: Open System Settings
    - toggle_dark_mode: Toggle dark mode
    - create_file: Create a file
    """
    try:
        from src.core.automation.macos_control import get_macos_controller
        controller = get_macos_controller()

        if request.action == "open_app":
            if not request.app_name:
                raise HTTPException(status_code=400, detail="app_name required")
            result = controller.open_application(request.app_name)

        elif request.action == "close_app":
            if not request.app_name:
                raise HTTPException(status_code=400, detail="app_name required")
            result = controller.close_application(request.app_name)

        elif request.action == "screenshot":
            result = controller.take_screenshot(request.path)

        elif request.action == "system_info":
            info_type = request.command or "memory"
            result = controller.get_system_info(info_type)

        elif request.action == "open_settings":
            result = controller.open_system_settings()

        elif request.action == "toggle_dark_mode":
            result = controller.toggle_dark_mode()

        elif request.action == "create_file":
            if not request.path:
                raise HTTPException(status_code=400, detail="path required")
            result = controller.create_file(request.path, request.content or "")

        else:
            raise HTTPException(status_code=400, detail=f"Unknown action: {request.action}")

        return result

    except Exception as e:
        logger.error(f"MacOS automation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/browser/execute")
async def execute_browser_command(request: BrowserCommandRequest):
    """
    Execute browser automation commands
    
    Actions:
    - navigate: Go to URL
    - click: Click element
    - type: Type text
    - screenshot: Take screenshot
    - get_content: Get page content
    - search: Search in page
    """
    try:
        from src.core.automation.browser_control import get_browser_controller
        controller = get_browser_controller()

        if request.action == "navigate":
            if not request.url:
                raise HTTPException(status_code=400, detail="url required")
            result = await controller.navigate(request.url)

        elif request.action == "click":
            if not request.selector:
                raise HTTPException(status_code=400, detail="selector required")
            result = await controller.click(request.selector)

        elif request.action == "type":
            if not request.selector or not request.text:
                raise HTTPException(status_code=400, detail="selector and text required")
            result = await controller.type_text(request.selector, request.text)

        elif request.action == "screenshot":
            result = await controller.screenshot(request.path)

        elif request.action == "get_content":
            result = await controller.get_page_content()

        elif request.action == "search":
            if not request.text:
                raise HTTPException(status_code=400, detail="text required")
            result = await controller.search_in_page(request.text)

        else:
            raise HTTPException(status_code=400, detail=f"Unknown action: {request.action}")

        return result

    except Exception as e:
        logger.error(f"Browser automation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/capabilities")
async def get_capabilities():
    """Get available automation capabilities"""
    return {
        "macos": {
            "open_app": "Open a Mac application",
            "close_app": "Close a Mac application",
            "screenshot": "Take a screenshot",
            "system_info": "Get system information (memory, disk, processes, etc.)",
            "open_settings": "Open System Settings",
            "toggle_dark_mode": "Toggle dark mode",
            "create_file": "Create a file"
        },
        "browser": {
            "navigate": "Navigate to a URL",
            "click": "Click an element",
            "type": "Type text into an element",
            "screenshot": "Take page screenshot",
            "get_content": "Get page content",
            "search": "Search in page"
        }
    }


@router.get("/health")
async def automation_health():
    """Check automation services health"""
    try:
        from src.core.automation.browser_control import get_browser_controller
        from src.core.automation.macos_control import get_macos_controller

        macos = get_macos_controller()
        browser = get_browser_controller()

        return {
            "status": "healthy",
            "macos": "available",
            "browser": "available"
        }
    except Exception as e:
        return {
            "status": "degraded",
            "error": str(e)
        }

