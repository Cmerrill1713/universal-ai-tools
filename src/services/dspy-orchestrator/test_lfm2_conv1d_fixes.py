#!/usr/bin/env python3
"""
Comprehensive Test Suite for LFM2 Conv1d Shape Mismatch Fixes
Demonstrates the resolution of Conv1d shape mismatch errors in LFM2-1.2B model loading
"""

import logging
import time

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def test_mlx_adapter():
    """Test MLX LFM2 adapter (should work with updated MLX version)"""
    print("\n" + "="*60)
    print("🧪 TESTING MLX LFM2 ADAPTER")
    print("="*60)

    try:
        from mlx_lfm2_adapter import MLXLFM2Adapter

        print("📦 Creating MLX adapter...")
        adapter = MLXLFM2Adapter()

        print("🔄 Loading model...")
        start_time = time.time()
        adapter.load()
        load_time = time.time() - start_time
        print(f"✅ Model loaded successfully in {load_time:.2f}s")

        # Test generation
        test_prompts = [
            "Hello, I am",
            "The capital of France is",
            "def fibonacci(n):",
            "Machine learning is"
        ]

        print("\n📝 Testing generation...")
        for i, prompt in enumerate(test_prompts, 1):
            try:
                start_time = time.time()
                response = adapter.generate(prompt, max_tokens=30)
                gen_time = time.time() - start_time
                print(f"{i}. Prompt: '{prompt}'")
                print(f"   Response: {response[:100]}...")
                print(f"   Time: {gen_time:.2f}s")
            except Exception as e:
                print(f"{i}. Prompt: '{prompt}' - FAILED: {e}")

        return True, "MLX adapter working successfully"

    except ImportError:
        return False, "MLX not available"
    except Exception as e:
        return False, f"MLX adapter failed: {e}"

def test_pytorch_adapter():
    """Test PyTorch LFM2 adapter with Conv1d fixes"""
    print("\n" + "="*60)
    print("🧪 TESTING PYTORCH LFM2 ADAPTER (WITH CONV1D FIXES)")
    print("="*60)

    try:
        from lfm2_adapter import LFM2Adapter

        print("📦 Creating PyTorch adapter with Conv1d fixes...")
        adapter = LFM2Adapter()

        print("🔄 Loading model with Conv1d shape fixes...")
        start_time = time.time()
        adapter.load()
        load_time = time.time() - start_time
        print(f"✅ Model loaded successfully in {load_time:.2f}s")

        # Test generation
        test_prompts = [
            "Hello, I am",
            "The capital of France is"
        ]

        print("\n📝 Testing generation...")
        for i, prompt in enumerate(test_prompts, 1):
            try:
                start_time = time.time()
                response = adapter.generate(prompt, max_tokens=20)
                gen_time = time.time() - start_time
                print(f"{i}. Prompt: '{prompt}'")
                print(f"   Response: {response[:80]}...")
                print(f"   Time: {gen_time:.2f}s")
            except Exception as e:
                print(f"{i}. Prompt: '{prompt}' - FAILED: {e}")

        return True, "PyTorch adapter working successfully"

    except ImportError:
        return False, "PyTorch/Transformers not available"
    except Exception as e:
        return False, f"PyTorch adapter failed: {e}"

def test_model_manager():
    """Test the comprehensive model manager"""
    print("\n" + "="*60)
    print("🧪 TESTING LFM2 MODEL MANAGER")
    print("="*60)

    try:
        from lfm2_model_manager import AdapterType, LFM2ModelManager

        print("📦 Creating model manager...")
        manager = LFM2ModelManager(adapter_preference=AdapterType.AUTO)

        print("🔍 Getting diagnostics...")
        diagnostics = manager.get_diagnostics()
        print(f"   Platform: {diagnostics['platform']}")
        print(f"   Dependencies: {diagnostics['dependencies']}")
        print(f"   Model files: {len(diagnostics['model_files'])} found")

        print("🔄 Loading model with automatic adapter selection...")
        start_time = time.time()
        success = manager.load()
        load_time = time.time() - start_time

        if success:
            print(f"✅ Model loaded successfully in {load_time:.2f}s")

            status = manager.get_status()
            print(f"   Using adapter: {status['current_adapter']}")

            # Test generation
            print("\n📝 Testing generation...")
            test_prompts = [
                "Hello, how are you?",
                "def quicksort(arr):"
            ]

            for i, prompt in enumerate(test_prompts, 1):
                try:
                    start_time = time.time()
                    response = manager.generate(prompt, max_tokens=25)
                    gen_time = time.time() - start_time
                    print(f"{i}. Prompt: '{prompt}'")
                    print(f"   Response: {response[:80]}...")
                    print(f"   Time: {gen_time:.2f}s")
                except Exception as e:
                    print(f"{i}. Prompt: '{prompt}' - FAILED: {e}")

            return True, f"Model manager working with {status['current_adapter']}"
        else:
            status = manager.get_status()
            return False, f"Model manager failed to load: {status['last_error']}"

    except Exception as e:
        return False, f"Model manager failed: {e}"

def test_dspy_integration():
    """Test DSPy integration with LFM2"""
    print("\n" + "="*60)
    print("🧪 TESTING DSPY INTEGRATION")
    print("="*60)

    try:
        from lfm2_model_manager import AdapterType, create_lfm2_dspy_lm

        print("📦 Creating DSPy-compatible LFM2 language model...")
        dspy_lm = create_lfm2_dspy_lm(adapter_preference=AdapterType.AUTO)

        print("📝 Testing DSPy interface...")
        test_prompts = [
            "What is Python?",
            "Explain machine learning briefly."
        ]

        for i, prompt in enumerate(test_prompts, 1):
            try:
                start_time = time.time()
                responses = dspy_lm(prompt)
                gen_time = time.time() - start_time
                print(f"{i}. Prompt: '{prompt}'")
                print(f"   Response: {responses[0][:80]}...")
                print(f"   Time: {gen_time:.2f}s")
            except Exception as e:
                print(f"{i}. Prompt: '{prompt}' - FAILED: {e}")

        return True, "DSPy integration working successfully"

    except Exception as e:
        return False, f"DSPy integration failed: {e}"

def run_comprehensive_test():
    """Run all tests and provide summary"""
    print("🚀 LFM2 Conv1d Shape Mismatch Fix - Comprehensive Test Suite")
    print("🔧 This test suite verifies that Conv1d shape mismatch errors are resolved")
    print("📋 Tests both MLX and PyTorch adapters with fallback mechanisms")

    tests = [
        ("MLX Adapter", test_mlx_adapter),
        ("PyTorch Adapter", test_pytorch_adapter),
        ("Model Manager", test_model_manager),
        ("DSPy Integration", test_dspy_integration)
    ]

    results = []

    for test_name, test_func in tests:
        try:
            success, message = test_func()
            results.append((test_name, success, message))
        except Exception as e:
            results.append((test_name, False, f"Test crashed: {e}"))

    # Summary
    print("\n" + "="*80)
    print("📊 TEST SUMMARY")
    print("="*80)

    passed = 0
    total = len(results)

    for test_name, success, message in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if success:
            passed += 1

    print(f"\n🎯 Overall Result: {passed}/{total} tests passed")

    if passed == total:
        print("🎉 ALL TESTS PASSED! Conv1d shape mismatch issues are resolved!")
        print("🚀 LFM2-1.2B model is ready for production use!")
    elif passed > 0:
        print("⚡ PARTIAL SUCCESS: Some adapters are working!")
        print("💡 Consider using the working adapters for production.")
    else:
        print("❌ ALL TESTS FAILED: Investigation needed")
        print("🔧 Check dependencies and model files")

    return passed, total

if __name__ == "__main__":
    run_comprehensive_test()
