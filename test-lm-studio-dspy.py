#!/usr/bin/env python3
"""Test DSPy with LM Studio DeepSeek model"""

import dspy
import os

print("🧪 Testing DSPy with LM Studio DeepSeek Model")
print("=" * 50)

# Configure DSPy with your LM Studio instance
try:
    # Your LM Studio is running at 192.168.1.179:5901
    lm = dspy.LM("openai/deepseek/deepseek-r1-0528-qwen3-8b", 
                 api_base="http://192.168.1.179:5901/v1",
                 api_key="lm-studio")  # LM Studio needs a dummy API key
    
    dspy.configure(lm=lm)
    print("✅ Connected to LM Studio successfully!")
    
    # Test basic completion
    print("\n📝 Testing basic completion...")
    response = lm("What is MIPRO in the context of DSPy?")
    print(f"Response: {response}")
    
    # Test DSPy signature
    print("\n🔬 Testing DSPy Signature...")
    
    class CodeExplainer(dspy.Signature):
        """Explain code functionality."""
        code = dspy.InputField(desc="Code snippet to explain")
        explanation = dspy.OutputField(desc="Clear explanation of what the code does")
    
    explainer = dspy.Predict(CodeExplainer)
    result = explainer(code="def mipro_optimize(module, examples): return optimizer.compile(module, trainset=examples)")
    
    print(f"✅ DSPy Signature works!")
    print(f"Explanation: {result.explanation}")
    
    # Test Chain of Thought
    print("\n🧠 Testing Chain of Thought...")
    
    class ComplexReasoning(dspy.Signature):
        """Reason through a complex problem step by step."""
        problem = dspy.InputField()
        reasoning = dspy.OutputField(desc="Step-by-step reasoning")
        solution = dspy.OutputField(desc="Final solution")
    
    reasoner = dspy.ChainOfThought(ComplexReasoning)
    result = reasoner(problem="How can MIPRO optimization improve DSPy agent orchestration performance?")
    
    print(f"✅ Chain of Thought works!")
    print(f"Reasoning: {result.reasoning}")
    print(f"Solution: {result.solution}")
    
except Exception as e:
    print(f"❌ Error: {e}")
    print("\nTroubleshooting:")
    print("1. Ensure LM Studio is running at http://192.168.1.179:5901")
    print("2. Make sure deepseek/deepseek-r1-0528-qwen3-8b model is loaded")
    print("3. Check that 'Enable CORS' is enabled in LM Studio settings")

print("\n🎉 Test complete!")