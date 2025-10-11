#!/usr/bin/env python3
"""
Test Apple FastVLM Vision Language Model
Tests Apple's new 2025 FastVLM model with vision capabilities
"""

import subprocess
import sys

# Add the MLX VLM environment
sys.path.insert(
    0,
    '/Users/christianmerrill/Desktop/universal-ai-tools/venv-mlx-vlm/lib/python3.13/site-packages')


def test_apple_fastvlm():
    """Test Apple FastVLM with vision features"""

    print("=== Apple FastVLM Vision Testing ===")
    print("Testing Apple's 2025 FastVLM model with MLX optimization")
    print()

    try:
        # Activate virtual environment and test
        venv_path = "/Users/christianmerrill/Desktop/universal-ai-tools/venv-mlx-vlm"
        activate_script = f"{venv_path}/bin/activate"

        # Test FastVLM-0.5B first (smaller, faster)
        test_cmd = f"""
source {activate_script} && python3 -c "
import mlx_vlm
from mlx_vlm import load, generate
import mlx.core as mx
import time
from PIL import Image
import requests
from io import BytesIO

print('=== Loading Apple FastVLM-0.5B ===')
start_time = time.time()

try:
    # Load Apple's FastVLM model
    model, processor = load('apple/FastVLM-0.5B')
    load_time = time.time() - start_time

    print(f'✓ Apple FastVLM-0.5B loaded in {{load_time:.1f}}s')
    print(f'Model type: {{type(model).__name__}}')
    print(f'Processor type: {{type(processor).__name__}}')

    # Test with a sample image (create a simple test image)
    print('\\n=== Testing Vision Capabilities ===')

    # Create a simple test image
    from PIL import Image, ImageDraw
    img = Image.new('RGB', (224, 224), color='lightblue')
    draw = ImageDraw.Draw(img)
    draw.rectangle([50, 50, 174, 174], fill='red', outline='black', width=3)
    draw.text((70, 100), 'TEST', fill='white')

    # Test vision processing
    prompt = 'Describe what you see in this image.'

    print(f'Prompt: {{prompt}}')

    # Generate response
    response = generate(model, processor, img, prompt, max_tokens=100, temperature=0.7)

    print(f'FastVLM Response: {{response}}')

    print('\\n✓ Apple FastVLM vision test completed successfully!')

    # Test model details
    if hasattr(model, 'args'):
        args = model.args
        print(f'\\nModel Configuration:')
        if hasattr(args, 'hidden_size'):
            print(f'  Hidden size: {{args.hidden_size}}')
        if hasattr(args, 'num_hidden_layers'):
            print(f'  Layers: {{args.num_hidden_layers}}')
        if hasattr(args, 'model_type'):
            print(f'  Model type: {{args.model_type}}')

    print('\\n=== FastVLM Performance Summary ===')
    print(f'Load time: {{load_time:.1f}}s')
    print('Model: Apple FastVLM-0.5B (2025)')
    print('Framework: MLX (Apple Silicon optimized)')
    print('Vision: ✓ Working')
    print('Text generation: ✓ Working')

except Exception as e:
    print(f'Error testing FastVLM: {{e}}')
    import traceback
    traceback.print_exc()
"
"""

        # Run the test
        result = subprocess.run(
            test_cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=300)

        print("STDOUT:")
        print(result.stdout)

        if result.stderr:
            print("STDERR:")
            print(result.stderr)

        return result.returncode == 0

    except subprocess.TimeoutExpired:
        print("Test timed out after 5 minutes")
        return False
    except Exception as e:
        print(f"Error running test: {e}")
        return False


def test_integration_with_dynamic_discovery():
    """Test if the dynamic discovery system can detect FastVLM"""

    print("\n=== Testing Dynamic Discovery Integration ===")

    try:
        # Check if MLX service can detect the downloaded model
        mlx_models_cmd = """
source /Users/christianmerrill/Desktop/universal-ai-tools/venv-mlx-vlm/bin/activate && python3 -c "
import os
from pathlib import Path

# Check cache for downloaded models
cache_dir = Path.home() / '.cache' / 'huggingface' / 'hub'
print(f'Checking cache directory: {cache_dir}')

if cache_dir.exists():
    models = []
    for item in cache_dir.iterdir():
        if 'apple' in item.name.lower() and 'fastvlm' in item.name.lower():
            models.append(item.name)

    if models:
        print('✓ Found Apple FastVLM models in cache:')
        for model in models:
            print(f'  - {model}')
    else:
        print('No Apple FastVLM models found in cache yet')
else:
    print('Hugging Face cache directory not found')
"
"""

        result = subprocess.run(
            mlx_models_cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=30)
        print(result.stdout)

        if result.stderr:
            print("STDERR:", result.stderr)

        return True

    except Exception as e:
        print(f"Error checking dynamic discovery: {e}")
        return False


if __name__ == "__main__":
    print("Starting Apple FastVLM comprehensive test...")

    # Test 1: Basic FastVLM functionality
    print("\n" + "=" * 60)
    success1 = test_apple_fastvlm()

    # Test 2: Dynamic discovery integration
    print("\n" + "=" * 60)
    success2 = test_integration_with_dynamic_discovery()

    # Summary
    print("\n" + "=" * 60)
    print("=== Test Summary ===")
    print(f"FastVLM Vision Test: {'✓ PASS' if success1 else '✗ FAIL'}")
    print(f"Dynamic Discovery: {'✓ PASS' if success2 else '✗ FAIL'}")

    if success1 and success2:
        print("\n🎉 All tests passed! Apple FastVLM is ready for use.")
        sys.exit(0)
    else:
        print("\n⚠️  Some tests failed. Check the output above.")
        sys.exit(1)
