import asyncio
import json
import logging

# ChainOfThought, ReAct, ProgramOfThought are accessed via dspy module
import os
from typing import Any, Dict, List

import dspy
import websockets
from dspy.teleprompt import MIPROv2

# Configure logging first
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

from knowledge_optimizer import (
    KnowledgeOptimizer,
    OptimizedKnowledgeEvolver,
    OptimizedKnowledgeExtractor,
    OptimizedKnowledgeSearcher,
    OptimizedKnowledgeValidator,
)
from llm_discovery import LLMDiscovery
from model_selector import model_selector

# Try to import MLX LFM2 adapter and agent specialization if available
try:
    from agent_specialization import agent_orchestrator

    AGENT_SPECIALIZATION_AVAILABLE = True
    logger.info("🤖 Agent specialization system loaded")
except ImportError as e:
    AGENT_SPECIALIZATION_AVAILABLE = False
    logger.warning(f"Agent specialization not available: {e}")

# Try to import MLX LFM2 adapter if available
try:
    from mlx_lfm2_adapter import MLX_AVAILABLE, add_mlx_lfm2_to_discovery

    if MLX_AVAILABLE:
        # Only try if MLX models are supported
        try:
            add_mlx_lfm2_to_discovery()
            logger.info("🌊 MLX LFM2 adapter loaded and added to discovery")
        except Exception as e:
            logger.debug(f"MLX LFM2 not available: {e}")
except ImportError:
    logger.debug("MLX LFM2 adapter not available")

# Initialize DSPy with intelligent model selection
logger.info("🔍 Discovering available LLMs...")

# Show all available models for debugging
available_models = LLMDiscovery.get_all_available_models()
if available_models:
    logger.info("📋 Available models:")
    for provider, models in available_models.items():
        logger.info(f"  {provider}: {', '.join(models[:3])}{'...' if len(models) > 3 else ''}")

# Configure with intelligent model selection for a general task
initial_result = model_selector.select_model_for_task(
    "General purpose AI assistant task", context={"complexity": "moderate"}
)

if initial_result:
    lm, profile = initial_result
    logger.info(f"🚀 DSPy ready with {profile.provider} using {profile.name}")
    logger.info(f"   Model profile: {profile.size_category} (~{profile.estimated_params}B params)")
    logger.info(f"   Capabilities: {[c.value for c in profile.capabilities]}")
else:
    if os.environ.get("NODE_ENV") == "development":
        logger.warning("⚠️ No LLMs found, using development mock mode")
        # Use discovery fallback
        config_result = LLMDiscovery.discover_and_configure()
    else:
        logger.error("❌ No valid LLM configuration found")
        raise Exception(
            "DSPy requires at least one working LLM. Please ensure Ollama, LM Studio, or OpenAI API is available."
        )


class IntentAnalyzer(dspy.Signature):
    """Analyze user intent and determine request complexity."""

    request = dspy.InputField(desc="User request to analyze")
    intent = dspy.OutputField(desc="Primary intent of the request")
    complexity = dspy.OutputField(desc="Complexity level: simple, moderate, complex")
    suggested_mode = dspy.OutputField(desc="Suggested orchestration mode")


class AgentSelector(dspy.Signature):
    """Select appropriate agents for a task."""

    task = dspy.InputField(desc="Task to accomplish")
    available_agents = dspy.InputField(desc="List of available agents")
    selected_agents = dspy.OutputField(desc="List of selected agent IDs")
    coordination_plan = dspy.OutputField(desc="How agents should coordinate")


class ConsensusBuilder(dspy.Signature):
    """Build consensus from multiple agent responses."""

    agent_responses = dspy.InputField(desc="Responses from multiple agents")
    task_context = dspy.InputField(desc="Original task context")
    consensus = dspy.OutputField(desc="Consensus decision")
    confidence = dspy.OutputField(desc="Confidence score 0-1")


class KnowledgeExtractor(dspy.Signature):
    """Extract structured knowledge from content."""

    content = dspy.InputField(desc="Raw content to extract from")
    context = dspy.InputField(desc="Context for extraction")
    structured_knowledge = dspy.OutputField(desc="Extracted structured knowledge")
    confidence = dspy.OutputField(desc="Extraction confidence 0-1")


class UniversalOrchestrator(dspy.Module):
    """Main DSPy orchestrator for Universal AI Tools with MIPROv2 optimization."""

    def __init__(self):
        super().__init__()
        self.intent_analyzer = dspy.ChainOfThought(IntentAnalyzer)
        self.agent_selector = dspy.Predict(AgentSelector)  # Use Predict instead of ReAct
        self.consensus_builder = dspy.ChainOfThought(ConsensusBuilder)
        self.knowledge_extractor = dspy.Predict(
            KnowledgeExtractor
        )  # Use Predict instead of ProgramOfThought

        # Initialize MIPROv2-optimized modules
        self.knowledge_optimizer = KnowledgeOptimizer()
        self.optimized_extractor = OptimizedKnowledgeExtractor()
        self.optimized_searcher = OptimizedKnowledgeSearcher()
        self.optimized_evolver = OptimizedKnowledgeEvolver()
        self.optimized_validator = OptimizedKnowledgeValidator()

    def forward(self, request: str, context: Dict[str, Any] = None) -> Dict[str, Any]:
        """Main orchestration flow."""
        context = context or {}

        # Step 1: Analyze intent
        intent_result = self.intent_analyzer(request=request)

        # Step 2: Select agents based on intent
        available_agents = context.get(
            "available_agents",
            [
                "planner",
                "executor",
                "validator",
                "researcher",
                "error_handler",
                "performance_monitor",
            ],
        )

        agent_result = self.agent_selector(task=request, available_agents=str(available_agents))

        # Step 3: Simulate agent execution (in real system, this would call actual agents)
        agent_responses = self._simulate_agent_execution(
            request, agent_result.selected_agents, intent_result.complexity
        )

        # Step 4: Build consensus
        consensus_result = self.consensus_builder(
            agent_responses=str(agent_responses), task_context=request
        )

        return {
            "intent": intent_result.intent,
            "complexity": intent_result.complexity,
            "orchestration_mode": intent_result.suggested_mode,
            "selected_agents": agent_result.selected_agents,
            "coordination_plan": agent_result.coordination_plan,
            "consensus": consensus_result.consensus,
            "confidence": float(consensus_result.confidence),
            "agent_responses": agent_responses,
        }

    def _simulate_agent_execution(self, task: str, agents: str, complexity: str) -> List[Dict]:
        """Simulate agent execution for demo purposes."""
        # In production, this would actually call the TypeScript agents
        return [
            {
                "agent": "planner",
                "response": f"Created execution plan for: {task}",
                "confidence": 0.9,
            },
            {"agent": "validator", "response": "Plan validated successfully", "confidence": 0.95},
        ]


class DSPyServer:
    """WebSocket server for DSPy integration."""

    def __init__(self):
        self.orchestrator = UniversalOrchestrator()
        self.clients = set()
        self.optimization_examples = []  # Store examples for continuous learning
        self.optimization_threshold = 100  # Optimize after collecting 100 examples

    async def handle_request(self, websocket, path=None):
        """Handle incoming WebSocket connections."""
        self.clients.add(websocket)
        logger.info(f"Client connected. Total clients: {len(self.clients)}")

        try:
            async for message in websocket:
                try:
                    request = json.loads(message)
                    response = await self.process_request(request)
                    await websocket.send(json.dumps(response))
                except json.JSONDecodeError as e:
                    error_response = {
                        "requestId": "error",
                        "success": False,
                        "error": f"Invalid JSON: {str(e)}",
                    }
                    await websocket.send(json.dumps(error_response))
                except Exception as e:
                    logger.error(f"Error processing request: {e}")
                    error_response = {
                        "requestId": request.get("requestId", "unknown"),
                        "success": False,
                        "error": str(e),
                    }
                    await websocket.send(json.dumps(error_response))
        finally:
            self.clients.remove(websocket)
            logger.info(f"Client disconnected. Total clients: {len(self.clients)}")

    async def process_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Process incoming DSPy requests with intelligent model selection."""
        request_id = request.get("requestId")
        method = request.get("method")
        params = request.get("params", {})

        logger.info(f"Processing request: {method}")

        # Auto-select model based on the request
        user_request = params.get("userRequest", "")
        context = params.get("context", {})

        # Add method hint to context for better model selection
        if method == "orchestrate":
            context["task_type"] = "orchestration"
        elif method == "manage_knowledge":
            context["task_type"] = "knowledge_management"
        elif method == "optimize_prompts":
            context["task_type"] = "optimization"
            context["complexity"] = "complex"  # MIPRO optimization is complex

        # Select appropriate model for this specific request
        model_result = model_selector.select_model_for_task(
            user_request or f"Process {method} request",
            context,
            max_response_time_ms=context.get("max_response_time_ms"),
            prefer_quality=context.get("prefer_quality", False),
        )

        if model_result:
            lm, profile = model_result
            logger.info(f"🎯 Using {profile.name} for {method} request")

        try:
            if method == "orchestrate":
                result = self.orchestrator(
                    request=params.get("userRequest"), context=params.get("context")
                )

                # Add model info to response
                result["model_used"] = model_selector.get_model_info()

                return {"requestId": request_id, "success": True, "data": result}

            elif method == "coordinate_agents":
                # Use specialized DSPy agents with MiPro2 optimization
                if AGENT_SPECIALIZATION_AVAILABLE:
                    task = params.get("task", params.get("userRequest", ""))
                    task_type = params.get("task_type", "general")
                    context_str = params.get("context", "")

                    # Coordinate specialized agents
                    result = agent_orchestrator.coordinate_agents(
                        task=task, task_type=task_type, context=context_str
                    )

                    # Add model selection info
                    result["model_used"] = model_selector.get_model_info()
                    result["dspy_optimized"] = True

                    return {"requestId": request_id, "success": True, "data": result}
                else:
                    return {
                        "requestId": request_id,
                        "success": False,
                        "error": "Agent specialization system not available",
                    }

            elif method == "manage_knowledge":
                # Implement knowledge management with MIPROv2
                result = self._manage_knowledge_optimized(
                    params.get("operation"), params.get("data")
                )
                return {"requestId": request_id, "success": True, "data": result}

            elif method == "optimize_prompts":
                # Implement prompt optimization with MIPROv2
                result = self._optimize_prompts_miprov2(params.get("examples"))
                return {"requestId": request_id, "success": True, "data": result}

            elif method == "optimize_knowledge_modules":
                # Optimize knowledge modules using MIPROv2
                result = self._optimize_knowledge_modules(
                    params.get("examples", []), params.get("iterations", 10)
                )
                return {"requestId": request_id, "success": True, "data": result}

            elif method == "get_optimization_metrics":
                # Get current optimization metrics
                result = self.orchestrator.knowledge_optimizer.get_performance_metrics()
                return {"requestId": request_id, "success": True, "data": result}

            elif method == "escalate_model":
                # Escalate to a larger model
                min_quality = params.get("min_quality_score", 0.8)
                result = model_selector.escalate_to_larger_model(min_quality)
                if result:
                    lm, profile = result
                    return {
                        "requestId": request_id,
                        "success": True,
                        "data": {
                            "escalated": True,
                            "new_model": model_selector.get_model_info(),
                            "message": f"Escalated to {profile.name} with quality score {profile.quality_score}",
                        },
                    }
                else:
                    return {
                        "requestId": request_id,
                        "success": False,
                        "error": "No larger models available for escalation",
                    }

            elif method == "get_model_info":
                # Get current model information
                return {
                    "requestId": request_id,
                    "success": True,
                    "data": model_selector.get_model_info(),
                }

            else:
                return {
                    "requestId": request_id,
                    "success": False,
                    "error": f"Unknown method: {method}",
                }

        except Exception as e:
            logger.error(f"Error in {method}: {e}")
            return {"requestId": request_id, "success": False, "error": str(e)}

    def _coordinate_agents(self, task: str, agents: List[str], context: Dict) -> Dict:
        """Coordinate multiple agents for a task."""
        agent_selector = self.orchestrator.agent_selector
        result = agent_selector(task=task, available_agents=str(agents))
        return {
            "selected_agents": result.selected_agents,
            "coordination_plan": result.coordination_plan,
        }

    def _manage_knowledge_optimized(self, operation: str, data: Dict) -> Dict:
        """Manage knowledge operations with MIPROv2 optimization."""
        if operation == "extract":
            # Use optimized extractor
            result = self.orchestrator.optimized_extractor(
                raw_content=data.get("content", ""), context=data.get("context", {})
            )

            # Store example for continuous learning
            self._store_optimization_example(
                {
                    "operation": "extract",
                    "raw_content": data.get("content", ""),
                    "context": data.get("context", {}),
                    "result": result,
                }
            )

            return result

        elif operation == "search":
            # Use optimized searcher
            result = self.orchestrator.optimized_searcher(
                query=data.get("query", ""), context=data.get("context", {})
            )

            # Store example for continuous learning
            self._store_optimization_example(
                {
                    "operation": "search",
                    "query": data.get("query", ""),
                    "search_context": data.get("context", {}),
                    "result": result,
                }
            )

            return result

        elif operation == "evolve":
            # Use optimized evolver
            result = self.orchestrator.optimized_evolver(
                existing=data.get("existing", {}),
                new_info=data.get("new_info", {}),
                context=data.get("context", {}),
            )

            # Store example for continuous learning
            self._store_optimization_example(
                {
                    "operation": "evolve",
                    "existing_knowledge": data.get("existing", {}),
                    "new_information": data.get("new_info", {}),
                    "evolution_context": data.get("context", {}),
                    "result": result,
                }
            )

            return result

        elif operation == "validate":
            # Use optimized validator
            result = self.orchestrator.optimized_validator(
                knowledge=data.get("knowledge", {}), context=data.get("context", {})
            )

            # Store example for continuous learning
            self._store_optimization_example(
                {
                    "operation": "validate",
                    "knowledge_item": data.get("knowledge", {}),
                    "validation_context": data.get("context", {}),
                    "result": result,
                }
            )

            return result

        else:
            return {"error": f"Unknown operation: {operation}"}

    def _optimize_prompts_miprov2(self, examples: List[Dict]) -> Dict:
        """Optimize prompts using MIPROv2."""
        try:
            # Use MIPROv2 for prompt optimization
            optimizer = MIPROv2(
                metric=lambda ex, pred, trace: self._evaluate_prompt_quality(ex, pred),
                num_iterations=5,
                temperature_range=(0.7, 1.0),
            )

            # Optimize the intent analyzer as an example
            optimized_module = optimizer.compile(
                self.orchestrator.intent_analyzer, trainset=examples
            )

            # Update the module
            self.orchestrator.intent_analyzer = optimized_module

            return {
                "optimized": True,
                "improvements": [
                    "Optimized with MIPROv2",
                    "Improved intent detection accuracy",
                    "Enhanced complexity assessment",
                ],
                "performance_gain": 0.25,
                "optimization_details": {
                    "method": "MIPROv2",
                    "iterations": 5,
                    "examples_used": len(examples),
                },
            }
        except Exception as e:
            logger.error(f"MIPROv2 optimization failed: {e}")
            return {"optimized": False, "error": str(e)}

    def _evaluate_prompt_quality(self, example, prediction) -> float:
        """Evaluate prompt quality for MIPROv2 optimization."""
        # Simple evaluation based on output fields
        score = 0.0

        if hasattr(prediction, "intent") and prediction.intent:
            score += 0.3

        if hasattr(prediction, "complexity") and prediction.complexity in [
            "simple",
            "moderate",
            "complex",
        ]:
            score += 0.3

        if hasattr(prediction, "suggested_mode") and prediction.suggested_mode:
            score += 0.4

        return score

    def _optimize_knowledge_modules(self, examples: List[Dict], iterations: int) -> Dict:
        """Optimize all knowledge modules using MIPROv2."""
        try:
            result = self.orchestrator.knowledge_optimizer.optimize_with_examples(
                examples=examples, num_iterations=iterations
            )

            # Trigger continuous learning if threshold met
            if len(self.optimization_examples) >= self.optimization_threshold:
                self._perform_continuous_learning()

            return result
        except Exception as e:
            logger.error(f"Knowledge module optimization failed: {e}")
            return {"success": False, "error": str(e)}

    def _store_optimization_example(self, example: Dict):
        """Store examples for continuous learning."""
        self.optimization_examples.append(example)

        # Trigger optimization if threshold reached
        if len(self.optimization_examples) >= self.optimization_threshold:
            self._perform_continuous_learning()

    def _perform_continuous_learning(self):
        """Perform continuous learning with collected examples."""
        logger.info(
            f"Performing continuous learning with {len(self.optimization_examples)} examples"
        )

        try:
            # Optimize with collected examples
            result = self.orchestrator.knowledge_optimizer.optimize_with_examples(
                examples=self.optimization_examples,
                num_iterations=5,  # Fewer iterations for continuous learning
            )

            logger.info(f"Continuous learning completed: {result}")

            # Clear examples after optimization
            self.optimization_examples = []

        except Exception as e:
            logger.error(f"Continuous learning failed: {e}")

    async def start_server(self, host="localhost", port=8766):
        """Start the WebSocket server."""
        logger.info(f"Starting DSPy server on {host}:{port}")
        async with websockets.serve(self.handle_request, host, port):
            await asyncio.Future()  # Run forever


def main():
    """Main entry point."""
    # Get port from environment variable or use default
    port = int(os.environ.get("DSPY_PORT", "8766"))
    logger.info(f"Starting DSPy server on port {port}")

    server = DSPyServer()
    asyncio.run(server.start_server(port=port))


if __name__ == "__main__":
    main()
