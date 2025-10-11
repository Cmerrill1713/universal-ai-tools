from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
import logging
import subprocess
import tempfile
import os

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/speech", tags=["speech"])


class TranscriptionResponse(BaseModel):
    transcript: str
    confidence: float = 0.95
    language: str = "en"


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(audio: UploadFile = File(...)):
    """Transcribe audio to text using Whisper"""
    try:
        # Save uploaded audio to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".m4a") as temp_audio:
            content = await audio.read()
            temp_audio.write(content)
            temp_path = temp_audio.name
        
        try:
            # Try using whisper command line
            result = subprocess.run(
                ['whisper', temp_path, '--model', 'base', '--output_format', 'txt'],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                # Read the output file
                txt_file = temp_path.replace('.m4a', '.txt')
                if os.path.exists(txt_file):
                    with open(txt_file, 'r') as f:
                        transcript = f.read().strip()
                    os.remove(txt_file)
                    
                    return TranscriptionResponse(
                        transcript=transcript,
                        confidence=0.9,
                        language="en"
                    )
        except FileNotFoundError:
            logger.warning("Whisper not installed, using fallback")
        except Exception as e:
            logger.error(f"Whisper error: {e}")
        
        finally:
            # Clean up
            if os.path.exists(temp_path):
                os.remove(temp_path)
        
        # Fallback: Return a message asking user to install Whisper
        raise HTTPException(
            status_code=501,
            detail="Whisper not installed. Install with: pip install openai-whisper"
        )
    
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/voices")
async def get_voices():
    """List available TTS voices"""
    return {
        "success": True,
        "voices": [
            {"id": "samantha", "name": "Samantha", "language": "en-US"},
            {"id": "alex", "name": "Alex", "language": "en-US"},
            {"id": "victoria", "name": "Victoria", "language": "en-UK"}
        ]
    }

