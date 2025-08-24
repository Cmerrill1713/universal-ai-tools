"""
Type definitions for DSPy orchestrator service.
Provides TypedDict classes for better type safety with DSPy result objects.
"""

from typing import Any, Optional, TypedDict, Union


class DSPyBaseResult(TypedDict, total=False):
    """Base result type for DSPy predictions"""
    reasoning: Optional[str]
    confidence: Optional[float]


class IntentAnalysisResult(DSPyBaseResult):
    """Result from intent analysis"""
    intent: str
    assumptions: str
    constraints: str
    complexity: str
    suggested_mode: str


class ChallengeResult(DSPyBaseResult):
    """Result from devil's advocate challenges"""
    challenges: str
    risks: str
    alternatives: str


class EthicsResult(DSPyBaseResult):
    """Result from ethics check"""
    ethical_concerns: str
    recommendations: str


class PlanningResult(DSPyBaseResult):
    """Result from planning agent"""
    detailed_plan: str
    steps: str
    dependencies: str


class ResourceResult(DSPyBaseResult):
    """Result from resource manager"""
    required_resources: str
    availability: str
    alternatives: str


class SynthesisResult(DSPyBaseResult):
    """Result from synthesis agent"""
    integrated_approach: str


class ExecutionResult(DSPyBaseResult):
    """Result from execution agent"""
    execution_steps: str
    commands: Optional[str]


class ReflectionResult(DSPyBaseResult):
    """Result from reflection agent"""
    learnings: str
    improvements: str
    next_steps: str


class ValidationResult(DSPyBaseResult):
    """Result from validation agent"""
    quality_score: Union[str, float]
    validation_status: str
    approved: Optional[bool]
    issues: Optional[list[str]]
    suggestions: Optional[list[str]]
    security_issues: Optional[list[str]]
    security_severity: Optional[str]


class ReportResult(DSPyBaseResult):
    """Result from reporting agent"""
    final_report: str
    key_insights: str


class CodingResult(DSPyBaseResult):
    """Result from coding agent"""
    code: str
    explanation: str
    improvements: Optional[str]
    agent_type: str


class UIDesignResult(DSPyBaseResult):
    """Result from UI design agent"""
    component_code: str
    styling: str
    explanation: str
    ux_improvements: Optional[list[str]]
    accessibility: Optional[list[str]]
    agent_type: str
    framework: str


class DevilsAdvocateResult(DSPyBaseResult):
    """Result from devil's advocate agent"""
    concerns: list[str]
    alternatives: list[str]
    questions: list[str]
    risks: list[str]
    mitigations: list[str]
    agent_type: str
    challenge_level: str


class ComplexityAnalysisResult(DSPyBaseResult):
    """Result from complexity analysis"""
    complexity_score: Union[str, float]
    # reasoning is inherited from DSPyBaseResult


class ModeSelectionResult(DSPyBaseResult):
    """Result from mode selection"""
    mode: str
    justification: str


class AgentSelectionResult(DSPyBaseResult):
    """Result from agent selection"""
    selected_agents: str
    coordination_plan: str


class ConsensusResult(DSPyBaseResult):
    """Result from consensus building"""
    consensus: str
    # confidence is inherited from DSPyBaseResult


class KnowledgeExtractionResult(DSPyBaseResult):
    """Result from knowledge extraction"""
    facts: str
    relationships: str
    insights: str
    structured_knowledge: Optional[str]


class KnowledgeValidationResult(DSPyBaseResult):
    """Result from knowledge validation"""
    validity_score: Union[str, float]
    concerns: str


class KnowledgeEvolutionResult(DSPyBaseResult):
    """Result from knowledge evolution"""
    evolved_knowledge: str


class QueryOptimizationResult(DSPyBaseResult):
    """Result from query optimization"""
    optimized_query: str
    search_strategy: str


class RelevanceScoreResult(DSPyBaseResult):
    """Result from relevance scoring"""
    relevance_score: Union[str, float]


class CognitiveAnalysis(TypedDict):
    """Complete cognitive analysis result"""
    intent: str
    assumptions: str
    constraints: str
    challenges: str
    risks: str
    ethical_concerns: str
    plan: str
    resources: str
    synthesis: str
    execution: str
    learnings: str
    validation_score: float
    final_report: str
    key_insights: str


class OrchestrationMetadata(TypedDict):
    """Metadata for orchestration results"""
    timestamp: str
    reasoning_mode: str
    agent_count: int


class CognitiveReasoningChainResult(TypedDict):
    """Complete result from cognitive reasoning chain"""
    cognitive_analysis: CognitiveAnalysis
    metadata: OrchestrationMetadata


class AgentResponse(TypedDict):
    """Response from an individual agent"""
    agent: str
    response: str
    confidence: float


class TaskAnalysis(TypedDict):
    """Analysis of a task breakdown"""
    subtasks: str
    dependencies: str
    priority: str


class AgentAssignment(TypedDict):
    """Assignment of agent to subtask"""
    subtask: str
    agent: str
    confidence: float


class TaskCoordinationResult(TypedDict):
    """Result from task coordination"""
    task_analysis: TaskAnalysis
    agent_assignments: list[AgentAssignment]
    coordination_plan: str
    consensus: str
    confidence: float


class KnowledgeSearchResult(TypedDict):
    """Result from knowledge search"""
    query: str
    optimized_query: str
    strategy: str
    results: list[dict[str, Any]]


class KnowledgeExtractionFull(TypedDict):
    """Full knowledge extraction result"""
    facts: str
    relationships: str
    insights: str
    validity_score: float
    concerns: str


class KnowledgeEvolutionFull(TypedDict):
    """Full knowledge evolution result"""
    evolved_knowledge: str
    changes: list[str]


class OrchestrationResult(TypedDict):
    """Main orchestration result"""
    intent: str
    complexity: str
    orchestration_mode: str
    selected_agents: str
    coordination_plan: str
    consensus: str
    confidence: float
    agent_responses: list[AgentResponse]


class ModelInfo(TypedDict):
    """Information about the current model"""
    name: str
    provider: str
    size: str
    estimated_params: str
    capabilities: list[str]
    speed_score: float
    quality_score: float
    response_time_ms: Optional[float]


class AgentCoordinationResults(TypedDict):
    """Results from agent coordination"""
    task: str
    task_type: str
    context: str
    agents_used: list[str]
    results: dict[str, Any]
    consensus: bool
    iterations: int
    final_output: Optional[str]
    error: Optional[str]


class OptimizationExample(TypedDict):
    """Training example for optimization"""
    input: dict[str, Any]
    output: dict[str, Any]
    quality: float
    timestamp: str


class OptimizationDetails(TypedDict):
    """Details about optimization process"""
    method: str
    iterations: int
    examples_used: int


class PromptOptimizationResult(TypedDict):
    """Result from prompt optimization"""
    optimized: bool
    improvements: list[str]
    performance_gain: float
    optimization_details: OptimizationDetails
    error: Optional[str]


class DSPyServerResponse(TypedDict):
    """Standard DSPy server response"""
    requestId: str
    success: bool
    data: Optional[dict[str, Any]]
    error: Optional[str]
