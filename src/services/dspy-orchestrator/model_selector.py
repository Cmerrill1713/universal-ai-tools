"""
Intelligent Model Selection System
Automatically selects the best model based on task requirements and performance needs
"""

import httpx
import logging
import time
from typing import List, Dict, Optional, Tuple, Any
from dataclasses import dataclass
from enum import Enum
import os
import re
import dspy
from llm_discovery import LLMDiscovery

logger = logging.getLogger(__name__)


class TaskComplexity(Enum):
    """Task complexity levels"""
    SIMPLE = "simple"        # Basic Q&A, simple completions
    MODERATE = "moderate"    # Multi-step reasoning, analysis
    COMPLEX = "complex"      # Code generation, complex reasoning
    CRITICAL = "critical"    # High-stakes decisions, production code


class ModelCapability(Enum):
    """Model capabilities"""
    BASIC = "basic"          # Simple text generation
    REASONING = "reasoning"  # Chain of thought, analysis
    CODING = "coding"        # Code generation and analysis
    ADVANCED = "advanced"    # Complex multi-modal tasks


@dataclass
class ModelProfile:
    """Profile for each available model"""
    name: str
    provider: str
    size_category: str  # small, medium, large, xlarge
    estimated_params: float  # in billions
    capabilities: List[ModelCapability]
    speed_score: float  # 0-1, higher is faster
    quality_score: float  # 0-1, higher is better
    cost_score: float  # 0-1, lower is cheaper (1 = free)
    is_available: bool = False
    response_time_ms: Optional[float] = None
    

class ModelSelector:
    """Intelligent model selection based on task requirements"""
    
    # Model profiles based on common naming patterns
    MODEL_PROFILES = {
        # Small models (< 3B) - Fast, basic tasks
        r"(gemma|phi|qwen).*[0-2]\.[0-9]b": {
            "size": "small", "params": 2, "speed": 0.9, "quality": 0.5,
            "capabilities": [ModelCapability.BASIC]
        },
        r"llama.*3\.2.*1b": {
            "size": "small", "params": 1, "speed": 0.95, "quality": 0.4,
            "capabilities": [ModelCapability.BASIC]
        },
        r"liquid.*3b": {
            "size": "small", "params": 3, "speed": 0.85, "quality": 0.6,
            "capabilities": [ModelCapability.BASIC, ModelCapability.REASONING]
        },
        r"lfm2.*1\.2b": {
            "size": "small", "params": 1.2, "speed": 0.92, "quality": 0.55,
            "capabilities": [ModelCapability.BASIC, ModelCapability.REASONING]
        },
        
        # Medium models (3-7B) - Balanced
        r"(llama|mistral|gemma).*3b": {
            "size": "medium", "params": 3, "speed": 0.8, "quality": 0.6,
            "capabilities": [ModelCapability.BASIC, ModelCapability.REASONING]
        },
        r"(qwen|mistral|llama).*7b": {
            "size": "medium", "params": 7, "speed": 0.7, "quality": 0.7,
            "capabilities": [ModelCapability.BASIC, ModelCapability.REASONING]
        },
        r"liquid.*7b|lfm.*7b": {
            "size": "medium", "params": 7, "speed": 0.75, "quality": 0.75,
            "capabilities": [ModelCapability.BASIC, ModelCapability.REASONING, ModelCapability.CODING]
        },
        
        # Large models (8-15B) - Quality focused
        r"(deepseek|qwen|mistral).*1[0-4]b": {
            "size": "large", "params": 13, "speed": 0.5, "quality": 0.8,
            "capabilities": [ModelCapability.BASIC, ModelCapability.REASONING, ModelCapability.CODING]
        },
        r"nous.*hermes.*13b": {
            "size": "large", "params": 13, "speed": 0.5, "quality": 0.8,
            "capabilities": [ModelCapability.BASIC, ModelCapability.REASONING]
        },
        
        # Extra large models (20B+) - Maximum quality
        r"(devstral|deepseek).*2[0-9]b": {
            "size": "xlarge", "params": 24, "speed": 0.3, "quality": 0.9,
            "capabilities": [ModelCapability.BASIC, ModelCapability.REASONING, ModelCapability.CODING, ModelCapability.ADVANCED]
        },
        
        # Specialized models
        r".*embed.*": {
            "size": "small", "params": 0.5, "speed": 0.99, "quality": 0.3,
            "capabilities": [ModelCapability.BASIC]
        },
        r".*coder.*": {
            "size": "medium", "params": 7, "speed": 0.6, "quality": 0.8,
            "capabilities": [ModelCapability.CODING, ModelCapability.REASONING]
        },
    }
    
    def __init__(self):
        self.available_models: Dict[str, ModelProfile] = {}
        self.performance_cache: Dict[str, float] = {}
        self.current_model: Optional[Tuple[Any, ModelProfile]] = None
        self.discovery = LLMDiscovery()
        
    def analyze_task(self, task: str, context: Dict[str, Any] = None) -> Tuple[TaskComplexity, List[ModelCapability]]:
        """Analyze task to determine complexity and required capabilities"""
        context = context or {}
        
        # Keywords for different complexity levels
        simple_keywords = ["what is", "define", "list", "name", "simple", "basic", "hello"]
        moderate_keywords = ["explain", "analyze", "compare", "summarize", "describe how"]
        complex_keywords = ["implement", "design", "optimize", "debug", "create a system", "architect"]
        critical_keywords = ["production", "security", "critical", "financial", "medical", "legal"]
        
        # Keywords for capabilities
        coding_keywords = ["code", "function", "implement", "debug", "program", "script", "api"]
        reasoning_keywords = ["why", "how", "analyze", "reason", "think through", "step by step"]
        
        task_lower = task.lower()
        
        # Determine complexity
        complexity = TaskComplexity.SIMPLE
        if any(kw in task_lower for kw in critical_keywords):
            complexity = TaskComplexity.CRITICAL
        elif any(kw in task_lower for kw in complex_keywords):
            complexity = TaskComplexity.COMPLEX
        elif any(kw in task_lower for kw in moderate_keywords):
            complexity = TaskComplexity.MODERATE
        elif any(kw in task_lower for kw in simple_keywords):
            complexity = TaskComplexity.SIMPLE
        
        # Check context hints
        if context.get("complexity"):
            complexity = TaskComplexity(context["complexity"])
        
        # Determine required capabilities
        capabilities = [ModelCapability.BASIC]
        if any(kw in task_lower for kw in coding_keywords):
            capabilities.append(ModelCapability.CODING)
        if any(kw in task_lower for kw in reasoning_keywords):
            capabilities.append(ModelCapability.REASONING)
        if complexity == TaskComplexity.CRITICAL:
            capabilities.append(ModelCapability.ADVANCED)
        
        logger.info(f"Task analysis: complexity={complexity.value}, capabilities={[c.value for c in capabilities]}")
        return complexity, capabilities
    
    def profile_model(self, model_name: str, provider: str) -> ModelProfile:
        """Create a profile for a model based on its name and characteristics"""
        # Default profile
        profile = ModelProfile(
            name=model_name,
            provider=provider,
            size_category="medium",
            estimated_params=7,
            capabilities=[ModelCapability.BASIC],
            speed_score=0.5,
            quality_score=0.5,
            cost_score=1.0  # Assume all local models are free
        )
        
        # Match against known patterns
        model_lower = model_name.lower()
        for pattern, characteristics in self.MODEL_PROFILES.items():
            if re.search(pattern, model_lower):
                profile.size_category = characteristics["size"]
                profile.estimated_params = characteristics["params"]
                profile.speed_score = characteristics["speed"]
                profile.quality_score = characteristics["quality"]
                profile.capabilities = characteristics["capabilities"]
                break
        
        # Special handling for specific providers
        if provider == "OpenAI":
            profile.cost_score = 0.1  # Paid API
            profile.quality_score = min(0.95, profile.quality_score + 0.2)
        elif "Remote" in provider:
            profile.speed_score *= 0.8  # Network latency
        
        return profile
    
    def benchmark_model(self, model_name: str, provider: str, lm: Any) -> float:
        """Benchmark a model's response time"""
        try:
            start = time.time()
            response = lm("Complete this: The sky is")
            end = time.time()
            response_time = (end - start) * 1000  # ms
            logger.debug(f"Benchmarked {model_name}: {response_time:.0f}ms")
            return response_time
        except Exception as e:
            logger.debug(f"Benchmark failed for {model_name}: {e}")
            return 10000  # High penalty for failed models
    
    def discover_and_profile_models(self) -> Dict[str, ModelProfile]:
        """Discover all available models and create profiles"""
        logger.info("🔍 Discovering and profiling available models...")
        
        all_models = self.discovery.get_all_available_models()
        profiles = {}
        
        for provider, models in all_models.items():
            for model in models:
                profile = self.profile_model(model, provider)
                profile.is_available = True
                
                # Cache key for this model
                cache_key = f"{provider}:{model}"
                
                # Use cached performance data if available
                if cache_key in self.performance_cache:
                    profile.response_time_ms = self.performance_cache[cache_key]
                
                profiles[cache_key] = profile
        
        logger.info(f"📊 Profiled {len(profiles)} available models")
        return profiles
    
    def select_model_for_task(
        self, 
        task: str, 
        context: Dict[str, Any] = None,
        max_response_time_ms: Optional[float] = None,
        prefer_quality: bool = False
    ) -> Optional[Tuple[Any, ModelProfile]]:
        """Select the best model for a given task"""
        
        # Analyze task requirements
        complexity, required_capabilities = self.analyze_task(task, context)
        
        # Get available models
        self.available_models = self.discover_and_profile_models()
        
        # Filter models by capabilities
        suitable_models = []
        for key, profile in self.available_models.items():
            # Check if model has required capabilities
            has_capabilities = all(cap in profile.capabilities for cap in required_capabilities)
            if not has_capabilities and complexity != TaskComplexity.SIMPLE:
                continue
            
            # Check complexity requirements
            if complexity == TaskComplexity.CRITICAL and profile.quality_score < 0.8:
                continue
            elif complexity == TaskComplexity.COMPLEX and profile.quality_score < 0.7:
                continue
            
            suitable_models.append((key, profile))
        
        if not suitable_models:
            logger.warning("No suitable models found for task requirements")
            suitable_models = list(self.available_models.items())
        
        # Score and rank models
        scored_models = []
        for key, profile in suitable_models:
            # Calculate composite score
            if prefer_quality:
                score = (profile.quality_score * 0.7 + 
                        profile.speed_score * 0.2 + 
                        profile.cost_score * 0.1)
            else:
                score = (profile.speed_score * 0.5 + 
                        profile.quality_score * 0.4 + 
                        profile.cost_score * 0.1)
            
            # Adjust for task complexity
            if complexity == TaskComplexity.SIMPLE:
                score += profile.speed_score * 0.2  # Prefer faster models
            elif complexity == TaskComplexity.CRITICAL:
                score += profile.quality_score * 0.3  # Prefer quality
            
            scored_models.append((score, key, profile))
        
        # Sort by score (highest first)
        scored_models.sort(reverse=True, key=lambda x: x[0])
        
        # Try models in order until one works
        for score, key, profile in scored_models:
            provider, model_name = key.split(":", 1)
            
            logger.info(f"🎯 Trying {model_name} (score: {score:.2f}, quality: {profile.quality_score:.1f}, speed: {profile.speed_score:.1f})")
            
            try:
                # Configure the model
                if provider == "Ollama" or provider == "Ollama Proxy":
                    base_url = "http://localhost:11434" if provider == "Ollama" else "http://localhost:8080"
                    lm = dspy.LM(f"ollama_chat/{model_name}", 
                                api_base=base_url, 
                                api_key="")
                else:  # OpenAI-compatible
                    if "Remote" in provider:
                        base_url = os.environ.get("REMOTE_LLM_URL", "http://192.168.1.179:5901")
                    else:
                        base_url = os.environ.get("LM_STUDIO_URL", "http://localhost:1234")
                    
                    lm = dspy.LM(f"openai/{model_name}", 
                                api_base=f"{base_url}/v1",
                                api_key="lm-studio" if "Studio" in provider else "")
                
                # Quick test
                test_response = lm("Hi")
                
                # Benchmark if needed
                if key not in self.performance_cache:
                    response_time = self.benchmark_model(model_name, provider, lm)
                    self.performance_cache[key] = response_time
                    profile.response_time_ms = response_time
                
                # Check response time constraint
                if max_response_time_ms and profile.response_time_ms > max_response_time_ms:
                    logger.info(f"⏱️ {model_name} too slow ({profile.response_time_ms:.0f}ms > {max_response_time_ms}ms)")
                    continue
                
                # Configure DSPy
                dspy.configure(lm=lm)
                
                logger.info(f"✅ Selected {model_name} for {complexity.value} task")
                self.current_model = (lm, profile)
                return lm, profile
                
            except Exception as e:
                logger.debug(f"Failed to configure {model_name}: {e}")
                continue
        
        logger.error("❌ No models could be configured")
        return None
    
    def escalate_to_larger_model(self, min_quality_score: float = 0.8) -> Optional[Tuple[Any, ModelProfile]]:
        """Escalate to a larger model when needed"""
        logger.info(f"📈 Escalating to larger model (min quality: {min_quality_score})")
        
        # Get current model quality
        current_quality = 0
        if self.current_model:
            _, current_profile = self.current_model
            current_quality = current_profile.quality_score
        
        # Find better models
        better_models = []
        for key, profile in self.available_models.items():
            if profile.quality_score > current_quality and profile.quality_score >= min_quality_score:
                better_models.append((profile.quality_score, key, profile))
        
        if not better_models:
            logger.warning("No better models available for escalation")
            return None
        
        # Sort by quality
        better_models.sort(reverse=True, key=lambda x: x[0])
        
        # Try the best available
        for quality, key, profile in better_models:
            provider, model_name = key.split(":", 1)
            result = self.select_model_for_task(
                "Complex task requiring high quality",
                context={"complexity": "critical"},
                prefer_quality=True
            )
            if result:
                return result
        
        return None
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about currently selected model"""
        if not self.current_model:
            return {"status": "No model selected"}
        
        _, profile = self.current_model
        return {
            "name": profile.name,
            "provider": profile.provider,
            "size": profile.size_category,
            "estimated_params": f"{profile.estimated_params}B",
            "capabilities": [c.value for c in profile.capabilities],
            "speed_score": profile.speed_score,
            "quality_score": profile.quality_score,
            "response_time_ms": profile.response_time_ms
        }


# Singleton instance
model_selector = ModelSelector()


# Integration with DSPy server
def auto_select_model(task: str = None, context: Dict = None) -> Optional[Tuple[Any, str, str]]:
    """Automatically select best model for the task"""
    if not task:
        task = "General purpose task"
    
    result = model_selector.select_model_for_task(task, context)
    if result:
        lm, profile = result
        return lm, profile.provider, profile.name
    return None


if __name__ == "__main__":
    # Test the model selector
    print("🧪 Testing Intelligent Model Selection")
    print("=" * 50)
    
    # Test different task types
    test_tasks = [
        ("What is 2+2?", {}),
        ("Explain quantum computing in simple terms", {}),
        ("Write a Python function to sort a list using quicksort", {}),
        ("Design a production-ready microservices architecture", {"complexity": "critical"}),
        ("Hi", {"max_response_time_ms": 500})  # Speed requirement
    ]
    
    selector = ModelSelector()
    
    for task, context in test_tasks:
        print(f"\n📝 Task: {task}")
        if context:
            print(f"   Context: {context}")
        
        # Extract kwargs from context
        kwargs = {k: v for k, v in context.items() if k in ['max_response_time_ms', 'prefer_quality']}
        result = selector.select_model_for_task(task, context, **kwargs)
        if result:
            lm, profile = result
            print(f"✅ Selected: {profile.name}")
            print(f"   Provider: {profile.provider}")
            print(f"   Size: {profile.size_category} (~{profile.estimated_params}B params)")
            print(f"   Quality: {profile.quality_score:.1f}/1.0")
            print(f"   Speed: {profile.speed_score:.1f}/1.0")
            if profile.response_time_ms:
                print(f"   Response time: {profile.response_time_ms:.0f}ms")
    
    print("\n" + "=" * 50)
    print("✅ Model selection test complete!")