#!/usr/bin/env python3
"""
MLX Audio TTS Service - Optimized for Apple Silicon
Advanced features: Multiple voices, speed control, emotion synthesis
"""

import argparse
import base64
import json
import logging
import os
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from flask import Flask, jsonify, request
from flask_cors import CORS

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('mlx-audio-tts-service')

# Initialize Flask app
app = Flask(__name__)
CORS(app)


class MLXAudioTTSService:
    """Optimized MLX Audio TTS Service for Apple Silicon"""

    def __init__(self):
        self.model = "mlx-community/Kokoro-82M-bf16"
        self.available_voices = {
            # Female voices
            'sarah': 'af_sarah',
            'bella': 'af_bella', 
            'jessica': 'af_jessica',
            'nicole': 'af_nicole',
            'nova': 'af_nova',
            'river': 'af_river',
            'sky': 'af_sky',
            'alloy': 'af_alloy',
            'aoede': 'af_aoede',
            'heart': 'af_heart',
            'kore': 'af_kore',
            
            # Male voices
            'eric': 'am_eric',
            'adam': 'am_adam',
            'echo': 'am_echo',
            'fenrir': 'am_fenrir',
            'liam': 'am_liam',
            'michael': 'am_michael',
            'onyx': 'am_onyx',
            'puck': 'am_puck',
            'santa': 'am_santa',
            
            # British voices
            'alice': 'bf_alice',
            'emma': 'bf_emma',
            'isabella': 'bf_isabella',
            'lily': 'bf_lily',
            'daniel': 'bm_daniel',
            'fable': 'bm_fable',
            'george': 'bm_george',
            'lewis': 'bm_lewis',
            
            # Other languages
            'dora_english': 'ef_dora',
            'alex_english': 'em_alex',
            'santa_english': 'em_santa',
            'siwis_french': 'ff_siwis',
            'alpha_hindi': 'hf_alpha',
            'beta_hindi': 'hf_beta',
            'omega_hindi': 'hm_omega',
            'psi_hindi': 'hm_psi',
            'sara_italian': 'if_sara',
            'nicola_italian': 'im_nicola',
            'alpha_japanese': 'jf_alpha',
            'gongitsune_japanese': 'jf_gongitsune',
            'nezumi_japanese': 'jf_nezumi',
            'tebukuro_japanese': 'jf_tebukuro',
            'kumo_japanese': 'jm_kumo',
            'dora_portuguese': 'pf_dora',
            'alex_portuguese': 'pm_alex',
            'santa_portuguese': 'pm_santa',
            'xiaobei_chinese': 'zf_xiaobei',
            'xiaoni_chinese': 'zf_xiaoni',
            'xiaoxiao_chinese': 'zf_xiaoxiao',
            'xiaoyi_chinese': 'zf_xiaoyi',
            'yunjian_chinese': 'zm_yunjian',
            'yunxi_chinese': 'zm_yunxi',
            'yunxia_chinese': 'zm_yunxia',
            'yunyang_chinese': 'zm_yunyang'
        }
        
        self.emotion_speeds = {
            'calm': 0.8,
            'normal': 1.0,
            'excited': 1.3,
            'urgent': 1.5,
            'slow': 0.7,
            'fast': 1.4
        }

    def generate_speech(self, text: str, voice: str = 'sarah', emotion: str = 'normal', 
                       speed: Optional[float] = None, language: str = 'en') -> Dict[str, Any]:
        """Generate speech using MLX Audio TTS with advanced features"""
        start_time = time.time()
        
        try:
            # Map voice name to actual voice ID
            voice_id = self.available_voices.get(voice.lower(), 'af_sarah')
            
            # Determine speed based on emotion if not specified
            if speed is None:
                speed = self.emotion_speeds.get(emotion.lower(), 1.0)
            
            # Create unique temporary file for output
            temp_dir = tempfile.mkdtemp()
            temp_prefix = os.path.join(temp_dir, f"mlx_tts_{int(time.time())}")
            
            logger.info(f"Generating speech: '{text[:50]}...' with voice '{voice_id}' at speed {speed}x")
            
            # Build MLX Audio command
            cmd = [
                'python3.11', '-m', 'mlx_audio.tts.generate',
                '--model', self.model,
                '--text', text,
                '--voice', voice_id,
                '--speed', str(speed),
                '--file_prefix', temp_prefix,
                '--audio_format', 'wav'
            ]
            
            # Execute MLX Audio TTS with proper working directory
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120, cwd=temp_dir)
            
            if result.returncode != 0:
                logger.error(f"MLX Audio TTS failed: {result.stderr}")
                return {
                    "success": False,
                    "error": f"TTS generation failed: {result.stderr}",
                    "model": "MLX-Audio-Kokoro-82M"
                }
            
            # Find the generated audio file
            audio_data = None
            generated_file = None
            
            # Look for generated files
            for file in os.listdir(temp_dir):
                if file.endswith('.wav'):
                    generated_file = os.path.join(temp_dir, file)
                    break
            
            if generated_file and os.path.exists(generated_file):
                with open(generated_file, 'rb') as f:
                    audio_data = f.read()
                os.unlink(generated_file)  # Clean up file
            
            # Clean up temp directory
            try:
                os.rmdir(temp_dir)
            except:
                pass
            
            if audio_data is None:
                return {
                    "success": False,
                    "error": "Generated audio file not found",
                    "model": "MLX-Audio-Kokoro-82M"
                }
            
            generation_time = time.time() - start_time
            
            return {
                "success": True,
                "audio_data": base64.b64encode(audio_data).decode('utf-8'),
                "audio_format": "wav",
                "sample_rate": 24000,  # MLX Audio default
                "duration": len(audio_data) / (24000 * 2),  # Rough estimate
                "generation_time": generation_time,
                "voice": voice,
                "voice_id": voice_id,
                "emotion": emotion,
                "speed": speed,
                "language": language,
                "model": "MLX-Audio-Kokoro-82M-Optimized",
                "text": text,
                "optimized_for": "Apple Silicon"
            }
            
        except subprocess.TimeoutExpired:
            logger.error("MLX Audio TTS timed out")
            return {
                "success": False,
                "error": "TTS generation timed out (120s limit)",
                "model": "MLX-Audio-Kokoro-82M"
            }
        except Exception as e:
            logger.error(f"MLX Audio TTS error: {e}")
            return {
                "success": False,
                "error": f"TTS generation failed: {str(e)}",
                "model": "MLX-Audio-Kokoro-82M"
            }

    def get_available_voices(self) -> Dict[str, Any]:
        """Get list of available voices organized by category"""
        return {
            "female_voices": {
                name: voice_id for name, voice_id in self.available_voices.items()
                if voice_id.startswith('af_')
            },
            "male_voices": {
                name: voice_id for name, voice_id in self.available_voices.items()
                if voice_id.startswith('am_')
            },
            "british_voices": {
                name: voice_id for name, voice_id in self.available_voices.items()
                if voice_id.startswith('b')
            },
            "multilingual_voices": {
                name: voice_id for name, voice_id in self.available_voices.items()
                if voice_id.startswith(('e', 'f', 'h', 'i', 'j', 'p', 'z'))
            },
            "emotions": list(self.emotion_speeds.keys()),
            "emotion_speeds": self.emotion_speeds
        }


# Initialize service
mlx_tts_service = MLXAudioTTSService()


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "model": "MLX-Audio-Kokoro-82M-Optimized",
        "optimized_for": "Apple Silicon",
        "python_version": "3.11",
        "available_voices": len(mlx_tts_service.available_voices),
        "version": "1.0.0-optimized",
        "emotions": list(mlx_tts_service.emotion_speeds.keys()),
        "ready": True
    })


@app.route('/synthesize', methods=['POST'])
def synthesize():
    """Synthesize speech from text with advanced features"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "success": False,
                "error": "No JSON data provided"
            }), 400
            
        text = data.get('text', '')
        voice = data.get('voice', 'sarah')
        emotion = data.get('emotion', 'normal')
        speed = data.get('speed')
        language = data.get('language', 'en')
        
        if not text:
            return jsonify({
                "success": False,
                "error": "No text provided"
            }), 400
        
        if len(text) > 1000:
            return jsonify({
                "success": False,
                "error": "Text too long (max 1000 characters)"
            }), 400
        
        logger.info(f"Synthesis request: voice={voice}, emotion={emotion}, text_length={len(text)}")
        result = mlx_tts_service.generate_speech(text, voice, emotion, speed, language)
        
        if result.get('success'):
            logger.info(f"Synthesis successful: {result.get('generation_time', 0):.2f}s")
        else:
            logger.error(f"Synthesis failed: {result.get('error', 'Unknown error')}")
            
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Synthesis error: {e}")
        return jsonify({
            "success": False,
            "error": f"Internal server error: {str(e)}"
        }), 500


@app.route('/voices', methods=['GET'])
def list_voices():
    """List available voices and features"""
    return jsonify({
        "success": True,
        "voices": mlx_tts_service.get_available_voices(),
        "model": "MLX-Audio-Kokoro-82M-Optimized",
        "optimized_for": "Apple Silicon",
        "features": [
            "Multiple voice options",
            "Emotion-based speed control", 
            "Multilingual support",
            "Apple Silicon optimization",
            "High-quality audio output"
        ]
    })


@app.route('/test', methods=['POST'])
def test_synthesis():
    """Test endpoint with sample text"""
    try:
        data = request.get_json()
        voice = data.get('voice', 'sarah')
        emotion = data.get('emotion', 'normal')
        
        sample_texts = {
            'calm': "Hello, this is a calm and peaceful voice demonstration.",
            'normal': "Hello world! This is a normal speaking voice.",
            'excited': "Wow! This is an excited and energetic voice!",
            'urgent': "Attention! This is an urgent message requiring immediate action.",
            'slow': "This is a slow and deliberate speaking pace.",
            'fast': "This is a fast and rapid speaking pace for quick information."
        }
        
        text = sample_texts.get(emotion, sample_texts['normal'])
        
        result = mlx_tts_service.generate_speech(text, voice, emotion)
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Test synthesis error: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='MLX Audio TTS Service - Optimized')
    parser.add_argument('--port', type=int, default=8090, help='Port to run the service on')
    parser.add_argument('--host', type=str, default='0.0.0.0', help='Host to bind to')
    
    args = parser.parse_args()
    
    logger.info(f"🚀 Starting MLX Audio TTS Service (Optimized)")
    logger.info(f"📡 Port: {args.port}")
    logger.info(f"🤖 Model: {mlx_tts_service.model}")
    logger.info(f"🍎 Optimized for: Apple Silicon")
    logger.info(f"🎭 Available voices: {len(mlx_tts_service.available_voices)}")
    logger.info(f"⚡ Emotion speeds: {len(mlx_tts_service.emotion_speeds)}")
    
    app.run(host=args.host, port=args.port, debug=False)
