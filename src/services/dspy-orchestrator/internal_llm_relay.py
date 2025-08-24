"""
Internal LLM Relay Integration for DSPy
Provides a custom DSPy LM class that uses our internal relay
"""

import os
import sys
from typing import Any, Optional

import dspy
import httpx
from dspy.clients.lm import LM

# Add parent directory to path to import from TypeScript services
sys.path.append(os.path.dirname(os.path.abspath(__file__)))


class InternalLLMRelay(LM):
    """Custom DSPy LM that uses our internal LLM relay service"""

    def __init__(
        self,
        model: str = "auto",
        api_base: str = "http://localhost:8080/api/v1/llm",
        prefer_local: bool = True,
        use_hrm: bool = False,
        hrm_base: str = "http://localhost:8085",
        **kwargs,
    ):
        self.model = model
        self.api_base = api_base.rstrip("/")
        self.prefer_local = prefer_local
        self.use_hrm = use_hrm
        self.hrm_base = hrm_base.rstrip("/")
        self.client = httpx.Client(timeout=60.0)

        # Get available providers
        self.providers = self._get_providers()
        
        # Check HRM availability
        if self.use_hrm:
            self.hrm_available = self._check_hrm_availability()
        else:
            self.hrm_available = False

        super().__init__(model=model, **kwargs)

    def _get_providers(self) -> dict[str, bool]:
        """Get available LLM providers from relay"""
        try:
            response = self.client.get(f"{self.api_base}/status")
            if response.status_code == 200:
                data = response.json()
                return data.get("providers", {})
        except Exception as e:
            print(f"Failed to get provider status: {e}")
        return {}
    
    def _check_hrm_availability(self) -> bool:
        """Check if HRM service is available."""
        try:
            response = self.client.get(f"{self.hrm_base}/health", timeout=2.0)
            return response.status_code == 200
        except Exception:
            return False
    
    def _call_hrm(self, prompt: str, template_hint: str = "analytical") -> Optional[dict]:
        """Call HRM service for fast preprocessing."""
        if not self.hrm_available:
            return None
        
        try:
            # Map template hints to HRM task types
            task_type_mapping = {
                "analytical": "planning",
                "problem_solving": "planning", 
                "creative": "arc",
                "explanatory": "planning",
                "comparative": "planning"
            }
            
            task_type = task_type_mapping.get(template_hint, "planning")
            
            response = self.client.post(
                f"{self.hrm_base}/reasoning",
                json={
                    "task_type": task_type,
                    "input_data": {
                        "prompt": prompt,
                        "template_hint": template_hint,
                        "reasoning_type": "preprocessing"
                    },
                    "max_steps": 7,
                    "temperature": 0.7,
                    "adaptive_computation": True
                },
                timeout=5.0
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    return data
        except Exception as e:
            print(f"HRM call failed: {e}")
        return None

    def basic_request(self, prompt: str, **kwargs) -> str:
        """Make a basic completion request with optional HRM preprocessing"""
        
        # Check if HRM preprocessing is requested
        if self.use_hrm and self.hrm_available and kwargs.get("use_hrm_preprocessing", True):
            template_hint = kwargs.get("template_hint", "analytical")
            hrm_response = self._call_hrm(prompt, template_hint)
            
            if hrm_response and hrm_response.get("result"):
                # For HRM signature calls, return structured HRM response
                if "HRM" in prompt or "template" in prompt:
                    # This is a DSPy HRM signature call
                    result = hrm_response.get("result", {})
                    reasoning = result.get("final_result", {}).get("answer", "")
                    confidence = result.get("reasoning_confidence", 0.7)
                    template = result.get("template_used", template_hint)
                    
                    # Return structured response for HRM signatures
                    return f"preprocessed: {reasoning}\nconfidence: {confidence}\ntemplate_used: {template}"
                else:
                    # Regular call - enhance prompt with HRM reasoning
                    reasoning = hrm_response.get("result", {}).get("final_result", {}).get("answer", "")
                    if reasoning:
                        prompt = f"{prompt}\n\nInitial reasoning: {reasoning}"
        
        request_data = {
            "prompt": prompt,
            "maxTokens": kwargs.get("max_tokens", 512),
            "temperature": kwargs.get("temperature", 0.7),
            "topP": kwargs.get("top_p", 0.9),
            "preferLocal": self.prefer_local,
        }

        if self.model != "auto":
            request_data["model"] = self.model

        if "system" in kwargs:
            request_data["systemPrompt"] = kwargs["system"]

        try:
            response = self.client.post(f"{self.api_base}/generate", json=request_data)

            if response.status_code == 200:
                data = response.json()
                if data.get("success") and data.get("response"):
                    return data["response"]["text"]
                else:
                    raise Exception(f"Generation failed: {data.get('error', 'Unknown error')}")
            else:
                raise Exception(f"HTTP {response.status_code}: {response.text}")

        except Exception as e:
            raise Exception(f"Internal LLM relay request failed: {e}") from e

    def __call__(
        self, prompt: str, only_completed: bool = True, return_sorted: bool = False, **kwargs
    ) -> list[dict[str, Any]]:
        """DSPy-compatible call interface"""

        # Handle system prompt if provided
        system_prompt = None
        if "system" in kwargs:
            system_prompt = kwargs.pop("system")

        # Make the request
        n = kwargs.get("n", 1)
        completions = []

        for _i in range(n):
            try:
                # Build the full prompt
                full_prompt = prompt
                if system_prompt:
                    kwargs["system"] = system_prompt

                # Get completion
                completion = self.basic_request(full_prompt, **kwargs)

                completions.append({"text": completion, "finish_reason": "stop", "logprobs": None})
            except Exception as e:
                if not only_completed:
                    completions.append(
                        {"text": f"Error: {e}", "finish_reason": "error", "logprobs": None}
                    )

        return completions

    def get_info(self) -> dict[str, Any]:
        """Get information about the LLM relay"""
        return {
            "model": self.model,
            "api_base": self.api_base,
            "prefer_local": self.prefer_local,
            "providers": self.providers,
        }


def configure_dspy_with_internal_relay(prefer_local: bool = True) -> Optional[LM]:
    """Configure DSPy to use internal LLM relay"""
    try:
        # Create relay LM
        relay_lm = InternalLLMRelay(prefer_local=prefer_local)

        # Test the connection
        test_response = relay_lm("Hello, this is a test.")
        if test_response:
            # Configure DSPy
            dspy.configure(lm=relay_lm)

            print("✅ DSPy configured with Internal LLM Relay")
            print(f"   Available providers: {list(relay_lm.providers.keys())}")
            print(f"   Active providers: {[k for k, v in relay_lm.providers.items() if v]}")

            return relay_lm
        else:
            print("❌ Internal LLM relay test failed")
            return None

    except Exception as e:
        print(f"❌ Failed to configure internal LLM relay: {e}")
        return None


def get_best_available_lm(use_hrm: bool = False) -> Optional[LM]:
    """Get the best available LLM, preferring local models with optional HRM support"""

    # First try internal relay with HRM if requested
    if use_hrm:
        relay_lm = configure_dspy_with_hrm(prefer_local=True)
        if relay_lm:
            return relay_lm
    
    # Try internal relay with local preference (no HRM)
    relay_lm = configure_dspy_with_internal_relay(prefer_local=True)
    if relay_lm:
        return relay_lm

    # Fallback to standard discovery (support both package and script modes)
    try:
        from .llm_discovery import LLMDiscovery  # type: ignore
    except Exception:  # noqa: BLE001
        from llm_discovery import LLMDiscovery  # type: ignore

    try:
        lm, provider, model = LLMDiscovery.auto_discover()
        if lm:
            print(f"✅ Using fallback: {provider} - {model}")
            return lm
    except Exception as e:
        print(f"❌ Fallback discovery failed: {e}")

    return None


def configure_dspy_with_hrm(prefer_local: bool = True) -> Optional[LM]:
    """Configure DSPy to use internal LLM relay with HRM support"""
    try:
        # Create HRM-enabled relay LM
        relay_lm = InternalLLMRelay(prefer_local=prefer_local, use_hrm=True)

        # Test the connection
        test_response = relay_lm("Hello, this is a test.")
        if test_response:
            # Configure DSPy
            dspy.configure(lm=relay_lm)

            print("✅ DSPy configured with HRM-enhanced Internal LLM Relay")
            print(f"   Available providers: {list(relay_lm.providers.keys())}")
            print(f"   Active providers: {[k for k, v in relay_lm.providers.items() if v]}")
            print(f"   HRM available: {relay_lm.hrm_available}")

            return relay_lm
        else:
            print("❌ HRM-enhanced relay test failed")
            return None

    except Exception as e:
        print(f"❌ Failed to configure HRM-enhanced relay: {e}")
        return None


# Integration with existing DSPy orchestrator
def enhance_dspy_with_relay():
    """Enhance existing DSPy setup with internal relay support"""

    # Check if DSPy is already configured
    current_lm = dspy.settings.lm

    if current_lm:
        print(f"ℹ️  DSPy already configured with: {type(current_lm).__name__}")

        # Ask if we should override
        relay_lm = InternalLLMRelay(prefer_local=True)
        if relay_lm.providers:
            active_providers = [k for k, v in relay_lm.providers.items() if v]
            if active_providers and any(p in ["mlx", "lfm2"] for p in active_providers):
                print("🔄 Switching to Internal LLM Relay for better local model support")
                dspy.configure(lm=relay_lm)
                return relay_lm
    else:
        # No LM configured, use relay
        return configure_dspy_with_internal_relay(prefer_local=True)

    return current_lm


if __name__ == "__main__":
    # Test the relay
    print("Testing Internal LLM Relay for DSPy...")

    lm = get_best_available_lm()
    if lm:
        print("\nTest generation:")
        result = lm("What is 2+2?")
        print(f"Response: {result}")
    else:
        print("❌ No LLM available")
