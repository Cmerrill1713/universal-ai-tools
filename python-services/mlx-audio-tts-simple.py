#!/usr/bin/env python3
"""
MLX Audio TTS Service - Simplified and Reliable
Focus on core functionality with proper error handling
"""

import argparse
import base64
import logging
import os
import subprocess
import tempfile
import time
from typing import Any, Dict

from flask import Flask, jsonify, request
from flask_cors import CORS

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('mlx-audio-tts-simple')

# Initialize Flask app
app = Flask(__name__)
CORS(app)


class SimpleMLXAudioTTS:
    """Simplified MLX Audio TTS Service"""

    def __init__(self):
        self.model = "mlx-community/Kokoro-82M-bf16"
        self.voices = {
            'sarah': 'af_sarah',
            'eric': 'am_eric',
            'bella': 'af_bella',
            'adam': 'am_adam',
            'jessica': 'af_jessica',
            'michael': 'am_michael'
        }
        self.speeds = {
            'slow': 0.7,
            'normal': 1.0,
            'fast': 1.3
        }

    def generate_speech(self, text: str, voice: str = 'sarah', speed: str = 'normal') -> Dict[str, Any]:
        """Generate speech using MLX Audio TTS"""
        start_time = time.time()

        try:
            # Validate inputs
            if not text or len(text.strip()) == 0:
                return {"success": False, "error": "No text provided"}

            if len(text) > 500:
                return {"success": False, "error": "Text too long (max 500 characters)"}

            # Get voice and speed
            voice_id = self.voices.get(voice.lower(), 'af_sarah')
            speed_value = self.speeds.get(speed.lower(), 1.0)

            logger.info(f"Generating: '{text[:30]}...' voice={voice_id} speed={speed_value}x")

            # Create temporary directory for output
            with tempfile.TemporaryDirectory() as temp_dir:
                output_prefix = os.path.join(temp_dir, "output")

                # Build command
                cmd = [
                    'python3.11', '-m', 'mlx_audio.tts.generate',
                    '--model', self.model,
                    '--text', text,
                    '--voice', voice_id,
                    '--speed', str(speed_value),
                    '--file_prefix', output_prefix
                ]

                # Execute command
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)

                if result.returncode != 0:
                    logger.error(f"Command failed: {result.stderr}")
                    return {"success": False, "error": f"TTS failed: {result.stderr[:200]}"}

                # Find generated file
                audio_file = None
                for file in os.listdir(temp_dir):
                    if file.endswith('.wav'):
                        audio_file = os.path.join(temp_dir, file)
                        break

                if not audio_file:
                    return {"success": False, "error": "No audio file generated"}

                # Read audio data
                with open(audio_file, 'rb') as f:
                    audio_data = f.read()

                generation_time = time.time() - start_time

                return {
                    "success": True,
                    "audio_data": base64.b64encode(audio_data).decode('utf-8'),
                    "audio_format": "wav",
                    "duration": len(audio_data) / 48000,  # Rough estimate
                    "generation_time": generation_time,
                    "voice": voice,
                    "speed": speed,
                    "text_length": len(text),
                    "model": "MLX-Audio-Kokoro-82M-Simple"
                }

        except subprocess.TimeoutExpired:
            logger.error("TTS generation timed out")
            return {"success": False, "error": "Generation timed out (60s limit)"}
        except Exception as e:
            logger.error(f"TTS error: {e}")
            return {"success": False, "error": f"Generation failed: {str(e)[:200]}"}


# Initialize service
tts_service = SimpleMLXAudioTTS()


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "model": "MLX-Audio-Kokoro-82M-Simple",
        "available_voices": list(tts_service.voices.keys()),
        "available_speeds": list(tts_service.speeds.keys()),
        "ready": True,
        "version": "1.0.0-simple"
    })


@app.route('/synthesize', methods=['POST'])
def synthesize():
    """Synthesize speech from text"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "No JSON data"}), 400

        text = data.get('text', '')
        voice = data.get('voice', 'sarah')
        speed = data.get('speed', 'normal')

        logger.info(f"Synthesis request: voice={voice}, speed={speed}, text_len={len(text)}")

        result = tts_service.generate_speech(text, voice, speed)

        if result.get('success'):
            logger.info(f"Synthesis successful: {result.get('generation_time', 0):.2f}s")
        else:
            logger.error(f"Synthesis failed: {result.get('error', 'Unknown')}")

        return jsonify(result)

    except Exception as e:
        logger.error(f"Synthesis error: {e}")
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500


@app.route('/voices', methods=['GET'])
def list_voices():
    """List available voices"""
    return jsonify({
        "success": True,
        "voices": tts_service.voices,
        "speeds": tts_service.speeds,
        "model": "MLX-Audio-Kokoro-82M-Simple"
    })


@app.route('/test', methods=['POST'])
def test_synthesis():
    """Test endpoint with sample text"""
    try:
        data = request.get_json() or {}
        voice = data.get('voice', 'sarah')
        speed = data.get('speed', 'normal')

        sample_text = "Hello! This is a test of the MLX Audio TTS service. It's working perfectly!"

        result = tts_service.generate_speech(sample_text, voice, speed)
        return jsonify(result)

    except Exception as e:
        logger.error(f"Test error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='MLX Audio TTS Service - Simple')
    parser.add_argument('--port', type=int, default=8093, help='Port to run the service on')
    parser.add_argument('--host', type=str, default='0.0.0.0', help='Host to bind to')

    args = parser.parse_args()

    logger.info("🚀 Starting Simple MLX Audio TTS Service")
    logger.info(f"📡 Port: {args.port}")
    logger.info(f"🤖 Model: {tts_service.model}")
    logger.info(f"🎭 Voices: {len(tts_service.voices)}")
    logger.info(f"⚡ Speeds: {len(tts_service.speeds)}")

    app.run(host=args.host, port=args.port, debug=False, threaded=True)
