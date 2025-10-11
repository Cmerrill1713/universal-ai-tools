#!/usr/bin/env python3
"""
Launch Script for NewTradingBot Streamlit Application
Simplified launcher with environment setup and error handling
"""

import os
import subprocess
import sys
from pathlib import Path


def setup_environment():
    """Setup environment and paths"""
    # Add src directory to Python path
    project_root = Path(__file__).parent
    src_dir = project_root / "src"

    if str(src_dir) not in sys.path:
        sys.path.insert(0, str(src_dir))

    # Set environment variables
    os.environ.setdefault('PYTHONPATH', str(src_dir))
    os.environ.setdefault('ENVIRONMENT', 'development')

    # Create logs directory if it doesn't exist
    logs_dir = project_root / "logs"
    logs_dir.mkdir(exist_ok=True)

    return project_root, src_dir


def check_dependencies():
    """Check if required dependencies are installed"""
    required_packages = [
        'streamlit',
        'pandas',
        'numpy',
        'plotly',
        'pydantic'
    ]

    missing_packages = []

    for package in required_packages:
        try:
            __import__(package)
        except ImportError:
            missing_packages.append(package)

    if missing_packages:
        print(f"❌ Missing required packages: {', '.join(missing_packages)}")
        print("Please install dependencies with: pip install -r requirements.txt")
        return False

    return True


def launch_streamlit_app(src_dir: Path):
    """Launch the Streamlit application"""
    run_file = src_dir / "run.py"

    if not run_file.exists():
        print(f"❌ Main application file not found: {run_file}")
        return False

    print("🚀 Launching NewTradingBot...")
    print(f"📁 Project directory: {src_dir.parent}")
    print(f"🐍 Python path: {sys.executable}")
    print("🌐 Starting Streamlit server...")
    print("-" * 50)

    # Launch Streamlit
    try:
        cmd = [
            sys.executable, "-m", "streamlit", "run",
            str(run_file),
            "--server.headless", "false",
            "--server.runOnSave", "true",
            "--browser.serverAddress", "localhost",
            "--browser.gatherUsageStats", "false",
            "--theme.base", "dark"
        ]

        subprocess.run(cmd, check=True)

    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to launch Streamlit: {e}")
        return False
    except KeyboardInterrupt:
        print("\n✅ Application stopped by user")
        return True

    return True


def main():
    """Main entry point"""
    print("=" * 50)
    print("🚀 NewTradingBot Launch Script")
    print("=" * 50)

    try:
        # Setup environment
        project_root, src_dir = setup_environment()
        print("✅ Environment setup complete")

        # Check dependencies
        if not check_dependencies():
            print("\n📦 To install dependencies, run:")
            print("pip install -r requirements.txt")
            sys.exit(1)

        print("✅ Dependencies check passed")

        # Launch application
        success = launch_streamlit_app(src_dir)

        if not success:
            sys.exit(1)

    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
