#!/usr/bin/env python3
"""
macOS Automation Service
Runs on Mac host to control browser, apps, and system
Called by Docker containers via HTTP
"""

import subprocess
from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import Optional
import uvicorn
import datetime

app = FastAPI(title="macOS Automation Service")

class OpenBrowserRequest(BaseModel):
    url: str

class OpenAppRequest(BaseModel):
    app_name: str

class ScreenshotRequest(BaseModel):
    path: Optional[str] = None

class SystemInfoRequest(BaseModel):
    info_type: str = "memory"

@app.post("/open")
async def open_browser(request: OpenBrowserRequest):
    """Open URL in default browser on Mac"""
    try:
        result = subprocess.run(
            ['open', request.url],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0:
            return {
                "success": True,
                "url": request.url,
                "message": f"Opened browser to {request.url}"
            }
        else:
            return {
                "success": False,
                "error": result.stderr,
                "message": f"Failed to open browser"
            }
    
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": f"Error: {str(e)}"
        }

@app.post("/macos/open-app")
async def open_app(request: OpenAppRequest):
    """Open macOS application"""
    try:
        result = subprocess.run(
            ['open', '-a', request.app_name],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0:
            return {
                "success": True,
                "app": request.app_name,
                "message": f"✅ Opened {request.app_name}"
            }
        else:
            return {
                "success": False,
                "error": result.stderr or "Application not found",
                "message": f"Failed to open {request.app_name}"
            }
    
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": f"Error: {str(e)}"
        }

@app.post("/macos/close-app")
async def close_app(request: OpenAppRequest):
    """Close macOS application"""
    try:
        script = f'quit app "{request.app_name}"'
        result = subprocess.run(
            ['osascript', '-e', script],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0:
            return {
                "success": True,
                "app": request.app_name,
                "message": f"✅ Closed {request.app_name}"
            }
        else:
            return {
                "success": False,
                "error": result.stderr or "Failed to close app",
                "message": f"Failed to close {request.app_name}"
            }
    
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/macos/minimize-all")
async def minimize_all():
    """Minimize all windows"""
    try:
        script = 'tell application "System Events" to set visible of every process to false'
        result = subprocess.run(['osascript', '-e', script], capture_output=True, timeout=5)
        return {"success": True, "message": "✅ Minimized all windows"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/macos/show-desktop")
async def show_desktop():
    """Show desktop (F11 equivalent)"""
    try:
        script = '''
        tell application "System Events"
            key code 103 using {command down}
        end tell
        '''
        subprocess.run(['osascript', '-e', script], timeout=3)
        return {"success": True, "message": "✅ Showing desktop"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/macos/lock-screen")
async def lock_screen():
    """Lock the screen"""
    try:
        subprocess.run(['/System/Library/CoreServices/Menu Extras/User.menu/Contents/Resources/CGSession', '-suspend'], timeout=3)
        return {"success": True, "message": "✅ Screen locked"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/macos/volume")
async def set_volume(request: dict):
    """Set system volume (0-100)"""
    try:
        volume = request.get("level", 50)
        script = f'set volume output volume {volume}'
        subprocess.run(['osascript', '-e', script], timeout=3)
        return {"success": True, "message": f"✅ Volume set to {volume}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/macos/mute")
async def toggle_mute():
    """Toggle mute"""
    try:
        script = 'set volume with output muted'
        subprocess.run(['osascript', '-e', script], timeout=3)
        return {"success": True, "message": "✅ Toggled mute"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/macos/brightness")
async def set_brightness(request: dict):
    """Set screen brightness (0.0-1.0)"""
    try:
        level = request.get("level", 0.5)
        script = f'tell application "System Events" to set brightness of display 1 to {level}'
        subprocess.run(['osascript', '-e', script], timeout=3)
        return {"success": True, "message": f"✅ Brightness set to {int(level*100)}%"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/macos/notification")
async def send_notification(request: dict):
    """Send macOS notification"""
    try:
        title = request.get("title", "NeuroForge AI")
        message = request.get("message", "")
        script = f'display notification "{message}" with title "{title}"'
        subprocess.run(['osascript', '-e', script], timeout=3)
        return {"success": True, "message": "✅ Notification sent"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/macos/sleep")
async def sleep_computer():
    """Put computer to sleep"""
    try:
        subprocess.run(['pmset', 'sleepnow'], timeout=3)
        return {"success": True, "message": "✅ Computer going to sleep"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/macos/restart")
async def restart_computer():
    """Restart computer"""
    try:
        subprocess.run(['osascript', '-e', 'tell app "System Events" to restart'], timeout=3)
        return {"success": True, "message": "✅ Computer restarting"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/macos/empty-trash")
async def empty_trash():
    """Empty the Trash"""
    try:
        script = 'tell application "Finder" to empty trash'
        subprocess.run(['osascript', '-e', script], timeout=10)
        return {"success": True, "message": "✅ Trash emptied"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/macos/wifi")
async def toggle_wifi(request: dict):
    """Toggle WiFi on/off"""
    try:
        action = request.get("action", "on")  # "on" or "off"
        subprocess.run(['networksetup', '-setairportpower', 'en0', action], timeout=5)
        return {"success": True, "message": f"✅ WiFi turned {action}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/macos/dark-mode")
async def toggle_dark_mode():
    """Toggle dark mode"""
    try:
        script = '''
        tell application "System Events"
            tell appearance preferences
                set dark mode to not dark mode
            end tell
        end tell
        '''
        subprocess.run(['osascript', '-e', script], timeout=5)
        return {"success": True, "message": "✅ Toggled dark mode"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/macos/screenshot")
async def take_screenshot(request: ScreenshotRequest):
    """Take a screenshot on Mac"""
    try:
        if request.path is None:
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            request.path = f"/tmp/screenshot_{timestamp}.png"
        
        result = subprocess.run(
            ['screencapture', request.path],
            capture_output=True,
            timeout=5
        )
        
        if result.returncode == 0:
            return {
                "success": True,
                "path": request.path,
                "message": f"Screenshot saved to {request.path}"
            }
        else:
            return {
                "success": False,
                "error": "Screenshot failed"
            }
    
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/macos/system-info")
async def get_system_info(request: SystemInfoRequest):
    """Get macOS system information"""
    try:
        if request.info_type == "memory":
            result = subprocess.run(['vm_stat'], capture_output=True, text=True, timeout=3)
            output = result.stdout if result.returncode == 0 else "Memory info unavailable"
        
        elif request.info_type == "disk":
            result = subprocess.run(['df', '-h'], capture_output=True, text=True, timeout=3)
            output = result.stdout if result.returncode == 0 else "Disk info unavailable"
        
        else:
            return {"success": False, "error": f"Unknown info type: {request.info_type}"}
        
        return {
            "success": True,
            "info_type": request.info_type,
            "output": output[:500]
        }
    
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/macos/clipboard/copy")
async def clipboard_copy(request: dict):
    """Copy text to clipboard"""
    try:
        text = request.get("text", "")
        subprocess.run(['pbcopy'], input=text.encode(), timeout=3)
        return {"success": True, "message": f"✅ Copied to clipboard"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/macos/clipboard/paste")
async def clipboard_paste():
    """Get clipboard contents"""
    try:
        result = subprocess.run(['pbpaste'], capture_output=True, text=True, timeout=3)
        return {"success": True, "content": result.stdout, "message": "✅ Got clipboard"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/macos/say")
async def speak_text(request: dict):
    """Speak text out loud (Text-to-Speech)"""
    try:
        text = request.get("text", "")
        voice = request.get("voice", "Samantha")  # Default voice
        subprocess.Popen(['say', '-v', voice, text])
        return {"success": True, "message": f"✅ Speaking: {text[:50]}..."}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/macos/open-folder")
async def open_folder(request: dict):
    """Open folder in Finder"""
    try:
        path = request.get("path", "~")
        subprocess.run(['open', path], timeout=5)
        return {"success": True, "message": f"✅ Opened {path}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/macos/open-file")
async def open_file(request: dict):
    """Open file with default app"""
    try:
        path = request.get("path", "")
        subprocess.run(['open', path], timeout=5)
        return {"success": True, "message": f"✅ Opened {path}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/macos/spotlight-search")
async def spotlight_search(request: dict):
    """Open Spotlight search"""
    try:
        query = request.get("query", "")
        script = f'''
        tell application "System Events"
            keystroke space using command down
            delay 0.5
            keystroke "{query}"
        end tell
        '''
        subprocess.run(['osascript', '-e', script], timeout=5)
        return {"success": True, "message": f"✅ Searching for: {query}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/macos/force-quit")
async def force_quit_app(request: OpenAppRequest):
    """Force quit an application"""
    try:
        subprocess.run(['killall', '-9', request.app_name], timeout=3)
        return {"success": True, "message": f"✅ Force quit {request.app_name}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/macos/get-running-apps")
async def get_running_apps():
    """Get list of running applications"""
    try:
        script = 'tell application "System Events" to get name of every process whose background only is false'
        result = subprocess.run(['osascript', '-e', script], capture_output=True, text=True, timeout=5)
        apps = result.stdout.strip().split(', ')
        return {"success": True, "apps": apps, "count": len(apps)}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/macos/get-frontmost-app")
async def get_frontmost_app():
    """Get the currently active application"""
    try:
        script = 'tell application "System Events" to get name of first process whose frontmost is true'
        result = subprocess.run(['osascript', '-e', script], capture_output=True, text=True, timeout=3)
        return {"success": True, "app": result.stdout.strip()}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/macos/battery-status")
async def get_battery():
    """Get battery status"""
    try:
        result = subprocess.run(['pmset', '-g', 'batt'], capture_output=True, text=True, timeout=3)
        return {"success": True, "status": result.stdout}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/macos/mission-control")
async def show_mission_control():
    """Show Mission Control"""
    try:
        script = 'tell application "System Events" to key code 160'
        subprocess.run(['osascript', '-e', script], timeout=3)
        return {"success": True, "message": "✅ Showing Mission Control"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/macos/create-reminder")
async def create_reminder(request: dict):
    """Create a Reminder"""
    try:
        title = request.get("title", "")
        script = f'''
        tell application "Reminders"
            tell list "Reminders"
                make new reminder with properties {{name:"{title}"}}
            end tell
        end tell
        '''
        subprocess.run(['osascript', '-e', script], timeout=5)
        return {"success": True, "message": f"✅ Created reminder: {title}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/macos/play-pause-music")
async def play_pause_music():
    """Play/pause Music app"""
    try:
        script = 'tell application "Music" to playpause'
        subprocess.run(['osascript', '-e', script], timeout=3)
        return {"success": True, "message": "✅ Toggled music playback"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/macos/next-track")
async def next_track():
    """Skip to next track"""
    try:
        script = 'tell application "Music" to next track'
        subprocess.run(['osascript', '-e', script], timeout=3)
        return {"success": True, "message": "✅ Next track"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/macos/previous-track")
async def previous_track():
    """Go to previous track"""
    try:
        script = 'tell application "Music" to previous track'
        subprocess.run(['osascript', '-e', script], timeout=3)
        return {"success": True, "message": "✅ Previous track"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/health")
async def health():
    return {
        "status": "healthy", 
        "capabilities": [
            "browser", "macos", "apps", "audio", "display", 
            "notifications", "power", "clipboard", "speech", 
            "files", "music", "reminders", "system-info"
        ],
        "total_endpoints": 30
    }

if __name__ == "__main__":
    print("🚀 macOS Automation Service starting on http://localhost:9876")
    print("Capabilities:")
    print("  🌐 Browser control (open URLs)")
    print("  💻 macOS apps (open/close)")
    print("  📸 Screenshots")
    print("  📊 System info")
    print("")
    print("Called by Docker containers to control your Mac")
    uvicorn.run(app, host="0.0.0.0", port=9876, log_level="info")

