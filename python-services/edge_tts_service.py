#!/usr/bin/env python3
"""
Edge TTS Service
High-quality text-to-speech using Microsoft Edge TTS with real accents and voices
"""

import os
import sys
import json
import logging
import base64
import tempfile
import asyncio
import argparse
from typing import Optional, Dict, Any, List

import edge_tts

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("edge-tts-service")


class EdgeTTSService:
    """
    Microsoft Edge TTS Service

    Features:
    - High-quality neural voices
    - Multiple real English accents (US, UK, AU, CA, IN)
    - Natural prosody and emotion
    - Fast inference
    - Commercial use allowed
    """

    def __init__(self):
        self.voice_mapping = {
            "US": "en-US-AriaNeural",  # US Female - Natural and expressive
            "UK": "en-GB-SoniaNeural",  # UK Female - Clear British accent
            "AU": "en-AU-NatashaNeural",  # AU Female - Australian accent
            "IN": "en-IN-NeerjaNeural",  # IN Female - Indian English accent
            "CA": "en-CA-ClaraNeural",  # CA Female - Canadian accent
            # Male voices
            "US_Male": "en-US-GuyNeural",
            "UK_Male": "en-GB-RyanNeural",
            "AU_Male": "en-AU-WilliamNeural",
            "IN_Male": "en-IN-PrabhatNeural",
        }

        # Available voices cache
        self.available_voices = None
        logger.info("Edge TTS Service initialized")

    async def load_voices(self) -> bool:
        """Load and cache available voices."""
        try:
            logger.info("Loading available Edge TTS voices...")
            voices = await edge_tts.list_voices()
            self.available_voices = voices

            english_voices = [v for v in voices if "en-" in v["Locale"]]
            logger.info(
                f"✅ Loaded {len(english_voices)} English voices from {len(voices)} total"
            )
            return True

        except Exception as e:
            logger.error(f"❌ Failed to load voices: {str(e)}")
            return False

    async def generate_speech(
        self, text: str, speaker: str = "US", speed: float = 1.0, pitch: str = "+0Hz"
    ) -> Optional[Dict[str, Any]]:
        """
        Generate speech from text using Edge TTS.

        Args:
            text: Text to convert to speech
            speaker: Speaker accent (US, UK, AU, IN, CA, US_Male, etc.)
            speed: Speech speed multiplier (0.5 to 2.0)
            pitch: Pitch adjustment (+/-50Hz)

        Returns:
            Dictionary with audio data and metadata
        """
        try:
            import time

            start_time = time.time()

            # Get voice name for speaker
            voice_name = self.voice_mapping.get(speaker, self.voice_mapping["US"])

            logger.info(
                f"Generating speech with voice '{voice_name}' for accent '{speaker}'"
            )
            logger.info(f"Text: '{text[:50]}{'...' if len(text) > 50 else ''}'")

            # Adjust speed if needed
            rate = (
                f"+{int((speed - 1) * 100)}%"
                if speed > 1
                else f"{int((speed - 1) * 100)}%"
            )

            # Create SSML for better control
            ssml = f"""
            <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
                <voice name="{voice_name}">
                    <prosody rate="{rate}" pitch="{pitch}">
                        {text}
                    </prosody>
                </voice>
            </speak>
            """.strip()

            # Generate audio
            communicate = edge_tts.Communicate(ssml, voice_name)

            # Save to temporary file
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as temp_file:
                temp_path = temp_file.name

            await communicate.save(temp_path)

            # Read and encode audio
            with open(temp_path, "rb") as f:
                audio_data = f.read()
                audio_base64 = base64.b64encode(audio_data).decode("utf-8")

            # Clean up
            os.unlink(temp_path)

            generation_time = time.time() - start_time

            # Estimate duration (rough calculation for MP3)
            estimated_duration = len(text.split()) * 0.6  # ~0.6s per word

            result = {
                "success": True,
                "audio_base64": audio_base64,
                "format": "mp3",
                "sample_rate": 24000,  # Edge TTS outputs 24kHz
                "duration": estimated_duration,
                "generation_time": generation_time,
                "text": text,
                "speaker": speaker,
                "voice_name": voice_name,
                "speed": speed,
                "pitch": pitch,
                "model": "Microsoft Edge TTS",
                "quality": "High-Quality Neural Speech",
                "accent": self.get_accent_description(speaker),
                "message": f"Generated {estimated_duration:.2f}s of speech in {generation_time:.2f}s",
            }

            logger.info(
                f"✅ Speech generated: {estimated_duration:.2f}s audio in {generation_time:.2f}s"
            )
            return result

        except Exception as e:
            logger.error(f"❌ Speech generation failed: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "message": "Speech generation failed",
            }

    def get_accent_description(self, speaker: str) -> str:
        """Get human-readable accent description."""
        accent_map = {
            "US": "American English",
            "UK": "British English",
            "AU": "Australian English",
            "IN": "Indian English",
            "CA": "Canadian English",
            "US_Male": "American English (Male)",
            "UK_Male": "British English (Male)",
            "AU_Male": "Australian English (Male)",
            "IN_Male": "Indian English (Male)",
        }
        return accent_map.get(speaker, "American English")

    def get_available_speakers(self) -> List[str]:
        """Get list of available speaker accents."""
        return list(self.voice_mapping.keys())

    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the Edge TTS model."""
        return {
            "model_name": "Microsoft Edge TTS",
            "provider": "Microsoft",
            "loaded": True,
            "speakers": self.get_available_speakers(),
            "capabilities": [
                "High-quality neural voices",
                "Multiple English accents",
                "Real-time inference",
                "Natural prosody and emotion",
                "SSML support",
                "Pitch and speed control",
            ],
            "supported_accents": [
                "US (American)",
                "UK (British)",
                "AU (Australian)",
                "IN (Indian)",
                "CA (Canadian)",
            ],
            "audio_format": "MP3, 24kHz",
            "license": "Commercial use allowed",
            "quality": "Production-grade neural TTS",
        }


async def main():
    """Main function for command-line usage."""
    parser = argparse.ArgumentParser(description="Edge TTS Service")
    parser.add_argument("--text", "-t", help="Text to convert to speech")
    parser.add_argument(
        "--speaker",
        "-s",
        choices=[
            "US",
            "UK",
            "AU",
            "IN",
            "CA",
            "US_Male",
            "UK_Male",
            "AU_Male",
            "IN_Male",
        ],
        default="US",
        help="Speaker accent",
    )
    parser.add_argument("--speed", type=float, default=1.0, help="Speech speed")
    parser.add_argument("--output", "-o", help="Output audio file path")
    parser.add_argument("--info", action="store_true", help="Show model information")
    parser.add_argument("--test", action="store_true", help="Run speech test")
    parser.add_argument("--voices", action="store_true", help="List available voices")

    args = parser.parse_args()

    # Initialize TTS service
    tts = EdgeTTSService()

    if args.info:
        print(json.dumps(tts.get_model_info(), indent=2))
        return

    if args.voices:
        await tts.load_voices()
        print(
            json.dumps(
                {
                    "available_speakers": tts.get_available_speakers(),
                    "voice_mapping": tts.voice_mapping,
                    "descriptions": {
                        speaker: tts.get_accent_description(speaker)
                        for speaker in tts.get_available_speakers()
                    },
                },
                indent=2,
            )
        )
        return

    # Load voices
    logger.info("Initializing Edge TTS...")
    if not await tts.load_voices():
        logger.error("Failed to load voices")
        sys.exit(1)

    if args.test:
        logger.info("Running speech generation test...")
        result = await tts.generate_speech(
            "Hello! This is a test of Microsoft Edge TTS with high-quality neural voices and natural accents.",
            speaker=args.speaker,
        )
        if result and result["success"]:
            logger.info("✅ Speech test passed")
            if args.output:
                audio_data = base64.b64decode(result["audio_base64"])
                with open(args.output, "wb") as f:
                    f.write(audio_data)
                logger.info(f"Test audio saved to: {args.output}")
        else:
            logger.error("❌ Speech test failed")
            sys.exit(1)
        return

    if not args.text:
        logger.error("Text is required for speech generation")
        sys.exit(1)

    # Generate speech
    result = await tts.generate_speech(
        text=args.text, speaker=args.speaker, speed=args.speed
    )

    if result and result["success"]:
        if args.output:
            # Save audio file
            audio_data = base64.b64decode(result["audio_base64"])
            with open(args.output, "wb") as f:
                f.write(audio_data)
            logger.info(f"Audio saved to: {args.output}")
        else:
            # Print result JSON
            print(
                json.dumps(
                    {k: v for k, v in result.items() if k != "audio_base64"}, indent=2
                )
            )
    else:
        logger.error("Speech generation failed")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
