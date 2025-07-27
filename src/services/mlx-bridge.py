#!/usr/bin/env python3
"""
MLX Bridge Server
Handles MLX fine-tuning and inference requests
"""

import sys
import json
import time
import logging
from typing import Dict, Any, Optional

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - MLX - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

try:
    import mlx.core as mx
    import mlx.nn as nn
    from mlx_lm import load, generate
    # Try different import paths for generate_text
    try:
        from mlx_lm.utils import generate_text
    except ImportError:
        try:
            from mlx_lm import generate_text
        except ImportError:
            # Use generate as fallback
            generate_text = generate
    MLX_AVAILABLE = True
except ImportError as e:
    MLX_AVAILABLE = False
    logger.error(f"MLX not available: {e}")

class MLXBridge:
    def __init__(self):
        self.models = {}
        self.is_ready = False
        
    def initialize(self):
        if not MLX_AVAILABLE:
            raise RuntimeError("MLX not available")
        
        logger.info("🍎 Initializing MLX bridge...")
        self.is_ready = True
        print("INITIALIZED", flush=True)
        logger.info("✅ MLX bridge ready")
    
    def load_model(self, model_path: str) -> bool:
        try:
            logger.info(f"📥 Loading model from {model_path}")
            model, tokenizer = load(model_path)
            self.models[model_path] = {'model': model, 'tokenizer': tokenizer}
            logger.info(f"✅ Model loaded: {model_path}")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to load model {model_path}: {e}")
            return False
    
    def inference(self, request: Dict[str, Any]) -> Dict[str, Any]:
        try:
            model_path = request['modelPath']
            prompt = request['prompt']
            params = request.get('parameters', {})
            
            # Load model if not already loaded
            if model_path not in self.models:
                if not self.load_model(model_path):
                    return {'success': False, 'error': f'Failed to load model {model_path}'}
            
            model_info = self.models[model_path]
            model = model_info['model']
            tokenizer = model_info['tokenizer']
            
            # Generate text
            response = generate(
                model=model,
                tokenizer=tokenizer,
                prompt=prompt,
                max_tokens=params.get('maxTokens', 256),
                temp=params.get('temperature', 0.7),
                top_p=params.get('topP', 0.9),
                verbose=False
            )
            
            # Clean response
            if response.startswith(prompt):
                response = response[len(prompt):].strip()
            
            return {
                'success': True,
                'data': {
                    'text': response,
                    'model': model_path,
                    'prompt': prompt
                }
            }
            
        except Exception as e:
            logger.error(f"❌ Inference failed: {e}")
            return {'success': False, 'error': str(e)}
    
    def fine_tune(self, request: Dict[str, Any]) -> Dict[str, Any]:
        # Placeholder for fine-tuning implementation
        return {
            'success': False,
            'error': 'Fine-tuning not yet implemented'
        }
    
    def process_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        request_id = request.get('id', 'unknown')
        request_type = request.get('type', 'unknown')
        
        try:
            if request_type == 'inference':
                result = self.inference(request)
            elif request_type == 'fine_tune':
                result = self.fine_tune(request)
            else:
                result = {'success': False, 'error': f'Unknown request type: {request_type}'}
            
            result['id'] = request_id
            return result
            
        except Exception as e:
            return {
                'id': request_id,
                'success': False,
                'error': str(e)
            }
    
    def run(self):
        logger.info("🏃 Starting MLX bridge server...")
        
        while True:
            try:
                line = sys.stdin.readline()
                if not line:
                    break
                
                request = json.loads(line.strip())
                response = self.process_request(request)
                print(json.dumps(response), flush=True)
                
            except json.JSONDecodeError as e:
                logger.error(f"❌ Invalid JSON: {e}")
            except KeyboardInterrupt:
                logger.info("⏹️ Shutting down MLX bridge...")
                break
            except Exception as e:
                logger.error(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    bridge = MLXBridge()
    bridge.initialize()
    bridge.run()
