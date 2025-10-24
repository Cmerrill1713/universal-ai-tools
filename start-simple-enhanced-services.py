#!/usr/bin/env python3
"""
Start Simple Enhanced Services - Universal AI Tools
Simple approach to start enhanced services with proper integration
"""

import json
import time
import http.server
import socketserver
import threading
from pathlib import Path

class SimpleEnhancedService:
    def __init__(self, service_name, port):
        self.service_name = service_name
        self.port = port
        self.server = None
        self.thread = None
        
    def create_handler(self):
        """Create enhanced HTTP handler"""
        class EnhancedHandler(http.server.BaseHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                self.service_name = service_name
                self.port = port
                super().__init__(*args, **kwargs)
            
            def do_GET(self):
                if self.path == "/health":
                    self.send_health_response()
                elif self.path == "/":
                    self.send_service_info()
                elif self.path.startswith("/api/"):
                    self.send_api_response()
                else:
                    self.send_error_response(404, "Not Found")
            
            def do_POST(self):
                if self.path.startswith("/api/"):
                    self.send_api_response()
                else:
                    self.send_error_response(404, "Not Found")
            
            def send_health_response(self):
                """Send standardized health response"""
                self.send_response(200)
                self.send_header("Content-type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                
                health_data = {
                    "status": "healthy",
                    "service": self.service_name,
                    "port": self.port,
                    "timestamp": time.time(),
                    "uptime": time.time() - getattr(self.server, 'start_time', time.time()),
                    "version": "1.0.0",
                    "environment": "production",
                    "data_structure": "standardized"
                }
                
                self.wfile.write(json.dumps(health_data, indent=2).encode())
            
            def send_service_info(self):
                """Send service information"""
                self.send_response(200)
                self.send_header("Content-type", "text/html")
                self.end_headers()
                
                html = f"""
                <html>
                <head><title>{self.service_name}</title></head>
                <body>
                    <h1>{self.service_name}</h1>
                    <p>Status: <span style="color: green;">Running</span></p>
                    <p>Port: {self.port}</p>
                    <p>Version: 1.0.0</p>
                    <p>Data Structure: Standardized</p>
                    <p><a href="/health">Health Check</a></p>
                </body>
                </html>
                """
                self.wfile.write(html.encode())
            
            def send_api_response(self):
                """Send API response"""
                self.send_response(200)
                self.send_header("Content-type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                
                api_data = {
                    "status": "success",
                    "service": self.service_name,
                    "method": self.command,
                    "path": self.path,
                    "timestamp": time.time(),
                    "data": {
                        "message": f"API endpoint from {self.service_name}",
                        "data_structure": "standardized"
                    }
                }
                
                self.wfile.write(json.dumps(api_data, indent=2).encode())
            
            def send_error_response(self, code, message):
                """Send error response"""
                self.send_response(code)
                self.send_header("Content-type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                
                error_data = {
                    "status": "error",
                    "service": self.service_name,
                    "error": {
                        "code": code,
                        "message": message,
                        "timestamp": time.time()
                    }
                }
                
                self.wfile.write(json.dumps(error_data, indent=2).encode())
            
            def log_message(self, format, *args):
                pass
        
        return EnhancedHandler
    
    def start(self):
        """Start the service"""
        try:
            handler = self.create_handler()
            self.server = socketserver.TCPServer(("", self.port), handler)
            self.server.start_time = time.time()
            
            def serve():
                self.server.serve_forever()
            
            self.thread = threading.Thread(target=serve)
            self.thread.daemon = True
            self.thread.start()
            
            print(f"✅ {self.service_name} started on port {self.port}")
            return True
        except OSError as e:
            if e.errno == 98:
                print(f"⚠️ Port {self.port} already in use for {self.service_name}")
                return False
            else:
                print(f"❌ Failed to start {self.service_name}: {e}")
                return False
        except Exception as e:
            print(f"❌ Error starting {self.service_name}: {e}")
            return False
    
    def stop(self):
        """Stop the service"""
        if self.server:
            self.server.shutdown()
            self.server.server_close()

def main():
    """Main function to start all enhanced services"""
    print("🚀 Starting Simple Enhanced Services...")
    
    services = [
        SimpleEnhancedService("athena-gateway", 8080),
        SimpleEnhancedService("unified-gateway", 9000),
        SimpleEnhancedService("family-profiles", 8005),
        SimpleEnhancedService("family-calendar", 8006),
        SimpleEnhancedService("family-knowledge", 8007)
    ]
    
    started_services = []
    
    for service in services:
        if service.start():
            started_services.append(service)
        time.sleep(0.5)
    
    print(f"✅ Started {len(started_services)}/{len(services)} services")
    
    if started_services:
        print("🎉 Enhanced services are running!")
        print("Press Ctrl+C to stop all services")
        
        try:
            # Keep the main thread alive
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n🛑 Stopping all services...")
            for service in started_services:
                service.stop()
            print("✅ All services stopped")
    else:
        print("❌ No services started")

if __name__ == "__main__":
    main()