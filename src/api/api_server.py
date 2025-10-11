#!/usr/bin/env python3
"""
FastAPI Web Server for Agentic LLM Core
Provides REST API and WebSocket endpoints for frontend integration
"""

import logging
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / 'src'))

try:
    from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import HTMLResponse
    from fastapi.staticfiles import StaticFiles
    from pydantic import BaseModel
    from src.core.assessment.response_judge import judge_response

    # Import core modules
    # from src.core.security.sanitizer import sanitize_user_text  # Module doesn't exist
    from src.core.assessment.response_reviewer import evaluate_response
    from src.core.engines.local_model_manager import LocalModelConfig, ModelType, model_manager
    from src.core.logging.event_tracker import log_event

    # Import HRM orchestration routes
    try:
        from api.orchestration_routes import router as orchestration_router
        HRM_ORCHESTRATION_AVAILABLE = True
    except ImportError:
        HRM_ORCHESTRATION_AVAILABLE = False

    # Import smart chat routing
    try:
        from api.smart_chat_endpoint import router as smart_chat_router
        SMART_CHAT_AVAILABLE = True
    except ImportError:
        SMART_CHAT_AVAILABLE = False

    # Import unified chat orchestrator
    try:
        from api.unified_chat_routes import router as unified_chat_router
        UNIFIED_CHAT_AVAILABLE = True
    except ImportError:
        UNIFIED_CHAT_AVAILABLE = False

    # Import evolution routes
    try:
        from api.evolution_routes import router as evolution_router
        EVOLUTION_ROUTES_AVAILABLE = True
    except ImportError:
        EVOLUTION_ROUTES_AVAILABLE = False

    # Import evolution approval routes
    try:
        from src.api.evolution_approval_routes import router as evolution_approval_router
        EVOLUTION_APPROVAL_AVAILABLE = True
    except ImportError:
        EVOLUTION_APPROVAL_AVAILABLE = False
        evolution_approval_router = None


    # Import automation routes
    try:
        from api.automation_routes import router as automation_router
        AUTOMATION_ROUTES_AVAILABLE = True
    except ImportError:
        AUTOMATION_ROUTES_AVAILABLE = False
    # Import correction routes
    try:
        from api.correction_routes import router as correction_router
        CORRECTION_ROUTES_AVAILABLE = True
    except ImportError:
        CORRECTION_ROUTES_AVAILABLE = False

    # Import router tuning routes
    try:
        from api.router_tuning_routes import router as router_tuning_router
        ROUTER_TUNING_AVAILABLE = True
    except ImportError:
        ROUTER_TUNING_AVAILABLE = False

    # Import speech routes
    try:
        from api.speech_routes import router as speech_router
        SPEECH_ROUTES_AVAILABLE = True
    except ImportError:
        SPEECH_ROUTES_AVAILABLE = False
        speech_router = None

    # Import TTS proxy routes
    try:
        from src.api.tts_proxy_routes import router as tts_proxy_router
        TTS_PROXY_AVAILABLE = True
    except ImportError as e:
        TTS_PROXY_AVAILABLE = False
        tts_proxy_router = None
        print(f"❌ TTS proxy routes not available: {e}")
except ImportError as e:
    print(f"❌ Missing dependencies: {e}")
    print("Install with: pip install fastapi uvicorn websockets aiohttp")
    sys.exit(1)

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Pydantic models for API
class ChatRequest(BaseModel):
    """Chat request model"""
    request_id: str = str(uuid.uuid4())
    message: str
    model: Optional[str] = None
    context: Optional[Dict[str, Any]] = None
    user_id: Optional[str] = None  # NEW: Persistent user identification
    thread_id: Optional[str] = None  # NEW: Conversation thread tracking

class ChatResponse(BaseModel):
    """Chat response model"""
    request_id: str
    response: str
    model_used: str
    processing_time: float
    status: str = "success"

class ModelConfigRequest(BaseModel):
    """Model configuration request"""
    name: str
    model_type: str  # "ollama", "mlx", "qwen"
    model_name: str
    base_url: Optional[str] = None
    model_path: Optional[str] = None

class ModelInfo(BaseModel):
    """Model information"""
    name: str
    type: str
    model_name: str
    status: str
    details: Optional[Dict[str, Any]] = None

# Initialize default models on startup using lifespan events
from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for FastAPI"""
    # Startup
    try:
        registered = model_manager.initialize_default_models()
        logger.info(f"Initialized {registered} default models on startup")
    except Exception as e:
        logger.warning(f"Failed to initialize default models: {e}")

    yield

    # Shutdown
    logger.info("Shutting down NeuroForge API")

# FastAPI app
app = FastAPI(
    title="NeuroForge API",
    description="AI Development Platform API with Local Model Support",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include HRM orchestration routes
if HRM_ORCHESTRATION_AVAILABLE:
    app.include_router(orchestration_router)
    logger.info("✅ HRM Orchestration routes loaded")

# Include smart chat routes
if SMART_CHAT_AVAILABLE:
    app.include_router(smart_chat_router)
    logger.info("✅ Smart Chat routing loaded")

# Include evolution routes
if EVOLUTION_ROUTES_AVAILABLE:
    app.include_router(evolution_router)
    logger.info("✅ Nightly evolution routes loaded")

# Include evolution approval routes
if EVOLUTION_APPROVAL_AVAILABLE and evolution_approval_router:
    app.include_router(evolution_approval_router)
    logger.info("✅ Evolution approval routes loaded")

# Include automation routes
if AUTOMATION_ROUTES_AVAILABLE:
    app.include_router(automation_router)
    logger.info("✅ Automation routes loaded")

# Include unified chat routes
if UNIFIED_CHAT_AVAILABLE:
    app.include_router(unified_chat_router)
    logger.info("✅ Unified Chat orchestrator loaded")

# Include correction routes
if CORRECTION_ROUTES_AVAILABLE:
    app.include_router(correction_router)
    logger.info("✅ Correction routes loaded")

# Include router tuning routes
if ROUTER_TUNING_AVAILABLE:
    app.include_router(router_tuning_router)
    logger.info("✅ Router tuning routes loaded")

# Include speech routes
if SPEECH_ROUTES_AVAILABLE:
    app.include_router(speech_router)
    logger.info("✅ Speech routes loaded")

# Include TTS proxy routes
if TTS_PROXY_AVAILABLE:
    app.include_router(tts_proxy_router)
    logger.info("✅ TTS proxy routes loaded")

# Health check endpoint

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.get("/api/chat/optimizer/stats")
async def get_optimizer_stats():
    """Get chat optimizer performance statistics"""
    try:
        from src.core.chat.chat_optimizer import get_chat_optimizer
        optimizer = get_chat_optimizer()
        return optimizer.get_performance_stats()
    except Exception as e:
        logger.warning(f"Optimizer stats unavailable: {e}")
        return {"status": "optimizer_not_available", "error": str(e)}

# Model management endpoints
@app.get("/api/models", response_model=List[ModelInfo])
async def list_models():
    """List all registered models"""
    models = []
    for model_name in model_manager.list_available_models():
        health = model_manager.check_model_health(model_name)
        info = model_manager.get_model_info(model_name)
        models.append(ModelInfo(
            name=model_name,
            type=info.get("type", "unknown") if info else "unknown",
            model_name=info.get("model_name", model_name) if info else model_name,
            status=health.get("status", "unknown"),
            details=info
        ))
    return models

@app.post("/api/models/register")
async def register_model(config: ModelConfigRequest):
    """Register a new local model"""
    try:
        # Convert string type to enum
        model_type_map = {
            "ollama": ModelType.OLLAMA,
            "mlx": ModelType.MLX,
            "qwen": ModelType.QWEN
        }

        if config.model_type not in model_type_map:
            raise HTTPException(status_code=400, detail=f"Unsupported model type: {config.model_type}")

        model_config = LocalModelConfig(
            name=config.name,
            model_type=model_type_map[config.model_type],
            model_name=config.model_name,
            base_url=config.base_url,
            model_path=config.model_path
        )

        success = model_manager.register_model(model_config)
        if success:
            return {"message": f"Model {config.name} registered successfully"}
        else:
            raise HTTPException(status_code=500, detail=f"Failed to register model {config.name}")

    except Exception as e:
        logger.error(f"Model registration failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/models/switch/{model_name}")
async def switch_model(model_name: str):
    """Switch to a different model"""
    success = model_manager.switch_model(model_name)
    if success:
        return {"message": f"Switched to model: {model_name}"}
    else:
        raise HTTPException(status_code=404, detail=f"Model not found: {model_name}")

@app.get("/api/models/current")
async def get_current_model():
    """Get information about the current model"""
    info = model_manager.get_model_info(model_manager.current_model)
    if info:
        return info
    else:
        return {"message": "No model selected"}

# Import comprehensive tool calling system
from api.tool_calling_agent import detect_and_execute_tool, format_tool_response


# Legacy function (replaced by comprehensive tool calling)
async def _detect_and_execute_browser_action(message: str) -> Optional[Dict]:
    """Detect if message is a browser automation request and execute it"""
    message_lower = message.lower()

    # Browser automation keywords
    browser_keywords = [
        "open browser", "open a browser", "browse", "search google",
        "search for", "navigate to", "go to website", "visit"
    ]

    if not any(keyword in message_lower for keyword in browser_keywords):
        return None

    logger.info(f"🌐 Detected browser automation request: {message}")

    try:
        # Extract URL or search query
        url = None
        if "google.com" in message_lower or "search google" in message_lower or "search for" in message_lower:
            # Extract search query
            import re
            search_match = re.search(r'(?:search (?:for |google for )?|about )(.+?)(?:\.|$)', message_lower)
            if search_match:
                query = search_match.group(1).strip()
                url = f"https://www.google.com/search?q={query.replace(' ', '+')}"
        elif "http" in message_lower:
            # Extract URL
            import re
            url_match = re.search(r'(https?://[^\s]+)', message_lower)
            if url_match:
                url = url_match.group(1)

        if not url:
            # Default to Google with the whole message as query
            import urllib.parse
            query = urllib.parse.quote(message)
            url = f"https://www.google.com/search?q={query}"

        # Call browser automation API
        from src.core.automation.browser_control import get_browser_controller
        controller = get_browser_controller()
        result = await controller.navigate(url)

        logger.info(f"✅ Browser opened: {url}")

        # Try to extract content from the page
        try:
            content = await controller.get_page_content()
            # Limit content to first 500 chars
            page_info = content.get("text", "")[:500] if content else ""
        except:
            page_info = ""

        return {
            "success": True,
            "action": "browser_navigation",
            "url": url,
            "page_preview": page_info,
            "message": f"✅ Opened browser to {url}"
        }

    except Exception as e:
        logger.error(f"Browser automation failed: {e}")
        return {
            "success": False,
            "action": "browser_navigation",
            "error": str(e),
            "message": f"I tried to open a browser but encountered an error: {str(e)}"
        }

# Chat endpoint - NOW USES ORCHESTRATOR FOR RAG, SEARCH, ROUTING & LEARNING + BROWSER AUTOMATION + OPTIMIZATION
@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    Process chat request with FULL AGENTIC SYSTEM + CHAT OPTIMIZER
    
    Features:
    - **NEW: Intelligent system prompts & context management**
    - **NEW: Response tuning & model selection**
    - RAG (Retrieval Augmented Generation)
    - Internet search
    - Task classification & intelligent routing
    - Auto-learning & performance tracking
    - Self-evolution recommendations
    - Browser automation tool calling
    """
    try:
        start_time = datetime.now()

        # Initialize chat optimizer
        try:
            from src.core.chat.chat_optimizer import get_chat_optimizer
            optimizer = await get_chat_optimizer()
            use_optimizer = True
        except Exception as opt_err:
            logger.warning(f"Chat optimizer not available: {opt_err}")
            optimizer = None
            use_optimizer = False

        # Sanitize input
        sanitized = sanitize_user_text(request.message)

        # Build optimized system prompt if optimizer available
        system_prompt = None
        # Use persistent user_id from request, or fallback to request_id
        user_id = request.user_id or request.request_id[:8]
        thread_id = request.thread_id or f"user_{user_id}"  # Thread identifier

        logger.info(f"💬 Chat request from user={user_id}, thread={thread_id}")

        if use_optimizer:
            # Use agentic prompt generation (falls back to template if unavailable)
            system_prompt = await optimizer.build_system_prompt_agentic(request.context)
            # Get conversation context from Postgres
            conversation_context = await optimizer.format_context_for_prompt(user_id, thread_id)
            if conversation_context:
                system_prompt += "\n" + conversation_context

        # Log event
        await log_event({
            "event_type": "chat_request",
            "request_id": request.request_id,
            "message_length": len(request.message),
            "model": request.model,
            "timestamp": start_time.isoformat(),
            "optimizer_enabled": use_optimizer
        })

        # 🔧 COMPREHENSIVE TOOL CALLING - Check for ANY tool request
        tool_result = await detect_and_execute_tool(sanitized.text)
        browser_result = tool_result  # For backwards compatibility
        if tool_result:
            # Tool was called - format response with LLM
            response_text = await format_tool_response(tool_result, sanitized.text)
            tool_name = tool_result.get("tool", "unknown")
            model_used = f"{tool_name}_tool + llama3.2:3b"

            logger.info(f"✅ Tool executed: {tool_name} - success={tool_result.get('success')}")

        else:
            # Regular chat - Try to use unified orchestrator (RAG + Search + Routing + Learning)
            try:
                from src.core.unified_orchestration.unified_chat_orchestrator import (
                    get_unified_orchestrator,
                )
                orchestrator = get_unified_orchestrator()

                logger.info("🧠 Using orchestrator for intelligent routing")

                result = await orchestrator.chat(
                    message=sanitized.text,
                    context=request.context or {}
                )

                response_text = result.get("response", "I couldn't process that request.")
                model_used = f"{result.get('backend_used', 'unknown')} ({result.get('task_type', 'general')})"

                logger.info(f"✅ Orchestrator: {result.get('task_type')} → {result.get('backend_used')} ({result.get('elapsed_s', 0):.2f}s)")

            except Exception as orch_error:
                # Fallback to basic LLM if orchestrator fails
                logger.warning(f"⚠️  Orchestrator unavailable: {orch_error}, using fallback")

                try:
                    import httpx
                    async with httpx.AsyncClient(timeout=30.0) as client:
                        ollama_url = os.getenv("OLLAMA_URL", "http://host.docker.internal:11434")
                        ollama_response = await client.post(
                            f"{ollama_url}/api/generate",
                            json={
                                "model": request.model or "llama3.2:3b",
                                "prompt": sanitized.text,
                                "stream": False
                            }
                        )
                        if ollama_response.status_code == 200:
                            ollama_data = ollama_response.json()
                            response_text = ollama_data.get("response", "")
                            model_used = request.model or "llama3.2:3b"
                        else:
                            raise Exception("Ollama returned non-200")
                except Exception as e:
                    logger.error(f"Fallback also failed: {e}")
                    response_text = "I apologize, but I'm having trouble processing your request."
                    model_used = "error_fallback"

        processing_time = (datetime.now() - start_time).total_seconds()

        # Tune response if optimizer is available
        if use_optimizer:
            response_text = optimizer.tune_response(
                response_text,
                context=request.context,
                tool_result=tool_result
            )
            # Add to conversation history for context - saves to Postgres!
            await optimizer.add_conversation_context(
                user_id=user_id,
                message=sanitized.text,
                response=response_text,
                thread_id=thread_id,
                metadata=request.context,
                model_used=model_used,
                processing_time=processing_time
            )

        return ChatResponse(
            request_id=request.request_id,
            response=response_text,
            model_used=model_used,
            processing_time=processing_time
        )

    except Exception as e:
        logger.error(f"Error processing chat request: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# WebSocket endpoint
@app.websocket("/ws/chat")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time intelligent chat
    
    Uses full agentic system with:
    - RAG (Retrieval Augmented Generation)
    - Internet search
    - Task classification & routing
    - Multiple specialized backends
    """
    await websocket.accept()

    # Try to import unified orchestrator
    try:
        from src.core.unified_orchestration.unified_chat_orchestrator import (
            get_unified_orchestrator,
        )
        orchestrator = get_unified_orchestrator()
        use_orchestrator = True
        logger.info("✅ WebSocket using unified orchestrator (RAG + Search + Routing)")
    except Exception as e:
        logger.warning(f"⚠️  Unified orchestrator not available, using fallback: {e}")
        use_orchestrator = False

    try:
        while True:
            data = await websocket.receive_text()

            try:
                # Parse message (could be JSON or plain text)
                import json
                try:
                    message_data = json.loads(data)
                    user_message = message_data.get("message", data)
                    context = message_data.get("context", {})
                except:
                    user_message = data
                    context = {}

                # Sanitize input
                sanitized = sanitize_user_text(user_message)

                # Use unified orchestrator (RAG + Search + Routing)
                if use_orchestrator:
                    try:
                        result = await orchestrator.chat(
                            message=sanitized.text,
                            context=context
                        )

                        # Extract response
                        response_text = result.get("response", "I couldn't process that request.")

                        # Add metadata if routing was used
                        task_type = result.get("task_type", "general")
                        backend = result.get("backend_used", "unknown")

                        # Add helpful context for certain task types
                        if task_type == "research" and "sources" in result.get("metadata", {}):
                            sources = result["metadata"]["sources"]
                            if sources:
                                response_text += f"\n\n📚 Sources: {', '.join(sources[:3])}"

                        logger.info(f"WebSocket routed to: {backend} (task: {task_type})")

                    except Exception as orch_error:
                        logger.error(f"Orchestrator error: {orch_error}")
                        # Fallback to basic LLM
                        use_orchestrator = False
                        response_text = await _fallback_llm_chat(sanitized.text)
                else:
                    # Fallback: basic LLM without RAG/search
                    response_text = await _fallback_llm_chat(sanitized.text)

                # Send response back
                await websocket.send_text(response_text)

            except Exception as e:
                logger.error(f"WebSocket message processing error: {e}")
                await websocket.send_text("I encountered an error processing your message.")

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")


async def _fallback_llm_chat(message: str) -> str:
    """Fallback to basic LLM if orchestrator unavailable"""
    try:
        import httpx
        async with httpx.AsyncClient(timeout=30.0) as client:
            ollama_url = os.getenv("OLLAMA_URL", "http://host.docker.internal:11434")
            ollama_response = await client.post(
                f"{ollama_url}/api/generate",
                json={
                    "model": "llama3.2:3b",
                    "prompt": message,
                    "stream": False
                }
            )
            if ollama_response.status_code == 200:
                ollama_data = ollama_response.json()
                return ollama_data.get("response", "I couldn't generate a response.")
            else:
                return "I'm having trouble connecting to the AI model."
    except Exception as e:
        logger.error(f"Fallback LLM error: {e}")
        return "I'm having trouble processing your request right now."

# Learning system debug endpoint
@app.get("/api/learning/status")
async def get_learning_status():
    """Get ACTUAL learning system status from the RUNNING orchestrator"""
    try:
        from src.core.unified_orchestration.unified_chat_orchestrator import (
            get_unified_orchestrator,
        )
        orch = get_unified_orchestrator()

        stats = {
            "orchestrator_id": id(orch),
            "execution_history_count": len(orch.execution_history),
            "recent_executions": orch.execution_history[-5:] if orch.execution_history else [],
        }

        if orch.tuner:
            tuner_stats = orch.tuner.get_statistics()
            stats["learning"] = {
                "total_routings": tuner_stats.get("total_routings", 0),
                "success_rate": tuner_stats.get("overall_success_rate", 0),
                "backends": tuner_stats.get("by_backend", {}),
                "task_types": tuner_stats.get("by_task_type", {}),
                "backend_performance": tuner_stats.get("backend_performance", {})
            }

            recommendations = orch.tuner.get_tuning_recommendations()
            stats["evolution"] = {
                "status": recommendations.get("status"),
                "recommendation_count": len(recommendations.get("recommendations", [])),
                "recommendations": recommendations.get("recommendations", [])[:5]
            }
        else:
            stats["learning"] = {"error": "Tuner not available"}

        return stats

    except Exception as e:
        return {"error": str(e), "traceback": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)

