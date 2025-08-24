package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"
	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// Agent represents an AI agent instance
type Agent struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Type        string                 `json:"type"`
	Status      AgentStatus            `json:"status"`
	Config      map[string]interface{} `json:"config"`
	CreatedAt   time.Time              `json:"created_at"`
	LastActive  time.Time              `json:"last_active"`
	Capabilities []string              `json:"capabilities"`
	Performance AgentPerformance       `json:"performance"`
}

type AgentStatus string

const (
	StatusIdle     AgentStatus = "idle"
	StatusBusy     AgentStatus = "busy"
	StatusFailed   AgentStatus = "failed"
	StatusOffline  AgentStatus = "offline"
)

type AgentPerformance struct {
	TasksCompleted    int     `json:"tasks_completed"`
	AverageResponseMs float64 `json:"average_response_ms"`
	SuccessRate       float64 `json:"success_rate"`
	LastError         string  `json:"last_error,omitempty"`
}

// Task represents a task to be executed by agents
type Task struct {
	ID          string                 `json:"id"`
	Type        string                 `json:"type"`
	Priority    int                    `json:"priority"`
	Payload     map[string]interface{} `json:"payload"`
	Status      TaskStatus             `json:"status"`
	AssignedTo  string                 `json:"assigned_to,omitempty"`
	CreatedAt   time.Time              `json:"created_at"`
	StartedAt   *time.Time             `json:"started_at,omitempty"`
	CompletedAt *time.Time             `json:"completed_at,omitempty"`
	Result      map[string]interface{} `json:"result,omitempty"`
	Error       string                 `json:"error,omitempty"`
}

type TaskStatus string

const (
	TaskPending    TaskStatus = "pending"
	TaskRunning    TaskStatus = "running"
	TaskCompleted  TaskStatus = "completed"
	TaskFailed     TaskStatus = "failed"
)

// AgentOrchestrator manages all agents and task distribution
type AgentOrchestrator struct {
	agents      map[string]*Agent
	tasks       map[string]*Task
	taskQueue   chan *Task
	redisClient *redis.Client
	logger      *logrus.Logger
	tracer      trace.Tracer
	mu          sync.RWMutex
}

// Prometheus metrics
var (
	agentsTotal = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "agents_total",
			Help: "Total number of agents by status",
		},
		[]string{"status"},
	)
	
	tasksTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "tasks_total",
			Help: "Total number of tasks processed",
		},
		[]string{"type", "status"},
	)
	
	taskDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name: "task_duration_seconds",
			Help: "Time taken to complete tasks",
		},
		[]string{"type"},
	)
	
	agentUtilization = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "agent_utilization",
			Help: "Agent utilization percentage",
		},
		[]string{"agent_id"},
	)
)

func NewAgentOrchestrator() *AgentOrchestrator {
	// Initialize Redis client
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "localhost:6379"
	}
	
	rdb := redis.NewClient(&redis.Options{
		Addr: redisURL,
	})
	
	// Initialize logger
	logger := logrus.New()
	logger.SetLevel(logrus.InfoLevel)
	
	// Initialize tracer
	tracer := otel.Tracer("agent-orchestrator")
	
	orchestrator := &AgentOrchestrator{
		agents:      make(map[string]*Agent),
		tasks:       make(map[string]*Task),
		taskQueue:   make(chan *Task, 1000),
		redisClient: rdb,
		logger:      logger,
		tracer:      tracer,
	}
	
	// Initialize with some default agents
	orchestrator.initializeDefaultAgents()
	
	// Start task processor
	go orchestrator.processTaskQueue()
	
	return orchestrator
}

func (ao *AgentOrchestrator) initializeDefaultAgents() {
	defaultAgents := []struct {
		name         string
		agentType    string
		capabilities []string
	}{
		{"swift-ui-expert", "specialized", []string{"swiftui", "ios", "macos", "ui-design"}},
		{"code-reviewer", "utility", []string{"code-review", "static-analysis", "best-practices"}},
		{"api-debugger", "debugging", []string{"api-testing", "network-debugging", "endpoint-analysis"}},
		{"performance-optimizer", "optimization", []string{"performance-analysis", "bottleneck-detection", "optimization"}},
		{"test-runner", "testing", []string{"test-execution", "test-automation", "ci-cd"}},
		{"rust-pro", "specialized", []string{"rust", "systems-programming", "performance"}},
		{"golang-pro", "specialized", []string{"go", "microservices", "concurrency"}},
		{"python-pro", "specialized", []string{"python", "ml", "data-science"}},
	}
	
	for _, agentDef := range defaultAgents {
		agent := &Agent{
			ID:           uuid.New().String(),
			Name:         agentDef.name,
			Type:         agentDef.agentType,
			Status:       StatusIdle,
			Config:       make(map[string]interface{}),
			CreatedAt:    time.Now(),
			LastActive:   time.Now(),
			Capabilities: agentDef.capabilities,
			Performance: AgentPerformance{
				TasksCompleted:    0,
				AverageResponseMs: 0,
				SuccessRate:       100.0,
			},
		}
		
		ao.agents[agent.ID] = agent
		ao.logger.Infof("Initialized agent: %s (%s)", agent.Name, agent.Type)
	}
	
	ao.updateAgentMetrics()
}

func (ao *AgentOrchestrator) processTaskQueue() {
	for task := range ao.taskQueue {
		go ao.executeTask(task)
	}
}

func (ao *AgentOrchestrator) executeTask(task *Task) {
	ctx, span := ao.tracer.Start(context.Background(), "execute_task")
	defer span.End()
	
	span.SetAttributes(
		attribute.String("task.id", task.ID),
		attribute.String("task.type", task.Type),
		attribute.Int("task.priority", task.Priority),
	)
	
	start := time.Now()
	
	// Find best agent for the task
	agent := ao.findBestAgent(task)
	if agent == nil {
		ao.logger.Errorf("No available agent found for task %s", task.ID)
		task.Status = TaskFailed
		task.Error = "No available agent"
		tasksTotal.WithLabelValues(task.Type, "failed").Inc()
		return
	}
	
	// Assign task to agent
	ao.mu.Lock()
	task.AssignedTo = agent.ID
	task.Status = TaskRunning
	now := time.Now()
	task.StartedAt = &now
	agent.Status = StatusBusy
	ao.mu.Unlock()
	
	ao.logger.Infof("Assigned task %s to agent %s", task.ID, agent.Name)
	
	// Simulate task execution (in real implementation, this would delegate to actual agent services)
	ao.simulateTaskExecution(ctx, task, agent)
	
	// Complete task
	ao.mu.Lock()
	duration := time.Since(start)
	completed := time.Now()
	task.CompletedAt = &completed
	task.Status = TaskCompleted
	agent.Status = StatusIdle
	agent.LastActive = time.Now()
	agent.Performance.TasksCompleted++
	
	// Update performance metrics
	if agent.Performance.AverageResponseMs == 0 {
		agent.Performance.AverageResponseMs = float64(duration.Milliseconds())
	} else {
		agent.Performance.AverageResponseMs = (agent.Performance.AverageResponseMs + float64(duration.Milliseconds())) / 2
	}
	ao.mu.Unlock()
	
	// Update metrics
	tasksTotal.WithLabelValues(task.Type, "completed").Inc()
	taskDuration.WithLabelValues(task.Type).Observe(duration.Seconds())
	ao.updateAgentMetrics()
	
	ao.logger.Infof("Completed task %s in %v", task.ID, duration)
}

func (ao *AgentOrchestrator) findBestAgent(task *Task) *Agent {
	ao.mu.RLock()
	defer ao.mu.RUnlock()
	
	var bestAgent *Agent
	var bestScore float64
	
	for _, agent := range ao.agents {
		if agent.Status != StatusIdle {
			continue
		}
		
		// Calculate agent score based on capabilities and performance
		score := ao.calculateAgentScore(agent, task)
		if score > bestScore {
			bestScore = score
			bestAgent = agent
		}
	}
	
	return bestAgent
}

func (ao *AgentOrchestrator) calculateAgentScore(agent *Agent, task *Task) float64 {
	score := 0.0
	
	// Base score for being available
	score += 10.0
	
	// Capability matching
	taskRequirements := ao.getTaskRequirements(task.Type)
	for _, requirement := range taskRequirements {
		for _, capability := range agent.Capabilities {
			if capability == requirement {
				score += 50.0
			}
		}
	}
	
	// Performance bonus
	score += agent.Performance.SuccessRate / 10.0
	score -= agent.Performance.AverageResponseMs / 1000.0 // Prefer faster agents
	
	return score
}

func (ao *AgentOrchestrator) getTaskRequirements(taskType string) []string {
	requirements := map[string][]string{
		"swift_review":        {"swiftui", "code-review"},
		"api_debug":          {"api-testing", "network-debugging"},
		"performance_check":  {"performance-analysis"},
		"test_execution":     {"test-execution"},
		"rust_development":   {"rust", "systems-programming"},
		"go_development":     {"go", "microservices"},
		"python_analysis":    {"python", "data-science"},
	}
	
	return requirements[taskType]
}

func (ao *AgentOrchestrator) simulateTaskExecution(ctx context.Context, task *Task, agent *Agent) {
	// Simulate processing time based on task complexity
	processingTime := time.Duration(100+task.Priority*50) * time.Millisecond
	
	select {
	case <-time.After(processingTime):
		// Task completed successfully
		task.Result = map[string]interface{}{
			"status":       "success",
			"processed_by": agent.Name,
			"duration_ms":  processingTime.Milliseconds(),
			"timestamp":    time.Now().Unix(),
		}
	case <-ctx.Done():
		// Task cancelled or timed out
		task.Status = TaskFailed
		task.Error = "Task cancelled or timed out"
	}
}

func (ao *AgentOrchestrator) updateAgentMetrics() {
	statusCounts := make(map[AgentStatus]int)
	
	ao.mu.RLock()
	for _, agent := range ao.agents {
		statusCounts[agent.Status]++
		
		// Calculate utilization (simplified)
		utilization := 0.0
		if agent.Status == StatusBusy {
			utilization = 100.0
		}
		agentUtilization.WithLabelValues(agent.ID).Set(utilization)
	}
	ao.mu.RUnlock()
	
	// Update status metrics
	for status, count := range statusCounts {
		agentsTotal.WithLabelValues(string(status)).Set(float64(count))
	}
}

// API Handlers

func (ao *AgentOrchestrator) getHealth(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":     "healthy",
		"service":    "agent-orchestrator",
		"version":    "1.0.0",
		"timestamp":  time.Now().Unix(),
		"agents":     len(ao.agents),
		"tasks":      len(ao.tasks),
		"queue_size": len(ao.taskQueue),
	})
}

func (ao *AgentOrchestrator) listAgents(c *gin.Context) {
	ao.mu.RLock()
	agents := make([]*Agent, 0, len(ao.agents))
	for _, agent := range ao.agents {
		agents = append(agents, agent)
	}
	ao.mu.RUnlock()
	
	c.JSON(http.StatusOK, gin.H{
		"agents": agents,
		"total":  len(agents),
	})
}

func (ao *AgentOrchestrator) createTask(c *gin.Context) {
	var req struct {
		Type     string                 `json:"type" binding:"required"`
		Priority int                    `json:"priority"`
		Payload  map[string]interface{} `json:"payload"`
	}
	
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	task := &Task{
		ID:        uuid.New().String(),
		Type:      req.Type,
		Priority:  req.Priority,
		Payload:   req.Payload,
		Status:    TaskPending,
		CreatedAt: time.Now(),
	}
	
	ao.mu.Lock()
	ao.tasks[task.ID] = task
	ao.mu.Unlock()
	
	// Add to queue
	select {
	case ao.taskQueue <- task:
		ao.logger.Infof("Queued task %s (type: %s, priority: %d)", task.ID, task.Type, task.Priority)
	default:
		ao.logger.Errorf("Task queue full, rejecting task %s", task.ID)
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Task queue full"})
		return
	}
	
	tasksTotal.WithLabelValues(task.Type, "pending").Inc()
	
	c.JSON(http.StatusCreated, gin.H{
		"task_id": task.ID,
		"status":  task.Status,
		"message": "Task queued successfully",
	})
}

func (ao *AgentOrchestrator) getTask(c *gin.Context) {
	taskID := c.Param("id")
	
	ao.mu.RLock()
	task, exists := ao.tasks[taskID]
	ao.mu.RUnlock()
	
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}
	
	c.JSON(http.StatusOK, task)
}

func (ao *AgentOrchestrator) listTasks(c *gin.Context) {
	status := c.Query("status")
	
	ao.mu.RLock()
	tasks := make([]*Task, 0)
	for _, task := range ao.tasks {
		if status == "" || string(task.Status) == status {
			tasks = append(tasks, task)
		}
	}
	ao.mu.RUnlock()
	
	c.JSON(http.StatusOK, gin.H{
		"tasks": tasks,
		"total": len(tasks),
	})
}

func (ao *AgentOrchestrator) getMetrics(c *gin.Context) {
	promhttp.Handler().ServeHTTP(c.Writer, c.Request)
}

func setupRouter(orchestrator *AgentOrchestrator) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery())
	
	// Health check
	router.GET("/health", orchestrator.getHealth)
	
	// Agent management
	router.GET("/agents", orchestrator.listAgents)
	
	// Task management
	router.POST("/tasks", orchestrator.createTask)
	router.GET("/tasks", orchestrator.listTasks)
	router.GET("/tasks/:id", orchestrator.getTask)
	
	// Metrics
	router.GET("/metrics", orchestrator.getMetrics)
	
	return router
}

func main() {
	// Initialize orchestrator
	orchestrator := NewAgentOrchestrator()
	
	// Setup router
	router := setupRouter(orchestrator)
	
	// Get port from environment
	port := os.Getenv("PORT")
	if port == "" {
		port = "8006"
	}
	
	log.Printf("Agent Orchestrator starting on port %s", port)
	log.Printf("Initialized with %d agents", len(orchestrator.agents))
	
	// Start server
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}