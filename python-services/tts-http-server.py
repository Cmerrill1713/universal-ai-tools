#!/usr/bin/env python3
"""
TTS HTTP Server
HTTP API wrapper for MeloTTS-English service integration with Go API Gateway
"""

import os
import sys
import json
import logging
from pathlib import Path
from typing import Dict, Any

from flask import Flask, request, jsonify, Response
from melotts_service import MeloTTSService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('tts-http-server')

# Initialize Flask app
app = Flask(__name__)

# Initialize TTS service
tts_service = MeloTTSService()
tts_loaded = False

def ensure_tts_loaded():
    """Ensure TTS service is loaded"""
    global tts_loaded
    if not tts_loaded:
        logger.info("Loading TTS service...")
        if tts_service.load_model():
            tts_loaded = True
            logger.info("✅ TTS service loaded successfully")
        else:
            logger.error("❌ Failed to load TTS service")
    return tts_loaded

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'TTS HTTP Server',
        'tts_loaded': tts_loaded,
        'endpoints': {
            'voices': '/voices',
            'speak': '/speak',
            'status': '/status'
        }
    })

@app.route('/voices', methods=['GET'])
def get_voices():
    """Get available voices"""
    if not ensure_tts_loaded():
        return jsonify({'error': 'TTS service not available'}), 503
    
    speakers = tts_service.get_available_speakers()
    voice_details = {
        'US': {'name': 'Samantha', 'language': 'en-US', 'description': 'American English'},
        'UK': {'name': 'Daniel', 'language': 'en-GB', 'description': 'British English'},
        'AU': {'name': 'Karen', 'language': 'en-AU', 'description': 'Australian English'},
        'IN': {'name': 'Rishi', 'language': 'en-IN', 'description': 'Indian English'}
    }
    
    return jsonify({
        'success': True,
        'voices': [
            {
                'id': speaker,
                'name': voice_details[speaker]['name'],
                'language': voice_details[speaker]['language'],
                'description': voice_details[speaker]['description']
            }
            for speaker in speakers
        ],
        'total': len(speakers)
    })

@app.route('/speak', methods=['POST'])
def text_to_speech():
    """Convert text to speech"""
    if not ensure_tts_loaded():
        return jsonify({'error': 'TTS service not available'}), 503
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        text = data.get('text', '').strip()
        if not text:
            return jsonify({'error': 'Text is required'}), 400
        
        speaker = data.get('speaker', 'US')
        speed = data.get('speed', 1.0)
        
        logger.info(f"TTS request: '{text[:50]}{'...' if len(text) > 50 else ''}' (speaker: {speaker})")
        
        # Generate speech
        result = tts_service.generate_speech(
            text=text,
            speaker=speaker,
            speed=speed
        )
        
        if result and result['success']:
            return jsonify(result)
        else:
            error_msg = result.get('error', 'Speech generation failed') if result else 'Unknown error'
            return jsonify({'error': error_msg}), 500
            
    except Exception as e:
        logger.error(f"TTS error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/status', methods=['GET'])
def get_status():
    """Get TTS service status"""
    model_info = tts_service.get_model_info() if tts_loaded else None
    
    return jsonify({
        'success': True,
        'tts_loaded': tts_loaded,
        'model_info': model_info,
        'server_info': {
            'name': 'TTS HTTP Server',
            'version': '1.0.0',
            'capabilities': [
                'Text-to-speech generation',
                'Multiple English accents',
                'Real-time processing',
                'Base64 audio output'
            ]
        }
    })

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='TTS HTTP Server')
    parser.add_argument('--host', default='127.0.0.1', help='Server host')
    parser.add_argument('--port', type=int, default=8085, help='Server port')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')
    
    args = parser.parse_args()
    
    logger.info(f"🚀 Starting TTS HTTP Server on {args.host}:{args.port}")
    
    # Pre-load TTS service
    ensure_tts_loaded()
    
    app.run(
        host=args.host,
        port=args.port,
        debug=args.debug,
        threaded=True
    )

if __name__ == '__main__':
    main()