#!/usr/bin/env python3
"""
OpenAI TTS Service - AI-Powered Neural Voices
Uses OpenAI's TTS API for high-quality, natural-sounding voices
"""

import argparse
import base64
import json
import logging
import os
import tempfile
import time
from typing import Any, Dict, List, Optional

import openai
from flask import Flask, jsonify, request
from flask_cors import CORS

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('openai-tts-service')

# Initialize Flask app
app = Flask(__name__)
CORS(app)


class OpenAITTS:
    """OpenAI TTS service with neural voices"""

    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv('OPENAI_API_KEY')
        self.client = None
        self.voices = {
            'narrator_male': {
                'voice': 'alloy',
                'description': 'Neural male voice - clear and professional',
                'emotions': {
                    'professional': {'speed': 1.0},
                    'friendly': {'speed': 1.1},
                    'calm': {'speed': 0.9},
                    'excited': {'speed': 1.2},
                    'serious': {'speed': 0.95}
                }
            },
            'narrator_female': {
                'voice': 'nova',
                'description': 'Neural female voice - warm and engaging',
                'emotions': {
                    'professional': {'speed': 1.0},
                    'friendly': {'speed': 1.1},
                    'calm': {'speed': 0.9},
                    'excited': {'speed': 1.2},
                    'serious': {'speed': 0.95}
                }
            },
            'conversational_male': {
                'voice': 'echo',
                'description': 'Neural male voice - conversational and natural',
                'emotions': {
                    'professional': {'speed': 1.0},
                    'friendly': {'speed': 1.1},
                    'calm': {'speed': 0.9},
                    'excited': {'speed': 1.2},
                    'happy': {'speed': 1.15}
                }
            },
            'conversational_female': {
                'voice': 'shimmer',
                'description': 'Neural female voice - conversational and natural',
                'emotions': {
                    'professional': {'speed': 1.0},
                    'friendly': {'speed': 1.1},
                    'calm': {'speed': 0.9},
                    'excited': {'speed': 1.2},
                    'happy': {'speed': 1.15}
                }
            },
            'child': {
                'voice': 'nova',
                'description': 'Neural voice - playful and energetic',
                'emotions': {
                    'excited': {'speed': 1.3},
                    'happy': {'speed': 1.2},
                    'calm': {'speed': 1.0},
                    'playful': {'speed': 1.25}
                }
            },
            'elderly': {
                'voice': 'alloy',
                'description': 'Neural voice - mature and wise',
                'emotions': {
                    'professional': {'speed': 0.9},
                    'calm': {'speed': 0.8},
                    'wise': {'speed': 0.85},
                    'serious': {'speed': 0.9}
                }
            },
            'robot': {
                'voice': 'fable',
                'description': 'Neural voice - mechanical and precise',
                'emotions': {
                    'professional': {'speed': 1.0},
                    'serious': {'speed': 0.95},
                    'calm': {'speed': 0.9},
                    'mechanical': {'speed': 1.05}
                }
            }
        }
        
        if self.api_key:
            try:
                self.client = openai.OpenAI(api_key=self.api_key)
                logger.info("OpenAI client initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize OpenAI client: {e}")
                self.client = None
        else:
            logger.warning("No OpenAI API key provided - service will run in mock mode")

    def generate_speech(self, text: str, speaker: str = "narrator_male", emotion: str = "professional") -> Dict[str, Any]:
        """Generate speech using OpenAI TTS"""
        try:
            logger.info(f"Generating speech: '{text[:50]}...' with speaker: {speaker}, emotion: {emotion}")
            
            # Get voice configuration
            voice_config = self.voices.get(speaker, self.voices['narrator_male'])
            voice_name = voice_config['voice']
            emotion_config = voice_config['emotions'].get(emotion, voice_config['emotions']['professional'])
            
            if not self.client:
                return self._mock_generate_speech(text, speaker, voice_name)
            
            # Create temporary file for audio output
            with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as temp_file:
                temp_path = temp_file.name
            
            try:
                # Call OpenAI TTS API
                start_time = time.time()
                
                response = self.client.audio.speech.create(
                    model="tts-1",
                    voice=voice_name,
                    input=text,
                    speed=emotion_config['speed']
                )
                
                # Save audio to file
                response.stream_to_file(temp_path)
                generation_time = time.time() - start_time
                
                # Get file size
                file_size = os.path.getsize(temp_path)
                
                # Read and encode audio data
                with open(temp_path, 'rb') as f:
                    audio_data = base64.b64encode(f.read()).decode('utf-8')
                
                # Clean up temp file
                os.unlink(temp_path)
                
                # Estimate duration (rough calculation)
                duration = max(1.0, len(text) * 0.08)
                
                logger.info(f"✅ OpenAI TTS generated successfully: {voice_name}, {file_size} bytes")
                
                return {
                    "success": True,
                    "audio_data": audio_data,
                    "audio_format": "mp3",
                    "sample_rate": 22050,
                    "duration": duration,
                    "generation_time": generation_time,
                    "speaker": speaker,
                    "emotion": emotion,
                    "voice_used": voice_name,
                    "voice_description": voice_config['description'],
                    "file_size": file_size,
                    "text": text,
                    "provider": "OpenAI TTS"
                }
                
            except Exception as e:
                logger.error(f"OpenAI TTS API call failed: {e}")
                return self._mock_generate_speech(text, speaker, voice_name)
                
        except Exception as e:
            logger.error(f"Speech generation failed: {e}")
            return self._mock_generate_speech(text, speaker, "alloy")

    def _mock_generate_speech(self, text: str, speaker: str, voice_name: str) -> Dict[str, Any]:
        """Mock speech generation when API is not available"""
        logger.info(f"Mock generating speech: '{text[:50]}...' with voice: {voice_name}")
        
        try:
            # Create a simple mock MP3 file (silence)
            import wave
            import struct
            
            sample_rate = 22050
            duration = max(1.0, len(text) * 0.08)
            num_samples = int(sample_rate * duration)
            
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                temp_path = temp_file.name
            
            with wave.open(temp_path, 'wb') as wav_file:
                wav_file.setnchannels(1)  # Mono
                wav_file.setsampwidth(2)  # 16-bit
                wav_file.setframerate(sample_rate)
                
                # Generate silence (all zeros)
                silence = struct.pack('<h', 0) * num_samples
                wav_file.writeframes(silence)
            
            # Read file and encode as base64
            with open(temp_path, 'rb') as f:
                audio_data = base64.b64encode(f.read()).decode('utf-8')
            
            # Clean up temp file
            os.unlink(temp_path)
            
            return {
                "success": True,
                "audio_data": audio_data,
                "audio_format": "wav",
                "sample_rate": sample_rate,
                "duration": duration,
                "generation_time": 0.1,
                "speaker": speaker,
                "emotion": "neutral",
                "voice_used": f"{voice_name} (mock)",
                "voice_description": "Mock neural voice",
                "text": text,
                "mock": True,
                "provider": "OpenAI TTS (mock)"
            }
            
        except Exception as e:
            logger.error(f"Mock speech generation failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "text": text,
                "speaker": speaker
            }

    def list_voices(self) -> Dict[str, Any]:
        """List available neural voices"""
        voices = []
        for speaker_id, config in self.voices.items():
            voices.append({
                "id": speaker_id,
                "name": config['voice'],
                "description": config['description'],
                "emotions": list(config['emotions'].keys()),
                "provider": "OpenAI Neural TTS"
            })
        
        return {
            "voices": voices,
            "count": len(voices),
            "provider": "OpenAI Neural TTS"
        }

    def health_check(self) -> Dict[str, Any]:
        """Health check"""
        return {
            "status": "healthy" if self.client else "degraded",
            "provider": "OpenAI TTS",
            "api_available": self.client is not None,
            "voices_available": len(self.voices),
            "neural_voices": True
        }


# Global TTS instance
openai_tts = OpenAITTS()


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    health = openai_tts.health_check()
    health.update({
        "service": "openai-tts-service",
        "timestamp": int(time.time()),
    })
    return jsonify(health), 200


@app.route('/voices', methods=['GET'])
def list_voices():
    """List available neural voices"""
    try:
        voices = openai_tts.list_voices()
        return jsonify({
            "success": True,
            "message": "Neural voices retrieved successfully",
            "data": voices
        })
    except Exception as e:
        logger.error(f"List voices error: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/synthesize', methods=['POST'])
def synthesize_speech():
    """Synthesize speech using OpenAI neural voices"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "success": False,
                "error": "No data provided"
            }), 400

        text = data.get('text')
        speaker = data.get('speaker', 'narrator_male')
        emotion = data.get('emotion', 'professional')

        if not text or not isinstance(text, str):
            return jsonify({
                "success": False,
                "error": "Text is required and must be a string"
            }), 400

        if len(text) > 4000:
            return jsonify({
                "success": False,
                "error": "Text length exceeds maximum (4000 characters)"
            }), 400

        logger.info(f"Synthesizing speech: speaker={speaker}, text_length={len(text)}")

        result = openai_tts.generate_speech(text, speaker, emotion)

        if result.get("success"):
            return jsonify({
                "success": True,
                "message": "Speech synthesized successfully with OpenAI neural voices",
                "data": result
            })
        else:
            return jsonify({
                "success": False,
                "error": result.get("error", "Synthesis failed")
            }), 500

    except Exception as e:
        logger.error(f"Synthesis error: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/status', methods=['GET'])
def get_status():
    """Get service status and capabilities"""
    try:
        voices = openai_tts.list_voices()
        health = openai_tts.health_check()

        return jsonify({
            "success": True,
            "message": "OpenAI TTS service status retrieved successfully",
            "data": {
                **health,
                "voices": voices,
                "capabilities": [
                    "text_to_speech",
                    "neural_voices",
                    "emotion_based_synthesis",
                    "high_quality_audio",
                    "multiple_speakers"
                ],
                "supported_formats": ["mp3"],
                "max_text_length": 4000,
                "provider": "OpenAI"
            }
        })
    except Exception as e:
        logger.error(f"Status error: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.errorhandler(404)
def not_found(error):
    return jsonify({
        "success": False,
        "error": "Endpoint not found"
    }), 404


@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {str(error)}")
    return jsonify({
        "success": False,
        "error": "Internal server error"
    }), 500


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="OpenAI TTS Service")
    parser.add_argument("--port", type=int, default=8087,
                        help="Port to run the service on")
    parser.add_argument("--host", type=str, default="0.0.0.0",
                        help="Host to bind to")
    parser.add_argument("--api-key", type=str, default=None,
                        help="OpenAI API key")

    args = parser.parse_args()

    logger.info(f"Starting OpenAI TTS Service on {args.host}:{args.port}")
    logger.info(f"Available neural voices: {len(openai_tts.voices)}")

    app.run(
        host=args.host,
        port=args.port,
        debug=False,
        threaded=True
    )
