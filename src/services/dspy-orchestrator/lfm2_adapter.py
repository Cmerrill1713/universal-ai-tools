"""
LFM2-1.2B Direct Integration Adapter for DSPy
Uses the local safetensors model directly without conversion
"""

import os
import logging
from typing import Optional, List, Any
import json

logger = logging.getLogger(__name__)

# Check if we can use transformers
try:
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False
    logger.warning("Transformers not available. Install with: pip install transformers torch")

class LFM2Adapter:
    """Adapter for LFM2-1.2B model to work with DSPy"""
    
    def __init__(self, model_path: str = "/Users/christianmerrill/Desktop/universal-ai-tools/models/agents/LFM2-1.2B-bf16"):
        self.model_path = model_path
        self.model = None
        self.tokenizer = None
        self.device = None
        self.loaded = False
        
        if not os.path.exists(model_path):
            raise ValueError(f"Model path does not exist: {model_path}")
            
    def load(self):
        """Load the model and tokenizer"""
        if not TRANSFORMERS_AVAILABLE:
            raise RuntimeError("Transformers library not available")
            
        if self.loaded:
            return
            
        logger.info(f"Loading LFM2-1.2B from {self.model_path}...")
        
        # Determine device
        if torch.cuda.is_available():
            self.device = "cuda"
        elif torch.backends.mps.is_available():
            self.device = "mps"
        else:
            self.device = "cpu"
            
        logger.info(f"Using device: {self.device}")
        
        try:
            # Load tokenizer
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_path)
            if self.tokenizer.pad_token is None:
                self.tokenizer.pad_token = self.tokenizer.eos_token
            
            # Load model
            if self.device == "mps":
                # Apple Silicon optimization
                self.model = AutoModelForCausalLM.from_pretrained(
                    self.model_path,
                    torch_dtype=torch.float16,
                    low_cpu_mem_usage=True
                ).to(self.device)
            else:
                self.model = AutoModelForCausalLM.from_pretrained(
                    self.model_path,
                    torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
                    low_cpu_mem_usage=True,
                    device_map="auto" if self.device == "cuda" else None
                )
                if self.device == "cpu":
                    self.model = self.model.to(self.device)
            
            self.model.eval()
            self.loaded = True
            logger.info("✅ LFM2-1.2B loaded successfully")
            
        except Exception as e:
            logger.error(f"Failed to load LFM2 model: {e}")
            raise
            
    def generate(self, prompt: str, max_tokens: int = 256, temperature: float = 0.7, **kwargs) -> str:
        """Generate text from prompt"""
        if not self.loaded:
            self.load()
            
        try:
            # Tokenize input
            inputs = self.tokenizer(prompt, return_tensors="pt", truncation=True, max_length=2048)
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            # Generate
            with torch.no_grad():
                outputs = self.model.generate(
                    **inputs,
                    max_new_tokens=max_tokens,
                    temperature=temperature,
                    do_sample=True,
                    top_p=kwargs.get('top_p', 0.9),
                    pad_token_id=self.tokenizer.pad_token_id,
                    eos_token_id=self.tokenizer.eos_token_id
                )
            
            # Decode
            response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
            
            # Remove the prompt from response
            if response.startswith(prompt):
                response = response[len(prompt):].strip()
                
            return response
            
        except Exception as e:
            logger.error(f"Generation failed: {e}")
            return f"Error: {str(e)}"
    
    def __call__(self, prompt: str, **kwargs) -> List[str]:
        """Make the adapter callable for DSPy compatibility"""
        response = self.generate(prompt, **kwargs)
        return [response]  # DSPy expects a list


def create_lfm2_lm():
    """Create LFM2 language model for DSPy"""
    import dspy
    
    class LFM2LM(dspy.LM):
        """DSPy-compatible LFM2 language model"""
        
        def __init__(self):
            self.model_name = "lfm2-1.2b"
            self.adapter = LFM2Adapter()
            self.adapter.load()
            self.kwargs = {
                "temperature": 0.7,
                "max_tokens": 256,
                "model": self.model_name
            }
            
        def basic_request(self, prompt: str, **kwargs) -> List[str]:
            """Basic request interface for DSPy"""
            merged_kwargs = {**self.kwargs, **kwargs}
            return self.adapter(prompt, **merged_kwargs)
            
        def __call__(self, prompt: str, **kwargs) -> List[str]:
            """Call interface"""
            return self.basic_request(prompt, **kwargs)
            
        @property
        def history(self):
            """Return empty history for now"""
            return []
    
    return LFM2LM()


def add_lfm2_to_discovery():
    """Add LFM2 to the model discovery system"""
    from llm_discovery import LLMDiscovery
    import dspy
    
    # Add custom discovery method for LFM2
    original_discover = LLMDiscovery.discover_and_configure
    
    def discover_with_lfm2(cls):
        """Enhanced discovery that includes LFM2"""
        # Check if LFM2 is available
        lfm2_path = "/Users/christianmerrill/Desktop/universal-ai-tools/models/agents/LFM2-1.2B-bf16"
        
        if os.path.exists(lfm2_path) and TRANSFORMERS_AVAILABLE:
            try:
                logger.info("🌊 Found local LFM2-1.2B model, attempting to load...")
                lm = create_lfm2_lm()
                dspy.configure(lm=lm)
                logger.info("✅ DSPy configured with local LFM2-1.2B")
                return lm, "Local Model", "LFM2-1.2B"
            except Exception as e:
                logger.warning(f"Failed to load LFM2: {e}")
        
        # Fall back to original discovery
        return original_discover()
    
    # Monkey patch the discovery
    LLMDiscovery.discover_and_configure = classmethod(discover_with_lfm2)
    logger.info("✅ LFM2 added to model discovery system")


# Test function
def test_lfm2():
    """Test LFM2 model directly"""
    print("🧪 Testing LFM2-1.2B Model")
    print("=" * 50)
    
    if not TRANSFORMERS_AVAILABLE:
        print("❌ Transformers not installed. Run:")
        print("   pip install transformers torch")
        return
    
    try:
        adapter = LFM2Adapter()
        adapter.load()
        
        # Test generation
        prompts = [
            "Hello, I am",
            "The capital of France is",
            "def fibonacci(n):"
        ]
        
        for prompt in prompts:
            print(f"\n📝 Prompt: {prompt}")
            response = adapter.generate(prompt, max_tokens=50)
            print(f"💬 Response: {response}")
        
        print("\n✅ LFM2 test successful!")
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")


if __name__ == "__main__":
    test_lfm2()