#!/usr/bin/env python3
"""
TTS Service - Text-to-Speech using VibeVoice
Provides voice synthesis capabilities for the Universal AI Tools platform
"""

import argparse
import base64
import json
import os
import sys
import tempfile
import threading
import time
from typing import Any, Dict, Optional

from flask import Flask, jsonify, request, send_file
from flask_cors import CORS

# Add VibeVoice to path
vibevoice_path = os.path.join(os.path.dirname(__file__), '..', 'VibeVoice')
sys.path.insert(0, vibevoice_path)

try:
    from transformers.utils import logging
    from vibevoice.modular.modeling_vibevoice_inference import \
        VibeVoiceForConditionalGenerationInference
    from vibevoice.processor.vibevoice_processor import VibeVoiceProcessor
    VIBEVOICE_AVAILABLE = True
    logging.set_verbosity_error()  # Reduce logging noise
except ImportError as e:
    print(f"VibeVoice not available: {e}")
    VIBEVOICE_AVAILABLE = False


class TTSEngine:
    """Text-to-Speech Engine using VibeVoice"""

    def __init__(self):
        self.model = None
        self.processor = None
        self.model_loaded = False
        self.lock = threading.Lock()

    def load_model(self):
        """Load the VibeVoice model"""
        if not VIBEVOICE_AVAILABLE:
            print("VibeVoice not available - using mock responses")
            return False

        try:
            print("Loading VibeVoice model...")

            # Model paths - adjust as needed
            model_path = os.path.join(
                vibevoice_path, "vibevoice")  # Adjust path as needed
            if not os.path.exists(model_path):
                print(f"Model path not found: {model_path}")
                return False

            # Load processor and model
            self.processor = VibeVoiceProcessor.from_pretrained(model_path)
            self.model = VibeVoiceForConditionalGenerationInference.from_pretrained(
                model_path, torch_dtype="float16" if torch.cuda.is_available() else "float32")

            # Move to GPU if available
            if torch.cuda.is_available():
                self.model = self.model.cuda()

            self.model_loaded = True
            print("VibeVoice model loaded successfully!")
            return True

        except Exception as e:
            print(f"Failed to load VibeVoice model: {e}")
            return False

    def generate_speech(
            self,
            text: str,
            voice: str = "Alice",
            speed: float = 1.0) -> Optional[bytes]:
        """Generate speech from text"""
        if not self.model_loaded:
            # Return mock audio data
            return self._generate_mock_audio(text)

        with self.lock:
            try:
                print(f"Generating speech for: {text[:50]}...")

                # Process text
                inputs = self.processor(
                    text=text, voice=voice, speed=speed, return_tensors="pt")

                if torch.cuda.is_available():
                    inputs = {k: v.cuda() for k, v in inputs.items()}

                # Generate speech
                with torch.no_grad():
                    outputs = self.model.generate(**inputs)

                # Convert to audio bytes
                audio_data = self.processor.batch_decode(
                    outputs, output_format="wav")

                print(
                    f"Speech generated successfully: {
                        len(audio_data)} bytes")
                return audio_data

            except Exception as e:
                print(f"Speech generation failed: {e}")
                return self._generate_mock_audio(text)

    def _generate_mock_audio(self, text: str) -> bytes:
        """Generate mock audio data for testing"""
        print("Using mock audio generation")

        # Create a simple mock WAV file
        import io
        import struct
        import wave

        # Simple WAV file generation
        sample_rate = 22050
        # 0.1 seconds per character, max 10 seconds
        duration = min(len(text) * 0.1, 10)
        num_samples = int(sample_rate * duration)

        # Generate simple sine wave
        audio_data = b""
        for i in range(num_samples):
            sample = int(32767 * 0.3 * (i % 100) / 100.0)  # Simple pattern
            audio_data += struct.pack('<h', sample)

        # Create WAV file in memory
        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, 'wb') as wav_file:
            wav_file.setnchannels(1)  # Mono
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(audio_data)

        return wav_buffer.getvalue()


# Global TTS Engine
tts_engine = TTSEngine()

# Flask App
app = Flask(__name__)
CORS(app)


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'tts-service',
        'vibevoice_available': VIBEVOICE_AVAILABLE,
        'model_loaded': tts_engine.model_loaded,
        'timestamp': int(time.time())
    })


@app.route('/synthesize', methods=['POST'])
def synthesize():
    """Synthesize speech from text"""
    try:
        data = request.get_json()

        if not data or 'text' not in data:
            return jsonify({'error': 'Missing text parameter'}), 400

        text = data['text']
        voice = data.get('voice', 'Alice')
        speed = float(data.get('speed', 1.0))

        if not text.strip():
            return jsonify({'error': 'Empty text'}), 400

        print(f"Synthesizing: '{text[:50]}...' with voice {voice}")

        # Generate speech
        audio_data = tts_engine.generate_speech(text, voice, speed)

        if audio_data:
            # Return as base64 encoded audio
            audio_b64 = base64.b64encode(audio_data).decode('utf-8')

            return jsonify({
                'success': True,
                'audio_base64': audio_b64,
                'format': 'wav',
                'sample_rate': 22050,
                'text': text,
                'voice': voice,
                'speed': speed,
                'timestamp': int(time.time())
            })
        else:
            return jsonify({'error': 'Failed to generate audio'}), 500

    except Exception as e:
        print(f"Synthesis error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/voices', methods=['GET'])
def get_voices():
    """Get available voices"""
    voices = [
        {'name': 'Alice', 'gender': 'female', 'language': 'en', 'quality': 'high'},
        {'name': 'Carter', 'gender': 'male', 'language': 'en', 'quality': 'high'},
        {'name': 'Frank', 'gender': 'male', 'language': 'en', 'quality': 'high'},
        {'name': 'Mary', 'gender': 'female', 'language': 'en', 'quality': 'high'},
        {'name': 'Maya', 'gender': 'female', 'language': 'en', 'quality': 'medium'},
        {'name': 'Samuel', 'gender': 'male', 'language': 'en', 'quality': 'medium'},
    ]

    return jsonify({
        'voices': voices,
        'default_voice': 'Alice',
        'supported_languages': ['en'],
        'max_text_length': 1000
    })


@app.route('/status', methods=['GET'])
def get_status():
    """Get service status and capabilities"""
    return jsonify({
        'service': 'TTS Service',
        'version': '1.0.0',
        'capabilities': {
            'text_to_speech': True,
            'voice_selection': True,
            'speed_control': True,
            'multiple_languages': False,
            'streaming': False
        },
        'limits': {
            'max_text_length': 1000,
            'max_speed': 2.0,
            'min_speed': 0.5
        },
        'model_info': {
            'name': 'VibeVoice',
            'loaded': tts_engine.model_loaded,
            'available': VIBEVOICE_AVAILABLE
        }
    })


def main():
    parser = argparse.ArgumentParser(description='TTS Service using VibeVoice')
    parser.add_argument('--port', type=int, default=8080,
                        help='Port to run the service on')
    parser.add_argument('--host', default='0.0.0.0', help='Host to bind to')
    parser.add_argument(
        '--no-model',
        action='store_true',
        help='Run without loading the model')

    args = parser.parse_args()

    # Load model unless disabled
    if not args.no_model:
        tts_engine.load_model()

    print(f"🚀 Starting TTS Service on {args.host}:{args.port}")
    print(f"📊 VibeVoice Available: {VIBEVOICE_AVAILABLE}")
    print(f"🤖 Model Loaded: {tts_engine.model_loaded}")

    app.run(host=args.host, port=args.port, debug=False, threaded=True)


if __name__ == '__main__':
    main()
