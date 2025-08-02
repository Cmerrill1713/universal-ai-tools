#!/usr/bin/env python3
"""
LFM2 Server - Fast Local Model Bridge
Serves LFM2-1.2B model for TypeScript services
Uses MLX format for Apple Silicon optimization
"""

import sys
import json
import time
import logging
from typing import Dict, Any, Optional

# Try to import MLX-LM for the LFM2 model
try:
    from mlx_lm import load, generate
    HAS_MLX_LM = True
except ImportError:
    HAS_MLX_LM = False
    logging.warning("MLX-LM not available, install with: pip install mlx-lm")

class LFM2Server:
    """Fast LFM2 server using MLX for Apple Silicon"""
    
    def __init__(self):
        self.model = None
        self.tokenizer = None
        self.is_ready = False
        self.request_count = 0
        self.total_time = 0
        self.model_path = "/Users/christianmerrill/Desktop/universal-ai-tools/models/agents/LFM2-1.2B-bf16"
        # Use real LFM2 model for production routing - optimized for speed
        self.use_mock = False
        
        # Memory optimization settings
        self.last_used = time.time()
        self.idle_timeout = 300  # 5 minutes
        self.batch_size = 1
        self.max_sequence_length = 128  # Very short for fast routing decisions
        
        # Setup logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - LFM2 - %(levelname)s - %(message)s',
            handlers=[logging.StreamHandler(sys.stderr)]
        )
        self.logger = logging.getLogger(__name__)
        
    def initialize(self):
        """Initialize the LFM2 model using MLX"""
        try:
            self.logger.info("🚀 Initializing LFM2-1.2B server with MLX...")
            
            # Use mock to save memory unless explicitly disabled
            if self.use_mock:
                self.logger.info("📦 Using mock LFM2 to save memory (2.3GB saved)")
                self._initialize_mock()
                return
            
            if not HAS_MLX_LM:
                self.logger.warning("⚠️ MLX-LM not available, using mock implementation")
                self._initialize_mock()
                return
            
            # Check if the model path exists
            import os
            if not os.path.exists(self.model_path):
                self.logger.warning(f"⚠️ Model path not found: {self.model_path}")
                self._initialize_mock()
                return
            
            # Try to load with MLX - use lazy loading and optimizations
            try:
                self.logger.info(f"Loading LFM2 from {self.model_path} with optimizations...")
                
                # Load with lazy loading to reduce initial memory spike
                self.model, self.tokenizer = load(
                    self.model_path,
                    lazy=True  # Lazy loading for memory efficiency
                )
                
                # Set model to evaluation mode and optimize
                if hasattr(self.model, 'eval'):
                    self.model.eval()
                
                self.is_ready = True
                self.logger.info("✅ LFM2-1.2B loaded successfully with MLX (lazy mode)")
                
                # Schedule periodic memory cleanup
                self._schedule_memory_cleanup()
                
            except Exception as mlx_error:
                self.logger.warning(f"⚠️ MLX loading failed: {mlx_error}")
                self._initialize_mock()
                
        except Exception as e:
            self.logger.error(f"❌ Failed to initialize LFM2: {e}")
            self._initialize_mock()
    
    def _initialize_mock(self):
        """Initialize mock LFM2 implementation for development"""
        self.logger.info("🔄 Using mock LFM2 implementation for development")
        self.model = "mock-lfm2-1.2b"
        self.tokenizer = None
        self.is_ready = True
        self.logger.info("✅ Mock LFM2 server ready")
    
    def _schedule_memory_cleanup(self):
        """Schedule periodic memory cleanup with proper shutdown handling"""
        import threading
        import gc
        
        def cleanup():
            try:
                while self.is_ready:
                    time.sleep(60)  # Check every minute
                    if not self.is_ready:  # Check again after sleep
                        break
                        
                    current_time = time.time()
                    
                    # If model hasn't been used for idle_timeout, consider unloading
                    if current_time - self.last_used > self.idle_timeout:
                        self.logger.info("🧹 Model idle for too long, clearing cache")
                        gc.collect()
                        
                        # MLX specific cleanup if available
                        try:
                            import mlx.core as mx
                            mx.metal.clear_cache()
                        except ImportError:
                            pass
                        except Exception as e:
                            self.logger.warning(f"MLX cleanup warning: {e}")
            except Exception as e:
                self.logger.error(f"Memory cleanup thread error: {e}")
            finally:
                self.logger.info("Memory cleanup thread shutting down")
        
        self.cleanup_thread = threading.Thread(target=cleanup, daemon=True)
        self.cleanup_thread.start()
            
    def process(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Process a request"""
        start_time = time.time()
        self.request_count += 1
        self.last_used = time.time()  # Update last used time
        
        try:
            task_type = data.get('type', 'unknown')
            
            # Route to appropriate handler
            if task_type == 'completion':
                result = self._handle_completion(data)
            elif task_type == 'classification':
                result = self._handle_classification(data)
            elif task_type == 'coordination':
                result = self._handle_coordination(data)
            else:
                result = {
                    'success': False,
                    'error': f'Unknown task type: {task_type}'
                }
                
            # Add timing info
            result['processingTime'] = int((time.time() - start_time) * 1000)
            result['requestId'] = data.get('requestId', f'req_{self.request_count}')
            
            # Update stats
            self.total_time += result['processingTime']
            
            return result
            
        except Exception as e:
            self.logger.error(f"❌ Error processing request: {e}")
            return {
                'success': False,
                'error': str(e),
                'processingTime': int((time.time() - start_time) * 1000)
            }
            
    def _handle_completion(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle text completion requests"""
        prompt = data.get('prompt', '')
        max_tokens = data.get('maxTokens', 50)
        temperature = data.get('temperature', 0.7)
        
        if HAS_MLX_LM and self.model and self.tokenizer:
            try:
                # Apply chat template if available
                if self.tokenizer.chat_template is not None:
                    messages = [{"role": "user", "content": prompt}]
                    prompt = self.tokenizer.apply_chat_template(
                        messages, add_generation_prompt=True
                    )
                
                # Truncate prompt if too long to save memory
                if len(prompt) > self.max_sequence_length:
                    prompt = prompt[-self.max_sequence_length:]
                    self.logger.debug(f"Truncated prompt to {self.max_sequence_length} chars")
                
                # Generate response using MLX with memory limits
                # MLX-LM v0.26+ uses 'temp' parameter in generate
                response = generate(
                    self.model,
                    self.tokenizer,
                    prompt=prompt,
                    max_tokens=min(max_tokens, 50),  # Very short responses for routing
                    temp=temperature,  # MLX-LM uses 'temp' not 'temperature'
                    verbose=False
                )
                
                # Clear GPU cache after generation
                try:
                    import mlx.core as mx
                    mx.metal.clear_cache()
                except:
                    pass
                
                # Extract just the generated part
                if prompt in response:
                    response = response[len(prompt):].strip()
                
                return {
                    'success': True,
                    'text': response,
                    'model': 'lfm2-1.2b-mlx'
                }
            except Exception as e:
                self.logger.error(f"MLX generation error: {e}")
                # Fall through to mock
        
        # Smart mock response based on task type
        if data.get('type') == 'routing':
            # Intelligent routing decision based on simple keyword analysis
            prompt_lower = prompt.lower()
            
            # Simple but fast routing logic
            if any(word in prompt_lower for word in ['code', 'programming', 'debug', 'function', 'bug']):
                service = 'ollama'
                confidence = 0.85
            elif any(word in prompt_lower for word in ['creative', 'write', 'story', 'generate']):
                service = 'openai'
                confidence = 0.9
            elif any(word in prompt_lower for word in ['simple', 'quick', 'what', 'explain']):
                service = 'lfm2'
                confidence = 0.95
            else:
                service = 'ollama'
                confidence = 0.7
                
            routing_response = {
                "targetService": service,
                "confidence": confidence,
                "reasoning": f"Fast routing based on keywords in: {prompt[:30]}...",
                "estimatedTokens": min(max_tokens, 100)
            }
            
            return {
                'success': True,
                'text': str(routing_response).replace("'", '"'),  # JSON-like format
                'model': 'lfm2-mock-router'
            }
        
        # Default mock response
        return {
            'success': True,
            'text': f"[Mock LFM2] Processed: {prompt[:50]}...",
            'model': 'lfm2-mock'
        }
        
    def _handle_classification(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle classification requests"""
        text = data.get('text', '')
        categories = data.get('categories', ['general', 'technical', 'creative'])
        
        # For now, use completion to classify
        prompt = f"Classify this text into one of these categories: {', '.join(categories)}\n\nText: {text}\n\nCategory:"
        
        completion_result = self._handle_completion({
            'prompt': prompt,
            'maxTokens': 10,
            'temperature': 0.3
        })
        
        if completion_result['success']:
            # Extract category from response
            category = completion_result['text'].strip().lower()
            # Match to closest category
            for cat in categories:
                if cat.lower() in category:
                    category = cat
                    break
            else:
                category = categories[0]  # Default
                
            return {
                'success': True,
                'category': category,
                'confidence': 0.85,  # Mock confidence
                'model': completion_result['model']
            }
        
        return completion_result
        
    def _handle_coordination(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle agent coordination requests"""
        task = data.get('task', '')
        agents = data.get('agents', [])
        
        # Use LFM2 to suggest coordination strategy
        prompt = f"Given the task '{task}' and available agents {agents}, suggest the best coordination strategy in one sentence."
        
        completion_result = self._handle_completion({
            'prompt': prompt,
            'maxTokens': 50,
            'temperature': 0.5
        })
        
        if completion_result['success']:
            return {
                'success': True,
                'strategy': completion_result['text'],
                'suggestedAgent': agents[0] if agents else 'default',
                'confidence': 0.8,
                'model': completion_result['model']
            }
            
        return completion_result
        
    def run(self):
        """Main server loop"""
        self.logger.info("🚀 LFM2 server starting...")
        
        while True:
            try:
                line = sys.stdin.readline()
                if not line:
                    break
                    
                # Parse JSON request
                try:
                    request = json.loads(line.strip())
                except json.JSONDecodeError:
                    continue
                    
                # Process request
                response = self.process(request)
                
                # Send response
                print(json.dumps(response), flush=True)
                
            except KeyboardInterrupt:
                break
            except Exception as e:
                self.logger.error(f"❌ Server error: {e}")
                error_response = {
                    'success': False,
                    'error': str(e)
                }
                print(json.dumps(error_response), flush=True)
                
        self.logger.info("👋 LFM2 server shutting down")
        self.shutdown()
    
    def shutdown(self):
        """Properly shutdown the server and cleanup resources"""
        self.logger.info("🛑 Shutting down LFM2 server...")
        self.is_ready = False
        
        # Wait for cleanup thread to finish
        if hasattr(self, 'cleanup_thread') and self.cleanup_thread.is_alive():
            self.cleanup_thread.join(timeout=2)
        
        # Clear model and tokenizer
        self.model = None
        self.tokenizer = None
        
        # Final memory cleanup
        import gc
        gc.collect()
        
        try:
            import mlx.core as mx
            mx.metal.clear_cache()
        except ImportError:
            pass
        except Exception as e:
            self.logger.warning(f"Final MLX cleanup warning: {e}")
        
        self.logger.info("✅ LFM2 server shutdown complete")

if __name__ == "__main__":
    server = LFM2Server()
    server.initialize()
    if server.is_ready:
        server.run()