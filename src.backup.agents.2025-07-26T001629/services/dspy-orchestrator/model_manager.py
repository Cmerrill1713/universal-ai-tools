"""
Model Management System
Handles downloading, deleting, and managing LLM models including Liquid and MLX models
"""

import asyncio
import logging
import os
import re
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)


class ModelType(Enum):
    """Types of models supported"""

    OLLAMA = "ollama"
    LIQUID = "liquid"
    MLX = "mlx"
    LM_STUDIO = "lm_studio"


@dataclass
class ModelInfo:
    """Information about a model"""

    name: str
    type: ModelType
    size_gb: Optional[float] = None
    is_downloaded: bool = False
    provider: Optional[str] = None
    capabilities: Optional[List[str]] = None
    description: Optional[str] = None


class ModelManager:
    """Manages LLM models across different providers"""

    # Special model patterns
    LIQUID_MODELS = ["liquid/lfm-40b", "liquid/lfm-7b", "liquid-ai/liquid-3b"]

    MLX_MODELS = [
        r".*-mlx$",  # Models ending with -mlx
        r"mlx-.*",  # Models starting with mlx-
    ]

    def __init__(self):
        self.ollama_url = os.environ.get("OLLAMA_URL", "http://localhost:11434")
        self.available_models: Dict[str, ModelInfo] = {}

    async def list_all_models(self, include_remote: bool = True) -> Dict[str, List[ModelInfo]]:
        """List all models (downloaded and available for download)"""
        models = {
            "ollama": await self.list_ollama_models(include_remote),
            "liquid": await self.list_liquid_models(),
            "mlx": await self.list_mlx_models(),
        }
        return models

    async def list_ollama_models(self, include_remote: bool = True) -> List[ModelInfo]:
        """List Ollama models (local and remote)"""
        models = []

        # Get local models
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.ollama_url}/api/tags")
                if response.status_code == 200:
                    data = response.json()
                    for model in data.get("models", []):
                        name = model.get("name", "")
                        size_bytes = model.get("size", 0)
                        models.append(
                            ModelInfo(
                                name=name,
                                type=ModelType.OLLAMA,
                                size_gb=size_bytes / (1024**3) if size_bytes else None,
                                is_downloaded=True,
                                description=model.get("details", {}).get("description"),
                            )
                        )
        except Exception as e:
            logger.error(f"Failed to list local Ollama models: {e}")

        # Get available models from Ollama library
        if include_remote:
            # Common models that can be pulled
            remote_models = [
                ("llama3.3:70b", 40.0, "Latest Llama 3.3 70B model"),
                ("llama3.3:7b", 4.0, "Latest Llama 3.3 7B model"),
                ("qwen2.5:32b", 18.0, "Qwen 2.5 32B - excellent for coding"),
                ("qwen2.5:14b", 8.0, "Qwen 2.5 14B - balanced performance"),
                ("deepseek-r1:70b", 40.0, "DeepSeek R1 70B - advanced reasoning"),
                ("deepseek-r1:32b", 18.0, "DeepSeek R1 32B"),
                ("mistral:7b-instruct", 4.0, "Mistral 7B Instruct"),
                ("mixtral:8x7b", 26.0, "Mixtral 8x7B MoE"),
                ("command-r:35b", 20.0, "Command-R 35B"),
                ("liquid/lfm-7b", 4.0, "Liquid Foundation Model 7B"),
                ("liquid/lfm-40b", 23.0, "Liquid Foundation Model 40B"),
            ]

            # Check which ones are not downloaded
            downloaded_names = {m.name for m in models}
            for name, size, desc in remote_models:
                if name not in downloaded_names:
                    models.append(
                        ModelInfo(
                            name=name,
                            type=ModelType.OLLAMA,
                            size_gb=size,
                            is_downloaded=False,
                            description=desc,
                        )
                    )

        return models

    async def list_liquid_models(self) -> List[ModelInfo]:
        """List available Liquid models"""
        models = []

        # Check if Liquid models are available through Ollama
        ollama_models = await self.list_ollama_models(include_remote=False)
        ollama_names = {m.name for m in ollama_models}

        liquid_catalog = [
            ("liquid/lfm-7b", 4.0, "Liquid Foundation Model 7B - Efficient general purpose"),
            ("liquid/lfm-40b", 23.0, "Liquid Foundation Model 40B - High performance"),
            ("liquid-ai/liquid-3b", 2.0, "Liquid 3B - Fast and efficient"),
        ]

        for name, size, desc in liquid_catalog:
            models.append(
                ModelInfo(
                    name=name,
                    type=ModelType.LIQUID,
                    size_gb=size,
                    is_downloaded=name in ollama_names,
                    description=desc,
                    capabilities=["reasoning", "coding", "analysis"],
                )
            )

        return models

    async def list_mlx_models(self) -> List[ModelInfo]:
        """List MLX-optimized models for Apple Silicon"""
        models = []

        # MLX models from various sources
        mlx_catalog = [
            ("mlx-community/Qwen2.5-7B-Instruct-MLX", 4.2, "Qwen 2.5 7B optimized for MLX"),
            ("mlx-community/Llama-3.3-8B-Instruct-MLX", 4.8, "Llama 3.3 8B for MLX"),
            ("mlx-community/Mistral-7B-Instruct-v0.3-MLX", 4.0, "Mistral 7B v0.3 for MLX"),
            ("mlx-community/DeepSeek-Coder-7B-MLX", 4.0, "DeepSeek Coder optimized for MLX"),
            ("mlx-community/Phi-3-mini-4k-MLX", 2.3, "Phi-3 Mini for MLX"),
        ]

        # Check which MLX models might be available locally
        # This would need actual MLX integration to check properly
        for name, size, desc in mlx_catalog:
            models.append(
                ModelInfo(
                    name=name,
                    type=ModelType.MLX,
                    size_gb=size,
                    is_downloaded=False,  # Would need MLX library to check
                    description=desc,
                    capabilities=["fast_inference", "fine_tuning", "apple_silicon_optimized"],
                )
            )

        return models

    async def download_model(self, model_name: str, progress_callback=None) -> bool:
        """Download a model"""
        logger.info(f"📥 Downloading model: {model_name}")

        try:
            # Determine model type
            if any(model_name.startswith(prefix) for prefix in self.LIQUID_MODELS):
                return await self._download_liquid_model(model_name, progress_callback)
            elif any(re.match(pattern, model_name) for pattern in self.MLX_MODELS):
                return await self._download_mlx_model(model_name, progress_callback)
            else:
                # Default to Ollama
                return await self._download_ollama_model(model_name, progress_callback)

        except Exception as e:
            logger.error(f"Failed to download {model_name}: {e}")
            return False

    async def _download_ollama_model(self, model_name: str, progress_callback=None) -> bool:
        """Download an Ollama model"""
        try:
            # Use subprocess to run ollama pull
            process = await asyncio.create_subprocess_exec(
                "ollama",
                "pull",
                model_name,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            # Stream output
            while True:
                line = await process.stdout.readline()
                if not line:
                    break

                output = line.decode().strip()
                if output and progress_callback:
                    # Parse progress from ollama output
                    if "pulling" in output.lower():
                        progress_callback({"status": "downloading", "message": output})
                    elif "%" in output:
                        # Extract percentage
                        match = re.search(r"(\d+)%", output)
                        if match:
                            percent = int(match.group(1))
                            progress_callback({"status": "downloading", "progress": percent})

                logger.debug(f"Ollama: {output}")

            await process.wait()

            if process.returncode == 0:
                logger.info(f"✅ Successfully downloaded {model_name}")
                if progress_callback:
                    progress_callback({"status": "complete", "message": f"Downloaded {model_name}"})
                return True
            else:
                stderr = await process.stderr.read()
                logger.error(f"Failed to download {model_name}: {stderr.decode()}")
                return False

        except FileNotFoundError:
            logger.error("Ollama CLI not found. Please install Ollama.")
            return False

    async def _download_liquid_model(self, model_name: str, progress_callback=None) -> bool:
        """Download a Liquid model (through Ollama if available)"""
        # Liquid models might be available through Ollama
        return await self._download_ollama_model(model_name, progress_callback)

    async def _download_mlx_model(self, model_name: str, progress_callback=None) -> bool:
        """Download an MLX model"""
        # This would require MLX library integration
        logger.warning(f"MLX model download not yet implemented for {model_name}")
        if progress_callback:
            progress_callback(
                {
                    "status": "error",
                    "message": "MLX integration required for downloading MLX models",
                }
            )
        return False

    async def delete_model(self, model_name: str) -> bool:
        """Delete a model"""
        logger.info(f"🗑️ Deleting model: {model_name}")

        try:
            # For Ollama models
            async with httpx.AsyncClient() as client:
                response = await client.delete(
                    f"{self.ollama_url}/api/delete", json={"name": model_name}
                )

                if response.status_code == 200:
                    logger.info(f"✅ Successfully deleted {model_name}")
                    return True
                else:
                    logger.error(f"Failed to delete {model_name}: {response.text}")
                    return False

        except Exception as e:
            logger.error(f"Error deleting {model_name}: {e}")
            return False

    async def get_model_info(self, model_name: str) -> Optional[ModelInfo]:
        """Get detailed information about a specific model"""
        try:
            # Check Ollama
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.ollama_url}/api/show", json={"name": model_name}
                )

                if response.status_code == 200:
                    data = response.json()
                    return ModelInfo(
                        name=model_name,
                        type=ModelType.OLLAMA,
                        size_gb=data.get("size", 0) / (1024**3),
                        is_downloaded=True,
                        description=data.get("details", {}).get("description"),
                        capabilities=self._infer_capabilities(model_name),
                    )
        except Exception as e:
            logger.debug(f"Could not get info for {model_name}: {e}")

        return None

    def _infer_capabilities(self, model_name: str) -> List[str]:
        """Infer model capabilities from name"""
        capabilities = ["text_generation"]

        name_lower = model_name.lower()

        if "coder" in name_lower or "code" in name_lower:
            capabilities.append("coding")
        if "instruct" in name_lower or "chat" in name_lower:
            capabilities.append("instruction_following")
        if any(size in name_lower for size in ["70b", "40b", "32b", "34b"]):
            capabilities.extend(["advanced_reasoning", "complex_tasks"])
        if "liquid" in name_lower:
            capabilities.extend(["efficient_inference", "adaptive_computation"])
        if "mlx" in name_lower:
            capabilities.extend(["apple_silicon_optimized", "fine_tuning"])
        if "embed" in name_lower:
            capabilities = ["embeddings"]

        return capabilities

    async def recommend_model(
        self, task_type: str, constraints: Dict[str, Any] = None
    ) -> Optional[str]:
        """Recommend a model based on task and constraints"""
        constraints = constraints or {}
        max_size_gb = constraints.get("max_size_gb", 50)
        require_local = constraints.get("require_local", True)
        prefer_fast = constraints.get("prefer_fast", False)

        all_models = await self.list_all_models(include_remote=not require_local)
        candidates = []

        # Flatten all models
        for provider, models in all_models.items():
            for model in models:
                if require_local and not model.is_downloaded:
                    continue
                if model.size_gb and model.size_gb > max_size_gb:
                    continue

                # Score based on task
                score = 0

                # Task-specific scoring
                if (
                    task_type == "coding"
                    and "coding" in (model.capabilities or [])
                    or task_type == "reasoning"
                    and any(
                        c in (model.capabilities or []) for c in ["reasoning", "advanced_reasoning"]
                    )
                ):
                    score += 10
                elif task_type == "fast_inference":
                    if model.size_gb and model.size_gb < 5:
                        score += 10
                    if "mlx" in model.name.lower():
                        score += 5

                # Size preference
                if prefer_fast and model.size_gb:
                    score += max(0, 10 - model.size_gb)  # Smaller is better for speed

                # Special model bonuses
                if "liquid" in model.name.lower():
                    score += 3  # Liquid models are efficient
                if "qwen" in model.name.lower() and task_type == "coding":
                    score += 5  # Qwen is excellent for coding

                candidates.append((score, model))

        # Sort by score
        candidates.sort(reverse=True, key=lambda x: x[0])

        if candidates:
            best_score, best_model = candidates[0]
            logger.info(f"📋 Recommended model: {best_model.name} (score: {best_score})")
            return best_model.name

        return None


# Singleton instance
model_manager = ModelManager()


if __name__ == "__main__":
    # Test the model manager
    async def test():
        print("🧪 Testing Model Manager")
        print("=" * 50)

        manager = ModelManager()

        # List all models
        print("\n📋 Available Models:")
        all_models = await manager.list_all_models()

        for provider, models in all_models.items():
            print(f"\n{provider.upper()}:")
            for model in models[:5]:  # Show first 5
                status = "✅" if model.is_downloaded else "⬇️"
                size = f"{model.size_gb:.1f}GB" if model.size_gb else "Unknown"
                print(f"  {status} {model.name} ({size})")
                if model.description:
                    print(f"     {model.description}")

        # Test recommendations
        print("\n🎯 Model Recommendations:")

        tasks = [
            ("coding", {"max_size_gb": 10, "prefer_fast": True}),
            ("reasoning", {"max_size_gb": 50}),
            ("fast_inference", {"max_size_gb": 5, "prefer_fast": True}),
        ]

        for task, constraints in tasks:
            rec = await manager.recommend_model(task, constraints)
            print(f"\nTask: {task}")
            print(f"Constraints: {constraints}")
            print(f"Recommendation: {rec or 'No suitable model found'}")

        print("\n" + "=" * 50)
        print("✅ Model manager test complete!")

    # Run the test
    asyncio.run(test())
