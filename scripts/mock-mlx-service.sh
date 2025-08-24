#!/bin/bash

# Mock MLX Service for Testing
# Simulates MLX service responses for migration testing
# Created: 2025-08-22

set -euo pipefail

PORT="${MLX_PORT:-8004}"
HOST="${MLX_HOST:-0.0.0.0}"

echo "🚀 Starting Mock MLX Service on $HOST:$PORT"

# Create a simple HTTP server using Python
python3 -c "
import http.server
import socketserver
import json
import time
import urllib.parse
from datetime import datetime

class MLXMockHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            response = {
                'status': 'healthy',
                'service': 'mlx-lfm2',
                'timestamp': datetime.now().isoformat(),
                'model': 'lfm2:1.2b',
                'version': '1.0.0'
            }
            self.wfile.write(json.dumps(response).encode())
            
        elif self.path == '/api/models':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            response = {
                'models': [
                    {
                        'id': 'lfm2:1.2b',
                        'provider': 'mlx',
                        'parameters': '1.2B',
                        'type': 'language_model'
                    }
                ]
            }
            self.wfile.write(json.dumps(response).encode())
            
        elif self.path == '/metrics':
            self.send_response(200)
            self.send_header('Content-type', 'text/plain')
            self.end_headers()
            
            metrics = '''# HELP mlx_requests_total Total number of requests
mlx_requests_total{model=\"lfm2\"} 142
# HELP mlx_response_time_ms Response time in milliseconds  
mlx_response_time_ms{model=\"lfm2\"} 87
# HELP mlx_memory_usage_kb Memory usage in kilobytes
mlx_memory_usage_kb 45632
'''
            self.wfile.write(metrics.encode())
            
        elif self.path == '/api/circuit-breaker/status':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            response = {
                'circuit_breakers': {
                    'mlx_inference': {
                        'state': 'CLOSED',
                        'failure_count': 0,
                        'success_count': 142
                    }
                }
            }
            self.wfile.write(json.dumps(response).encode())
            
        else:
            self.send_response(404)
            self.end_headers()
            
    def do_POST(self):
        if self.path == '/api/chat/completions':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                request_data = json.loads(post_data.decode('utf-8'))
                
                # Simulate processing time
                time.sleep(0.05)  # 50ms processing time
                
                # Mock response based on prompt
                prompt = request_data.get('messages', [{}])[-1].get('content', '')
                
                if '2 + 2' in prompt or '2+2' in prompt:
                    answer = 'The answer to 2 + 2 is 4.'
                elif 'calculation' in prompt.lower():
                    answer = '4'
                elif 'integration test' in prompt.lower():
                    answer = 'Integration test successful. All systems operational.'
                elif '10 divided by 2' in prompt:
                    answer = '10 divided by 2 equals 5.'
                elif 'Count to 5' in prompt:
                    answer = '1, 2, 3, 4, 5'
                elif 'artificial intelligence' in prompt.lower():
                    answer = 'Artificial intelligence (AI) refers to computer systems that can perform tasks typically requiring human intelligence, such as learning, reasoning, and problem-solving.'
                else:
                    answer = f'Mock MLX response to: {prompt}'
                
                response = {
                    'id': f'chatcmpl-mock-{int(time.time())}',
                    'object': 'chat.completion',
                    'created': int(time.time()),
                    'model': request_data.get('model', 'lfm2:1.2b'),
                    'choices': [{
                        'index': 0,
                        'message': {
                            'role': 'assistant',
                            'content': answer
                        },
                        'finish_reason': 'stop'
                    }],
                    'usage': {
                        'prompt_tokens': len(prompt.split()),
                        'completion_tokens': len(answer.split()),
                        'total_tokens': len(prompt.split()) + len(answer.split())
                    }
                }
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(response).encode())
                
            except json.JSONDecodeError:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                error_response = {'error': 'Invalid JSON in request body'}
                self.wfile.write(json.dumps(error_response).encode())
        else:
            self.send_response(404)
            self.end_headers()
            
    def log_message(self, format, *args):
        print(f'[{datetime.now().strftime(\"%Y-%m-%d %H:%M:%S\")}] {format % args}')

with socketserver.TCPServer(('$HOST', $PORT), MLXMockHandler) as httpd:
    print(f'Mock MLX Service serving at http://$HOST:$PORT')
    print('Available endpoints:')
    print('  GET  /health - Service health check')
    print('  GET  /api/models - Available models')
    print('  POST /api/chat/completions - Chat completions')
    print('  GET  /metrics - Prometheus metrics')
    print('  GET  /api/circuit-breaker/status - Circuit breaker status')
    print('')
    print('Press Ctrl+C to stop')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nShutting down Mock MLX Service...')
        httpd.shutdown()
"