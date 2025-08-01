#!/usr/bin/env python3
"""
Test MLX temperature parameter usage
"""

from mlx_lm import load, generate

# Test parameters
prompts = [
    ("What is 2+2?", 0.1),  # Low temp for factual
    ("Write a poem", 0.8),   # High temp for creative
]

print("Testing MLX temperature parameter...")

# Try to load a simple model (this will fail if no model is available)
try:
    model, tokenizer = load("mlx-community/Llama-3.2-1B-Instruct-4bit")
    
    for prompt, temp in prompts:
        print(f"\nPrompt: {prompt}")
        print(f"Temperature: {temp}")
        
        # Test with temp parameter
        response = generate(
            model,
            tokenizer,
            prompt=prompt,
            temp=temp,  # Using 'temp' not 'temperature'
            max_tokens=50,
            verbose=True
        )
        
        print(f"Response: {response[:100]}...")
        
except Exception as e:
    print(f"Error: {e}")
    print("\nTesting parameter names...")
    
    # Test which parameter name works
    import inspect
    from mlx_lm import generate
    from mlx_lm.generate import stream_generate
    
    print(f"generate accepts: {inspect.signature(generate)}")
    print(f"stream_generate accepts: {inspect.signature(stream_generate)}")
    
    # Check the sample_utils
    from mlx_lm.sample_utils import make_sampler
    print(f"make_sampler accepts: {inspect.signature(make_sampler)}")
    print("\nCorrect parameter name is 'temp' not 'temperature'!")