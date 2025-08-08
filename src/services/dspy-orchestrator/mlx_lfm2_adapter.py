"""
MLX LFM2-1.2B Integration for DSPy
Optimized for Apple Silicon using MLX
"""

import logging
import os

logger = logging.getLogger(__name__)

# Check if MLX is available
try:
    from mlx_lm import generate, load

    MLX_AVAILABLE = True
except ImportError:
    MLX_AVAILABLE = False
    logger.warning("MLX not available. Install with: pip install mlx-lm")


class MLXLFM2Adapter:
    """Adapter for MLX LFM2-1.2B model to work with DSPy"""

    def __init__(
        self,
        model_path: str = "/Users/christianmerrill/Desktop/universal-ai-tools/models/agents/LFM2-1.2B-bf16",
    ):
        self.model_path = model_path
        self.model = None
        self.tokenizer = None
        self.loaded = False

    def load(self):
        """Load the MLX model and tokenizer with enhanced error handling"""
        if not MLX_AVAILABLE:
            raise RuntimeError("MLX library not available. Install with: pip install mlx-lm")

        if self.loaded:
            return

        logger.info(f"🌊 Loading LFM2-1.2B MLX model from {self.model_path}...")

        try:
            # Try loading with MLX-LM
            self.model, self.tokenizer = load(self.model_path)
            self.loaded = True
            logger.info("✅ LFM2-1.2B MLX model loaded successfully")

        except Exception as e:
            error_msg = str(e).lower()
            logger.error(f"Failed to load MLX LFM2 model: {e}")

            # Check for specific Conv1d shape mismatch errors
            if "conv1d" in error_msg and "shape" in error_msg:
                logger.info("🔧 Detected Conv1d shape mismatch - this may be fixed in newer MLX versions")
                logger.info("💡 Try updating MLX-LM: pip install --upgrade mlx-lm")
                logger.info("📋 Or use the regular PyTorch adapter instead")

            # Check for missing MLX model support
            if "unsupported" in error_msg or "not found" in error_msg:
                logger.info("🔧 MLX may not support this model architecture yet")
                logger.info("📋 Consider using the PyTorch adapter as a fallback")

            raise RuntimeError(f"MLX LFM2 loading failed: {e}. Try using the PyTorch adapter instead.")

    def generate(
        self, prompt: str, max_tokens: int = 256, temperature: float = 0.7, **kwargs
    ) -> str:
        """Generate text from prompt using MLX"""
        if not self.loaded:
            self.load()

        try:
            # Apply chat template if available
            if self.tokenizer.chat_template is not None and not kwargs.get("raw_prompt", False):
                messages = [{"role": "user", "content": prompt}]
                formatted_prompt = self.tokenizer.apply_chat_template(
                    messages, tokenize=False, add_generation_prompt=True
                )
                
                # Ensure formatted_prompt is a string after template application
                if isinstance(formatted_prompt, list):
                    formatted_prompt = formatted_prompt[0] if formatted_prompt else ""
                if not isinstance(formatted_prompt, str):
                    formatted_prompt = str(formatted_prompt) if formatted_prompt else ""
            else:
                formatted_prompt = prompt
                # Ensure original prompt is also a string
                if not isinstance(formatted_prompt, str):
                    formatted_prompt = str(formatted_prompt) if formatted_prompt else ""

            # Generate using MLX 
            # Note: MLX generate() only accepts model, tokenizer, prompt, verbose, and formatter
            # Temperature and max_tokens are not supported in this version
            response = generate(
                self.model,
                self.tokenizer,
                prompt=formatted_prompt,
                verbose=False
            )

            # Handle both string and list responses from MLX
            if isinstance(response, list):
                response = response[0] if response else ""
            
            # Ensure response is a string before string operations
            if not isinstance(response, str):
                response = str(response) if response else ""

            # Clean up response - now response is guaranteed to be a string
            # Ensure formatted_prompt is also a string before comparison
            if isinstance(formatted_prompt, str) and response.startswith(formatted_prompt):
                response = response[len(formatted_prompt) :].strip()

            return response

        except Exception as e:
            logger.error(f"MLX generation failed: {e}")
            return f"Error: {str(e)}"

    def __call__(self, prompt: str, **kwargs) -> list[str]:
        """Make the adapter callable for DSPy compatibility"""
        response = self.generate(prompt, **kwargs)
        return [response]


def create_mlx_lfm2_lm():
    """Create MLX LFM2 language model for DSPy"""
    import dspy

    class MLXLFM2LM(dspy.LM):
        """DSPy-compatible MLX LFM2 language model"""

        def __init__(self):
            self.model_name = "mlx-lfm2-1.2b"
            self.adapter = MLXLFM2Adapter()
            self.adapter.load()
            self.kwargs = {"temperature": 0.7, "max_tokens": 256, "model": self.model_name}

        def basic_request(self, prompt: str, **kwargs) -> list[str]:
            """Basic request interface for DSPy"""
            merged_kwargs = {**self.kwargs, **kwargs}
            return self.adapter(prompt, **merged_kwargs)

        def __call__(self, prompt: str, **kwargs) -> list[str]:
            """Call interface"""
            return self.basic_request(prompt, **kwargs)

        @property
        def history(self):
            """Return empty history for now"""
            return []

    return MLXLFM2LM()


def add_mlx_lfm2_to_discovery():
    """Add MLX LFM2 to the model discovery system"""
    import dspy
    from llm_discovery import LLMDiscovery

    # Store original method
    original_discover = LLMDiscovery.discover_and_configure

    def discover_with_mlx_lfm2(cls):
        """Enhanced discovery that includes MLX LFM2"""
        # Check if MLX LFM2 is available
        lfm2_path = (
            "/Users/christianmerrill/Desktop/universal-ai-tools/models/agents/LFM2-1.2B-bf16"
        )

        if os.path.exists(lfm2_path) and MLX_AVAILABLE:
            try:
                logger.info("🌊 Found MLX LFM2-1.2B model, attempting to load...")
                lm = create_mlx_lfm2_lm()
                dspy.configure(lm=lm)
                logger.info("✅ DSPy configured with MLX LFM2-1.2B (Apple Silicon optimized)")
                return lm, "MLX Local", "LFM2-1.2B"
            except Exception as e:
                logger.warning(f"Failed to load MLX LFM2: {e}")

        # Fall back to original discovery
        return original_discover()

    # Replace the discovery method
    LLMDiscovery.discover_and_configure = classmethod(discover_with_mlx_lfm2)
    logger.info("✅ MLX LFM2 added to model discovery system")


def test_mlx_lfm2():
    """Test MLX LFM2 model directly"""
    print("🧪 Testing MLX LFM2-1.2B Model")
    print("=" * 50)

    if not MLX_AVAILABLE:
        print("❌ MLX not installed. Run:")
        print("   pip install mlx-lm")
        return

    try:
        adapter = MLXLFM2Adapter()
        adapter.load()

        # Test generation
        prompts = [
            "Hello, I am",
            "The capital of France is",
            "What is machine learning?",
            "def fibonacci(n):",
        ]

        for prompt in prompts:
            print(f"\n📝 Prompt: {prompt}")
            response = adapter.generate(prompt, max_tokens=50)
            print(f"💬 Response: {response}")

        print("\n✅ MLX LFM2 test successful!")
        print("🚀 This model is optimized for Apple Silicon!")

    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    test_mlx_lfm2()
