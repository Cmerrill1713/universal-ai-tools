#!/usr/bin/env python3
"""
Tool Calling Agent - Wires ALL agents and tools into the chat
Enables the LLM to call any of the 40 endpoints and 19 agents
"""

import logging
import re
from typing import Optional, Dict, Any
import httpx

logger = logging.getLogger(__name__)


async def detect_and_execute_tool(message: str) -> Optional[Dict[str, Any]]:
    """
    Master tool detector - checks message and calls appropriate tool
    
    Returns Dict with result if tool was called, None if no tool detected
    """
    message_lower = message.lower()
    
    # 1. Application Building (highest priority for complex dev tasks)
    app_building_result = await _detect_app_building_request(message, message_lower)
    if app_building_result:
        return app_building_result
    
    # 2. Browser Automation
    browser_result = await _detect_browser_request(message, message_lower)
    if browser_result:
        return browser_result
    
    # 3. macOS System Control
    macos_result = await _detect_macos_request(message, message_lower)
    if macos_result:
        return macos_result
    
    # 4. GitHub Operations
    github_result = await _detect_github_request(message, message_lower)
    if github_result:
        return github_result
    
    # 5. Puzzle Solving
    puzzle_result = await _detect_puzzle_request(message, message_lower)
    if puzzle_result:
        return puzzle_result
    
    # 6. Research & Orchestration
    research_result = await _detect_research_request(message, message_lower)
    if research_result:
        return research_result
    
    # No tool detected
    return None


async def _detect_app_building_request(message: str, message_lower: str) -> Optional[Dict]:
    """Detect and execute application building requests via agentic platform"""
    building_keywords = [
        "build", "create", "make", "develop", "generate", "implement",
        "write a", "design a", "build me", "create me", "make me"
    ]
    
    app_keywords = [
        "app", "application", "website", "web app", "api", "backend",
        "frontend", "service", "microservice", "tool", "cli", "bot",
        "dashboard", "platform", "system", "project"
    ]
    
    # Check if it's an application building request
    has_building = any(keyword in message_lower for keyword in building_keywords)
    has_app_type = any(keyword in message_lower for keyword in app_keywords)
    
    if not (has_building and has_app_type):
        return None
    
    logger.info(f"🏗️ Application building detected: {message}")
    
    try:
        # Call the agentic engineering platform
        async with httpx.AsyncClient(timeout=180.0) as client:  # Long timeout for complex tasks
            response = await client.post(
                "http://localhost:8000/api/v1/orchestration/orchestrate",
                json={
                    "task": message,
                    "complexity": "god_tier",
                    "context": {
                        "task_type": "application_development",
                        "requested_via": "neuroforge_chat"
                    },
                    "constraints": [
                        "Follow best practices",
                        "Include documentation",
                        "Add tests where appropriate"
                    ],
                    "success_criteria": [
                        "Code is functional",
                        "Well documented",
                        "Ready to run"
                    ]
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "tool": "agentic_builder",
                    "success": True,
                    "result": data,
                    "message": f"🏗️ Built application using {data.get('agents_used', 'multiple')} agents"
                }
            else:
                # Try fallback to God Tier system
                response2 = await client.post(
                    "http://localhost:3033/smart",
                    json={
                        "messages": [{"role": "user", "content": message}],
                        "context": {"mode": "development"}
                    }
                )
                
                if response2.status_code == 200:
                    data = response2.json()
                    return {
                        "tool": "god_tier_builder",
                        "success": True,
                        "result": data.get("response", ""),
                        "message": "🏗️ Application plan created via God Tier agents"
                    }
    
    except Exception as e:
        logger.error(f"Agentic builder error: {e}")
        return {
            "tool": "agentic_builder",
            "success": False,
            "error": str(e),
            "message": f"Agentic builder encountered an error: {str(e)}"
        }
    
    return None


async def _detect_browser_request(message: str, message_lower: str) -> Optional[Dict]:
    """Detect and execute browser automation requests"""
    browser_keywords = [
        "open browser", "open a browser", "browse", "search google", 
        "search for", "navigate to", "go to website", "visit", "look up"
    ]
    
    if not any(keyword in message_lower for keyword in browser_keywords):
        return None
    
    logger.info(f"🌐 Browser automation detected: {message}")
    
    try:
        from src.core.automation.browser_control import get_browser_controller
        controller = get_browser_controller()
        
        # Extract URL or search query
        url = None
        query = None
        
        # Try to extract explicit URL
        if "http" in message_lower:
            url_match = re.search(r'(https?://[^\s]+)', message_lower)
            if url_match:
                url = url_match.group(1)
        
        # If no URL, extract search query
        if not url:
            # Try multiple patterns to extract just the search query
            patterns = [
                r'(?:search (?:for |google )?|look (?:up |for )|find )(?:information (?:on |about )?)?(.+?)(?:\?|\.|\!|$)',
                r'(?:browser and |browser to )(?:search for |look for |find )(.+?)(?:\?|\.|\!|$)',
                r'(?:google |bing )(.+?)(?:\?|\.|\!|$)',
            ]
            
            for pattern in patterns:
                match = re.search(pattern, message_lower)
                if match:
                    query = match.group(1).strip()
                    # Remove common trailing words
                    query = re.sub(r'\s+(please|now|today)$', '', query)
                    break
            
            # If still no query, use the whole message but strip browser-opening phrases
            if not query:
                query = re.sub(r'^.*?(?:open (?:a )?browser (?:and )?(?:to )?|search for |look for )', '', message_lower).strip()
                query = re.sub(r'[\?\.!]$', '', query).strip()
            
            if query:
                import urllib.parse
                query_encoded = urllib.parse.quote(query)
                url = f"https://www.google.com/search?q={query_encoded}"
        
        result = await controller.navigate(url)
        content = await controller.get_page_content()
        
        return {
            "tool": "browser",
            "success": result.get("success", False),
            "url": url,
            "content": content.get("text", "")[:1500] if content.get("success") else "",
            "message": f"✅ Opened browser to {url}"
        }
    
    except Exception as e:
        logger.error(f"Browser tool error: {e}")
        return {"tool": "browser", "success": False, "error": str(e)}


async def _detect_macos_request(message: str, message_lower: str) -> Optional[Dict]:
    """Detect and execute macOS system control requests"""
    macos_keywords = {
        "open": ["open", "launch", "start"],
        "close": ["close", "quit", "exit"],
        "screenshot": ["screenshot", "screen shot", "take a screenshot", "capture screen"],
        "system_info": ["system info", "memory usage", "disk space", "cpu usage"],
        "settings": ["open settings", "system settings", "preferences"],
        "dark_mode": ["dark mode", "toggle dark mode", "enable dark mode"],
        "volume": ["set volume", "volume to", "volume at", "adjust volume"],
        "mute": ["mute", "unmute", "toggle mute"],
        "brightness": ["brightness", "set brightness", "dim screen", "brighten"],
        "notification": ["send notification", "notify", "show notification"],
        "minimize": ["minimize", "hide all", "minimize all"],
        "desktop": ["show desktop", "desktop"],
        "lock": ["lock screen", "lock computer", "lock my mac"],
        "sleep": ["put to sleep", "sleep computer", "go to sleep"],
        "trash": ["empty trash", "clear trash"],
        "wifi": ["wifi", "turn off wifi", "turn on wifi", "disable wifi"]
    }
    
    action = None
    app_name = None
    params = {}
    
    # Check for app opening - more flexible pattern
    if any(kw in message_lower for kw in macos_keywords["open"]):
        # Try multiple patterns to extract app name
        patterns = [
            r'(?:open|launch|start)\s+(?:the\s+)?(.+?)(?:\s+app)?(?:\s+for\s+me)?(?:\s*[.,!?]|$)',
            r'(?:open|launch|start)\s+(.+)',
        ]
        for pattern in patterns:
            app_match = re.search(pattern, message_lower)
            if app_match:
                app_name = app_match.group(1).strip()
                # Remove common trailing words
                app_name = re.sub(r'\s+(please|app|application)$', '', app_name)
                # Title case each word
                app_name = ' '.join(word.capitalize() for word in app_name.split())
                action = "open_app"
                break
    
    # Check for app closing - more flexible pattern
    elif any(kw in message_lower for kw in macos_keywords["close"]):
        patterns = [
            r'(?:close|quit|exit)\s+(?:the\s+)?(.+?)(?:\s+app)?(?:\s+for\s+me)?(?:\s*[.,!?]|$)',
            r'(?:close|quit|exit)\s+(.+)',
        ]
        for pattern in patterns:
            app_match = re.search(pattern, message_lower)
            if app_match:
                app_name = app_match.group(1).strip()
                app_name = re.sub(r'\s+(please|app|application)$', '', app_name)
                app_name = ' '.join(word.capitalize() for word in app_name.split())
                action = "close_app"
                break
    
    # Check for volume
    elif any(kw in message_lower for kw in macos_keywords["volume"]):
        vol_match = re.search(r'volume\s+(?:to\s+)?(\d+)', message_lower)
        if vol_match:
            params['level'] = int(vol_match.group(1))
            action = "set_volume"
    
    # Check for brightness
    elif any(kw in message_lower for kw in macos_keywords["brightness"]):
        bright_match = re.search(r'brightness\s+(?:to\s+)?(\d+)', message_lower)
        if bright_match:
            params['level'] = int(bright_match.group(1)) / 100.0
            action = "set_brightness"
    
    # Check for screenshot
    elif any(kw in message_lower for kw in macos_keywords["screenshot"]):
        action = "screenshot"
    
    # Check for notification
    elif any(kw in message_lower for kw in macos_keywords["notification"]):
        notify_match = re.search(r'notification\s+(.+)', message_lower)
        if notify_match:
            params['message'] = notify_match.group(1).strip()
            action = "notification"
    
    # Check for other actions
    elif any(kw in message_lower for kw in macos_keywords["mute"]):
        action = "toggle_mute"
    elif any(kw in message_lower for kw in macos_keywords["minimize"]):
        action = "minimize_all"
    elif any(kw in message_lower for kw in macos_keywords["desktop"]):
        action = "show_desktop"
    elif any(kw in message_lower for kw in macos_keywords["lock"]):
        action = "lock_screen"
    elif any(kw in message_lower for kw in macos_keywords["sleep"]):
        action = "sleep_computer"
    elif any(kw in message_lower for kw in macos_keywords["trash"]):
        action = "empty_trash"
    elif any(kw in message_lower for kw in macos_keywords["dark_mode"]):
        action = "toggle_dark_mode"
    elif "wifi" in message_lower:
        if "off" in message_lower or "disable" in message_lower:
            params['action'] = 'off'
        else:
            params['action'] = 'on'
        action = "toggle_wifi"
    elif any(kw in message_lower for kw in macos_keywords["system_info"]):
        action = "system_info"
    elif any(kw in message_lower for kw in macos_keywords["settings"]):
        action = "open_settings"
    
    if not action:
        return None
    
    logger.info(f"💻 macOS control detected: {action} {app_name or ''}")
    
    try:
        import httpx
        
        # Call the macOS automation service on port 9876
        async with httpx.AsyncClient(timeout=10.0) as client:
            if action == "open_app" and app_name:
                response = await client.post("http://host.docker.internal:9876/macos/open-app", json={"app_name": app_name})
            elif action == "close_app" and app_name:
                response = await client.post("http://host.docker.internal:9876/macos/close-app", json={"app_name": app_name})
            elif action == "screenshot":
                response = await client.post("http://host.docker.internal:9876/macos/screenshot", json={})
            elif action == "set_volume":
                response = await client.post("http://host.docker.internal:9876/macos/volume", json=params)
            elif action == "toggle_mute":
                response = await client.post("http://host.docker.internal:9876/macos/mute", json={})
            elif action == "set_brightness":
                response = await client.post("http://host.docker.internal:9876/macos/brightness", json=params)
            elif action == "notification":
                response = await client.post("http://host.docker.internal:9876/macos/notification", json=params)
            elif action == "minimize_all":
                response = await client.post("http://host.docker.internal:9876/macos/minimize-all", json={})
            elif action == "show_desktop":
                response = await client.post("http://host.docker.internal:9876/macos/show-desktop", json={})
            elif action == "lock_screen":
                response = await client.post("http://host.docker.internal:9876/macos/lock-screen", json={})
            elif action == "sleep_computer":
                response = await client.post("http://host.docker.internal:9876/macos/sleep", json={})
            elif action == "empty_trash":
                response = await client.post("http://host.docker.internal:9876/macos/empty-trash", json={})
            elif action == "toggle_dark_mode":
                response = await client.post("http://host.docker.internal:9876/macos/dark-mode", json={})
            elif action == "toggle_wifi":
                response = await client.post("http://host.docker.internal:9876/macos/wifi", json=params)
            elif action == "system_info":
                response = await client.post("http://host.docker.internal:9876/macos/system-info", json={"info_type": "memory"})
            elif action == "open_settings":
                response = await client.post("http://host.docker.internal:9876/macos/open-app", json={"app_name": "System Settings"})
            else:
                return None
            
            if response.status_code == 200:
                result = response.json()
            else:
                result = {"success": False, "error": f"HTTP {response.status_code}"}
        
        return {
            "tool": "macos",
            "action": action,
            "success": result.get("success", False),
            "result": result,
            "message": result.get("message", f"Executed {action}")
        }
    
    except Exception as e:
        logger.error(f"macOS tool error: {e}")
        return {"tool": "macos", "success": False, "error": str(e)}


async def _detect_github_request(message: str, message_lower: str) -> Optional[Dict]:
    """Detect and execute GitHub operations"""
    github_keywords = [
        "github", "repository", "repo", "pull request", "pr", 
        "issue", "commit", "search github", "create issue"
    ]
    
    if not any(keyword in message_lower for keyword in github_keywords):
        return None
    
    logger.info(f"🐙 GitHub operation detected: {message}")
    
    # For now, return a signal that GitHub tools should be used
    # The full MCP integration would handle the actual calls
    return {
        "tool": "github",
        "success": False,
        "message": "GitHub tools available but need MCP integration - use direct API",
        "suggestion": "Try: curl http://localhost:8013/api/github/..."
    }


async def _detect_puzzle_request(message: str, message_lower: str) -> Optional[Dict]:
    """Detect and execute puzzle solving requests"""
    puzzle_keywords = ["sudoku", "maze", "arc", "puzzle", "grid", "pattern"]
    
    if not any(keyword in message_lower for keyword in puzzle_keywords):
        return None
    
    logger.info(f"🧩 Puzzle solving detected: {message}")
    
    # Check if there's a grid in the message
    grid_match = re.search(r'\[\[.*?\]\]', message)
    if grid_match:
        try:
            import json
            grid_str = grid_match.group(0)
            grid = json.loads(grid_str)
            
            # Call TRM orchestration
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "http://localhost:8013/api/orchestration/solve-grid",
                    json={
                        "task_type": "arc",
                        "grid": grid,
                        "instructions": message
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "tool": "puzzle_solver",
                        "success": data.get("success", False),
                        "solution": data.get("solution", ""),
                        "message": f"🧩 Solved puzzle using TRM model"
                    }
        
        except Exception as e:
            logger.error(f"Puzzle solving error: {e}")
    
    return {
        "tool": "puzzle_solver",
        "success": False,
        "message": "Puzzle solver available - provide grid in [[row],[row]] format"
    }


async def _detect_research_request(message: str, message_lower: str) -> Optional[Dict]:
    """Detect and execute research/orchestration requests"""
    research_keywords = [
        "research", "analyze", "investigate", "study", "explore",
        "compare", "evaluate", "review", "plan", "design"
    ]
    
    if not any(keyword in message_lower for keyword in research_keywords):
        return None
    
    logger.info(f"🔬 Research/orchestration detected: {message}")
    
    try:
        # Call orchestration endpoint
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "http://localhost:8013/api/orchestration/execute",
                json={
                    "goal": message,
                    "enable_hrm": True,
                    "enable_refiner": True
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "tool": "orchestration",
                    "success": data.get("success", False),
                    "summary": data.get("summary", ""),
                    "decisions": data.get("decisions", []),
                    "message": f"🔬 Orchestrated {len(data.get('decisions', []))} agents"
                }
            else:
                # Fallback: let LLM handle it normally
                logger.warning(f"Orchestration returned {response.status_code}")
                return None
    
    except Exception as e:
        logger.warning(f"Orchestration not available: {e}")
        # Return None to let normal LLM handle it
        return None


async def format_tool_response(tool_result: Dict, original_message: str) -> str:
    """
    Format tool result into a natural language response using LLM
    
    Args:
        tool_result: Dict from tool execution
        original_message: User's original message
    
    Returns:
        Formatted natural language response
    """
    import os
    
    if not tool_result.get("success"):
        return f"I tried to use the {tool_result.get('tool', 'tool')} but encountered an error: {tool_result.get('error', 'Unknown error')}"
    
    # Build context for LLM
    tool_name = tool_result.get("tool", "unknown")
    
    if tool_name == "browser":
        prompt = f"User asked: {original_message}\n\n"
        prompt += f"I opened a browser to {tool_result.get('url')}. "
        if tool_result.get("content"):
            prompt += f"Here's what I found:\n\n{tool_result['content'][:1000]}\n\n"
        prompt += "Please provide a helpful summary answering the user's question."
    
    elif tool_name == "macos":
        prompt = f"User asked: {original_message}\n\n"
        prompt += f"I executed: {tool_result.get('action')} "
        if tool_result.get("result"):
            prompt += f"\nResult: {tool_result['result']}"
        prompt += "\n\nPlease confirm what was done in a friendly way."
    
    elif tool_name == "orchestration":
        prompt = f"User asked: {original_message}\n\n"
        prompt += f"I used multiple agents to research this. Summary: {tool_result.get('summary', '')}"
        prompt += "\n\nPlease present this to the user in a clear way."
    
    elif tool_name == "puzzle_solver":
        prompt = f"User asked: {original_message}\n\n"
        prompt += f"I solved the puzzle. Solution: {tool_result.get('solution', '')}"
        prompt += "\n\nPlease explain the solution clearly."
    
    else:
        return tool_result.get("message", "Task completed")
    
    # Get LLM to format the response
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            ollama_url = os.getenv("OLLAMA_URL", "http://host.docker.internal:11434")
            response = await client.post(
                f"{ollama_url}/api/generate",
                json={
                    "model": "llama3.2:3b",
                    "prompt": prompt,
                    "stream": False
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                ai_response = data.get("response", "")
                return f"{tool_result.get('message', '')}\n\n{ai_response}"
    
    except Exception as e:
        logger.warning(f"LLM formatting failed: {e}")
    
    return tool_result.get("message", "Task completed")

