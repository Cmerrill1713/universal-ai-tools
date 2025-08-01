#!/usr/bin/env python3
"""
Direct test of LFM2 server temperature handling
"""

import json
import subprocess
import time

print("Testing LFM2 server directly...")

# Start LFM2 server
server = subprocess.Popen(
    ['python3', 'src/services/lfm2-server.py'],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True
)

# Wait for initialization
time.sleep(3)

# Test requests with different temperatures
test_cases = [
    {
        "type": "completion",
        "requestId": "test1",
        "prompt": "What is 2+2?",
        "maxTokens": 50,
        "temperature": 0.1  # Low temp for factual
    },
    {
        "type": "completion", 
        "requestId": "test2",
        "prompt": "Write a poem",
        "maxTokens": 50,
        "temperature": 0.8  # High temp for creative
    }
]

for test in test_cases:
    print(f"\nSending request: {test['prompt']} (temp={test['temperature']})")
    
    # Send request
    server.stdin.write(json.dumps(test) + '\n')
    server.stdin.flush()
    
    # Read response
    response_line = server.stdout.readline()
    if response_line:
        response = json.loads(response_line)
        print(f"Response: {response}")
    
    # Check for errors
    stderr_output = server.stderr.readline()
    if stderr_output and ("error" in stderr_output.lower() or "temp" in stderr_output.lower()):
        print(f"Error output: {stderr_output}")

# Clean up
server.terminate()
print("\nTest complete!")