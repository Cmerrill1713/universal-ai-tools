#!/usr/bin/env python3
"""Test MLX model loading and inference"""

import sys
import os
from mlx_lm import load, generate

model_path = "/Users/christianmerrill/Desktop/universal-ai-tools/models/mlx-community--Llama-3.2-3B-Instruct-4bit"

print(f"Loading model from: {model_path}")
print(f"Model exists: {os.path.exists(model_path)}")

try:
    # Load the model
    model, tokenizer = load(model_path)
    print("✅ Model loaded successfully!")
    
    # Test generation
    prompt = "What is the capital of France?"
    # Try with different parameter names
    response = generate(
        model,
        tokenizer,
        prompt,
        verbose=False,
        max_tokens=50
    )
    
    print(f"\nPrompt: {prompt}")
    print(f"Response: {response}")
    
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)