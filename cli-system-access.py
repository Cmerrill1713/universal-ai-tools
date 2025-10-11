#!/usr/bin/env python3
"""
Simple CLI tool for system access
Allows the AI to open applications and execute commands on macOS
"""

import argparse
import json
import subprocess


def open_app(app_name):
    """Open an application on macOS"""
    try:
        result = subprocess.run(['open', '-a', app_name],
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            return {"success": True, "message": f"Opened {app_name}"}
        else:
            return {"success": False, "message": f"Failed to open {app_name}: {result.stderr}"}
    except subprocess.TimeoutExpired:
        return {"success": False, "message": f"Timeout opening {app_name}"}
    except Exception as e:
        return {"success": False, "message": f"Error opening {app_name}: {str(e)}"}

def execute_command(command):
    """Execute a system command with shell support"""
    safe_commands = ['ls', 'pwd', 'date', 'whoami', 'ps', 'top', 'df', 'du', 'cat', 'head', 'tail', 'grep', 'find']
    base_command = command.split()[0]

    if base_command not in safe_commands:
        return {"success": False, "message": f"Command '{base_command}' is not allowed for security reasons"}

    try:
        # Use shell=True to support pipes and complex commands
        result = subprocess.run(command, shell=True,
                              capture_output=True, text=True, timeout=30)
        return {
            "success": result.returncode == 0,
            "message": f"Executed: {command}",
            "output": result.stdout,
            "error": result.stderr if result.stderr else None
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "message": f"Timeout executing: {command}"}
    except Exception as e:
        return {"success": False, "message": f"Error executing '{command}': {str(e)}"}

def close_app(app_name):
    """Close an application on macOS"""
    try:
        # Use osascript to close the app
        script = f'tell application "{app_name}" to quit'
        result = subprocess.run(['osascript', '-e', script],
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            return {"success": True, "message": f"Closed {app_name}"}
        else:
            return {"success": False, "message": f"Failed to close {app_name}: {result.stderr}"}
    except subprocess.TimeoutExpired:
        return {"success": False, "message": f"Timeout closing {app_name}"}
    except Exception as e:
        return {"success": False, "message": f"Error closing {app_name}: {str(e)}"}

def main():
    parser = argparse.ArgumentParser(description='CLI System Access Tool')
    parser.add_argument('action', choices=['open', 'close', 'execute'], help='Action to perform')
    parser.add_argument('target', help='App name or command to execute')

    args = parser.parse_args()

    if args.action == 'open':
        result = open_app(args.target)
    elif args.action == 'close':
        result = close_app(args.target)
    elif args.action == 'execute':
        result = execute_command(args.target)

    print(json.dumps(result, indent=2))

if __name__ == '__main__':
    main()
