"""
Universal HRM Decision Engine
Intelligent decision-making system that can be applied to any decision point in the application
"""

import asyncio
import json
import time
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, asdict
from enum import Enum
import httpx
from datetime import datetime, timedelta

class DecisionType(Enum):
    """Types of decisions the HRM can make"""
    LLM_SELECTION = "llm_selection"
    AGENT_ROUTING = "agent_routing"
    MEMORY_MANAGEMENT = "memory_management"
    RESOURCE_SCALING = "resource_scaling"
    ERROR_RECOVERY = "error_recovery"
    SECURITY_ACCESS = "security_access"
    DATA_PROCESSING = "data_processing"
    UX_OPTIMIZATION = "ux_optimization"
    API_ROUTING = "api_routing"
    MONITORING_ACTION = "monitoring_action"

class DecisionPriority(Enum):
    """Priority levels for decisions"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"
    IMMEDIATE = "immediate"

@dataclass
class DecisionContext:
    """Context information for making decisions"""
    decision_type: DecisionType
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    request_data: Dict[str, Any] = None
    system_state: Dict[str, Any] = None
    historical_data: List[Dict[str, Any]] = None
    constraints: Dict[str, Any] = None
    available_options: List[Dict[str, Any]] = None

@dataclass
class DecisionResult:
    """Result of HRM decision-making"""
    decision_id: str
    selected_option: Dict[str, Any]
    confidence: float
    reasoning_steps: List[str]
    alternative_options: List[Dict[str, Any]]
    estimated_impact: Dict[str, float]
    monitoring_metrics: List[str]
    fallback_strategy: Optional[Dict[str, Any]] = None

class UniversalHRMDecisionEngine:
    """Universal decision engine powered by HRM reasoning"""
    
    def __init__(self, hrm_base_url: str = "http://localhost:8085"):
        self.hrm_base = hrm_base_url.rstrip("/")
        self.client = httpx.AsyncClient(timeout=30.0)
        
        # Decision history for learning
        self.decision_history = []
        self.performance_tracking = {}
        
        # Decision templates for different types
        self.decision_templates = {
            DecisionType.LLM_SELECTION: self._llm_selection_template,
            DecisionType.AGENT_ROUTING: self._agent_routing_template,
            DecisionType.MEMORY_MANAGEMENT: self._memory_management_template,
            DecisionType.RESOURCE_SCALING: self._resource_scaling_template,
            DecisionType.ERROR_RECOVERY: self._error_recovery_template,
            DecisionType.SECURITY_ACCESS: self._security_access_template,
            DecisionType.DATA_PROCESSING: self._data_processing_template,
            DecisionType.UX_OPTIMIZATION: self._ux_optimization_template,
            DecisionType.API_ROUTING: self._api_routing_template,
            DecisionType.MONITORING_ACTION: self._monitoring_action_template,
        }
    
    async def make_decision(self, context: DecisionContext) -> DecisionResult:
        """Make an intelligent decision using HRM reasoning"""
        
        decision_id = f"{context.decision_type.value}_{int(time.time())}"
        
        # Get the appropriate template
        template_func = self.decision_templates.get(context.decision_type)
        if not template_func:
            raise ValueError(f"No template found for decision type: {context.decision_type}")
        
        # Prepare HRM reasoning request
        hrm_request = await template_func(context)
        
        # Use HRM to analyze and decide
        try:
            response = await self.client.post(
                f"{self.hrm_base}/reasoning",
                json=hrm_request
            )
            
            if response.status_code == 200:
                hrm_data = response.json()
                if hrm_data.get("success"):
                    decision_result = await self._process_hrm_decision(
                        decision_id, context, hrm_data
                    )
                    
                    # Track decision for learning
                    self.decision_history.append({
                        "timestamp": datetime.now().isoformat(),
                        "context": asdict(context),
                        "result": asdict(decision_result)
                    })
                    
                    return decision_result
        except Exception as e:
            print(f"HRM decision failed: {e}")
        
        # Fallback to rule-based decision
        return await self._fallback_decision(decision_id, context)
    
    async def _process_hrm_decision(self, decision_id: str, context: DecisionContext, hrm_data: Dict[str, Any]) -> DecisionResult:
        """Process HRM reasoning into decision result"""
        
        result = hrm_data.get("result", {})
        reasoning_steps = hrm_data.get("reasoning_steps", [])
        
        # Extract decision from HRM reasoning (simplified - would be more sophisticated)
        if context.available_options:
            selected_option = context.available_options[0]  # Placeholder logic
            alternatives = context.available_options[1:3]
        else:
            selected_option = {"action": "default", "parameters": {}}
            alternatives = []
        
        return DecisionResult(
            decision_id=decision_id,
            selected_option=selected_option,
            confidence=0.85,  # Would extract from HRM
            reasoning_steps=[step.get("reasoning", "") for step in reasoning_steps],
            alternative_options=alternatives,
            estimated_impact={"performance": 0.1, "cost": -0.05, "reliability": 0.15},
            monitoring_metrics=["response_time", "error_rate", "user_satisfaction"],
            fallback_strategy={"action": "fallback", "trigger": "confidence < 0.5"}
        )
    
    # Decision Templates for Different Types
    
    async def _llm_selection_template(self, context: DecisionContext) -> Dict[str, Any]:
        """Template for LLM selection decisions"""
        return {
            "task_type": "planning",
            "input_data": {
                "prompt": f"Select the best LLM for this request based on complexity, domain, and requirements",
                "decision_context": {
                    "user_query": context.request_data.get("query", ""),
                    "query_complexity": self._assess_complexity(context.request_data.get("query", "")),
                    "domain": context.request_data.get("domain", "general"),
                    "available_models": context.available_options or [],
                    "performance_requirements": context.constraints or {},
                    "user_preferences": context.request_data.get("user_preferences", {})
                },
                "decision_criteria": [
                    "Model capability match",
                    "Response time requirements", 
                    "Cost considerations",
                    "Quality expectations",
                    "Availability and load"
                ]
            },
            "max_steps": 7,
            "temperature": 0.3,  # Lower temperature for more consistent decisions
            "adaptive_computation": True
        }
    
    async def _agent_routing_template(self, context: DecisionContext) -> Dict[str, Any]:
        """Template for agent routing decisions"""
        return {
            "task_type": "planning",
            "input_data": {
                "prompt": "Determine the optimal agent routing strategy for this task",
                "decision_context": {
                    "task_description": context.request_data.get("task", ""),
                    "task_complexity": self._assess_task_complexity(context.request_data),
                    "required_capabilities": context.request_data.get("capabilities", []),
                    "available_agents": context.available_options or [],
                    "system_load": context.system_state or {},
                    "deadline_requirements": context.constraints.get("deadline") if context.constraints else None
                },
                "routing_strategies": [
                    "Single specialized agent",
                    "Sequential agent chain", 
                    "Parallel agent execution",
                    "Hybrid approach with fallbacks"
                ]
            },
            "max_steps": 10,
            "temperature": 0.4
        }
    
    async def _memory_management_template(self, context: DecisionContext) -> Dict[str, Any]:
        """Template for memory management decisions"""
        return {
            "task_type": "planning", 
            "input_data": {
                "prompt": "Optimize memory usage and retention strategy",
                "decision_context": {
                    "memory_pressure": context.system_state.get("memory_usage", 0),
                    "active_sessions": context.system_state.get("active_sessions", 0),
                    "conversation_importance": self._assess_conversation_importance(context),
                    "access_patterns": context.historical_data or [],
                    "storage_costs": context.constraints.get("cost_limits", {}),
                    "retention_policies": context.constraints.get("retention_policies", {})
                },
                "management_actions": [
                    "Archive to long-term storage",
                    "Compress and retain", 
                    "Delete expired content",
                    "Prioritize active conversations",
                    "Implement smart caching"
                ]
            },
            "max_steps": 8,
            "temperature": 0.2
        }
    
    async def _resource_scaling_template(self, context: DecisionContext) -> Dict[str, Any]:
        """Template for resource scaling decisions"""
        return {
            "task_type": "planning",
            "input_data": {
                "prompt": "Determine optimal resource scaling strategy",
                "decision_context": {
                    "current_load": context.system_state.get("cpu_usage", 0),
                    "memory_usage": context.system_state.get("memory_usage", 0), 
                    "request_patterns": context.historical_data or [],
                    "performance_metrics": context.system_state.get("performance", {}),
                    "cost_constraints": context.constraints.get("budget", {}),
                    "sla_requirements": context.constraints.get("sla", {}),
                    "available_resources": context.available_options or []
                },
                "scaling_strategies": [
                    "Scale up current services",
                    "Scale out with new instances",
                    "Optimize current resource usage",
                    "Migrate to different resource types",
                    "Implement resource scheduling"
                ]
            },
            "max_steps": 12,
            "temperature": 0.3
        }
    
    async def _error_recovery_template(self, context: DecisionContext) -> Dict[str, Any]:
        """Template for error recovery decisions"""
        return {
            "task_type": "planning",
            "input_data": {
                "prompt": "Determine the best error recovery strategy",
                "decision_context": {
                    "error_type": context.request_data.get("error_type", "unknown"),
                    "error_severity": context.request_data.get("severity", "medium"),
                    "system_impact": context.system_state.get("impact_assessment", {}),
                    "recovery_options": context.available_options or [],
                    "historical_success_rates": context.historical_data or [],
                    "user_impact": context.request_data.get("user_impact", "low"),
                    "time_constraints": context.constraints.get("recovery_time", {})
                },
                "recovery_strategies": [
                    "Immediate retry with same parameters",
                    "Retry with different approach",
                    "Fallback to alternative service", 
                    "Graceful degradation",
                    "Manual intervention required"
                ]
            },
            "max_steps": 6,
            "temperature": 0.4
        }
    
    # Placeholder implementations for other templates...
    async def _security_access_template(self, context: DecisionContext) -> Dict[str, Any]:
        return {"task_type": "planning", "input_data": {"prompt": "Security access decision"}, "max_steps": 5}
    
    async def _data_processing_template(self, context: DecisionContext) -> Dict[str, Any]:
        return {"task_type": "planning", "input_data": {"prompt": "Data processing decision"}, "max_steps": 5}
    
    async def _ux_optimization_template(self, context: DecisionContext) -> Dict[str, Any]:
        return {"task_type": "planning", "input_data": {"prompt": "UX optimization decision"}, "max_steps": 5}
        
    async def _api_routing_template(self, context: DecisionContext) -> Dict[str, Any]:
        return {"task_type": "planning", "input_data": {"prompt": "API routing decision"}, "max_steps": 5}
    
    async def _monitoring_action_template(self, context: DecisionContext) -> Dict[str, Any]:
        return {"task_type": "planning", "input_data": {"prompt": "Monitoring action decision"}, "max_steps": 5}
    
    # Helper methods
    def _assess_complexity(self, query: str) -> str:
        """Assess query complexity for decision making"""
        if len(query) > 200:
            return "high"
        elif len(query) > 100:
            return "medium"
        return "low"
    
    def _assess_task_complexity(self, request_data: Dict[str, Any]) -> str:
        """Assess task complexity"""
        # Simplified complexity assessment
        return "medium"  # Would implement actual complexity analysis
    
    def _assess_conversation_importance(self, context: DecisionContext) -> str:
        """Assess conversation importance for memory decisions"""
        # Would analyze conversation content, user engagement, etc.
        return "medium"
    
    async def _fallback_decision(self, decision_id: str, context: DecisionContext) -> DecisionResult:
        """Fallback decision when HRM is unavailable"""
        return DecisionResult(
            decision_id=decision_id,
            selected_option={"action": "default", "reason": "fallback_mode"},
            confidence=0.3,
            reasoning_steps=["HRM unavailable, using fallback logic"],
            alternative_options=[],
            estimated_impact={"reliability": -0.1},
            monitoring_metrics=["fallback_usage_rate"]
        )

# Example usage implementations for each decision type

class LLMSelectionDecisionEngine:
    """Specialized decision engine for LLM selection"""
    
    def __init__(self, universal_engine: UniversalHRMDecisionEngine):
        self.engine = universal_engine
    
    async def select_llm(self, user_query: str, available_models: List[Dict], user_preferences: Dict = None) -> str:
        """Select the best LLM for a user query"""
        
        context = DecisionContext(
            decision_type=DecisionType.LLM_SELECTION,
            request_data={
                "query": user_query,
                "user_preferences": user_preferences or {}
            },
            available_options=available_models,
            constraints={"response_time": "< 5s", "cost": "optimize"}
        )
        
        decision = await self.engine.make_decision(context)
        
        return decision.selected_option.get("model_id", "default")

class AgentRoutingDecisionEngine:
    """Specialized decision engine for agent routing"""
    
    def __init__(self, universal_engine: UniversalHRMDecisionEngine):
        self.engine = universal_engine
    
    async def route_to_agents(self, task_description: str, available_agents: List[Dict]) -> List[str]:
        """Route task to optimal agent sequence"""
        
        context = DecisionContext(
            decision_type=DecisionType.AGENT_ROUTING,
            request_data={"task": task_description},
            available_options=available_agents,
            constraints={"deadline": "30s"}
        )
        
        decision = await self.engine.make_decision(context)
        
        return decision.selected_option.get("agent_sequence", ["general-purpose"])

# Demo function
async def demonstrate_universal_decisions():
    """Demonstrate the universal decision engine across different scenarios"""
    
    print("🧠 UNIVERSAL HRM DECISION ENGINE DEMONSTRATION")
    print("=" * 60)
    
    engine = UniversalHRMDecisionEngine()
    
    # 1. LLM Selection Decision
    print("\n🤖 LLM SELECTION DECISION")
    print("-" * 30)
    
    llm_context = DecisionContext(
        decision_type=DecisionType.LLM_SELECTION,
        request_data={
            "query": "Write a complex algorithm for distributed consensus",
            "domain": "computer_science"
        },
        available_options=[
            {"model_id": "claude-3.5", "capabilities": ["reasoning", "coding"], "cost": 0.01},
            {"model_id": "gpt-4", "capabilities": ["general", "creative"], "cost": 0.015},
            {"model_id": "local-llama", "capabilities": ["basic"], "cost": 0.0}
        ],
        constraints={"response_time": "< 5s", "cost": "optimize"}
    )
    
    llm_decision = await engine.make_decision(llm_context)
    print(f"Selected Model: {llm_decision.selected_option}")
    print(f"Confidence: {llm_decision.confidence}")
    print(f"Reasoning: {llm_decision.reasoning_steps[0] if llm_decision.reasoning_steps else 'N/A'}")
    
    # 2. Agent Routing Decision  
    print("\n🎯 AGENT ROUTING DECISION")
    print("-" * 30)
    
    agent_context = DecisionContext(
        decision_type=DecisionType.AGENT_ROUTING,
        request_data={"task": "Fix SwiftUI layout issue and run tests"},
        available_options=[
            {"agent_id": "swift-ui-expert", "specialization": "SwiftUI"},
            {"agent_id": "code-reviewer", "specialization": "code_quality"},
            {"agent_id": "test-runner", "specialization": "testing"}
        ]
    )
    
    agent_decision = await engine.make_decision(agent_context)
    print(f"Selected Route: {agent_decision.selected_option}")
    print(f"Confidence: {agent_decision.confidence}")
    
    # 3. Memory Management Decision
    print("\n💾 MEMORY MANAGEMENT DECISION") 
    print("-" * 30)
    
    memory_context = DecisionContext(
        decision_type=DecisionType.MEMORY_MANAGEMENT,
        system_state={"memory_usage": 0.85, "active_sessions": 150},
        constraints={"cost_limits": {"storage": "$50/month"}}
    )
    
    memory_decision = await engine.make_decision(memory_context)
    print(f"Memory Action: {memory_decision.selected_option}")
    print(f"Estimated Impact: {memory_decision.estimated_impact}")
    
    print(f"\n🎯 SUMMARY: Made {len(engine.decision_history)} intelligent decisions")

if __name__ == "__main__":
    asyncio.run(demonstrate_universal_decisions())