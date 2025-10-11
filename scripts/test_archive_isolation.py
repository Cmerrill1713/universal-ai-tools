#!/usr/bin/env python3
"""
Test that nothing under /archive is importable
This ensures archived code doesn't interfere with the active codebase
"""

import sys
from pathlib import Path


def test_archive_isolation():
    """Ensure archive directory is not in sys.path"""
    print("Testing archive isolation...")
    print("="*80)

    # Check sys.path doesn't contain archive
    archive_in_path = any('archive' in p for p in sys.path)
    if archive_in_path:
        print("❌ FAIL: 'archive' found in sys.path!")
        print(f"   sys.path: {sys.path}")
        return False

    print("✅ PASS: 'archive' not in sys.path")

    # Try to find any Python files in archive
    repo_root = Path(__file__).parent.parent
    archive_dir = repo_root / "archive"

    if not archive_dir.exists():
        print("ℹ️  No archive directory found (OK)")
        return True

    py_files = list(archive_dir.rglob("*.py"))
    print(f"ℹ️  Found {len(py_files)} Python files in archive/")

    # Verify we can't import them
    if py_files:
        sample = py_files[0].stem
        try:
            __import__(sample)
            print(f"❌ FAIL: Successfully imported '{sample}' from archive!")
            return False
        except (ImportError, ModuleNotFoundError):
            print("✅ PASS: Cannot import archived modules (expected)")

    print("="*80)
    return True

if __name__ == "__main__":
    success = test_archive_isolation()
    sys.exit(0 if success else 1)

