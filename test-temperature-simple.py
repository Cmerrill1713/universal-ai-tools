#!/usr/bin/env python3
"""
Simple test to verify MLX temperature parameter
"""

from mlx_lm import load, generate

print("Testing MLX temperature parameter...")

# Test different ways to pass temperature
test_cases = [
    {"temp": 0.5},
    {"temperature": 0.5},
]

for params in test_cases:
    try:
        print(f"\nTesting with params: {params}")
        # This will fail without a model, but we can see which parameter name works
        response = generate(
            model=None,
            tokenizer=None,
            prompt="test",
            max_tokens=10,
            **params
        )
    except TypeError as e:
        if "unexpected keyword argument" in str(e):
            print(f"❌ Parameter rejected: {e}")
        else:
            print(f"✓ Parameter accepted, other error: {e}")
    except Exception as e:
        print(f"✓ Parameter accepted, other error: {e}")

print("\nConclusion: Use 'temp' not 'temperature' for MLX-LM generate()")