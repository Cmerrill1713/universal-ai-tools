#!/usr/bin/env python3
"""
Simple TTS HTTP Server
HTTP API wrapper for MeloTTS-English service using built-in Python HTTP server
"""

import os
import sys
import json
import logging
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from typing import Dict, Any

# Add the current directory to path for imports
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

# Import with error handling
try:
    from melotts_service import MeloTTSService
except ImportError:
    # Try importing from the module file directly
    import importlib.util
    spec = importlib.util.spec_from_file_location("melotts_service", os.path.join(current_dir, "melotts-service.py"))
    melotts_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(melotts_module)
    MeloTTSService = melotts_module.MeloTTSService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('tts-simple-server')

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

class TTSRequestHandler(BaseHTTPRequestHandler):
    """HTTP request handler for TTS service"""
    
    def log_message(self, format, *args):
        """Override to use our logger"""
        logger.info(f"{self.client_address[0]} - {format % args}")
    
    def send_json_response(self, data: Dict[str, Any], status_code: int = 200):
        """Send JSON response"""
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        
        response_data = json.dumps(data, indent=2)
        self.wfile.write(response_data.encode('utf-8'))
    
    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_GET(self):
        """Handle GET requests"""
        try:
            if self.path == '/health':
                self.handle_health()
            elif self.path == '/voices':
                self.handle_voices()
            elif self.path == '/status':
                self.handle_status()
            else:
                self.send_json_response({'error': 'Endpoint not found'}, 404)
        except Exception as e:
            logger.error(f"GET error: {str(e)}")
            self.send_json_response({'error': str(e)}, 500)
    
    def do_POST(self):
        """Handle POST requests"""
        try:
            if self.path == '/speak':
                self.handle_speak()
            else:
                self.send_json_response({'error': 'Endpoint not found'}, 404)
        except Exception as e:
            logger.error(f"POST error: {str(e)}")
            self.send_json_response({'error': str(e)}, 500)
    
    def handle_health(self):
        """Health check endpoint"""
        self.send_json_response({
            'status': 'healthy',
            'service': 'TTS Simple HTTP Server',
            'tts_loaded': tts_loaded,
            'endpoints': {
                'voices': '/voices',
                'speak': '/speak',
                'status': '/status'
            }
        })
    
    def handle_voices(self):
        """Get available voices"""
        if not ensure_tts_loaded():
            self.send_json_response({'error': 'TTS service not available'}, 503)
            return
        
        speakers = tts_service.get_available_speakers()
        voice_details = {
            'US': {'name': 'Samantha', 'language': 'en-US', 'description': 'American English'},
            'UK': {'name': 'Daniel', 'language': 'en-GB', 'description': 'British English'},
            'AU': {'name': 'Karen', 'language': 'en-AU', 'description': 'Australian English'},
            'IN': {'name': 'Rishi', 'language': 'en-IN', 'description': 'Indian English'}
        }
        
        self.send_json_response({
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
    
    def handle_speak(self):
        """Convert text to speech"""
        if not ensure_tts_loaded():
            self.send_json_response({'error': 'TTS service not available'}, 503)
            return
        
        try:
            # Read POST data
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self.send_json_response({'error': 'No data provided'}, 400)
                return
            
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            text = data.get('text', '').strip()
            if not text:
                self.send_json_response({'error': 'Text is required'}, 400)
                return
            
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
                self.send_json_response(result)
            else:
                error_msg = result.get('error', 'Speech generation failed') if result else 'Unknown error'
                self.send_json_response({'error': error_msg}, 500)
                
        except json.JSONDecodeError:
            self.send_json_response({'error': 'Invalid JSON data'}, 400)
        except Exception as e:
            logger.error(f"Speak error: {str(e)}")
            self.send_json_response({'error': str(e)}, 500)
    
    def handle_status(self):
        """Get TTS service status"""
        model_info = tts_service.get_model_info() if tts_loaded else None
        
        self.send_json_response({
            'success': True,
            'tts_loaded': tts_loaded,
            'model_info': model_info,
            'server_info': {
                'name': 'TTS Simple HTTP Server',
                'version': '1.0.0',
                'capabilities': [
                    'Text-to-speech generation',
                    'Multiple English accents',
                    'Real-time processing',
                    'Base64 audio output'
                ]
            }
        })

def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='TTS Simple HTTP Server')
    parser.add_argument('--host', default='127.0.0.1', help='Server host')
    parser.add_argument('--port', type=int, default=8085, help='Server port')
    
    args = parser.parse_args()
    
    logger.info(f"🚀 Starting TTS Simple HTTP Server on {args.host}:{args.port}")
    
    # Pre-load TTS service
    ensure_tts_loaded()
    
    server_address = (args.host, args.port)
    httpd = HTTPServer(server_address, TTSRequestHandler)
    
    try:
        logger.info(f"✅ Server ready! Available endpoints:")
        logger.info(f"  - Health: http://{args.host}:{args.port}/health")
        logger.info(f"  - Voices: http://{args.host}:{args.port}/voices")
        logger.info(f"  - Speak: http://{args.host}:{args.port}/speak (POST)")
        logger.info(f"  - Status: http://{args.host}:{args.port}/status")
        
        httpd.serve_forever()
    except KeyboardInterrupt:
        logger.info("🛑 Server shutting down...")
        httpd.shutdown()

if __name__ == '__main__':
    main()