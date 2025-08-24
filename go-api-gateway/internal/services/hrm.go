// HRM-MLX Service Client
// Provides integration with the Hierarchical Reasoning Model service

package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"go.uber.org/zap"
	"universal-ai-tools/go-api-gateway/internal/config"
)

// HRMService represents the HRM-MLX service client
type HRMService struct {
	config    *config.Config
	logger    *zap.Logger
	client    *http.Client
	endpoint  string
}

// HRMReasoningRequest represents a request to the HRM reasoning endpoint
type HRMReasoningRequest struct {
	TaskType            string                 `json:"task_type"`
	InputData           map[string]interface{} `json:"input_data"`
	MaxSteps            int                    `json:"max_steps,omitempty"`
	Temperature         float64                `json:"temperature,omitempty"`
	AdaptiveComputation bool                   `json:"adaptive_computation,omitempty"`
}

// HRMReasoningStep represents a single step in hierarchical reasoning
type HRMReasoningStep struct {
	Level      string                 `json:"level"`
	StepNumber int                    `json:"step_number"`
	Content    string                 `json:"content"`
	Confidence float64                `json:"confidence"`
	Metadata   map[string]interface{} `json:"metadata"`
}

// HRMReasoningResponse represents the response from HRM reasoning
type HRMReasoningResponse struct {
	Success        bool                 `json:"success"`
	Result         map[string]interface{} `json:"result"`
	ReasoningSteps []HRMReasoningStep   `json:"reasoning_steps"`
	TotalSteps     int                  `json:"total_steps"`
	InferenceTimeMS float64             `json:"inference_time_ms"`
	ModelInfo      map[string]interface{} `json:"model_info"`
}

// HRMHealthResponse represents the health check response
type HRMHealthResponse struct {
	Status                string            `json:"status"`
	ModelLoaded           bool              `json:"model_loaded"`
	AppleSiliconOptimized bool              `json:"apple_silicon_optimized"`
	MemoryUsageGB         float64           `json:"memory_usage_gb"`
	DeviceInfo            map[string]string `json:"device_info"`
}

// HRMModelInfo represents model information response
type HRMModelInfo struct {
	ModelName          string   `json:"model_name"`
	Version            string   `json:"version"`
	Parameters         string   `json:"parameters"`
	Architecture       string   `json:"architecture"`
	Optimization       string   `json:"optimization"`
	Capabilities       []string `json:"capabilities"`
	TrainingEfficiency string   `json:"training_efficiency"`
	InferenceSpeed     string   `json:"inference_speed"`
	MemoryFootprint    string   `json:"memory_footprint"`
}

// NewHRMService creates a new HRM service client
func NewHRMService(cfg *config.Config, logger *zap.Logger, portManager *PortManager) *HRMService {
	endpoint := "http://localhost:8085" // Default endpoint
	
	// Try to use dynamic port allocation if port manager is available
	if portManager != nil {
		if allocation := portManager.GetPortAllocation("hrm-mlx-service"); allocation != nil {
			endpoint = fmt.Sprintf("http://localhost:%d", allocation.Port)
			logger.Info("Using existing HRM port allocation",
				zap.Int("port", allocation.Port),
				zap.String("status", allocation.Status))
		} else {
			// Allocate a new port for HRM service
			preferredPort := 8085
			allocation, err := portManager.AllocatePort("hrm-mlx-service", "ml", &preferredPort)
			if err != nil {
				logger.Warn("Failed to allocate dynamic port for HRM service, using default",
					zap.Error(err),
					zap.Int("default_port", 8085))
			} else {
				endpoint = fmt.Sprintf("http://localhost:%d", allocation.Port)
				logger.Info("Allocated dynamic port for HRM service",
					zap.Int("port", allocation.Port),
					zap.String("service_type", allocation.ServiceType))
			}
		}
	}
	
	// Override with config if explicitly set
	if cfg.HRM.Endpoint != "" {
		endpoint = cfg.HRM.Endpoint
	}

	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	logger.Info("HRM-MLX service client initialized",
		zap.String("endpoint", endpoint))

	return &HRMService{
		config:   cfg,
		logger:   logger,
		client:   client,
		endpoint: endpoint,
	}
}

// Health checks the health of the HRM service
func (h *HRMService) Health(ctx context.Context) (*HRMHealthResponse, error) {
	url := fmt.Sprintf("%s/health", h.endpoint)
	
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create health request: %w", err)
	}

	resp, err := h.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to check HRM health: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HRM health check failed with status %d", resp.StatusCode)
	}

	var healthResponse HRMHealthResponse
	if err := json.NewDecoder(resp.Body).Decode(&healthResponse); err != nil {
		return nil, fmt.Errorf("failed to decode health response: %w", err)
	}

	return &healthResponse, nil
}

// GetModelInfo retrieves information about the HRM model
func (h *HRMService) GetModelInfo(ctx context.Context) (*HRMModelInfo, error) {
	url := fmt.Sprintf("%s/model/info", h.endpoint)
	
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create model info request: %w", err)
	}

	resp, err := h.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get model info: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("model info request failed with status %d: %s", resp.StatusCode, body)
	}

	var modelInfo HRMModelInfo
	if err := json.NewDecoder(resp.Body).Decode(&modelInfo); err != nil {
		return nil, fmt.Errorf("failed to decode model info: %w", err)
	}

	return &modelInfo, nil
}

// PerformReasoning executes hierarchical reasoning on a given task
func (h *HRMService) PerformReasoning(ctx context.Context, req *HRMReasoningRequest) (*HRMReasoningResponse, error) {
	// Set defaults if not specified
	if req.MaxSteps == 0 {
		req.MaxSteps = 10
	}
	if req.Temperature == 0 {
		req.Temperature = 0.7
	}
	req.AdaptiveComputation = true

	url := fmt.Sprintf("%s/reasoning", h.endpoint)
	
	jsonData, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal reasoning request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create reasoning request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	h.logger.Info("Performing HRM reasoning",
		zap.String("task_type", req.TaskType),
		zap.Int("max_steps", req.MaxSteps))

	resp, err := h.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to perform reasoning: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("reasoning request failed with status %d: %s", resp.StatusCode, body)
	}

	var reasoningResponse HRMReasoningResponse
	if err := json.NewDecoder(resp.Body).Decode(&reasoningResponse); err != nil {
		return nil, fmt.Errorf("failed to decode reasoning response: %w", err)
	}

	h.logger.Info("HRM reasoning completed",
		zap.String("task_type", req.TaskType),
		zap.Int("total_steps", reasoningResponse.TotalSteps),
		zap.Float64("inference_time_ms", reasoningResponse.InferenceTimeMS),
		zap.Bool("success", reasoningResponse.Success))

	return &reasoningResponse, nil
}

// SolveSudoku solves a Sudoku puzzle using hierarchical reasoning
func (h *HRMService) SolveSudoku(ctx context.Context, puzzle [][]int) (*HRMReasoningResponse, error) {
	req := &HRMReasoningRequest{
		TaskType: "sudoku",
		InputData: map[string]interface{}{
			"puzzle": puzzle,
		},
		MaxSteps:            20,
		AdaptiveComputation: true,
	}

	return h.PerformReasoning(ctx, req)
}

// SolveMaze solves a maze navigation problem
func (h *HRMService) SolveMaze(ctx context.Context, maze [][]int, start, goal []int) (*HRMReasoningResponse, error) {
	req := &HRMReasoningRequest{
		TaskType: "maze",
		InputData: map[string]interface{}{
			"maze":  maze,
			"start": start,
			"goal":  goal,
		},
		MaxSteps:            15,
		AdaptiveComputation: true,
	}

	return h.PerformReasoning(ctx, req)
}

// SolveARC solves an ARC (Abstraction and Reasoning Corpus) task
func (h *HRMService) SolveARC(ctx context.Context, trainExamples []interface{}, testInput interface{}) (*HRMReasoningResponse, error) {
	req := &HRMReasoningRequest{
		TaskType: "arc",
		InputData: map[string]interface{}{
			"train": trainExamples,
			"test": map[string]interface{}{
				"input": testInput,
			},
		},
		MaxSteps:            25,
		AdaptiveComputation: true,
	}

	return h.PerformReasoning(ctx, req)
}

// PerformPlanning executes multi-step strategic planning
func (h *HRMService) PerformPlanning(ctx context.Context, goal string, constraints []string, resources map[string]interface{}) (*HRMReasoningResponse, error) {
	req := &HRMReasoningRequest{
		TaskType: "planning",
		InputData: map[string]interface{}{
			"goal":        goal,
			"constraints": constraints,
			"resources":   resources,
		},
		MaxSteps:            30,
		AdaptiveComputation: true,
	}

	return h.PerformReasoning(ctx, req)
}

// EnhanceLLMPrompt uses HRM to structure and enhance LLM prompts with hierarchical reasoning
func (h *HRMService) EnhanceLLMPrompt(ctx context.Context, query, context string, complexity string) (*HRMReasoningResponse, error) {
	if complexity == "" {
		complexity = "medium"
	}

	req := &HRMReasoningRequest{
		TaskType: "llm_enhancement",
		InputData: map[string]interface{}{
			"query":      query,
			"context":    context,
			"complexity": complexity,
		},
		MaxSteps:            15,
		Temperature:         0.7,
		AdaptiveComputation: true,
	}

	h.logger.Info("Enhancing LLM prompt with HRM reasoning",
		zap.String("query", query),
		zap.String("complexity", complexity))

	return h.PerformReasoning(ctx, req)
}

// PerformGenericReasoning handles general problem-solving tasks using hierarchical reasoning
func (h *HRMService) PerformGenericReasoning(ctx context.Context, problem string, constraints []string, resources map[string]interface{}) (*HRMReasoningResponse, error) {
	req := &HRMReasoningRequest{
		TaskType: "generic_reasoning",
		InputData: map[string]interface{}{
			"problem":             problem,
			"constraints":         constraints,
			"available_resources": resources,
		},
		MaxSteps:            20,
		Temperature:         0.8,
		AdaptiveComputation: true,
	}

	h.logger.Info("Performing generic hierarchical reasoning",
		zap.String("problem", problem),
		zap.Int("constraints", len(constraints)))

	return h.PerformReasoning(ctx, req)
}