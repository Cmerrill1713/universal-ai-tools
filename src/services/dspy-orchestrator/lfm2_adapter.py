"""
LFM2-1.2B Direct Integration Adapter for DSPy
Uses the local safetensors model directly with Conv1d shape fix
"""

import json
import logging
import os

logger = logging.getLogger(__name__)

# Check if we can use transformers
try:
    import torch
    import torch.nn as nn
    from safetensors import safe_open
    from transformers import AutoModelForCausalLM, AutoTokenizer, PreTrainedModel

    TRANSFORMERS_AVAILABLE = True
    logger.info("✅ All required dependencies available for LFM2 adapter")
except ImportError as e:
    TRANSFORMERS_AVAILABLE = False
    logger.warning(f"Transformers not available: {e}. Install with: pip install transformers torch safetensors")


def fix_conv1d_state_dict(state_dict: dict[str, torch.Tensor]) -> dict[str, torch.Tensor]:
    """
    Fix Conv1d weight shapes in LFM2 state_dict.
    The saved weights have shape [out_channels, kernel_size, in_channels]
    but PyTorch expects [out_channels, in_channels, kernel_size]

    Specifically:
    - Saved: [2048, 3, 1] (2048 out_channels, 3 kernel_size, 1 in_channel)
    - Expected: [2048, 1, 3] (2048 out_channels, 1 in_channel, 3 kernel_size)
    """
    fixed_state_dict = {}

    for name, tensor in state_dict.items():
        if "conv" in name.lower() and "weight" in name and len(tensor.shape) == 3:
            # Check if this is likely a Conv1d weight that needs fixing
            original_shape = tensor.shape
            logger.info(f"Found Conv1d weight '{name}' with shape {original_shape}")

            # For LFM2, we know the pattern: [2048, 3, 1] -> [2048, 1, 3]
            # This means we need to swap the last two dimensions
            if original_shape == torch.Size([2048, 3, 1]):
                # Permute from [out_channels, kernel_size, in_channels] to [out_channels, in_channels, kernel_size]
                fixed_tensor = tensor.permute(0, 2, 1).contiguous()
                logger.info(f"Fixed Conv1d weight '{name}': {original_shape} -> {fixed_tensor.shape}")
                fixed_state_dict[name] = fixed_tensor
            else:
                # For other shapes, try to detect the pattern
                # If dimension 1 is larger than dimension 2, it's likely [out, kernel, in] format
                if original_shape[1] > original_shape[2]:
                    fixed_tensor = tensor.permute(0, 2, 1).contiguous()
                    logger.info(f"Fixed Conv1d weight '{name}': {original_shape} -> {fixed_tensor.shape}")
                    fixed_state_dict[name] = fixed_tensor
                else:
                    fixed_state_dict[name] = tensor
        else:
            fixed_state_dict[name] = tensor

    return fixed_state_dict


def load_lfm2_with_conv1d_fix(model_path: str, device: str = "auto") -> PreTrainedModel:
    """
    Load LFM2 model with Conv1d shape fixes applied
    """
    logger.info(f"Loading LFM2 model with Conv1d fixes from {model_path}")

    # Load config first
    from transformers import AutoConfig
    config = AutoConfig.from_pretrained(model_path)

    # Load the model architecture first (without weights)
    model = AutoModelForCausalLM.from_config(
        config,
        torch_dtype=torch.float16 if device in ["cuda", "mps"] else torch.float32,
    )

    # Load the state dict manually and fix Conv1d shapes
    model_file = os.path.join(model_path, "model.safetensors")

    if os.path.exists(model_file):
        logger.info("Loading weights from safetensors file")
        state_dict = {}
        with safe_open(model_file, framework="pt", device="cpu") as f:
            for name in f:
                state_dict[name] = f.get_tensor(name)
    else:
        # Fallback to index file if available
        index_file = os.path.join(model_path, "model.safetensors.index.json")
        if os.path.exists(index_file):
            logger.info("Loading weights from indexed safetensors files")
            with open(index_file) as f:
                index = json.load(f)

            state_dict = {}
            weight_map = index.get("weight_map", {})

            # Group weights by file
            files_to_load = {}
            for param_name, file_name in weight_map.items():
                if file_name not in files_to_load:
                    files_to_load[file_name] = []
                files_to_load[file_name].append(param_name)

            # Load weights from each file
            for file_name, param_names in files_to_load.items():
                file_path = os.path.join(model_path, file_name)
                with safe_open(file_path, framework="pt", device="cpu") as f:
                    for param_name in param_names:
                        state_dict[param_name] = f.get_tensor(param_name)
        else:
            raise FileNotFoundError(f"Could not find model weights in {model_path}")

    # Fix Conv1d shapes
    logger.info("Applying Conv1d shape fixes to state dict")
    fixed_state_dict = fix_conv1d_state_dict(state_dict)

    # Load the fixed state dict into the model
    missing_keys, unexpected_keys = model.load_state_dict(fixed_state_dict, strict=False)

    if missing_keys:
        logger.warning(f"Missing keys when loading model: {missing_keys[:5]}...")  # Show first 5
    if unexpected_keys:
        logger.warning(f"Unexpected keys when loading model: {unexpected_keys[:5]}...")  # Show first 5

    logger.info("✅ LFM2 model loaded successfully with Conv1d fixes")
    return model


class LFM2Adapter:
    """Adapter for LFM2-1.2B model to work with DSPy"""

    def __init__(
        self,
        model_path: str = "/Users/christianmerrill/Desktop/universal-ai-tools/models/agents/LFM2-1.2B-bf16",
    ):
        self.model_path = model_path
        self.model = None
        self.tokenizer = None
        self.device = None
        self.loaded = False

        if not os.path.exists(model_path):
            raise ValueError(f"Model path does not exist: {model_path}")

    def load(self):
        """Load the model and tokenizer with Conv1d fixes"""
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

            # Load model with Conv1d fixes
            self.model = load_lfm2_with_conv1d_fix(self.model_path, self.device)

            # Move to device
            if self.device == "mps":
                self.model = self.model.to(self.device)
            elif self.device == "cuda":
                if not hasattr(self.model, 'hf_device_map'):  # Not already on device
                    self.model = self.model.to(self.device)
            elif self.device == "cpu":
                self.model = self.model.to(self.device)

            self.model.eval()
            self.loaded = True
            logger.info("✅ LFM2-1.2B loaded successfully with Conv1d fixes")

        except Exception as e:
            logger.error(f"Failed to load LFM2 model: {e}")
            # Try fallback loading without Conv1d fixes
            logger.info("🔄 Attempting fallback loading without Conv1d fixes...")
            try:
                if self.device == "mps":
                    # Apple Silicon optimization
                    self.model = AutoModelForCausalLM.from_pretrained(
                        self.model_path, torch_dtype=torch.float16, low_cpu_mem_usage=True
                    ).to(self.device)
                else:
                    self.model = AutoModelForCausalLM.from_pretrained(
                        self.model_path,
                        torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
                        low_cpu_mem_usage=True,
                        device_map="auto" if self.device == "cuda" else None,
                    )
                    if self.device == "cpu":
                        self.model = self.model.to(self.device)

                self.model.eval()
                self.loaded = True
                logger.info("✅ LFM2-1.2B loaded successfully with fallback method")
            except Exception as fallback_e:
                logger.error(f"Fallback loading also failed: {fallback_e}")
                raise

    def generate(
        self, prompt: str, max_tokens: int = 256, temperature: float = 0.7, **kwargs
    ) -> str:
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
                    top_p=kwargs.get("top_p", 0.9),
                    pad_token_id=self.tokenizer.pad_token_id,
                    eos_token_id=self.tokenizer.eos_token_id,
                )

            # Decode
            response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)

            # Remove the prompt from response
            if response.startswith(prompt):
                response = response[len(prompt) :].strip()

            return response

        except Exception as e:
            logger.error(f"Generation failed: {e}")
            return f"Error: {str(e)}"

    def __call__(self, prompt: str, **kwargs) -> list[str]:
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

    return LFM2LM()


def add_lfm2_to_discovery():
    """Add LFM2 to the model discovery system"""
    import dspy
    from llm_discovery import LLMDiscovery

    # Add custom discovery method for LFM2
    original_discover = LLMDiscovery.discover_and_configure

    def discover_with_lfm2(cls):
        """Enhanced discovery that includes LFM2"""
        # Check if LFM2 is available
        lfm2_path = (
            "/Users/christianmerrill/Desktop/universal-ai-tools/models/agents/LFM2-1.2B-bf16"
        )

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
        prompts = ["Hello, I am", "The capital of France is", "def fibonacci(n):"]

        for prompt in prompts:
            print(f"\n📝 Prompt: {prompt}")
            response = adapter.generate(prompt, max_tokens=50)
            print(f"💬 Response: {response}")

        print("\n✅ LFM2 test successful!")

    except Exception as e:
        print(f"\n❌ Test failed: {e}")


if __name__ == "__main__":
    test_lfm2()
