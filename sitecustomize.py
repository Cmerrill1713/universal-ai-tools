"""
sitecustomize.py - Python path customization
Automatically adds /app/src and /app/api to sys.path if they exist.
This file is loaded automatically by Python on startup.
"""

import os
import sys


def setup_python_path():
    """Add project directories to sys.path if they exist."""
    paths_to_add = [
        "/app/src",
        "/app/api",
        "/app",
    ]

    for path in paths_to_add:
        if os.path.exists(path) and path not in sys.path:
            sys.path.insert(0, path)
            print(f"[sitecustomize] Added {path} to sys.path")


# Run setup on module import
setup_python_path()

