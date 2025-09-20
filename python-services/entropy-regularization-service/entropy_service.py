import json
import logging
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs
from entropy_regularizer import EntropyRegularizer
import torch

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class EntropyService:
    """Entropy Regularization Service for AI Systems"""
    
    def __init__(self):
        self.regularizer = EntropyRegularizer(alpha=0.5, beta=0.7, use_uniform=True)
        logger.info("Entropy Regularization Service initialized")
    
    def process_request(self, request_data: dict) -> dict:
        """Process entropy regularization request"""
        try:
            request_type = request_data.get('type', 'regularize')
            
            if request_type == 'regularize':
                return self._regularize_response(request_data)
            elif request_type == 'confidence':
                return self._compute_confidence(request_data)
            elif request_type == 'penalty':
                return self._compute_penalty(request_data)
            else:
                return {"error": f"Unknown request type: {request_type}"}
                
        except Exception as e:
            logger.error(f"Error processing request: {e}")
            return {"error": str(e)}
    
    def _regularize_response(self, request_data: dict) -> dict:
        """Regularize a text response"""
        response = request_data.get('response', '')
        threshold = request_data.get('confidence_threshold', 0.7)
        
        result = self.regularizer.regularize_response(response, threshold)
        
        return {
            "success": True,
            "result": result,
            "service": "entropy-regularization"
        }
    
    def _compute_confidence(self, request_data: dict) -> dict:
        """Compute confidence score for logits"""
        logits_data = request_data.get('logits', [])
        
        if not logits_data:
            return {"error": "No logits provided"}
        
        # Convert to tensor
        logits = torch.tensor(logits_data)
        confidence = self.regularizer.compute_confidence_score(logits)
        
        return {
            "success": True,
            "confidence": confidence.tolist(),
            "avg_confidence": torch.mean(confidence).item(),
            "service": "entropy-regularization"
        }
    
    def _compute_penalty(self, request_data: dict) -> dict:
        """Compute entropy penalty"""
        logits_data = request_data.get('logits', [])
        target_data = request_data.get('target', [])
        vocab_size = request_data.get('vocab_size', 1000)
        
        if not logits_data or not target_data:
            return {"error": "Logits and target required"}
        
        # Convert to tensors
        logits = torch.tensor(logits_data)
        target = torch.tensor(target_data)
        
        total_loss, entropy_penalty = self.regularizer.compute_entropy_penalty(
            logits, target, vocab_size
        )
        
        return {
            "success": True,
            "total_loss": total_loss.tolist(),
            "entropy_penalty": entropy_penalty.tolist(),
            "service": "entropy-regularization"
        }

class EntropyHTTPHandler(BaseHTTPRequestHandler):
    def __init__(self, entropy_service, *args, **kwargs):
        self.entropy_service = entropy_service
        super().__init__(*args, **kwargs)
    
    def do_GET(self):
        if self.path == '/health':
            self._handle_health()
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_POST(self):
        """Handle POST requests"""
        if self.path == '/regularize':
            self._handle_regularize()
        elif self.path == '/confidence':
            self._handle_confidence()
        elif self.path == '/penalty':
            self._handle_penalty()
        elif self.path == '/health':
            self._handle_health()
        else:
            self.send_response(404)
            self.end_headers()
    
    def _handle_regularize(self):
        """Handle response regularization"""
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            request_data = json.loads(post_data.decode('utf-8'))
            
            response = self.entropy_service.process_request(request_data)
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())
            
        except Exception as e:
            logger.error(f"Error in regularize handler: {e}")
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            error_response = {"error": str(e)}
            self.wfile.write(json.dumps(error_response).encode())
    
    def _handle_confidence(self):
        """Handle confidence computation"""
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            request_data = json.loads(post_data.decode('utf-8'))
            
            response = self.entropy_service.process_request(request_data)
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())
            
        except Exception as e:
            logger.error(f"Error in confidence handler: {e}")
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            error_response = {"error": str(e)}
            self.wfile.write(json.dumps(error_response).encode())
    
    def _handle_penalty(self):
        """Handle penalty computation"""
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            request_data = json.loads(post_data.decode('utf-8'))
            
            response = self.entropy_service.process_request(request_data)
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())
            
        except Exception as e:
            logger.error(f"Error in penalty handler: {e}")
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            error_response = {"error": str(e)}
            self.wfile.write(json.dumps(error_response).encode())
    
    def _handle_health(self):
        """Handle health check"""
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        health_response = {
            "status": "healthy",
            "service": "entropy-regularization",
            "version": "1.0.0"
        }
        self.wfile.write(json.dumps(health_response).encode())

def main():
    """Start the entropy regularization service"""
    entropy_service = EntropyService()
    
    def handler(*args, **kwargs):
        return EntropyHTTPHandler(entropy_service, *args, **kwargs)
    
    server = HTTPServer(('localhost', 8094), handler)
    logger.info("Entropy Regularization Service starting on port 8094")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down Entropy Regularization Service")
        server.shutdown()

if __name__ == "__main__":
    main()

