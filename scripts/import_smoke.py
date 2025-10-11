#!/usr/bin/env python3
"""
Import smoke tests - verify all critical modules can be imported
"""

import sys
from pathlib import Path

# Add paths
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
sys.path.insert(0, str(Path(__file__).parent.parent / "api"))

def test_import(module_name: str, description: str = ""):
    """Test importing a module"""
    try:
        __import__(module_name)
        print(f"✅ {module_name:50} - {description}")
        return True
    except ImportError as e:
        print(f"❌ {module_name:50} - FAILED: {e}")
        return False
    except Exception as e:
        print(f"⚠️  {module_name:50} - ERROR: {e}")
        return False

def main():
    print("="*80)
    print("IMPORT SMOKE TESTS")
    print("="*80)
    print()

    tests = [
        # API modules
        ("api", "API module"),
        ("api.app", "FastAPI application"),
        ("api.routers.health", "Health router"),
        ("api.routers.users", "Users router"),
        ("api.routers.tasks", "Tasks router"),

        # Source modules
        ("src", "Source module"),
        ("src.config", "Configuration"),
        ("src.utils", "Utilities"),
    ]

    print("Testing imports...")
    print("-"*80)

    results = [test_import(module, desc) for module, desc in tests]

    print("-"*80)
    passed = sum(results)
    total = len(results)
    print(f"\n📊 Results: {passed}/{total} imports successful ({passed/total*100:.1f}%)")

    if passed < total:
        print(f"\n❌ FAIL: {total - passed} imports failed")
        sys.exit(1)

    print("\n✅ PASS: All imports successful")
    return 0

if __name__ == "__main__":
    sys.exit(main())

