#!/usr/bin/env python3
"""
Vision Service - HTTP Server for Computer Vision Operations
Provides REST API for image processing and analysis
"""

import asyncio
import base64
import json
import logging
import os
import sys
import tempfile
from datetime import datetime
from typing import Any, Dict, Optional

from flask import Flask, jsonify, request
from flask_cors import CORS
from pyvision_bridge import PyVisionBridge, handle_request

# Import the PyVision bridge
sys.path.append('.')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('vision-service')

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Global bridge instance
bridge = PyVisionBridge()


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        status = bridge.get_status()
        return jsonify({
            "status": "healthy",
            "service": "vision-service",
            "timestamp": datetime.now().timestamp(),
            "bridge_status": status
        })
    except Exception as e:
        logger.error(f"Health check error: {str(e)}")
        return jsonify({
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().timestamp()
        }), 500


@app.route('/status', methods=['GET'])
def get_status():
    """Get service status"""
    try:
        status = bridge.get_status()
        return jsonify({
            "success": True,
            "message": "Vision service status retrieved",
            "data": status
        })
    except Exception as e:
        logger.error(f"Status error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/process', methods=['POST'])
def process_image():
    """Process image with various operations"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "success": False,
                "error": "No JSON data provided"
            }), 400

        # Handle the request using the bridge
        response = asyncio.run(handle_request(data))
        return jsonify(response)

    except Exception as e:
        logger.error(f"Process image error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/vision/analyze', methods=['POST'])
def analyze_image():
    """Analyze image content"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "success": False,
                "error": "No JSON data provided"
            }), 400

        # Prepare analysis request
        analysis_request = {
            "command": "process",
            "image_data": data.get("image"),
            "operation": "analyze",
            "parameters": data.get("parameters", {})
        }

        response = asyncio.run(handle_request(analysis_request))
        return jsonify(response)

    except Exception as e:
        logger.error(f"Analyze image error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/analyze', methods=['POST'])
def analyze_image_alias():
    """Analyze image endpoint - alias for /vision/analyze"""
    return analyze_image()


@app.route('/vision/ocr', methods=['POST'])
def extract_text():
    """Extract text from image"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "success": False,
                "error": "No JSON data provided"
            }), 400

        # For OCR, we'll use the analyze operation with OCR parameters
        ocr_request = {
            "command": "process",
            "image_data": data.get("image"),
            "operation": "analyze",
            "parameters": {
                "extract_text": True,
                "languages": data.get("languages", ["eng"])
            }
        }

        response = asyncio.run(handle_request(ocr_request))

        # Transform response to OCR format
        if response.get("success"):
            return jsonify(
                {
                    "success": True, "text": response.get(
                        "metadata", {}).get(
                        "extracted_text", ""), "confidence": response.get(
                        "metadata", {}).get(
                        "text_confidence", 0.0), "blocks": response.get(
                            "metadata", {}).get(
                                "text_blocks", [])})
        else:
            return jsonify(response)

    except Exception as e:
        logger.error(f"OCR error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/capabilities', methods=['GET'])
def get_capabilities():
    """Get service capabilities"""
    try:
        status = bridge.get_status()

        capabilities = {
            "success": True,
            "message": "Vision service capabilities retrieved",
            "data": {
                "supported_operations": ["resize", "enhance", "filter", "analyze"],
                "supported_formats": ["png", "jpg", "jpeg", "gif", "bmp"],
                "max_image_size": "10MB",
                "features": ["PIL integration", "NumPy support"],
                "available_models": status.get("available_models", []),
                "initialized": status.get("initialized", False)
            }
        }

        return jsonify(capabilities)

    except Exception as e:
        logger.error(f"Capabilities error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.errorhandler(404)
def not_found(error):
    return jsonify({
        "success": False,
        "error": "Endpoint not found",
        "message": f"The requested URL {request.url} was not found on this server"
    }), 404


@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {str(error)}")
    return jsonify({
        "success": False,
        "error": "Internal server error",
        "message": "An unexpected error occurred"
    }), 500


async def initialize_bridge():
    """Initialize the vision bridge"""
    try:
        await bridge.initialize()
        logger.info("Vision bridge initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize vision bridge: {str(e)}")
        raise


def main():
    """Main function to run the vision service"""
    logger.info("Starting Vision Service HTTP Server")

    try:
        # Initialize the bridge
        asyncio.run(initialize_bridge())

        # Get port from environment or use default
        port = int(os.environ.get('VISION_SERVICE_PORT', '8090'))
        host = os.environ.get('VISION_SERVICE_HOST', '0.0.0.0')

        logger.info(f"Vision Service starting on {host}:{port}")

        # Start Flask app
        app.run(
            host=host,
            port=port,
            debug=False,
            threaded=True
        )

    except KeyboardInterrupt:
        logger.info("Vision Service shutting down...")
    except Exception as e:
        logger.error(f"Fatal error: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
