#!/usr/bin/env python3
"""
macOS System Control
Opens apps, takes screenshots, gets system info on Mac
"""

import subprocess
import logging
from typing import Dict, Any, Optional
import platform

logger = logging.getLogger(__name__)


class MacOSController:
    """Controller for macOS system automation"""
    
    def __init__(self):
        self.is_macos = platform.system() == "Darwin"
    
    def open_application(self, app_name: str) -> Dict[str, Any]:
        """
        Open a macOS application
        
        Args:
            app_name: Name of the application (e.g., "Calculator", "Safari")
        
        Returns:
            Dict with success status and message
        """
        if not self.is_macos:
            return self._call_host_service("open_app", {"app_name": app_name})
        
        try:
            logger.info(f"💻 Opening application: {app_name}")
            
            # Try opening with 'open -a' command
            result = subprocess.run(
                ['open', '-a', app_name],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode == 0:
                logger.info(f"✅ Opened: {app_name}")
                return {
                    "success": True,
                    "app": app_name,
                    "message": f"Opened {app_name}"
                }
            else:
                error = result.stderr or "Application not found"
                logger.error(f"Failed to open {app_name}: {error}")
                return {
                    "success": False,
                    "app": app_name,
                    "error": error,
                    "message": f"Could not open {app_name}: {error}"
                }
        
        except Exception as e:
            logger.error(f"Open app error: {e}")
            return {"success": False, "error": str(e)}
    
    def close_application(self, app_name: str) -> Dict[str, Any]:
        """Close a macOS application"""
        if not self.is_macos:
            return self._call_host_service("close_app", {"app_name": app_name})
        
        try:
            result = subprocess.run(
                ['osascript', '-e', f'quit app "{app_name}"'],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode == 0:
                return {"success": True, "message": f"Closed {app_name}"}
            else:
                return {"success": False, "error": result.stderr}
        
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def take_screenshot(self, path: Optional[str] = None) -> Dict[str, Any]:
        """Take a screenshot"""
        if not self.is_macos:
            return self._call_host_service("screenshot", {"path": path})
        
        try:
            import tempfile
            import datetime
            
            if path is None:
                timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                path = f"/tmp/screenshot_{timestamp}.png"
            
            result = subprocess.run(
                ['screencapture', path],
                capture_output=True,
                timeout=5
            )
            
            if result.returncode == 0:
                return {"success": True, "path": path, "message": f"Screenshot saved to {path}"}
            else:
                return {"success": False, "error": "Screenshot failed"}
        
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def get_system_info(self, info_type: str = "memory") -> Dict[str, Any]:
        """Get system information"""
        if not self.is_macos:
            return self._call_host_service("system_info", {"command": info_type})
        
        try:
            if info_type == "memory":
                result = subprocess.run(['vm_stat'], capture_output=True, text=True, timeout=3)
                output = result.stdout if result.returncode == 0 else "Memory info unavailable"
                return {"success": True, "info_type": "memory", "output": output[:500]}
            
            elif info_type == "disk":
                result = subprocess.run(['df', '-h'], capture_output=True, text=True, timeout=3)
                output = result.stdout if result.returncode == 0 else "Disk info unavailable"
                return {"success": True, "info_type": "disk", "output": output[:500]}
            
            else:
                return {"success": False, "error": f"Unknown info type: {info_type}"}
        
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def open_system_settings(self) -> Dict[str, Any]:
        """Open System Settings"""
        return self.open_application("System Settings")
    
    def toggle_dark_mode(self) -> Dict[str, Any]:
        """Toggle dark mode"""
        if not self.is_macos:
            return self._call_host_service("toggle_dark_mode", {})
        
        try:
            # AppleScript to toggle dark mode
            script = '''
            tell application "System Events"
                tell appearance preferences
                    set dark mode to not dark mode
                end tell
            end tell
            '''
            result = subprocess.run(
                ['osascript', '-e', script],
                capture_output=True,
                timeout=5
            )
            
            if result.returncode == 0:
                return {"success": True, "message": "Toggled dark mode"}
            else:
                return {"success": False, "error": "Could not toggle dark mode"}
        
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def create_file(self, path: str, content: str = "") -> Dict[str, Any]:
        """Create a file"""
        try:
            with open(path, 'w') as f:
                f.write(content)
            return {"success": True, "path": path, "message": f"Created file: {path}"}
        
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _call_host_service(self, action: str, params: Dict) -> Dict[str, Any]:
        """Call host macOS service (when running in Docker)"""
        try:
            import httpx
            import asyncio
            
            # Call the macOS automation service on the host
            async def _make_call():
                async with httpx.AsyncClient(timeout=5.0) as client:
                    if action == "open_app":
                        response = await client.post(
                            "http://host.docker.internal:9876/macos/open-app",
                            json={"app_name": params.get("app_name")}
                        )
                    elif action == "screenshot":
                        response = await client.post(
                            "http://host.docker.internal:9876/macos/screenshot",
                            json={"path": params.get("path")}
                        )
                    elif action == "system_info":
                        response = await client.post(
                            "http://host.docker.internal:9876/macos/system-info",
                            json={"info_type": params.get("command", "memory")}
                        )
                    else:
                        return {"success": False, "error": f"Unknown action: {action}"}
                    
                    if response.status_code == 200:
                        return response.json()
                    else:
                        return {"success": False, "error": f"HTTP {response.status_code}"}
            
            # Run async call
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # Create a new event loop if one is already running
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(asyncio.run, _make_call())
                    return future.result(timeout=10)
            else:
                return loop.run_until_complete(_make_call())
        
        except Exception as e:
            logger.error(f"Host service call failed: {e}")
            return {
                "success": False,
                "error": f"macOS automation service not reachable: {str(e)}"
            }


# Global singleton
_macos_controller = None


def get_macos_controller() -> MacOSController:
    """Get the global macOS controller instance"""
    global _macos_controller
    if _macos_controller is None:
        _macos_controller = MacOSController()
    return _macos_controller

