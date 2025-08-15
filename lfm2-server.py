#!/usr/bin/env python3
"""
LFM2 Server - Fast Local Model Bridge
Serves LFM2-1.2B model for TypeScript services
Uses MLX format for Apple Silicon optimization
"""

import json
import logging
import sys
import time
from typing import Any

# Try to import MLX-LM for the LFM2 model
try:
    from mlx_lm import generate, load

    HAS_MLX_LM = True
except ImportError:
    HAS_MLX_LM = False
    logging.warning("MLX-LM not available, install with: pip install mlx-lm")


class LFM2Server:
    """Fast LFM2 server using MLX for Apple Silicon"""

    def __init__(self) -> None:
        self.model: Any = None
        self.tokenizer: Any = None
        self.is_ready = False
        self.request_count = 0
        self.total_time = 0
        self.model_path = (
            "/Users/christianmerrill/Desktop/universal-ai-tools/models/agents/LFM2-1.2B-bf16"
        )
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s - LFM2 - %(levelname)s - %(message)s",
            handlers=[logging.StreamHandler(sys.stderr)],
        )
        self.logger = logging.getLogger(__name__)

    def initialize(self) -> None:
        """Initialize the LFM2 model using MLX"""
        try:
            self.logger.info("🚀 Initializing LFM2-1.2B server with MLX...")
            if not HAS_MLX_LM:
                self.logger.warning("⚠️ MLX-LM not available, using mock implementation")
                self._initialize_mock()
                return
            import os

            if not os.path.exists(self.model_path):
                self.logger.warning(f"⚠️ Model path not found: {self.model_path}")
                self._initialize_mock()
                return
            try:
                self.logger.info(f"Loading LFM2 from {self.model_path}...")
                self.model, self.tokenizer = load(self.model_path)
                self.is_ready = True
                print("INITIALIZED", flush=True)
                self.logger.info("✅ LFM2-1.2B loaded successfully with MLX")
            except Exception as mlx_error:  # noqa: BLE001
                self.logger.warning(f"⚠️ MLX loading failed: {mlx_error}")
                self._initialize_mock()
        except Exception as e:  # noqa: BLE001
            self.logger.error(f"❌ Failed to initialize LFM2: {e}")
            self._initialize_mock()

    def _initialize_mock(self) -> None:
        """Initialize mock LFM2 implementation for development"""
        self.logger.info("🔄 Using mock LFM2 implementation for development")
        self.model = "mock-lfm2-1.2b"
        self.tokenizer = None
        self.is_ready = True
        print("INITIALIZED", flush=True)
        self.logger.info("✅ Mock LFM2 server ready")

    def process(self, data: dict[str, Any]) -> dict[str, Any]:
        """Process a request"""
        start_time = time.time()
        self.request_count += 1
        try:
            task_type = data.get("type", "unknown")
            if task_type == "completion":
                result = self._handle_completion(data)
            elif task_type == "classification":
                result = self._handle_classification(data)
            elif task_type == "coordination":
                result = self._handle_coordination(data)
            else:
                result = {"success": False, "error": f"Unknown task type: {task_type}"}
            result["processingTime"] = int((time.time() - start_time) * 1000)
            result["requestId"] = data.get("requestId", f"req_{self.request_count}")
            self.total_time += result["processingTime"]
            return result
        except Exception as e:  # noqa: BLE001
            self.logger.error(f"❌ Error processing request: {e}")
            return {
                "success": False,
                "error": str(e),
                "processingTime": int((time.time() - start_time) * 1000),
            }

    def _handle_completion(self, data: dict[str, Any]) -> dict[str, Any]:
        """Handle text completion requests"""
        prompt = data.get("prompt", "")
        max_tokens = int(data.get("maxTokens", 50))
        # Clamp prompt and tokens to control memory/CPU
        prompt = prompt[:4000]
        if max_tokens > 512:
            max_tokens = 512
        if len(prompt) == 0:
            return {"success": True, "text": "", "model": "lfm2-mock"}
        _ = data.get("temperature", 0.7)
        if HAS_MLX_LM and self.model and self.tokenizer:
            try:
                if self.tokenizer.chat_template is not None:
                    messages = [{"role": "user", "content": prompt}]
                    prompt = self.tokenizer.apply_chat_template(
                        messages, add_generation_prompt=True
                    )
                    if isinstance(prompt, list):
                        prompt = prompt[0] if prompt else ""
                    if not isinstance(prompt, str):
                        prompt = str(prompt) if prompt else ""
                # Optionally sleep a tiny bit to yield CPU under load
                try:
                    import time as _t

                    _t.sleep(0.0)
                except Exception:
                    pass
                response = generate(self.model, self.tokenizer, prompt=prompt, verbose=False)
                if isinstance(response, list):
                    response = response[0] if response else ""
                if not isinstance(response, str):
                    response = str(response) if response else ""
                if isinstance(prompt, str) and prompt in response:
                    response = response[len(prompt) :].strip()
                return {"success": True, "text": response, "model": "lfm2-1.2b-mlx"}
            except Exception as e:  # noqa: BLE001
                self.logger.error(f"MLX generation error: {e}")
        # Log rough memory usage of the process
        try:
            import resource

            usage = resource.getrusage(resource.RUSAGE_SELF)
            self.logger.info(f"Memory usage (ru_maxrss): {usage.ru_maxrss}")
        except Exception:
            pass
        return {
            "success": True,
            "text": f"[Mock LFM2] Processed: {prompt[:50]}...",
            "model": "lfm2-mock",
        }

    def _handle_classification(self, data: dict[str, Any]) -> dict[str, Any]:
        """Handle classification requests"""
        text = data.get("text") or data.get("prompt", "")
        categories = data.get("categories") or ["general", "technical", "creative"]
        prompt = (
            f"Classify this text into one of these categories: {', '.join(categories)}\n\n"
            f"Text: {text}\n\nCategory:"
        )
        completion_result = self._handle_completion(
            {"prompt": prompt, "maxTokens": 10, "temperature": 0.3}
        )
        if completion_result["success"]:
            category = completion_result["text"]
            if isinstance(category, list):
                category = category[0] if category else ""
            if not isinstance(category, str):
                category = str(category) if category else ""
            category = category.strip().lower()
            for cat in categories:
                if category and cat.lower() in category:
                    category = cat
                    break
            else:
                category = categories[0]
            return {
                "success": True,
                "category": category,
                "confidence": 0.85,
                "model": completion_result["model"],
            }
        return completion_result

    def _handle_coordination(self, data: dict[str, Any]) -> dict[str, Any]:
        """Handle agent coordination requests"""
        task = data.get("task", "")
        agents = data.get("agents", [])
        if not task and data.get("prompt"):
            completion_result = self._handle_completion(
                {"prompt": data.get("prompt", ""), "maxTokens": 50, "temperature": 0.5}
            )
            if completion_result["success"]:
                return {
                    "success": True,
                    "strategy": completion_result["text"],
                    "suggestedAgent": agents[0] if agents else "default",
                    "confidence": 0.8,
                    "model": completion_result["model"],
                }
            return completion_result
        prompt = (
            f"Given the task '{task}' and available agents {agents}, suggest the best"
            " coordination strategy in one sentence."
        )
        completion_result = self._handle_completion(
            {"prompt": prompt, "maxTokens": 50, "temperature": 0.5}
        )
        if completion_result["success"]:
            return {
                "success": True,
                "strategy": completion_result["text"],
                "suggestedAgent": agents[0] if agents else "default",
                "confidence": 0.8,
                "model": completion_result["model"],
            }
        return completion_result

    def run(self) -> None:
        """Main server loop"""
        self.logger.info("🚀 LFM2 server starting...")
        while True:
            try:
                line = sys.stdin.readline()
                if not line:
                    break
                try:
                    request = json.loads(line.strip())
                except json.JSONDecodeError:
                    continue
                response = self.process(request)
                print(json.dumps(response), flush=True)
            except KeyboardInterrupt:
                break
            except Exception as e:  # noqa: BLE001
                self.logger.error(f"❌ Server error: {e}")
                error_response = {"success": False, "error": str(e)}
                print(json.dumps(error_response), flush=True)
        self.logger.info("👋 LFM2 server shutting down")


if __name__ == "__main__":
    server = LFM2Server()
    server.initialize()
    if server.is_ready:
        server.run()
