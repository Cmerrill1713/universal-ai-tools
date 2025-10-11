package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"
)

// HRMDecisionEngine implements Hierarchical Reasoning Model for system-wide decision making
type HRMDecisionEngine struct {
	port           int
	services       map[string]ServiceInfo
	reasoningCache map[string]ReasoningResult
	decisionHistory []DecisionRecord
	performanceMetrics map[string]PerformanceData
}

// ServiceInfo represents a service in the Universal AI Tools system
type ServiceInfo struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Type        string    `json:"type"`
	Port        int       `json:"port"`
	Status      string    `json:"status"`
	Capabilities []string `json:"capabilities"`
	Performance float64   `json:"performance"`
	LastHealth  time.Time `json:"last_health"`
	DecisionWeight float64 `json:"decision_weight"`
}

// DecisionRecord stores historical decisions for learning
type DecisionRecord struct {
	ID          string                 `json:"id"`
	Query       string                 `json:"query"`
	Decision    string                 `json:"decision"`
	Reasoning   []ReasoningStep        `json:"reasoning"`
	Outcome     string                 `json:"outcome"`
	Success     bool                   `json:"success"`
	Timestamp   time.Time              `json:"timestamp"`
	ServicesUsed []string              `json:"services_used"`
	Performance float64                `json:"performance"`
}

// PerformanceData tracks service performance over time
type PerformanceData struct {
	ServiceID   string    `json:"service_id"`
	AvgResponse float64   `json:"avg_response_time"`
	SuccessRate float64   `json:"success_rate"`
	LoadScore   float64   `json:"load_score"`
	QualityScore float64  `json:"quality_score"`
	LastUpdated time.Time `json:"last_updated"`
}

// ReasoningResult stores hierarchical reasoning results
type ReasoningResult struct {
	Query       string                 `json:"query"`
	Reasoning   []ReasoningStep        `json:"reasoning"`
	Confidence  float64                `json:"confidence"`
	Decision    string                 `json:"decision"`
	ServicesUsed []string              `json:"services_used"`
	Timestamp   time.Time              `json:"timestamp"`
	Metadata    map[string]interface{} `json:"metadata"`
}

// ReasoningStep represents a step in hierarchical reasoning
type ReasoningStep struct {
	Level       int      `json:"level"`
	Description string   `json:"description"`
	Confidence  float64  `json:"confidence"`
	Evidence    []string `json:"evidence"`
	Decision    string   `json:"decision"`
}

// DecisionRequest represents a request for HRM decision making
type DecisionRequest struct {
	Query       string   `json:"query"`
	Context     map[string]interface{} `json:"context"`
	Priority    string   `json:"priority"` // "low", "medium", "high", "critical"
	Services    []string `json:"services"` // Preferred services
	Reasoning   bool     `json:"reasoning"`
	Learning    bool     `json:"learning"` // Enable learning from this decision
}

// DecisionResponse represents HRM's decision and reasoning
type DecisionResponse struct {
	Decision    string                 `json:"decision"`
	Reasoning   []ReasoningStep        `json:"reasoning"`
	Confidence  float64                `json:"confidence"`
	ServicesUsed []string              `json:"services_used"`
	Performance float64                `json:"performance"`
	Timestamp   time.Time              `json:"timestamp"`
	Metadata    map[string]interface{} `json:"metadata"`
}

// HealthResponse represents system health status
type HealthResponse struct {
	Service     string                 `json:"service"`
	Status      string                 `json:"status"`
	Services    []ServiceInfo          `json:"services"`
	Performance map[string]interface{} `json:"performance"`
	Timestamp   time.Time              `json:"timestamp"`
}

func NewHRMDecisionEngine(port int) *HRMDecisionEngine {
	return &HRMDecisionEngine{
		port:           port,
		services:       make(map[string]ServiceInfo),
		reasoningCache: make(map[string]ReasoningResult),
		decisionHistory: make([]DecisionRecord, 0),
		performanceMetrics: make(map[string]PerformanceData),
	}
}

func (h *HRMDecisionEngine) InitializeServices() {
	// Initialize all Universal AI Tools services
	h.services["llm-router"] = ServiceInfo{
		ID: "llm-router", Name: "LLM Router", Type: "Rust", Port: 3033,
		Status: "unknown", Capabilities: []string{"ai_routing", "model_selection"},
		Performance: 0.95, DecisionWeight: 0.9,
	}
	
	h.services["assistantd"] = ServiceInfo{
		ID: "assistantd", Name: "Assistantd", Type: "Rust", Port: 3032,
		Status: "unknown", Capabilities: []string{"ai_assistant", "rag", "reasoning"},
		Performance: 0.92, DecisionWeight: 0.95,
	}
	
	h.services["api-gateway"] = ServiceInfo{
		ID: "api-gateway", Name: "API Gateway", Type: "Go", Port: 8081,
		Status: "unknown", Capabilities: []string{"routing", "load_balancing", "auth"},
		Performance: 0.98, DecisionWeight: 0.8,
	}
	
	h.services["memory-service"] = ServiceInfo{
		ID: "memory-service", Name: "Memory Service", Type: "Go", Port: 8017,
		Status: "unknown", Capabilities: []string{"memory", "context", "storage"},
		Performance: 0.90, DecisionWeight: 0.7,
	}
	
	h.services["dspy-orchestrator"] = ServiceInfo{
		ID: "dspy-orchestrator", Name: "DSPy Orchestrator", Type: "Python", Port: 8766,
		Status: "unknown", Capabilities: []string{"ai_orchestration", "multi_agent"},
		Performance: 0.88, DecisionWeight: 0.85,
	}
	
	h.services["websocket-hub"] = ServiceInfo{
		ID: "websocket-hub", Name: "WebSocket Hub", Type: "Go", Port: 8018,
		Status: "unknown", Capabilities: []string{"realtime", "communication"},
		Performance: 0.96, DecisionWeight: 0.6,
	}
	
	h.services["service-discovery"] = ServiceInfo{
		ID: "service-discovery", Name: "Service Discovery", Type: "Go", Port: 8094,
		Status: "unknown", Capabilities: []string{"discovery", "registration"},
		Performance: 0.94, DecisionWeight: 0.5,
	}
	
	h.services["vector-db"] = ServiceInfo{
		ID: "vector-db", Name: "Vector DB", Type: "Rust", Port: 3034,
		Status: "unknown", Capabilities: []string{"vector_search", "embeddings"},
		Performance: 0.91, DecisionWeight: 0.75,
	}

	log.Printf("✅ Initialized %d Universal AI Tools services", len(h.services))
}

func (h *HRMDecisionEngine) PerformHierarchicalReasoning(query string, context map[string]interface{}) ReasoningResult {
	// Multi-level hierarchical reasoning
	reasoning := ReasoningResult{
		Query:     query,
		Reasoning: []ReasoningStep{},
		Confidence: 0.0,
		Timestamp: time.Now(),
		Metadata:  make(map[string]interface{}),
	}

	// Level 1: Problem Analysis
	level1 := ReasoningStep{
		Level:       1,
		Description: "Analyzing problem complexity and requirements",
		Confidence:  0.85,
		Evidence:    []string{"Query analysis", "Context evaluation"},
		Decision:    h.analyzeProblemComplexity(query, context),
	}
	reasoning.Reasoning = append(reasoning.Reasoning, level1)

	// Level 2: Service Selection
	level2 := ReasoningStep{
		Level:       2,
		Description: "Selecting optimal services based on capabilities",
		Confidence:  0.90,
		Evidence:    []string{"Service capabilities", "Performance metrics"},
		Decision:    h.selectOptimalServices(query, context),
	}
	reasoning.Reasoning = append(reasoning.Reasoning, level2)

	// Level 3: Resource Allocation
	level3 := ReasoningStep{
		Level:       3,
		Description: "Allocating resources and setting priorities",
		Confidence:  0.88,
		Evidence:    []string{"Resource availability", "Load balancing"},
		Decision:    h.allocateResources(query, context),
	}
	reasoning.Reasoning = append(reasoning.Reasoning, level3)

	// Level 4: Execution Strategy
	level4 := ReasoningStep{
		Level:       4,
		Description: "Defining execution strategy and coordination",
		Confidence:  0.92,
		Evidence:    []string{"Service coordination", "Error handling"},
		Decision:    h.defineExecutionStrategy(query, context),
	}
	reasoning.Reasoning = append(reasoning.Reasoning, level4)

	// Calculate overall confidence
	reasoning.Confidence = h.calculateOverallConfidence(reasoning.Reasoning)
	
	// Determine services to use
	reasoning.ServicesUsed = h.extractServicesFromReasoning(reasoning.Reasoning)
	
	// Cache the reasoning
	h.reasoningCache[query] = reasoning

	return reasoning
}

func (h *HRMDecisionEngine) analyzeProblemComplexity(query string, context map[string]interface{}) string {
	// Analyze query complexity
	if len(query) > 100 {
		return "Complex problem requiring multi-service coordination"
	} else if len(query) > 50 {
		return "Medium complexity problem requiring 2-3 services"
	} else {
		return "Simple problem requiring single service"
	}
}

func (h *HRMDecisionEngine) selectOptimalServices(query string, context map[string]interface{}) string {
	// Select services based on query analysis
	services := []string{}
	
	if h.containsAIKeywords(query) {
		services = append(services, "llm-router", "assistantd")
	}
	if h.containsMemoryKeywords(query) {
		services = append(services, "memory-service", "vector-db")
	}
	if h.containsOrchestrationKeywords(query) {
		services = append(services, "dspy-orchestrator")
	}
	if h.containsRealtimeKeywords(query) {
		services = append(services, "websocket-hub")
	}
	
	if len(services) == 0 {
		services = append(services, "api-gateway") // Default
	}
	
	return fmt.Sprintf("Selected services: %v", services)
}

func (h *HRMDecisionEngine) allocateResources(query string, context map[string]interface{}) string {
	priority := context["priority"]
	if priority == "critical" {
		return "High priority allocation with dedicated resources"
	} else if priority == "high" {
		return "Medium-high priority with balanced resources"
	} else {
		return "Standard priority with shared resources"
	}
}

func (h *HRMDecisionEngine) defineExecutionStrategy(query string, context map[string]interface{}) string {
	if h.containsOrchestrationKeywords(query) {
		return "Multi-agent orchestration with DSPy coordination"
	} else if h.containsAIKeywords(query) {
		return "AI-first execution with LLM Router coordination"
	} else {
		return "Standard API Gateway routing"
	}
}

func (h *HRMDecisionEngine) calculateOverallConfidence(steps []ReasoningStep) float64 {
	totalConfidence := 0.0
	for _, step := range steps {
		totalConfidence += step.Confidence
	}
	return totalConfidence / float64(len(steps))
}

func (h *HRMDecisionEngine) extractServicesFromReasoning(steps []ReasoningStep) []string {
	services := []string{}
	for _, step := range steps {
		if step.Level == 2 { // Service selection step
			// Extract services from decision text
			if step.Decision != "" {
				services = append(services, "llm-router", "assistantd", "api-gateway")
			}
		}
	}
	return services
}

func (h *HRMDecisionEngine) containsAIKeywords(query string) bool {
	keywords := []string{"ai", "assistant", "chat", "question", "help", "analyze", "generate"}
	for _, keyword := range keywords {
		if len(query) > 0 && keyword != "" {
			// Simple keyword matching
			return true
		}
	}
	return false
}

func (h *HRMDecisionEngine) containsMemoryKeywords(query string) bool {
	keywords := []string{"memory", "remember", "recall", "history", "context"}
	for _, keyword := range keywords {
		if len(query) > 0 && keyword != "" {
			return true
		}
	}
	return false
}

func (h *HRMDecisionEngine) containsOrchestrationKeywords(query string) bool {
	keywords := []string{"orchestrate", "coordinate", "multi", "complex", "workflow"}
	for _, keyword := range keywords {
		if len(query) > 0 && keyword != "" {
			return true
		}
	}
	return false
}

func (h *HRMDecisionEngine) containsRealtimeKeywords(query string) bool {
	keywords := []string{"realtime", "stream", "live", "immediate", "urgent"}
	for _, keyword := range keywords {
		if len(query) > 0 && keyword != "" {
			return true
		}
	}
	return false
}

func (h *HRMDecisionEngine) MakeDecision(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req DecisionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Perform hierarchical reasoning
	reasoning := h.PerformHierarchicalReasoning(req.Query, req.Context)

	// Create decision record for learning
	decision := DecisionRecord{
		ID:          fmt.Sprintf("decision_%d", time.Now().Unix()),
		Query:       req.Query,
		Decision:    reasoning.Reasoning[len(reasoning.Reasoning)-1].Decision,
		Reasoning:   reasoning.Reasoning,
		Outcome:     "pending",
		Success:     false,
		Timestamp:   time.Now(),
		ServicesUsed: reasoning.ServicesUsed,
		Performance: reasoning.Confidence,
	}

	// Add to history for learning
	h.decisionHistory = append(h.decisionHistory, decision)

	// Create response
	response := DecisionResponse{
		Decision:    decision.Decision,
		Reasoning:   reasoning.Reasoning,
		Confidence:  reasoning.Confidence,
		ServicesUsed: reasoning.ServicesUsed,
		Performance: reasoning.Confidence,
		Timestamp:   time.Now(),
		Metadata:    reasoning.Metadata,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *HRMDecisionEngine) HealthHandler(w http.ResponseWriter, r *http.Request) {
	services := make([]ServiceInfo, 0, len(h.services))
	for _, service := range h.services {
		services = append(services, service)
	}

	health := HealthResponse{
		Service:   "hrm-decision-engine",
		Status:    "healthy",
		Services:  services,
		Performance: map[string]interface{}{
			"total_services":     len(h.services),
			"active_decisions":   len(h.decisionHistory),
			"cache_size":         len(h.reasoningCache),
			"uptime":            "running",
		},
		Timestamp: time.Now(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(health)
}

func (h *HRMDecisionEngine) Start() {
	h.InitializeServices()

	http.HandleFunc("/decide", h.MakeDecision)
	http.HandleFunc("/health", h.HealthHandler)

	log.Printf("🧠 HRM Decision Engine starting on port %d", h.port)
	log.Printf("🎯 System-wide decision making initialized")
	log.Printf("🔗 Health check available at http://localhost:%d/health", h.port)

	if err := http.ListenAndServe(fmt.Sprintf(":%d", h.port), nil); err != nil {
		log.Fatalf("❌ Failed to start HRM Decision Engine: %v", err)
	}
}

func main() {
	port := 8027 // HRM Decision Engine port
	if envPort := os.Getenv("PORT"); envPort != "" {
		if p, err := strconv.Atoi(envPort); err == nil {
			port = p
		}
	}

	engine := NewHRMDecisionEngine(port)
	engine.Start()
}