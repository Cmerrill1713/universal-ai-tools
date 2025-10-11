import json
import logging
from http.server import BaseHTTPRequestHandler, HTTPServer

import torch
import torch.nn.functional as F

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SimpleEntropyService:
    """Simplified Entropy Regularization Service"""

    def __init__(self):
        self.alpha = 0.5
        self.beta = 0.7
        logger.info("Simple Entropy Service initialized")

    def regularize_response(self, response: str, threshold: float = 0.7) -> dict:
        """Regularize a text response based on entropy"""
        # Simple entropy-based regularization
        words = response.split()
        unique_words = len(set(words))
        total_words = len(words)

        # Compute entropy-like metric
        if total_words > 0:
            entropy_metric = unique_words / total_words
        else:
            entropy_metric = 0.0

        # Determine if response needs regularization
        if entropy_metric < threshold:
            regularized_response = f"[LOW_CONFIDENCE] {response}"
            regularized = True
            reason = "low_entropy_diversity"
        else:
            regularized_response = response
            regularized = False
            reason = "adequate_entropy"

        return {
            "response": regularized_response,
            "metadata": {
                "confidence": entropy_metric,
                "regularized": regularized,
                "reason": reason,
                "unique_words": unique_words,
                "total_words": total_words
            }
        }

    def compute_confidence(self, logits_data: list) -> dict:
        """Compute confidence from logits"""
        try:
            logits = torch.tensor(logits_data)
            probs = F.softmax(logits, dim=-1)
            entropy = -torch.sum(probs * torch.log(probs + 1e-8), dim=-1)

            # Convert to confidence (lower entropy = higher confidence)
            max_entropy = torch.log(torch.tensor(logits.shape[-1], dtype=torch.float))
            confidence = 1.0 - (entropy / max_entropy)

            return {
                "confidence": confidence.tolist(),
                "avg_confidence": torch.mean(confidence).item(),
                "entropy": entropy.tolist()
            }
        except Exception as e:
            return {"error": str(e)}

class SimpleEntropyHandler(BaseHTTPRequestHandler):
    def __init__(self, service, *args, **kwargs):
        self.service = service
        super().__init__(*args, **kwargs)

    def do_GET(self):
        """Handle GET requests"""
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                "status": "healthy",
                "service": "simple-entropy-regularization",
                "version": "1.0.0"
            }
            self.wfile.write(json.dumps(response).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        """Handle POST requests"""
        if self.path == '/regularize':
            self._handle_regularize()
        elif self.path == '/confidence':
            self._handle_confidence()
        else:
            self.send_response(404)
            self.end_headers()

    def _handle_regularize(self):
        """Handle response regularization"""
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            request_data = json.loads(post_data.decode('utf-8'))

            response = request_data.get('response', '')
            threshold = request_data.get('confidence_threshold', 0.7)

            result = self.service.regularize_response(response, threshold)

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "result": result
            }).encode())

        except Exception as e:
            logger.error(f"Error in regularize handler: {e}")
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def _handle_confidence(self):
        """Handle confidence computation"""
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            request_data = json.loads(post_data.decode('utf-8'))

            logits_data = request_data.get('logits', [])
            result = self.service.compute_confidence(logits_data)

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "result": result
            }).encode())

        except Exception as e:
            logger.error(f"Error in confidence handler: {e}")
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

def main():
    """Start the simple entropy service"""
    service = SimpleEntropyService()

    def handler(*args, **kwargs):
        return SimpleEntropyHandler(service, *args, **kwargs)

    server = HTTPServer(('localhost', 8094), handler)
    logger.info("Simple Entropy Service starting on port 8094")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down Simple Entropy Service")
        server.shutdown()

if __name__ == "__main__":
    main()

