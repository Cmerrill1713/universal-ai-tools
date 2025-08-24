package models

import "time"

// ModelPerformanceGrade represents the A-F grade for an MLX model
type ModelPerformanceGrade struct {
	Grade                 string                 `json:"grade"`
	Score                 float64                `json:"score"`
	GradedAt             time.Time              `json:"graded_at"`
	GradingSystemVersion string                 `json:"grading_system_version"`
	Metrics              ModelMetrics           `json:"metrics"`
	WeightedBreakdown    map[string]float64     `json:"weighted_breakdown"`
	Recommendations      []string               `json:"recommendations"`
	DeploymentApproved   bool                   `json:"deployment_approved"`
	ShouldRetire         bool                   `json:"should_retire"`
	ShouldRetrain        bool                   `json:"should_retrain"`
}

// ModelMetrics contains comprehensive model performance metrics
type ModelMetrics struct {
	DomainAccuracy     float64 `json:"domain_accuracy"`
	BleuScore          float64 `json:"bleu_score"`
	RougeLScore        float64 `json:"rouge_l_score"`
	Perplexity         float64 `json:"perplexity"`
	InferenceTime      float64 `json:"inference_time"`
	MemoryUsageGB      float64 `json:"memory_usage_gb"`
	ResponseRelevance  float64 `json:"response_relevance"`
	CoherenceScore     float64 `json:"coherence_score"`
	ConsistencyScore   float64 `json:"consistency_score"`
}

// ModelDeployment represents a deployed model with full metadata
type ModelDeployment struct {
	DeployedAt       time.Time              `json:"deployed_at"`
	DeploymentMethod string                 `json:"deployment_method"`
	TrainingMetrics  TrainingMetrics        `json:"training_metrics"`
	DataSources      map[string]int         `json:"data_sources"`
	ModelConfig      ModelConfig            `json:"model_config"`
	Performance      PerformanceData        `json:"performance"`
	PerformanceGrade ModelPerformanceGrade  `json:"performance_grade"`
	Status           string                 `json:"status"`
}

// TrainingMetrics contains training-specific metrics
type TrainingMetrics struct {
	TotalExamples    int     `json:"total_examples"`
	Iterations       int     `json:"iterations"`
	FinalLoss        float64 `json:"final_loss"`
	ValidationLoss   float64 `json:"validation_loss"`
	DomainAccuracy   float64 `json:"domain_accuracy"`
}

// ModelConfig contains model configuration details
type ModelConfig struct {
	BaseModel     string  `json:"base_model"`
	LoraLayers    int     `json:"lora_layers"`
	LearningRate  string  `json:"learning_rate"`
	BatchSize     int     `json:"batch_size"`
}

// PerformanceData contains runtime performance metrics
type PerformanceData struct {
	InferenceTimeAvg   string                 `json:"inference_time_avg"`
	MemoryUsage        string                 `json:"memory_usage"`
	AccuracyByCategory map[string]int         `json:"accuracy_by_category"`
}

// ModelStatus represents the status of models across environments
type ModelStatus struct {
	Production *ModelDeployment   `json:"production"`
	Staging    []StagingModel     `json:"staging"`
	Retired    []RetiredModel     `json:"retired"`
	Summary    ModelSummary       `json:"summary"`
}

// StagingModel represents a model in staging for review
type StagingModel struct {
	ModelName        string                `json:"model_name"`
	StagedAt         time.Time             `json:"staged_at"`
	ModelPath        string                `json:"model_path"`
	PerformanceGrade ModelPerformanceGrade `json:"performance_grade"`
	RequiresReview   bool                  `json:"requires_review"`
	Reviewer         *string               `json:"reviewer"`
	ReviewDecision   *string               `json:"review_decision"`
	ReviewNotes      *string               `json:"review_notes"`
}

// RetiredModel represents a retired model
type RetiredModel struct {
	ModelName         string                `json:"model_name"`
	RetiredAt         time.Time             `json:"retired_at"`
	ModelPath         string                `json:"model_path"`
	PerformanceGrade  ModelPerformanceGrade `json:"performance_grade"`
	RetirementReason  string                `json:"retirement_reason"`
	Recommendations   []string              `json:"recommendations"`
}

// ModelSummary contains aggregate statistics
type ModelSummary struct {
	TotalModels      int `json:"total_models"`
	ProductionModels int `json:"production_models"`
	StagingModels    int `json:"staging_models"`
	RetiredModels    int `json:"retired_models"`
}

// GradingConfig represents the grading system configuration
type GradingConfig struct {
	GradingSystemVersion string                    `json:"grading_system_version"`
	Domain               string                    `json:"domain"`
	CreatedAt            string                    `json:"created_at"`
	Weights              map[string]float64        `json:"weights"`
	GradeThresholds      map[string]float64        `json:"grade_thresholds"`
	Normalization        map[string]NormalizationConfig `json:"normalization"`
	DeploymentRules      DeploymentRules           `json:"deployment_rules"`
	DomainSpecificMetrics DomainMetrics           `json:"domain_specific_metrics"`
}

// NormalizationConfig contains metric normalization settings
type NormalizationConfig struct {
	Min    float64 `json:"min"`
	Max    float64 `json:"max"`
	Invert bool    `json:"invert"`
}

// DeploymentRules contains automated deployment rules
type DeploymentRules struct {
	AutoDeployGrades   []string `json:"auto_deploy_grades"`
	ManualReviewGrades []string `json:"manual_review_grades"`
	RejectGrades       []string `json:"reject_grades"`
	AutoRetireGrades   []string `json:"auto_retire_grades"`
}

// DomainMetrics contains domain-specific performance targets
type DomainMetrics struct {
	TargetDomainAccuracy     float64 `json:"target_domain_accuracy"`
	MinimumProductionScore   float64 `json:"minimum_production_score"`
	BenchmarkResponseTime    float64 `json:"benchmark_response_time"`
	MemoryLimitGB           float64 `json:"memory_limit_gb"`
}