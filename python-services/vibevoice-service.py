#!/usr/bin/env python3
"""
VibeVoice Service - Advanced Voice Processing Service
Provides comprehensive voice synthesis and processing capabilities using VibeVoice
"""

import argparse
import base64
import logging
import os
import tempfile
import time
from typing import Any, Dict, Optional

import torch
from flask import Flask, jsonify, request
from flask_cors import CORS

# Import VibeVoice components
try:
    from transformers.utils import logging as transformers_logging
    from vibevoice.modular.modeling_vibevoice_inference import (
        VibeVoiceForConditionalGenerationInference,
    )
    from vibevoice.processor.vibevoice_processor import VibeVoiceProcessor
    transformers_logging.set_verbosity_error()  # Reduce logging noise
    VIBEVOICE_AVAILABLE = True
except ImportError as e:
    print(f"Warning: VibeVoice not available: {e}")
    VIBEVOICE_AVAILABLE = False

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('vibevoice-service')

# Initialize Flask app
app = Flask(__name__)
CORS(app)


class VoiceMapper:
    """Maps speaker names to voice file paths"""

    def __init__(self, voices_dir: Optional[str] = None):
        self.voices_dir = voices_dir or os.path.join(
            os.path.dirname(__file__), "../VibeVoice/demo/voices")
        self.voice_presets = {}
        self.available_voices = {}
        self.setup_voice_presets()

    def setup_voice_presets(self):
        """Setup voice presets by scanning the voices directory."""
        if not os.path.exists(self.voices_dir):
            logger.warning(f"Voices directory not found at {self.voices_dir}")
            return

        # Scan for all WAV files in the voices directory
        wav_files = [
            f for f in os.listdir(
                self.voices_dir) if f.lower().endswith('.wav') and os.path.isfile(
                os.path.join(
                    self.voices_dir,
                    f))]

        # Create dictionary with filename (without extension) as key
        for wav_file in wav_files:
            name = os.path.splitext(wav_file)[0]
            full_path = os.path.join(self.voices_dir, wav_file)
            self.voice_presets[name] = full_path

        # Sort alphabetically
        self.voice_presets = dict(sorted(self.voice_presets.items()))

        # Filter out voices that don't exist
        self.available_voices = {
            name: path for name, path in self.voice_presets.items()
            if os.path.exists(path)
        }

        logger.info(f"Found {len(self.available_voices)} voice files")
        logger.info(
            f"Available voices: {
                ', '.join(
                    self.available_voices.keys())}")

    def get_voice_path(self, speaker_name: str) -> str:
        """Get voice file path for a given speaker name"""
        # First try exact match
        if speaker_name in self.voice_presets:
            return self.voice_presets[speaker_name]

        # Try partial matching (case insensitive)
        speaker_lower = speaker_name.lower()
        for preset_name, path in self.voice_presets.items():
            if preset_name.lower() in speaker_lower or speaker_lower in preset_name.lower():
                return path

        # Default to first voice if no match found
        if self.voice_presets:
            default_voice = list(self.voice_presets.values())[0]
            logger.warning(
                f"No voice preset found for '{speaker_name}', using default: {default_voice}")
            return default_voice

        raise ValueError(
            f"No voice presets available for speaker '{speaker_name}'")

    def list_voices(self) -> Dict[str, Any]:
        """List all available voices"""
        return {
            "voices": list(self.available_voices.keys()),
            "count": len(self.available_voices),
            "directory": self.voices_dir
        }


class VibeVoiceProcessor:
    """Main VibeVoice processing class"""

    def __init__(self, model_path: str = None, device: str = None):
        self.model_path = model_path or "../VibeVoice-1.5B"
        self.device = device or (
            "cuda" if torch.cuda.is_available() else "cpu")
        self.model = None
        self.processor = None
        self.voice_mapper = VoiceMapper()

        if VIBEVOICE_AVAILABLE:
            self.load_model()
        else:
            logger.warning("VibeVoice not available - running in mock mode")

    def load_model(self):
        """Load the VibeVoice model"""
        try:
            logger.info(f"Loading VibeVoice model from {self.model_path}")

            # Determine optimal settings based on device
            if self.device == "cuda":
                load_dtype = torch.bfloat16
                attn_impl = "flash_attention_2"
            elif self.device == "mps":
                load_dtype = torch.float32
                attn_impl = "sdpa"
            else:  # cpu
                load_dtype = torch.float32
                attn_impl = "sdpa"

            logger.info(
                f"Using device: {
                    self.device}, dtype: {load_dtype}, attention: {attn_impl}")

            # Load processor
            self.processor = VibeVoiceProcessor.from_pretrained(
                self.model_path)

            # Load model with error handling
            try:
                if self.device == "cuda":
                    self.model = VibeVoiceForConditionalGenerationInference.from_pretrained(
                        self.model_path,
                        torch_dtype=load_dtype,
                        device_map="cuda",
                        attn_implementation=attn_impl,
                    )
                elif self.device == "mps":
                    self.model = VibeVoiceForConditionalGenerationInference.from_pretrained(
                        self.model_path,
                        torch_dtype=load_dtype,
                        device_map=None,
                        attn_implementation=attn_impl,
                    )
                    self.model.to("mps")
                else:  # cpu
                    self.model = VibeVoiceForConditionalGenerationInference.from_pretrained(
                        self.model_path,
                        torch_dtype=load_dtype,
                        device_map="cpu",
                        attn_implementation=attn_impl,
                    )
            except Exception as e:
                logger.warning(f"Primary attention implementation failed: {e}")
                logger.info("Falling back to SDPA attention")
                self.model = VibeVoiceForConditionalGenerationInference.from_pretrained(
                    self.model_path, torch_dtype=load_dtype, device_map=(
                        self.device if self.device in (
                            "cuda", "cpu") else None), attn_implementation='sdpa')
                if self.device == "mps":
                    self.model.to("mps")

            self.model.eval()
            self.model.set_ddpm_inference_steps(num_steps=10)

            logger.info("VibeVoice model loaded successfully")

        except Exception as e:
            logger.error(f"Failed to load VibeVoice model: {e}")
            logger.info("Running in mock mode")
            self.model = None

    def generate_speech(self,
                        text: str,
                        speaker_name: str = "Alice",
                        cfg_scale: float = 1.3) -> Dict[str,
                                                        Any]:
        """Generate speech from text"""
        if not VIBEVOICE_AVAILABLE or self.model is None:
            return self._mock_generate_speech(text, speaker_name)

        try:
            logger.info(
                f"Generating speech for text: '{text[:50]}...' with speaker: {speaker_name}")

            # Get voice sample
            voice_path = self.voice_mapper.get_voice_path(speaker_name)

            # Prepare inputs
            inputs = self.processor(
                text=[text],
                voice_samples=[voice_path],
                padding=True,
                return_tensors="pt",
                return_attention_mask=True,
            )

            # Move to device
            target_device = self.device if self.device != "cpu" else "cpu"
            for k, v in inputs.items():
                if torch.is_tensor(v):
                    inputs[k] = v.to(target_device)

            # Generate audio
            start_time = time.time()
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=None,
                cfg_scale=cfg_scale,
                tokenizer=self.processor.tokenizer,
                generation_config={'do_sample': False},
                verbose=False,
            )
            generation_time = time.time() - start_time

            # Process output
            if outputs.speech_outputs and outputs.speech_outputs[0] is not None:
                # Save to temporary file
                with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                    temp_path = temp_file.name

                self.processor.save_audio(
                    outputs.speech_outputs[0], output_path=temp_path)

                # Calculate metrics
                sample_rate = 24000  # Common for speech synthesis
                audio_samples = outputs.speech_outputs[0].shape[-1] if len(
                    outputs.speech_outputs[0].shape) > 0 else len(outputs.speech_outputs[0])
                audio_duration = audio_samples / sample_rate
                rtf = generation_time / \
                    audio_duration if audio_duration > 0 else float('inf')

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
                    "duration": audio_duration,
                    "generation_time": generation_time,
                    "rtf": rtf,
                    "speaker": speaker_name,
                    "text": text
                }
            else:
                raise ValueError("No audio output generated")

        except Exception as e:
            logger.error(f"Speech generation failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "text": text,
                "speaker": speaker_name
            }

    def _mock_generate_speech(
            self, text: str, speaker_name: str) -> Dict[str, Any]:
        """Mock speech generation for when VibeVoice is not available"""
        logger.info(
            f"Mock generating speech for: '{text[:50]}...' with speaker: {speaker_name}")

        # Create a simple mock WAV file (silence)
        import struct
        import wave

        sample_rate = 24000
        duration = max(1.0, len(text) * 0.1)  # Rough estimate
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
            "rtf": 0.1 / duration,
            "speaker": speaker_name,
            "text": text,
            "mock": True
        }

    def list_voices(self) -> Dict[str, Any]:
        """List available voices"""
        return self.voice_mapper.list_voices()

    def health_check(self) -> Dict[str, Any]:
        """Health check"""
        return {
            "status": "healthy" if VIBEVOICE_AVAILABLE and self.model is not None else "degraded",
            "vibevoice_available": VIBEVOICE_AVAILABLE,
            "model_loaded": self.model is not None,
            "device": self.device,
            "voices_available": len(
                self.voice_mapper.available_voices)}


# Global processor instance
processor = VibeVoiceProcessor()


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    health = processor.health_check()
    health.update({
        "service": "vibevoice-service",
        "timestamp": int(time.time()),
    })

    status_code = 200 if health["status"] == "healthy" else 503
    return jsonify(health), status_code


@app.route('/voices', methods=['GET'])
def list_voices():
    """List available voices"""
    try:
        voices = processor.list_voices()
        return jsonify({
            "success": True,
            "message": "Voices retrieved successfully",
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
    """Synthesize speech from text"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "success": False,
                "error": "No data provided"
            }), 400

        text = data.get('text')
        speaker = data.get('speaker', 'Alice')
        cfg_scale = data.get('cfg_scale', 1.3)

        if not text or not isinstance(text, str):
            return jsonify({
                "success": False,
                "error": "Text is required and must be a string"
            }), 400

        if len(text) > 10000:
            return jsonify({
                "success": False,
                "error": "Text length exceeds maximum (10000 characters)"
            }), 400

        logger.info(
            f"Synthesizing speech: speaker={speaker}, text_length={
                len(text)}")

        result = processor.generate_speech(text, speaker, cfg_scale)

        if result.get("success"):
            return jsonify({
                "success": True,
                "message": "Speech synthesized successfully",
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


@app.route('/batch-synthesize', methods=['POST'])
def batch_synthesize():
    """Synthesize multiple speech segments"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "success": False,
                "error": "No data provided"
            }), 400

        segments = data.get('segments', [])
        if not segments or not isinstance(segments, list):
            return jsonify({
                "success": False,
                "error": "Segments array is required"
            }), 400

        if len(segments) > 10:
            return jsonify({
                "success": False,
                "error": "Maximum 10 segments allowed"
            }), 400

        results = []
        total_duration = 0
        total_generation_time = 0

        for i, segment in enumerate(segments):
            if not isinstance(segment, dict):
                continue

            text = segment.get('text')
            speaker = segment.get('speaker', 'Alice')
            cfg_scale = segment.get('cfg_scale', 1.3)

            if not text:
                continue

            logger.info(
                f"Processing segment {i + 1}/{len(segments)}: speaker={speaker}")

            result = processor.generate_speech(text, speaker, cfg_scale)
            results.append(result)

            if result.get("success"):
                total_duration += result.get("duration", 0)
                total_generation_time += result.get("generation_time", 0)

        return jsonify({
            "success": True,
            "message": f"Processed {len(results)} speech segments",
            "data": {
                "results": results,
                "total_segments": len(results),
                "total_duration": total_duration,
                "total_generation_time": total_generation_time,
                "average_rtf": total_generation_time / total_duration if total_duration > 0 else 0
            }
        })

    except Exception as e:
        logger.error(f"Batch synthesis error: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/conversation', methods=['POST'])
def synthesize_conversation():
    """Synthesize a multi-speaker conversation"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "success": False,
                "error": "No data provided"
            }), 400

        conversation = data.get('conversation', [])
        if not conversation or not isinstance(conversation, list):
            return jsonify({
                "success": False,
                "error": "Conversation array is required"
            }), 400

        if len(conversation) > 20:
            return jsonify({
                "success": False,
                "error": "Maximum 20 conversation turns allowed"
            }), 400

        # Build conversation script
        scripts = []
        speaker_names = []

        for turn in conversation:
            if not isinstance(turn, dict):
                continue

            speaker = turn.get('speaker', 'Speaker 1')
            text = turn.get('text', '')

            if text:
                scripts.append(f"{speaker}: {text}")
                speaker_names.append(speaker)

        if not scripts:
            return jsonify({
                "success": False,
                "error": "No valid conversation turns found"
            }), 400

        full_script = '\n'.join(scripts)

        # Use the first speaker for the conversation
        primary_speaker = speaker_names[0] if speaker_names else 'Alice'

        logger.info(
            f"Synthesizing conversation with {
                len(scripts)} turns, primary speaker: {primary_speaker}")

        result = processor.generate_speech(full_script, primary_speaker)

        if result.get("success"):
            return jsonify({
                "success": True,
                "message": "Conversation synthesized successfully",
                "data": {
                    **result,
                    "conversation_turns": len(scripts),
                    "speakers": list(set(speaker_names))
                }
            })
        else:
            return jsonify({
                "success": False,
                "error": result.get("error", "Conversation synthesis failed")
            }), 500

    except Exception as e:
        logger.error(f"Conversation synthesis error: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/status', methods=['GET'])
def get_status():
    """Get service status and capabilities"""
    try:
        voices = processor.list_voices()
        health = processor.health_check()

        return jsonify({
            "success": True,
            "message": "Service status retrieved successfully",
            "data": {
                **health,
                "voices": voices,
                "capabilities": [
                    "text_to_speech",
                    "voice_cloning",
                    "multi_speaker_conversation",
                    "batch_processing"
                ],
                "supported_formats": ["wav"],
                "max_text_length": 10000,
                "max_batch_segments": 10,
                "max_conversation_turns": 20
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
    parser = argparse.ArgumentParser(description="VibeVoice Service")
    parser.add_argument("--port", type=int, default=8081,
                        help="Port to run the service on")
    parser.add_argument(
        "--host",
        type=str,
        default="0.0.0.0",
        help="Host to bind to")
    parser.add_argument(
        "--model-path",
        type=str,
        default="../VibeVoice-1.5B",
        help="Path to VibeVoice model")
    parser.add_argument("--device", type=str, default=None,
                        help="Device for inference (cuda/cpu/mps)")

    args = parser.parse_args()

    # Override model path if specified
    if args.model_path != "../VibeVoice-1.5B":
        processor.model_path = args.model_path
        processor.load_model()

    # Override device if specified
    if args.device:
        processor.device = args.device
        if VIBEVOICE_AVAILABLE:
            processor.load_model()

    logger.info(f"Starting VibeVoice Service on {args.host}:{args.port}")
    logger.info(f"Model path: {processor.model_path}")
    logger.info(f"Device: {processor.device}")
    logger.info(f"VibeVoice available: {VIBEVOICE_AVAILABLE}")

    app.run(
        host=args.host,
        port=args.port,
        debug=False,
        threaded=True
    )
