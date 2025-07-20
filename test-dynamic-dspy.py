#!/usr/bin/env python3
"""Test DSPy with dynamic model discovery"""

import sys
import os
sys.path.append('src/services/dspy-orchestrator')

from llm_discovery import LLMDiscovery
import dspy

print("🧪 Testing DSPy Dynamic Model Discovery")
print("=" * 50)

# Show all available models
print("\n📋 Discovering all available models...")
all_models = LLMDiscovery.get_all_available_models()

for provider, models in all_models.items():
    print(f"\n{provider} ({len(models)} models):")
    # Show first 5 models from each provider
    for model in models[:5]:
        print(f"  - {model}")
    if len(models) > 5:
        print(f"  ... and {len(models) - 5} more")

# Test automatic configuration
print("\n🔧 Testing automatic configuration...")
result = LLMDiscovery.discover_and_configure()

if result:
    lm, provider, model = result
    print(f"\n✅ Successfully configured!")
    print(f"Provider: {provider}")
    print(f"Model: {model}")
    
    # Test the configuration
    print("\n📝 Testing DSPy functionality...")
    
    # Test 1: Simple completion
    print("\nTest 1: Simple completion")
    response = lm("What is 2+2?")
    print(f"Response: {response}")
    
    # Test 2: DSPy Signature
    print("\nTest 2: DSPy Signature")
    
    class MathSolver(dspy.Signature):
        """Solve a math problem step by step."""
        problem = dspy.InputField()
        steps = dspy.OutputField(desc="Steps to solve the problem")
        answer = dspy.OutputField(desc="Final answer")
    
    solver = dspy.Predict(MathSolver)
    result = solver(problem="If I have 3 apples and buy 5 more, how many do I have?")
    print(f"Steps: {result.steps}")
    print(f"Answer: {result.answer}")
    
    # Test 3: Chain of Thought
    print("\nTest 3: Chain of Thought")
    
    class CodeAnalyzer(dspy.Signature):
        """Analyze code and explain its purpose."""
        code = dspy.InputField()
        analysis = dspy.OutputField(desc="Analysis of the code")
        improvements = dspy.OutputField(desc="Suggested improvements")
    
    analyzer = dspy.ChainOfThought(CodeAnalyzer)
    code_snippet = """
    def discover_models():
        models = []
        for provider in get_providers():
            models.extend(provider.list_models())
        return models
    """
    
    result = analyzer(code=code_snippet)
    print(f"Analysis: {result.analysis}")
    print(f"Improvements: {result.improvements}")
    
    print("\n🎉 All tests passed! Dynamic discovery is working perfectly.")
    
else:
    print("\n❌ No LLM configuration found")
    print("Please ensure at least one of the following is running:")
    print("- Ollama (port 11434 or 8080)")
    print("- LM Studio (port 1234 or custom)")
    print("- Set OPENAI_API_KEY environment variable")

print("\n" + "=" * 50)
print("Test complete!")