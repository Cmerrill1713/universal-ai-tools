"""
Dynamic LLM Model Discovery for DSPy
Automatically discovers available models from various LLM providers
"""

import logging
import os
from typing import Dict, List, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)


class LLMDiscovery:
    """Discovers available models from various LLM providers"""

    @staticmethod
    def discover_ollama_models(base_url: str = "http://localhost:11434") -> List[str]:
        """Discover available Ollama models"""
        try:
            response = httpx.get(f"{base_url}/api/tags", timeout=5.0)
            if response.status_code == 200:
                data = response.json()
                models = []
                for model in data.get("models", []):
                    # Extract model name without tag if present
                    name = model.get("name", "")
                    if name:
                        models.append(name)
                logger.info(f"Found {len(models)} Ollama models at {base_url}")
                return models
        except Exception as e:
            logger.debug(f"Failed to discover Ollama models at {base_url}: {e}")
        return []

    @staticmethod
    def discover_openai_models(base_url: str, api_key: str = "") -> List[str]:
        """Discover available models from OpenAI-compatible endpoints (LM Studio, etc)"""
        try:
            headers = {}
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"

            response = httpx.get(f"{base_url}/v1/models", headers=headers, timeout=5.0)
            if response.status_code == 200:
                data = response.json()
                models = []
                for model in data.get("data", []):
                    model_id = model.get("id", "")
                    if model_id:
                        models.append(model_id)
                logger.info(f"Found {len(models)} models at {base_url}")
                return models
        except Exception as e:
            logger.debug(f"Failed to discover models at {base_url}: {e}")
        return []

    @staticmethod
    def test_model(model_name: str, provider: str, base_url: str, api_key: str = "") -> bool:
        """Test if a specific model works with DSPy"""
        try:
            import dspy

            if provider == "ollama":
                lm = dspy.LM(f"ollama_chat/{model_name}", api_base=base_url, api_key="")
            else:  # OpenAI-compatible
                lm = dspy.LM(
                    f"openai/{model_name}", api_base=f"{base_url}/v1", api_key=api_key or "dummy"
                )

            # Quick test
            response = lm("Hi")
            return True
        except Exception as e:
            logger.debug(f"Model {model_name} test failed: {e}")
            return False

    @classmethod
    def discover_and_configure(cls) -> Optional[Tuple[object, str, str]]:
        """
        Discover all available models and configure DSPy with the first working one
        Returns: (configured_lm, provider_name, model_name) or None
        """
        import dspy

        # Check for OpenAI API key first
        openai_api_key = os.environ.get("OPENAI_API_KEY", "")
        if openai_api_key and not openai_api_key.startswith("your-"):
            try:
                lm = dspy.LM("openai/gpt-4o-mini", api_key=openai_api_key)
                test = lm("Test")
                dspy.configure(lm=lm)
                logger.info("✅ DSPy configured with OpenAI GPT-4o-mini")
                return lm, "OpenAI", "gpt-4o-mini"
            except Exception as e:
                logger.debug(f"OpenAI configuration failed: {e}")

        # Try Ollama (stock location)
        ollama_url = os.environ.get("OLLAMA_URL", "http://localhost:11434")
        ollama_models = cls.discover_ollama_models(ollama_url)

        for model in ollama_models:
            if cls.test_model(model, "ollama", ollama_url):
                lm = dspy.LM(f"ollama_chat/{model}", api_base=ollama_url, api_key="")
                dspy.configure(lm=lm)
                logger.info(f"✅ DSPy configured with Ollama {model} at {ollama_url}")
                return lm, "Ollama", model

        # Try Ollama Docker proxy
        if ollama_url == "http://localhost:11434":
            ollama_proxy_models = cls.discover_ollama_models("http://localhost:8080")
            for model in ollama_proxy_models:
                if cls.test_model(model, "ollama", "http://localhost:8080"):
                    lm = dspy.LM(
                        f"ollama_chat/{model}", api_base="http://localhost:8080", api_key=""
                    )
                    dspy.configure(lm=lm)
                    logger.info(f"✅ DSPy configured with Ollama {model} via proxy")
                    return lm, "Ollama Proxy", model

        # Try Remote LM Studio
        remote_url = os.environ.get("REMOTE_LLM_URL", "http://192.168.1.179:5901")
        remote_models = cls.discover_openai_models(remote_url, "lm-studio")

        for model in remote_models:
            if cls.test_model(model, "openai", remote_url, "lm-studio"):
                lm = dspy.LM(f"openai/{model}", api_base=f"{remote_url}/v1", api_key="lm-studio")
                dspy.configure(lm=lm)
                logger.info(f"✅ DSPy configured with LM Studio {model} at {remote_url}")
                return lm, "LM Studio Remote", model

        # Try Local LM Studio
        local_lm_url = os.environ.get("LM_STUDIO_URL", "http://localhost:1234")
        local_models = cls.discover_openai_models(local_lm_url, "lm-studio")

        for model in local_models:
            if cls.test_model(model, "openai", local_lm_url, "lm-studio"):
                lm = dspy.LM(f"openai/{model}", api_base=f"{local_lm_url}/v1", api_key="lm-studio")
                dspy.configure(lm=lm)
                logger.info(f"✅ DSPy configured with LM Studio {model} at {local_lm_url}")
                return lm, "LM Studio Local", model

        # Try to use any available Ollama model as fallback
        ollama_models = cls.discover_ollama_models()
        if ollama_models:
            model = ollama_models[0]  # Use first available model
            ollama_url = "http://localhost:11434"
            lm = dspy.LM(f"ollama/{model}", api_base=ollama_url)
            dspy.configure(lm=lm)
            logger.info(f"✅ DSPy configured with Ollama {model} at {ollama_url}")
            return lm, "Ollama", model

        return None

    @classmethod
    def get_all_available_models(cls) -> Dict[str, List[str]]:
        """Get all available models from all providers"""
        available = {}

        # Ollama
        ollama_url = os.environ.get("OLLAMA_URL", "http://localhost:11434")
        ollama_models = cls.discover_ollama_models(ollama_url)
        if ollama_models:
            available["Ollama"] = ollama_models

        # Ollama Proxy
        proxy_models = cls.discover_ollama_models("http://localhost:8080")
        if proxy_models:
            available["Ollama Proxy"] = proxy_models

        # Remote LM Studio
        remote_url = os.environ.get("REMOTE_LLM_URL", "http://192.168.1.179:5901")
        remote_models = cls.discover_openai_models(remote_url, "lm-studio")
        if remote_models:
            available["LM Studio Remote"] = remote_models

        # Local LM Studio
        local_url = os.environ.get("LM_STUDIO_URL", "http://localhost:1234")
        local_models = cls.discover_openai_models(local_url, "lm-studio")
        if local_models:
            available["LM Studio Local"] = local_models

        return available


# Usage in server.py:
if __name__ == "__main__":
    # Test discovery
    discovery = LLMDiscovery()
    print("🔍 Discovering available models...")

    all_models = discovery.get_all_available_models()
    for provider, models in all_models.items():
        print(f"\n{provider}:")
        for model in models:
            print(f"  - {model}")

    print("\n🔧 Configuring DSPy...")
    result = discovery.discover_and_configure()
    if result:
        _, provider, model = result
        print(f"✅ Successfully configured with {provider} using {model}")
    else:
        print("❌ No working LLM configuration found")
