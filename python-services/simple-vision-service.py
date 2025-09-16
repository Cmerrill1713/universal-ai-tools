#!/usr/bin/env python3
"""
Simple Vision Service - Basic HTTP Server for Vision Operations
Provides essential vision capabilities without complex dependencies
"""

import base64
import json
import logging
import os
from datetime import datetime

from flask import Flask, jsonify, request
from flask_cors import CORS

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('simple-vision-service')

# Initialize Flask app
app = Flask(__name__)
CORS(app)


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "simple-vision-service",
        "timestamp": datetime.now().timestamp(),
        "capabilities": ["basic_processing", "mock_responses"]
    })


@app.route('/status', methods=['GET'])
def get_status():
    """Get service status"""
    return jsonify({
        "success": True,
        "message": "Simple Vision Service is operational",
        "data": {
            "initialized": True,
            "available_operations": ["analyze", "process"],
            "supported_formats": ["base64"],
            "service_type": "mock"
        }
    })


@app.route('/vision/analyze', methods=['POST'])
def analyze_image():
    """Mock image analysis"""
    try:
        data = request.get_json()
        if not data or 'image' not in data:
            return jsonify({
                "success": False,
                "error": "Image data required"
            }), 400

        # Mock analysis response
        response = {
            "success": True,
            "description": "Mock image analysis completed successfully",
            "objects": [
                {
                    "label": "object",
                    "confidence": 0.85,
                    "bbox": {
                        "x": 10,
                        "y": 10,
                        "width": 100,
                        "height": 100
                    }
                }
            ],
            "metadata": {
                "width": 512,
                "height": 512,
                "format": "png",
                "processing_time_ms": 150
            },
            "model": "mock-vision-v1"
        }

        logger.info("Mock image analysis completed")
        return jsonify(response)

    except Exception as e:
        logger.error(f"Analysis error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/vision/ocr', methods=['POST'])
def extract_text():
    """Mock OCR functionality"""
    try:
        data = request.get_json()
        if not data or 'image' not in data:
            return jsonify({
                "success": False,
                "error": "Image data required"
            }), 400

        # Mock OCR response
        response = {
            "success": True,
            "text": "This is mock extracted text from the image.",
            "blocks": [
                {
                    "text": "This is mock",
                    "confidence": 0.92,
                    "bbox": {
                        "x": 50,
                        "y": 100,
                        "width": 200,
                        "height": 30
                    }
                },
                {
                    "text": "extracted text",
                    "confidence": 0.88,
                    "bbox": {
                        "x": 50,
                        "y": 140,
                        "width": 180,
                        "height": 30
                    }
                }
            ],
            "confidence": 0.90
        }

        logger.info("Mock OCR completed")
        return jsonify(response)

    except Exception as e:
        logger.error(f"OCR error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/process', methods=['POST'])
def process_image():
    """Mock image processing"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "success": False,
                "error": "No data provided"
            }), 400

        operation = data.get('operation', 'analyze')
        image_data = data.get('image_data', '')

        if not image_data:
            return jsonify({
                "success": False,
                "error": "Image data required"
            }), 400

        # Mock processing response
        response = {
            "success": True,
            "operation": operation,
            "processed_image": image_data,  # Return same image (mock)
            "parameters_applied": data.get('parameters', {}),
            "metadata": {
                "processing_time_ms": 100,
                "operation_completed": True
            }
        }

        logger.info(f"Mock image processing completed: {operation}")
        return jsonify(response)

    except Exception as e:
        logger.error(f"Processing error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/capabilities', methods=['GET'])
def get_capabilities():
    """Get service capabilities"""
    return jsonify({
        "success": True,
        "message": "Simple Vision Service capabilities",
        "data": {
            "supported_operations": ["analyze", "ocr", "process"],
            "supported_formats": ["base64"],
            "max_image_size": "5MB",
            "features": ["mock_responses", "basic_processing"],
            "service_type": "simple_mock"
        }
    })


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
    port = int(os.environ.get('VISION_SERVICE_PORT', '8091'))
    host = os.environ.get('VISION_SERVICE_HOST', '0.0.0.0')

    logger.info(f"Starting Simple Vision Service on {host}:{port}")

    app.run(
        host=host,
        port=port,
        debug=False,
        threaded=True
    )
