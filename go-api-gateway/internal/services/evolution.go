package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"time"

	"go.uber.org/zap"
	"universal-ai-tools/go-api-gateway/internal/config"
)

// EvolutionService handles technology evolution alerts and integration with auto-healing
type EvolutionService struct {
	config         *config.Config
	logger         *zap.Logger
	client         *http.Client
	techScannerURL string
}

// TechnologyAlert represents an alert from the technology scanner
type TechnologyAlert struct {
	Type      string                 `json:"type"`
	Alert     map[string]interface{} `json:"alert"`
	Timestamp time.Time              `json:"timestamp"`
	Source    string                 `json:"source"`
}

// NewEvolutionService creates a new evolution service
func NewEvolutionService(cfg *config.Config, logger *zap.Logger) *EvolutionService {
	techScannerURL := "http://127.0.0.1:8084" // Default tech scanner URL
	
	return &EvolutionService{
		config:         cfg,
		logger:         logger,
		client:         &http.Client{Timeout: 30 * time.Second},
		techScannerURL: techScannerURL,
	}
}

// HandleTechnologyAlert processes incoming technology alerts
func (s *EvolutionService) HandleTechnologyAlert(ctx context.Context, alert TechnologyAlert) error {
	s.logger.Info("Received technology alert",
		zap.String("type", alert.Type),
		zap.String("source", alert.Source),
		zap.Time("timestamp", alert.Timestamp))

	switch alert.Type {
	case "security_vulnerability":
		return s.handleSecurityVulnerability(ctx, alert)
	case "new_library":
		return s.handleNewLibrary(ctx, alert)
	case "migration_recommendation":
		return s.handleMigrationRecommendation(ctx, alert)
	case "technology_update":
		return s.handleTechnologyUpdate(ctx, alert)
	default:
		s.logger.Warn("Unknown alert type", zap.String("type", alert.Type))
		return nil
	}
}

func (s *EvolutionService) handleSecurityVulnerability(ctx context.Context, alert TechnologyAlert) error {
	dependency, _ := alert.Alert["dependency"].(string)
	severity, _ := alert.Alert["severity"].(string)
	fixedVersion, _ := alert.Alert["fixed_version"].(string)

	s.logger.Warn("Security vulnerability detected",
		zap.String("dependency", dependency),
		zap.String("severity", severity),
		zap.String("fixed_version", fixedVersion))

	// Trigger auto-healing for critical vulnerabilities
	if severity == "Critical" || severity == "High" {
		return s.triggerAutoHealing(ctx, map[string]interface{}{
			"problem":     fmt.Sprintf("Critical vulnerability in %s", dependency),
			"service":     "dependency-management",
			"severity":    severity,
			"action":      "update_dependency",
			"target":      dependency,
			"new_version": fixedVersion,
		})
	}

	return nil
}

func (s *EvolutionService) handleNewLibrary(ctx context.Context, alert TechnologyAlert) error {
	name, _ := alert.Alert["name"].(string)
	language, _ := alert.Alert["language"].(string)
	relevanceScore, _ := alert.Alert["relevance_score"].(float64)
	githubURL, _ := alert.Alert["github_url"].(string)

	s.logger.Info("New relevant library discovered",
		zap.String("name", name),
		zap.String("language", language),
		zap.Float64("relevance_score", relevanceScore),
		zap.String("github_url", githubURL))

	// Store for evaluation in architecture decision engine
	return s.storeLibraryEvaluation(ctx, map[string]interface{}{
		"name":            name,
		"language":        language,
		"relevance_score": relevanceScore,
		"github_url":      githubURL,
		"discovered_at":   time.Now(),
		"status":          "pending_evaluation",
	})
}

func (s *EvolutionService) handleMigrationRecommendation(ctx context.Context, alert TechnologyAlert) error {
	fromTech, _ := alert.Alert["from_technology"].(string)
	toTech, _ := alert.Alert["to_technology"].(string)
	confidence, _ := alert.Alert["confidence_score"].(float64)
	effortDays, _ := alert.Alert["estimated_effort_days"].(float64)

	s.logger.Info("Migration recommendation received",
		zap.String("from_technology", fromTech),
		zap.String("to_technology", toTech),
		zap.Float64("confidence_score", confidence),
		zap.Float64("estimated_effort_days", effortDays))

	// High-confidence recommendations trigger architectural review
	if confidence > 0.8 {
		return s.triggerArchitecturalReview(ctx, map[string]interface{}{
			"recommendation_type": "technology_migration",
			"from_technology":     fromTech,
			"to_technology":       toTech,
			"confidence_score":    confidence,
			"estimated_effort":    effortDays,
			"priority":            "high",
		})
	}

	return nil
}

func (s *EvolutionService) handleTechnologyUpdate(ctx context.Context, alert TechnologyAlert) error {
	technology, _ := alert.Alert["technology"].(string)
	currentVersion, _ := alert.Alert["current_version"].(string)
	latestVersion, _ := alert.Alert["latest_version"].(string)
	breakingChanges, _ := alert.Alert["breaking_changes"].(bool)

	s.logger.Info("Technology update available",
		zap.String("technology", technology),
		zap.String("current_version", currentVersion),
		zap.String("latest_version", latestVersion),
		zap.Bool("breaking_changes", breakingChanges))

	// Non-breaking updates can be handled automatically
	if !breakingChanges {
		return s.triggerAutoHealing(ctx, map[string]interface{}{
			"problem":     fmt.Sprintf("%s update available", technology),
			"service":     "dependency-management",
			"action":      "update_dependency",
			"target":      technology,
			"new_version": latestVersion,
			"breaking":    breakingChanges,
		})
	}

	return nil
}

func (s *EvolutionService) triggerAutoHealing(ctx context.Context, problem map[string]interface{}) error {
	s.logger.Info("Triggering auto-healing system", zap.Any("problem", problem))

	// This would integrate with the existing auto-healing system
	// For now, we'll log the action that would be taken
	s.logger.Info("Auto-healing action would be triggered",
		zap.String("action", fmt.Sprintf("%v", problem["action"])),
		zap.String("target", fmt.Sprintf("%v", problem["target"])))

	return nil
}

func (s *EvolutionService) triggerArchitecturalReview(ctx context.Context, review map[string]interface{}) error {
	s.logger.Info("Triggering architectural review", zap.Any("review", review))

	// This would integrate with the architecture decision engine
	// For now, we'll log the review that would be triggered
	s.logger.Info("Architectural review would be triggered",
		zap.String("type", fmt.Sprintf("%v", review["recommendation_type"])),
		zap.String("priority", fmt.Sprintf("%v", review["priority"])))

	return nil
}

func (s *EvolutionService) storeLibraryEvaluation(ctx context.Context, evaluation map[string]interface{}) error {
	s.logger.Info("Storing library evaluation", zap.Any("evaluation", evaluation))

	// In production, this would store to database or send to architecture decision engine
	return nil
}

// GetTechScannerStatus retrieves status from the technology scanner service
func (s *EvolutionService) GetTechScannerStatus(ctx context.Context) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/api/scan/status", s.techScannerURL)
	
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := s.client.Do(req)
	if err != nil {
		s.logger.Error("Failed to get tech scanner status", zap.Error(err))
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("tech scanner returned status %d", resp.StatusCode)
	}

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var status map[string]interface{}
	if err := json.Unmarshal(body, &status); err != nil {
		return nil, err
	}

	return status, nil
}

// GetTechScannerResults retrieves latest scan results from the technology scanner
func (s *EvolutionService) GetTechScannerResults(ctx context.Context) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/api/scan/results", s.techScannerURL)
	
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := s.client.Do(req)
	if err != nil {
		s.logger.Error("Failed to get tech scanner results", zap.Error(err))
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("tech scanner returned status %d", resp.StatusCode)
	}

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var results map[string]interface{}
	if err := json.Unmarshal(body, &results); err != nil {
		return nil, err
	}

	return results, nil
}

// TriggerTechScan manually triggers a technology scan
func (s *EvolutionService) TriggerTechScan(ctx context.Context) error {
	url := fmt.Sprintf("%s/api/scan/trigger", s.techScannerURL)
	
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return err
	}

	resp, err := s.client.Do(req)
	if err != nil {
		s.logger.Error("Failed to trigger tech scan", zap.Error(err))
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("tech scanner returned status %d", resp.StatusCode)
	}

	s.logger.Info("Technology scan triggered successfully")
	return nil
}