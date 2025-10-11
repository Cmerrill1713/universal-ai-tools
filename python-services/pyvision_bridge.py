#!/usr/bin/env python3
"""
PyVision Bridge Service
Provides Python-based image processing capabilities for Universal AI Tools
"""

import asyncio
import base64
import json
import logging
import os
import sys
import tempfile
from datetime import datetime
from typing import Any, Dict

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('pyvision_bridge')


class PyVisionBridge:
    """Python bridge for vision processing tasks"""

    def __init__(self):
        self.initialized = False
        self.available_models = []
        self.temp_dir = tempfile.gettempdir()

    async def initialize(self):
        """Initialize the PyVision bridge"""
        try:
            logger.info("Initializing PyVision Bridge...")

            # Check for available vision processing libraries
            try:
                import PIL
                self.available_models.append("PIL")
                logger.info("PIL (Pillow) available")
            except ImportError:
                logger.warning("PIL (Pillow) not available")

            try:
                import cv2
                self.available_models.append("OpenCV")
                logger.info("OpenCV available")
            except ImportError:
                logger.warning("OpenCV not available")

            try:
                import numpy as np
                self.available_models.append("NumPy")
                logger.info("NumPy available")
            except ImportError:
                logger.warning("NumPy not available")

            self.initialized = True
            logger.info(
                f"PyVision Bridge initialized with models: {
                    self.available_models}")

        except Exception as e:
            logger.error(f"Failed to initialize PyVision Bridge: {str(e)}")
            raise

    async def process_image(self,
                            image_data: str,
                            operation: str,
                            parameters: Dict[str,
                                             Any]) -> Dict[str,
                                                           Any]:
        """Process an image with the specified operation"""
        try:
            if not self.initialized:
                await self.initialize()

            # Decode base64 image data
            try:
                image_bytes = base64.b64decode(image_data)
            except Exception as e:
                return {
                    "success": False,
                    "error": f"Invalid image data: {
                        str(e)}"}

            # Create temporary file
            temp_input_path = os.path.join(
                self.temp_dir, f"input_{
                    datetime.now().strftime('%Y%m%d_%H%M%S')}.png")
            temp_output_path = os.path.join(
                self.temp_dir, f"output_{
                    datetime.now().strftime('%Y%m%d_%H%M%S')}.png")

            with open(temp_input_path, 'wb') as f:
                f.write(image_bytes)

            # Process based on operation
            if operation == "resize":
                result = await self._resize_image(temp_input_path, temp_output_path, parameters)
            elif operation == "enhance":
                result = await self._enhance_image(temp_input_path, temp_output_path, parameters)
            elif operation == "filter":
                result = await self._filter_image(temp_input_path, temp_output_path, parameters)
            elif operation == "analyze":
                result = await self._analyze_image(temp_input_path, parameters)
            else:
                result = {
                    "success": False,
                    "error": f"Unknown operation: {operation}"}

            # Clean up temporary files
            try:
                if os.path.exists(temp_input_path):
                    os.remove(temp_input_path)
                if os.path.exists(temp_output_path):
                    os.remove(temp_output_path)
            except Exception as e:
                logger.warning(f"Failed to clean up temporary files: {str(e)}")

            return result

        except Exception as e:
            logger.error(f"Error processing image: {str(e)}")
            return {"success": False, "error": str(e)}

    async def _resize_image(self,
                            input_path: str,
                            output_path: str,
                            parameters: Dict[str,
                                             Any]) -> Dict[str,
                                                           Any]:
        """Resize an image"""
        try:
            if "PIL" not in self.available_models:
                return {
                    "success": False,
                    "error": "PIL not available for image resizing"}

            from PIL import Image

            width = parameters.get("width", 512)
            height = parameters.get("height", 512)
            maintain_aspect = parameters.get("maintain_aspect", True)

            with Image.open(input_path) as img:
                if maintain_aspect:
                    img.thumbnail((width, height), Image.Resampling.LANCZOS)
                else:
                    img = img.resize((width, height), Image.Resampling.LANCZOS)

                img.save(output_path)

            # Read processed image
            with open(output_path, 'rb') as f:
                processed_data = base64.b64encode(f.read()).decode('utf-8')

            return {
                "success": True,
                "processed_image": processed_data,
                "operation": "resize",
                "parameters_applied": {
                    "width": width,
                    "height": height,
                    "maintain_aspect": maintain_aspect
                }
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"Resize operation failed: {
                    str(e)}"}

    async def _enhance_image(self,
                             input_path: str,
                             output_path: str,
                             parameters: Dict[str,
                                              Any]) -> Dict[str,
                                                            Any]:
        """Enhance an image (brightness, contrast, etc.)"""
        try:
            if "PIL" not in self.available_models:
                return {
                    "success": False,
                    "error": "PIL not available for image enhancement"}

            from PIL import Image, ImageEnhance

            brightness = parameters.get("brightness", 1.0)
            contrast = parameters.get("contrast", 1.0)
            color = parameters.get("color", 1.0)
            sharpness = parameters.get("sharpness", 1.0)

            with Image.open(input_path) as img:
                # Apply enhancements
                if brightness != 1.0:
                    enhancer = ImageEnhance.Brightness(img)
                    img = enhancer.enhance(brightness)

                if contrast != 1.0:
                    enhancer = ImageEnhance.Contrast(img)
                    img = enhancer.enhance(contrast)

                if color != 1.0:
                    enhancer = ImageEnhance.Color(img)
                    img = enhancer.enhance(color)

                if sharpness != 1.0:
                    enhancer = ImageEnhance.Sharpness(img)
                    img = enhancer.enhance(sharpness)

                img.save(output_path)

            # Read processed image
            with open(output_path, 'rb') as f:
                processed_data = base64.b64encode(f.read()).decode('utf-8')

            return {
                "success": True,
                "processed_image": processed_data,
                "operation": "enhance",
                "parameters_applied": {
                    "brightness": brightness,
                    "contrast": contrast,
                    "color": color,
                    "sharpness": sharpness
                }
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"Enhancement operation failed: {
                    str(e)}"}

    async def _filter_image(self,
                            input_path: str,
                            output_path: str,
                            parameters: Dict[str,
                                             Any]) -> Dict[str,
                                                           Any]:
        """Apply filters to an image"""
        try:
            if "PIL" not in self.available_models:
                return {
                    "success": False,
                    "error": "PIL not available for image filtering"}

            from PIL import Image, ImageFilter

            filter_type = parameters.get("filter", "BLUR")

            with Image.open(input_path) as img:
                if filter_type == "BLUR":
                    img = img.filter(ImageFilter.BLUR)
                elif filter_type == "SHARPEN":
                    img = img.filter(ImageFilter.SHARPEN)
                elif filter_type == "EDGE_ENHANCE":
                    img = img.filter(ImageFilter.EDGE_ENHANCE)
                elif filter_type == "SMOOTH":
                    img = img.filter(ImageFilter.SMOOTH)
                elif filter_type == "GRAYSCALE":
                    img = img.convert('L')

                img.save(output_path)

            # Read processed image
            with open(output_path, 'rb') as f:
                processed_data = base64.b64encode(f.read()).decode('utf-8')

            return {
                "success": True,
                "processed_image": processed_data,
                "operation": "filter",
                "parameters_applied": {"filter": filter_type}
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"Filter operation failed: {
                    str(e)}"}

    async def _analyze_image(self, input_path: str,
                             parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze an image and return metadata"""
        try:
            if "PIL" not in self.available_models:
                return {
                    "success": False,
                    "error": "PIL not available for image analysis"}

            import os

            from PIL import Image

            with Image.open(input_path) as img:
                # Get image info
                file_size = os.path.getsize(input_path)

                analysis = {
                    "success": True,
                    "operation": "analyze",
                    "metadata": {
                        "format": img.format,
                        "mode": img.mode,
                        "size": {
                            "width": img.width,
                            "height": img.height},
                        "has_transparency": img.mode in (
                            'RGBA',
                            'LA') or 'transparency' in img.info,
                        "file_size_bytes": file_size,
                        "aspect_ratio": round(
                            img.width /
                            img.height,
                            2) if img.height > 0 else 0}}

                # Add color analysis if requested
                if parameters.get(
                    "analyze_colors",
                        False) and "PIL" in self.available_models:
                    try:
                        colors = img.getcolors(maxcolors=256 * 256 * 256)
                        if colors:
                            dominant_colors = sorted(colors, reverse=True)[:5]
                            analysis["metadata"]["dominant_colors"] = [
                                {"count": count, "rgb": color} for count, color in dominant_colors[:3]
                            ]
                    except Exception as e:
                        logger.warning(f"Color analysis failed: {str(e)}")

                return analysis

        except Exception as e:
            return {
                "success": False,
                "error": f"Analysis operation failed: {
                    str(e)}"}

    def get_status(self) -> Dict[str, Any]:
        """Get the current status of the PyVision bridge"""
        return {
            "initialized": self.initialized,
            "available_models": self.available_models,
            "temp_directory": self.temp_dir,
            "supported_operations": ["resize", "enhance", "filter", "analyze"]
        }


# Global bridge instance
bridge = PyVisionBridge()


async def handle_request(request_data: Dict[str, Any]) -> Dict[str, Any]:
    """Handle incoming requests"""
    try:
        command = request_data.get("command")

        if command == "status":
            return bridge.get_status()

        elif command == "process":
            image_data = request_data.get("image_data")
            operation = request_data.get("operation")
            parameters = request_data.get("parameters", {})

            if not image_data or not operation:
                return {
                    "success": False,
                    "error": "Missing required parameters"}

            return await bridge.process_image(image_data, operation, parameters)

        else:
            return {"success": False, "error": f"Unknown command: {command}"}

    except Exception as e:
        logger.error(f"Error handling request: {str(e)}")
        return {"success": False, "error": str(e)}


async def main():
    """Main function to run the PyVision bridge"""
    logger.info("Starting PyVision Bridge Service")

    try:
        await bridge.initialize()

        # Send initial ready status to TypeScript
        ready_response = {
            "success": True,
            "initialized": True,
            "available_models": bridge.available_models,
            "message": "PyVision Bridge ready"
        }
        print(json.dumps(ready_response), flush=True)

        # Simple stdin/stdout communication
        while True:
            try:
                line = sys.stdin.readline()
                if not line:
                    break

                request_data = json.loads(line.strip())
                response = await handle_request(request_data)

                print(json.dumps(response), flush=True)

            except json.JSONDecodeError as e:
                error_response = {
                    "success": False,
                    "error": f"Invalid JSON: {
                        str(e)}"}
                print(json.dumps(error_response), flush=True)
            except Exception as e:
                error_response = {"success": False, "error": str(e)}
                print(json.dumps(error_response), flush=True)

    except KeyboardInterrupt:
        logger.info("PyVision Bridge shutting down...")
    except Exception as e:
        logger.error(f"Fatal error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
