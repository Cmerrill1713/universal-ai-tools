#!/usr/bin/env python3
"""Quick DSPy test to verify LLM connections"""

import dspy
import os
import sys

print("🧪 Quick DSPy LLM Test")
print("=" * 50)

# Test configuration
configs_to_test = [
    {
        "name": "Remote LLM Server",
        "config": lambda: dspy.LM("openai/qwen2.5-coder-14b-instruct-mlx", 
                                 api_base="http://192.168.1.179:5901/v1", 
                                 api_key="")
    },
    {
        "name": "Ollama (Stock)",
        "config": lambda: dspy.LM("ollama_chat/llama3.2:3b", 
                                 api_base="http://localhost:11434", 
                                 api_key="")
    },
    {
        "name": "Ollama (Docker Proxy)",
        "config": lambda: dspy.LM("ollama_chat/llama3.2:3b", 
                                 api_base="http://localhost:8080", 
                                 api_key="")
    },
    {
        "name": "LM Studio",
        "config": lambda: dspy.LM("openai/local-model", 
                                 api_base="http://localhost:1234/v1", 
                                 api_key="lm-studio")
    }
]

# Test each configuration
for config in configs_to_test:
    print(f"\n📡 Testing {config['name']}...")
    try:
        lm = config["config"]()
        dspy.configure(lm=lm)
        
        # Test with a simple prompt
        response = lm("Complete this: The capital of France is")
        print(f"✅ {config['name']} WORKS!")
        print(f"   Response: {response[:100]}...")
        
    except Exception as e:
        print(f"❌ {config['name']} FAILED: {str(e)[:100]}...")

print("\n" + "=" * 50)

# Now test a DSPy signature
print("\n🔬 Testing DSPy Signature with working LLM...")

class SimpleQA(dspy.Signature):
    """Answer questions about general knowledge."""
    question = dspy.InputField()
    answer = dspy.OutputField()

# Find first working config
for config in configs_to_test:
    try:
        lm = config["config"]()
        dspy.configure(lm=lm)
        
        # Test the LM
        test = lm("Test")
        
        # If it works, use it for signature test
        print(f"\nUsing {config['name']} for signature test")
        
        qa = dspy.Predict(SimpleQA)
        result = qa(question="What is the purpose of MIPRO in DSPy?")
        
        print(f"✅ DSPy Signature Test Successful!")
        print(f"Question: What is the purpose of MIPRO in DSPy?")
        print(f"Answer: {result.answer}")
        break
        
    except Exception as e:
        continue

print("\n🎉 DSPy test complete!")