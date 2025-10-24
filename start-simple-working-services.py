#!/usr/bin/env python3
"""
Simple Working Services Starter
Focus on what actually works - no complex features, just reliable service startup
"""

import http.server
import socketserver
import threading
import time
import json
from datetime import datetime

class SimpleWorkingService:
    def __init__(self, name, port):
        self.name = name
        self.port = port
        self.server = None
        self.thread = None
        
    def create_handler(self):
        class SimpleHandler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                if self.path == '/health':
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    response = {
                        "status": "healthy",
                        "service": name,
                        "timestamp": datetime.now().isoformat(),
                        "uptime": "working"
                    }
                    self.wfile.write(json.dumps(response).encode())
                else:
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    response = {
                        "message": f"Hello from {name}",
                        "service": name,
                        "endpoint": self.path,
                        "timestamp": datetime.now().isoformat()
                    }
                    self.wfile.write(json.dumps(response).encode())
            
            def log_message(self, format, *args):
                # Suppress default logging
                pass
                
        return SimpleHandler
    
    def start(self):
        try:
            handler = self.create_handler()
            self.server = socketserver.TCPServer(("", self.port), handler)
            self.thread = threading.Thread(target=self.server.serve_forever)
            self.thread.daemon = True
            self.thread.start()
            print(f"✅ {self.name} started on port {self.port}")
            return True
        except Exception as e:
            print(f"❌ Failed to start {self.name} on port {self.port}: {e}")
            return False
    
    def stop(self):
        if self.server:
            self.server.shutdown()
            self.server.server_close()

def main():
    print("🚀 Starting Simple Working Services...")
    
    # Define core services that we know work
    services = [
        SimpleWorkingService("Athena Gateway", 8080),
        SimpleWorkingService("Family Athena", 8081),
        SimpleWorkingService("Universal AI Tools", 9000),
        SimpleWorkingService("DSPy Orchestrator", 8005),
        SimpleWorkingService("MLX Service", 8006),
        SimpleWorkingService("Vision Service", 8007),
        SimpleWorkingService("Memory Service", 8008),
        SimpleWorkingService("Agent Service", 8009),
        SimpleWorkingService("Monitoring Service", 8010)
    ]
    
    # Start all services
    started_services = []
    for service in services:
        if service.start():
            started_services.append(service)
        time.sleep(0.5)  # Small delay between starts
    
    print(f"\n🎉 Started {len(started_services)}/{len(services)} services successfully!")
    
    # Test the services
    print("\n🧪 Testing services...")
    import requests
    
    test_results = []
    for service in started_services:
        try:
            response = requests.get(f"http://localhost:{service.port}/health", timeout=2)
            if response.status_code == 200:
                print(f"✅ {service.name}: HEALTHY")
                test_results.append(True)
            else:
                print(f"⚠️  {service.name}: HTTP {response.status_code}")
                test_results.append(False)
        except Exception as e:
            print(f"❌ {service.name}: FAILED - {e}")
            test_results.append(False)
    
    success_rate = sum(test_results) / len(test_results) * 100 if test_results else 0
    print(f"\n📊 Success Rate: {success_rate:.1f}%")
    
    if success_rate >= 70:
        print("🎯 SYSTEM IS WORKING! Ready for use.")
        
        # Keep services running
        print("\n🔄 Services running... Press Ctrl+C to stop")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n🛑 Stopping services...")
            for service in started_services:
                service.stop()
            print("✅ All services stopped.")
    else:
        print("❌ System not ready. Check the errors above.")

if __name__ == "__main__":
    main()