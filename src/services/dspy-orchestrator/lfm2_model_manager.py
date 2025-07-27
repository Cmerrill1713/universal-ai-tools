"""
LFM2 Model Manager - Comprehensive LFM2-1.2B Integration
Automatically handles Conv1d shape mismatches and adapter selection
"""

import logging
import os
import sys
from typing import Optional, Dict, Any, List
from enum import Enum

logger = logging.getLogger(__name__)

class AdapterType(Enum):
    MLX = "mlx"
    PYTORCH = "pytorch"
    AUTO = "auto"

class LFM2Status(Enum):
    NOT_LOADED = "not_loaded"
    LOADING = "loading"
    LOADED = "loaded"
    ERROR = "error"

class LFM2ModelManager:
    """
    Comprehensive LFM2 model manager that handles:
    - Conv1d shape mismatch fixes
    - Adapter selection (MLX vs PyTorch)
    - Graceful fallbacks
    - Error diagnostics
    """
    
    def __init__(
        self,
        model_path: str = "/Users/christianmerrill/Desktop/universal-ai-tools/models/agents/LFM2-1.2B-bf16",
        adapter_preference: AdapterType = AdapterType.AUTO
    ):
        self.model_path = model_path
        self.adapter_preference = adapter_preference
        self.current_adapter = None
        self.status = LFM2Status.NOT_LOADED
        self.error_history: List[Dict[str, Any]] = []
        
        # Validate model path
        if not os.path.exists(model_path):
            raise ValueError(f"Model path does not exist: {model_path}")
            
        # Check for required files
        self._validate_model_files()
    
    def _validate_model_files(self) -> None:
        """Validate that all required model files are present"""
        required_files = [
            "config.json",
            "tokenizer.json",
            "tokenizer_config.json"
        ]
        
        model_files = ["model.safetensors", "model.safetensors.index.json"]
        has_model_file = any(os.path.exists(os.path.join(self.model_path, f)) for f in model_files)
        
        if not has_model_file:
            raise FileNotFoundError(f"No model weights found in {self.model_path}")
        
        for req_file in required_files:
            file_path = os.path.join(self.model_path, req_file)
            if not os.path.exists(file_path):
                logger.warning(f"Missing recommended file: {req_file}")
    
    def load(self, force_reload: bool = False) -> bool:
        """
        Load the LFM2 model with automatic adapter selection and Conv1d fixes
        
        Returns:
            bool: True if successfully loaded, False otherwise
        """
        if self.status == LFM2Status.LOADED and not force_reload:
            logger.info("LFM2 model already loaded")
            return True
            
        self.status = LFM2Status.LOADING
        logger.info(f"🚀 Loading LFM2-1.2B model from {self.model_path}")
        
        # Determine adapter order based on preference
        adapters_to_try = self._get_adapter_order()
        
        for adapter_type in adapters_to_try:
            try:
                logger.info(f"🔄 Attempting to load with {adapter_type.value} adapter")
                success = self._load_with_adapter(adapter_type)
                
                if success:
                    self.status = LFM2Status.LOADED
                    logger.info(f"✅ LFM2 model loaded successfully with {adapter_type.value} adapter")
                    return True
                    
            except Exception as e:
                error_info = {
                    "adapter": adapter_type.value,
                    "error": str(e),
                    "error_type": type(e).__name__
                }
                self.error_history.append(error_info)
                logger.warning(f"❌ Failed to load with {adapter_type.value} adapter: {e}")
                
                # Provide specific guidance for Conv1d errors
                if "conv1d" in str(e).lower() and "shape" in str(e).lower():
                    logger.info("🔧 Conv1d shape mismatch detected")
                    if adapter_type == AdapterType.MLX:
                        logger.info("💡 Try updating MLX-LM: pip install --upgrade mlx-lm")
                    else:
                        logger.info("🔧 Using enhanced PyTorch adapter with Conv1d fixes")
        
        self.status = LFM2Status.ERROR
        logger.error("❌ Failed to load LFM2 model with all available adapters")
        self._log_diagnostic_info()
        return False
    
    def _get_adapter_order(self) -> List[AdapterType]:
        """Determine the order of adapters to try based on preference and system"""
        if self.adapter_preference == AdapterType.MLX:
            return [AdapterType.MLX, AdapterType.PYTORCH]
        elif self.adapter_preference == AdapterType.PYTORCH:
            return [AdapterType.PYTORCH, AdapterType.MLX]
        else:  # AUTO
            # On Apple Silicon, prefer MLX, otherwise PyTorch
            if sys.platform == "darwin":
                return [AdapterType.MLX, AdapterType.PYTORCH]
            else:
                return [AdapterType.PYTORCH, AdapterType.MLX]
    
    def _load_with_adapter(self, adapter_type: AdapterType) -> bool:
        """Load model with specific adapter type"""
        if adapter_type == AdapterType.MLX:
            return self._load_mlx_adapter()
        elif adapter_type == AdapterType.PYTORCH:
            return self._load_pytorch_adapter()
        else:
            raise ValueError(f"Unsupported adapter type: {adapter_type}")
    
    def _load_mlx_adapter(self) -> bool:
        """Load with MLX adapter"""
        try:
            from mlx_lfm2_adapter import MLXLFM2Adapter
            
            self.current_adapter = MLXLFM2Adapter(self.model_path)
            self.current_adapter.load()
            logger.info("✅ MLX adapter loaded successfully")
            return True
            
        except ImportError:
            logger.warning("MLX-LM not available, skipping MLX adapter")
            return False
        except Exception as e:
            logger.error(f"MLX adapter failed: {e}")
            raise
    
    def _load_pytorch_adapter(self) -> bool:
        """Load with PyTorch adapter (includes Conv1d fixes)"""
        try:
            from lfm2_adapter import LFM2Adapter
            
            self.current_adapter = LFM2Adapter(self.model_path)
            self.current_adapter.load()
            logger.info("✅ PyTorch adapter loaded successfully")
            return True
            
        except ImportError:
            logger.warning("PyTorch/Transformers not available, skipping PyTorch adapter")
            return False
        except Exception as e:
            logger.error(f"PyTorch adapter failed: {e}")
            raise
    
    def generate(
        self, 
        prompt: str, 
        max_tokens: int = 256, 
        temperature: float = 0.7, 
        **kwargs
    ) -> str:
        """Generate text using the loaded model"""
        if self.status != LFM2Status.LOADED:
            if not self.load():
                raise RuntimeError("No LFM2 model is loaded and auto-loading failed")
        
        try:
            return self.current_adapter.generate(
                prompt=prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                **kwargs
            )
        except Exception as e:
            logger.error(f"Generation failed: {e}")
            raise
    
    def __call__(self, prompt: str, **kwargs) -> List[str]:
        """Make manager callable for DSPy compatibility"""
        response = self.generate(prompt, **kwargs)
        return [response]
    
    def get_status(self) -> Dict[str, Any]:
        """Get comprehensive status information"""
        return {
            "status": self.status.value,
            "model_path": self.model_path,
            "current_adapter": self.current_adapter.__class__.__name__ if self.current_adapter else None,
            "adapter_preference": self.adapter_preference.value,
            "error_count": len(self.error_history),
            "last_error": self.error_history[-1] if self.error_history else None
        }
    
    def get_diagnostics(self) -> Dict[str, Any]:
        """Get detailed diagnostic information"""
        diagnostics = {
            "model_path_exists": os.path.exists(self.model_path),
            "model_files": [],
            "python_version": sys.version,
            "platform": sys.platform,
            "dependencies": {},
            "error_history": self.error_history
        }
        
        # Check model files
        if os.path.exists(self.model_path):
            for item in os.listdir(self.model_path):
                file_path = os.path.join(self.model_path, item)
                if os.path.isfile(file_path):
                    diagnostics["model_files"].append({
                        "name": item,
                        "size": os.path.getsize(file_path)
                    })
        
        # Check dependencies
        try:
            import torch
            diagnostics["dependencies"]["torch"] = torch.__version__
            diagnostics["dependencies"]["torch_cuda"] = torch.cuda.is_available()
            diagnostics["dependencies"]["torch_mps"] = (
                torch.backends.mps.is_available() if hasattr(torch.backends, 'mps') else False
            )
        except ImportError:
            diagnostics["dependencies"]["torch"] = "not_installed"
        
        try:
            import transformers
            diagnostics["dependencies"]["transformers"] = transformers.__version__
        except ImportError:
            diagnostics["dependencies"]["transformers"] = "not_installed"
        
        try:
            import mlx
            diagnostics["dependencies"]["mlx"] = "available"
        except ImportError:
            diagnostics["dependencies"]["mlx"] = "not_installed"
        
        return diagnostics
    
    def _log_diagnostic_info(self) -> None:
        """Log diagnostic information for debugging"""
        logger.info("🔍 LFM2 Loading Diagnostic Information:")
        
        diagnostics = self.get_diagnostics()
        
        logger.info(f"📁 Model path: {self.model_path}")
        logger.info(f"📁 Path exists: {diagnostics['model_path_exists']}")
        logger.info(f"🐍 Python: {diagnostics['python_version']}")
        logger.info(f"💻 Platform: {diagnostics['platform']}")
        
        logger.info("📦 Dependencies:")
        for dep, version in diagnostics["dependencies"].items():
            logger.info(f"  - {dep}: {version}")
        
        if diagnostics["model_files"]:
            logger.info("📄 Model files:")
            for file_info in diagnostics["model_files"][:5]:  # Show first 5
                size_mb = file_info["size"] / (1024 * 1024)
                logger.info(f"  - {file_info['name']}: {size_mb:.1f} MB")
        
        if self.error_history:
            logger.info("❌ Error summary:")
            for i, error in enumerate(self.error_history[-3:], 1):  # Show last 3
                logger.info(f"  {i}. {error['adapter']}: {error['error_type']} - {error['error'][:100]}...")
    
    def shutdown(self) -> None:
        """Clean shutdown of the model manager"""
        if self.current_adapter and hasattr(self.current_adapter, 'shutdown'):
            self.current_adapter.shutdown()
        self.current_adapter = None
        self.status = LFM2Status.NOT_LOADED
        logger.info("🛑 LFM2 model manager shut down")


def create_lfm2_dspy_lm(model_path: str = None, adapter_preference: AdapterType = AdapterType.AUTO):
    """Create DSPy-compatible LFM2 language model with enhanced error handling"""
    import dspy
    
    class LFM2DSPyLM(dspy.LM):
        """DSPy-compatible LFM2 language model with automatic adapter selection"""
        
        def __init__(self, model_path: str = None, adapter_preference: AdapterType = AdapterType.AUTO):
            self.model_name = "lfm2-1.2b-enhanced"
            self.manager = LFM2ModelManager(
                model_path or "/Users/christianmerrill/Desktop/universal-ai-tools/models/agents/LFM2-1.2B-bf16",
                adapter_preference
            )
            self.kwargs = {"temperature": 0.7, "max_tokens": 256, "model": self.model_name}
            
            # Attempt to load the model
            if not self.manager.load():
                logger.warning("⚠️ Failed to load LFM2 model during initialization")
        
        def basic_request(self, prompt: str, **kwargs) -> List[str]:
            """Basic request interface for DSPy"""
            try:
                merged_kwargs = {**self.kwargs, **kwargs}
                return self.manager(prompt, **merged_kwargs)
            except Exception as e:
                logger.error(f"DSPy request failed: {e}")
                # Return a graceful fallback response
                return [f"Error processing request: {str(e)[:100]}..."]
        
        def __call__(self, prompt: str, **kwargs) -> List[str]:
            """Call interface"""
            return self.basic_request(prompt, **kwargs)
        
        @property
        def history(self):
            """Return empty history for now"""
            return []
        
        def get_diagnostics(self):
            """Get diagnostic information"""
            return self.manager.get_diagnostics()
    
    return LFM2DSPyLM(model_path, adapter_preference)


def test_lfm2_manager():
    """Test the LFM2 model manager"""
    print("🧪 Testing LFM2 Model Manager")
    print("=" * 60)
    
    try:
        # Test with auto adapter selection
        manager = LFM2ModelManager(adapter_preference=AdapterType.AUTO)
        
        print("📊 Initial Status:")
        status = manager.get_status()
        for key, value in status.items():
            print(f"  {key}: {value}")
        
        print("\n🔄 Loading model...")
        success = manager.load()
        
        if success:
            print("✅ Model loaded successfully!")
            
            # Test generation
            test_prompts = [
                "Hello, I am",
                "The capital of France is",
                "def fibonacci(n):"
            ]
            
            for prompt in test_prompts:
                print(f"\n📝 Prompt: {prompt}")
                try:
                    response = manager.generate(prompt, max_tokens=50)
                    print(f"💬 Response: {response}")
                except Exception as e:
                    print(f"❌ Generation failed: {e}")
        else:
            print("❌ Failed to load model")
            print("\n🔍 Diagnostics:")
            diagnostics = manager.get_diagnostics()
            print(f"Dependencies: {diagnostics['dependencies']}")
            print(f"Error count: {diagnostics['error_count']}")
            if diagnostics['error_history']:
                print("Recent errors:")
                for error in diagnostics['error_history'][-2:]:
                    print(f"  - {error['adapter']}: {error['error'][:100]}...")
        
        print(f"\n📊 Final Status: {manager.get_status()}")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    test_lfm2_manager()