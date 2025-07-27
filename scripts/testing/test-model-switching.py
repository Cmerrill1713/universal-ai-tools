#!/usr/bin/env python3
"""Demonstrate automatic model switching when models are added/removed"""

import sys

sys.path.append("src/services/dspy-orchestrator")

import dspy
from llm_discovery import LLMDiscovery

print("🔄 DSPy Automatic Model Switching Demo")
print("=" * 50)


def test_current_config():
    """Test the current configuration and show which model is being used"""
    result = LLMDiscovery.discover_and_configure()

    if result:
        lm, provider, model = result
        print(f"\n✅ Using: {provider} - {model}")

        # Quick test
        response = lm("Say hello in one word")
        print(f"Response: {response}")
        return True
    else:
        print("\n❌ No models available")
        return False


# Test 1: Show current configuration
print("\n📋 Test 1: Current Configuration")
test_current_config()

# Show how to prefer specific providers
print("\n📋 Test 2: Environment Variable Configuration")
print("You can control provider preference with environment variables:")
print("  - OPENAI_API_KEY: Use OpenAI (highest priority)")
print("  - OLLAMA_URL: Default http://localhost:11434")
print("  - REMOTE_LLM_URL: Default http://192.168.1.179:5901")
print("  - LM_STUDIO_URL: Default http://localhost:1234")

# Test with different environment settings
print("\n📋 Test 3: Testing with Remote LM Studio preference")
# Temporarily modify discovery order to prefer remote LM Studio
original_func = LLMDiscovery.discover_and_configure


def prefer_remote_lm_studio():
    """Modified discovery that tries remote LM Studio first"""

    # Try Remote LM Studio first
    remote_url = "http://192.168.1.179:5901"
    remote_models = LLMDiscovery.discover_openai_models(remote_url, "lm-studio")

    for model in remote_models:
        if LLMDiscovery.test_model(model, "openai", remote_url, "lm-studio"):
            lm = dspy.LM(f"openai/{model}", api_base=f"{remote_url}/v1", api_key="lm-studio")
            dspy.configure(lm=lm)
            return lm, "LM Studio Remote (Preferred)", model

    # Fall back to original discovery
    return original_func()


LLMDiscovery.discover_and_configure = prefer_remote_lm_studio
test_current_config()

# Restore original function
LLMDiscovery.discover_and_configure = original_func

print("\n📋 Test 4: Model Statistics")
all_models = LLMDiscovery.get_all_available_models()
total_models = sum(len(models) for models in all_models.values())
print(f"\nTotal available models: {total_models}")
print("Models by provider:")
for provider, models in all_models.items():
    print(f"  - {provider}: {len(models)} models")
    # Show model sizes if available
    size_info = {}
    for model in models:
        if "3b" in model.lower():
            size_info["3B"] = size_info.get("3B", 0) + 1
        elif "7b" in model.lower():
            size_info["7B"] = size_info.get("7B", 0) + 1
        elif "14b" in model.lower() or "13b" in model.lower():
            size_info["13-14B"] = size_info.get("13-14B", 0) + 1
        elif "24b" in model.lower():
            size_info["24B+"] = size_info.get("24B+", 0) + 1

    if size_info:
        sizes = ", ".join(f"{size}: {count}" for size, count in size_info.items())
        print(f"    Sizes: {sizes}")

print("\n💡 Tips:")
print("- Models are tested in order until one works")
print("- Failed models are skipped automatically")
print("- You can add/remove models at any time")
print("- The system will use the first working model it finds")
print("\n🎉 Dynamic model discovery ensures DSPy always finds a working LLM!")
