from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging
import httpx

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/tts", tags=["tts"])


class TTSRequest(BaseModel):
    text: str
    voice: str = "sarah"
    speed: str = "normal"


class TTSResponse(BaseModel):
    success: bool
    audio_url: Optional[str] = None
    audio_base64: Optional[str] = None
    error: Optional[str] = None


@router.post("/speak", response_model=TTSResponse)
async def text_to_speech(request: TTSRequest):
    """Generate speech using Kokoro TTS service"""
    try:
        # Call Kokoro TTS service
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "http://host.docker.internal:8877/synthesize",
                json={
                    "text": request.text,
                    "voice": request.voice,
                    "speed": request.speed
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                return TTSResponse(
                    success=True,
                    audio_base64=data.get("audio_data"),  # MLX service uses 'audio_data'
                    audio_url=data.get("audio_url")
                )
            else:
                logger.error(f"Kokoro TTS failed: {response.status_code}")
                return TTSResponse(
                    success=False,
                    error=f"TTS service error: {response.status_code}"
                )
    
    except Exception as e:
        logger.error(f"TTS proxy error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/voices")
async def get_available_voices():
    """Get available Kokoro voices"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get("http://host.docker.internal:8877/voices")
            if response.status_code == 200:
                return response.json()
            else:
                return {
                    "success": False,
                    "error": "Kokoro TTS service unavailable"
                }
    except Exception as e:
        logger.error(f"Failed to get voices: {e}")
        return {
            "success": False,
            "error": str(e),
            "fallback_voices": ["sarah", "eric", "bella", "adam"]
        }

