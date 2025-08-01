#!/usr/bin/env python3
"""
Test correct MLX temperature usage
"""

from mlx_lm import load, generate
from mlx_lm.sample_utils import make_sampler

# Test with explicit sampler
try:
    print("Testing MLX with explicit sampler...")
    
    # Create a sampler with temperature
    sampler = make_sampler(temp=0.7)
    
    # This shows the correct way to use temperature
    print(f"Sampler created with temp=0.7")
    
    # Try to load model and generate
    model, tokenizer = load("mlx-community/Llama-3.2-1B-Instruct-4bit")
    
    # Generate with sampler
    response = generate(
        model,
        tokenizer,
        prompt="What is 2+2?",
        sampler=sampler,  # Pass the sampler
        max_tokens=50
    )
    
    print(f"Response: {response}")
    
except Exception as e:
    print(f"Error: {e}")
    
    # Check if we can pass sampler to generate
    import inspect
    sig = inspect.signature(generate)
    print(f"\ngenerate parameters: {sig}")
    
    # The issue is that generate doesn't accept sampler directly!
    # We need to check how temperature is actually passed

# Let me test the actual working way
print("\n\nTesting direct temperature passing...")
try:
    # Based on the CLI args, it seems temp should work directly
    response = generate(
        model=None,  # Will fail but let's see the error
        tokenizer=None,
        prompt="test",
        temp=0.5,
        max_tokens=10
    )
except TypeError as e:
    if "temp" in str(e):
        print(f"❌ 'temp' parameter not accepted: {e}")
    else:
        print(f"✓ 'temp' parameter accepted, other error: {e}")
except Exception as e:
    print(f"✓ 'temp' parameter accepted, other error: {e}")
    
# The problem is that generate passes **kwargs to stream_generate
# which passes them to generate_step, but generate_step doesn't accept temp!
print("\n\nConclusion: MLX-LM doesn't support temperature via generate() directly.")
print("We need to use a different approach or modify our implementation.")