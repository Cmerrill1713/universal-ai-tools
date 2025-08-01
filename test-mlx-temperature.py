#!/usr/bin/env python3
"""Test MLX temperature parameter"""

try:
    from mlx_lm import load, generate
    print("MLX-LM imported successfully")
    
    # Check generate function signature
    import inspect
    sig = inspect.signature(generate)
    print(f"\ngenerate() signature: {sig}")
    
    # Try to find the actual parameter name
    # Common variations: temperature, temp, t
    print("\nChecking MLX documentation...")
    
    # Test with a simple generation
    print("\nTesting generation with different parameters...")
    
    # This should show us the actual parameter name in the error
    try:
        # Dummy values just to see the error
        generate(None, None, "test", temperature=0.5)
    except Exception as e:
        print(f"Error with 'temperature': {e}")
        
    try:
        generate(None, None, "test", temp=0.5)
    except Exception as e:
        print(f"Error with 'temp': {e}")
        
    # Check if it uses a different parameter name
    print("\nChecking generate.__doc__:")
    print(generate.__doc__)
    
except ImportError as e:
    print(f"Could not import MLX-LM: {e}")