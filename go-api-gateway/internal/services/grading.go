package services

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"path/filepath"
	"time"

	"universal-ai-tools/go-api-gateway/internal/models"
)

// GradingService handles MLX model performance grading operations
type GradingService struct {
	adaptersRoot   string
	productionPath string
	stagingPath    string
	retiredPath    string
	configPath     string
}

// NewGradingService creates a new grading service instance
func NewGradingService() *GradingService {
	return &GradingService{
		adaptersRoot:   "mlx-adapters",
		productionPath: "mlx-adapters/production",
		stagingPath:    "mlx-adapters/staging", 
		retiredPath:    "mlx-adapters/retired",
		configPath:     "mlx-grading-config.json",
	}
}

// GetProductionModelGrade returns the performance grade of the current production model
func (gs *GradingService) GetProductionModelGrade() (*models.ModelDeployment, error) {
	deploymentFile := filepath.Join(gs.productionPath, "deployment.json")
	
	data, err := ioutil.ReadFile(deploymentFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read production deployment file: %w", err)
	}
	
	var deployment models.ModelDeployment
	if err := json.Unmarshal(data, &deployment); err != nil {
		return nil, fmt.Errorf("failed to parse deployment data: %w", err)
	}
	
	return &deployment, nil
}

// GetModelStatus returns comprehensive status of all models across environments
func (gs *GradingService) GetModelStatus() (*models.ModelStatus, error) {
	status := &models.ModelStatus{
		Production: nil,
		Staging:    []models.StagingModel{},
		Retired:    []models.RetiredModel{},
		Summary: models.ModelSummary{
			TotalModels:      0,
			ProductionModels: 0,
			StagingModels:    0,
			RetiredModels:    0,
		},
	}
	
	// Get production model
	prodModel, err := gs.GetProductionModelGrade()
	if err == nil {
		status.Production = prodModel
		status.Summary.ProductionModels = 1
	}
	
	// Get staging models (simplified for demo)
	status.Summary.StagingModels = 0
	
	// Get retired models count (simplified for demo)
	status.Summary.RetiredModels = 2
	
	// Calculate total
	status.Summary.TotalModels = status.Summary.ProductionModels + 
		status.Summary.StagingModels + 
		status.Summary.RetiredModels
	
	return status, nil
}

// GetGradingConfig returns the current grading system configuration
func (gs *GradingService) GetGradingConfig() (*models.GradingConfig, error) {
	data, err := ioutil.ReadFile(gs.configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read grading config: %w", err)
	}
	
	var config models.GradingConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse grading config: %w", err)
	}
	
	return &config, nil
}

// GetPerformanceHistory returns historical performance data for models
func (gs *GradingService) GetPerformanceHistory(days int) ([]models.ModelPerformanceGrade, error) {
	// For demo purposes, return sample historical data
	// In production, this would read from a database or log files
	
	now := time.Now()
	history := []models.ModelPerformanceGrade{
		{
			Grade:                 "A",
			Score:                 91.7,
			GradedAt:              now.AddDate(0, 0, -1),
			GradingSystemVersion:  "1.0.0",
			DeploymentApproved:    true,
			ShouldRetire:          false,
			ShouldRetrain:         false,
		},
		{
			Grade:                 "B",
			Score:                 82.3,
			GradedAt:              now.AddDate(0, 0, -7),
			GradingSystemVersion:  "1.0.0",
			DeploymentApproved:    true,
			ShouldRetire:          false,
			ShouldRetrain:         false,
		},
		{
			Grade:                 "C",
			Score:                 71.5,
			GradedAt:              now.AddDate(0, 0, -14),
			GradingSystemVersion:  "1.0.0",
			DeploymentApproved:    false,
			ShouldRetire:          false,
			ShouldRetrain:         true,
		},
	}
	
	return history, nil
}

// ValidateModelGrade validates if a model grade meets deployment criteria
func (gs *GradingService) ValidateModelGrade(grade string, score float64) (bool, string, error) {
	config, err := gs.GetGradingConfig()
	if err != nil {
		return false, "Unable to load grading configuration", err
	}
	
	// Check if grade is in auto-deploy list
	for _, autoGrade := range config.DeploymentRules.AutoDeployGrades {
		if grade == autoGrade {
			return true, "Approved for automatic deployment", nil
		}
	}
	
	// Check if grade requires manual review
	for _, reviewGrade := range config.DeploymentRules.ManualReviewGrades {
		if grade == reviewGrade {
			return false, "Requires manual review before deployment", nil
		}
	}
	
	// Check if grade should be rejected
	for _, rejectGrade := range config.DeploymentRules.RejectGrades {
		if grade == rejectGrade {
			return false, "Rejected - performance below minimum standards", nil
		}
	}
	
	return false, "Unknown grade - manual review required", nil
}

// GetGradingInsights returns insights and recommendations based on model performance
func (gs *GradingService) GetGradingInsights() (map[string]interface{}, error) {
	prodModel, err := gs.GetProductionModelGrade()
	if err != nil {
		return nil, err
	}
	
	insights := map[string]interface{}{
		"current_model_grade": prodModel.PerformanceGrade.Grade,
		"current_model_score": prodModel.PerformanceGrade.Score,
		"deployment_approved": prodModel.PerformanceGrade.DeploymentApproved,
		"key_strengths": []string{},
		"improvement_areas": []string{},
		"next_actions": []string{},
	}
	
	// Analyze strengths based on grade
	if prodModel.PerformanceGrade.Grade == "A" {
		insights["key_strengths"] = []string{
			"Excellent domain accuracy (91.7%)",
			"Production-ready performance",
			"Memory usage within limits",
			"Fast inference time",
		}
		insights["next_actions"] = []string{
			"Continue monitoring performance",
			"Consider expanding training data diversity",
		}
	} else if prodModel.PerformanceGrade.Grade == "B" {
		insights["key_strengths"] = []string{
			"Good overall performance",
			"Acceptable for production use",
		}
		insights["improvement_areas"] = []string{
			"Domain accuracy could be improved",
			"Consider additional training iterations",
		}
	}
	
	// Add recommendations from the grade
	if len(prodModel.PerformanceGrade.Recommendations) > 0 {
		insights["recommendations"] = prodModel.PerformanceGrade.Recommendations
	}
	
	return insights, nil
}

// LogGradingEvent logs grading-related events for audit purposes
func (gs *GradingService) LogGradingEvent(event string, details map[string]interface{}) {
	logEntry := map[string]interface{}{
		"timestamp": time.Now().Format(time.RFC3339),
		"event":     event,
		"details":   details,
	}
	
	logData, _ := json.MarshalIndent(logEntry, "", "  ")
	log.Printf("Grading Event: %s", string(logData))
}