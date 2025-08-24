// Emotion service for Universal AI Tools Go API Gateway
// Provides emotion analysis and sentiment detection capabilities

package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"go.uber.org/zap"

	"universal-ai-tools/go-api-gateway/internal/config"
)

// EmotionService handles emotion analysis operations through the dedicated Go emotion service
type EmotionService struct {
	config          *config.Config
	logger          *zap.Logger
	emotionServiceURL string
	httpClient      *http.Client
}

// NewEmotionService creates a new emotion service instance with automated port allocation
func NewEmotionService(cfg *config.Config, logger *zap.Logger, portManager *PortManager) (*EmotionService, error) {
	// Use automated port allocation for emotion service
	var emotionServiceURL string
	
	if portManager != nil {
		allocation := portManager.GetPortAllocation("emotion-service")
		if allocation != nil {
			emotionServiceURL = fmt.Sprintf("http://localhost:%d", allocation.Port)
			logger.Info("Using allocated port for emotion service", 
				zap.String("url", emotionServiceURL),
				zap.Int("port", allocation.Port))
		} else {
			// Try to allocate a new port for emotion service
			allocation, err := portManager.AllocatePort("emotion-service", "ml", intPtr(8088))
			if err != nil {
				logger.Warn("Failed to allocate port for emotion service, using default", zap.Error(err))
				emotionServiceURL = "http://localhost:8088"
			} else {
				emotionServiceURL = fmt.Sprintf("http://localhost:%d", allocation.Port)
				logger.Info("Allocated new port for emotion service",
					zap.String("url", emotionServiceURL),
					zap.Int("port", allocation.Port))
			}
		}
	} else {
		emotionServiceURL = "http://localhost:8088" // Fallback to default
		logger.Warn("No port manager available, using hardcoded port for emotion service")
	}

	service := &EmotionService{
		config:            cfg,
		logger:            logger.With(zap.String("service", "emotion")),
		emotionServiceURL: emotionServiceURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}

	service.logger.Info("Emotion service wrapper initialized with automated port management")
	return service, nil
}

// Request/Response structures for the emotion service

// EmotionAnalysisRequest represents a request for emotion analysis
type EmotionAnalysisRequest struct {
	Text     string `json:"text"`
	UserID   string `json:"user_id,omitempty"`
	Context  string `json:"context,omitempty"`
	Language string `json:"language,omitempty"`
}

// EmotionScore represents individual emotion confidence
type EmotionScore struct {
	Emotion    string  `json:"emotion"`
	Confidence float32 `json:"confidence"`
	Intensity  string  `json:"intensity"`
}

// EmotionAnalysis provides detailed emotion analysis metrics
type EmotionAnalysis struct {
	TextLength     int      `json:"text_length"`
	KeyPhrases     []string `json:"key_phrases"`
	EmotionalWords []string `json:"emotional_words"`
	Subjectivity   float32  `json:"subjectivity"`
	Arousal        float32  `json:"arousal"`
	Valence        float32  `json:"valence"`
}

// EmotionAnalysisResponse represents the response from emotion analysis
type EmotionAnalysisResponse struct {
	Success          bool           `json:"success"`
	Message          string         `json:"message,omitempty"`
	PrimaryEmotion   string         `json:"primary_emotion"`
	EmotionScores    []EmotionScore `json:"emotion_scores"`
	Sentiment        string         `json:"sentiment"`
	SentimentScore   float32        `json:"sentiment_score"`
	Confidence       float32        `json:"confidence"`
	ProcessingTime   int64          `json:"processing_time_ms"`
	Analysis         EmotionAnalysis `json:"analysis"`
}

// EmotionHealthResponse represents the health status of the emotion service
type EmotionHealthResponse struct {
	Status            string `json:"status"`
	EmotionEngine     bool   `json:"emotion_engine"`
	DatabaseConnected bool   `json:"database_connected"`
	Uptime            int64  `json:"uptime_seconds"`
	AnalysisCount     int64  `json:"analysis_count"`
}

// StoredEmotion represents historical emotion analysis data
type StoredEmotion struct {
	ID             int64     `json:"id"`
	UserID         string    `json:"user_id"`
	Text           string    `json:"text"`
	PrimaryEmotion string    `json:"primary_emotion"`
	SentimentScore float32   `json:"sentiment_score"`
	Context        string    `json:"context,omitempty"`
	Confidence     float32   `json:"confidence"`
	Timestamp      time.Time `json:"timestamp"`
}

// EmotionHistory represents a user's emotion history
type EmotionHistory struct {
	UserID  string          `json:"user_id"`
	History []StoredEmotion `json:"history"`
	Count   int             `json:"count"`
}

// Core service methods

// AnalyzeEmotion performs emotion analysis on the provided text
func (s *EmotionService) AnalyzeEmotion(ctx context.Context, req *EmotionAnalysisRequest) (*EmotionAnalysisResponse, error) {
	s.logger.Debug("Analyzing emotion", 
		zap.String("text", req.Text[:min(len(req.Text), 100)]),
		zap.String("user_id", req.UserID))

	// Prepare request body
	reqBody, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Make HTTP request to emotion service
	httpReq, err := http.NewRequestWithContext(ctx, "POST", s.emotionServiceURL+"/analyze", bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to call emotion service: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("emotion service returned status %d", resp.StatusCode)
	}

	var response EmotionAnalysisResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	s.logger.Debug("Emotion analysis completed",
		zap.String("primary_emotion", response.PrimaryEmotion),
		zap.String("sentiment", response.Sentiment),
		zap.Float32("confidence", response.Confidence))

	return &response, nil
}

// GetEmotionHealth checks the health of the emotion service
func (s *EmotionService) GetEmotionHealth(ctx context.Context) (*EmotionHealthResponse, error) {
	httpReq, err := http.NewRequestWithContext(ctx, "GET", s.emotionServiceURL+"/health", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to call emotion service: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("emotion service returned status %d", resp.StatusCode)
	}

	var health EmotionHealthResponse
	if err := json.NewDecoder(resp.Body).Decode(&health); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &health, nil
}

// GetUserEmotionHistory retrieves emotion history for a specific user
func (s *EmotionService) GetUserEmotionHistory(ctx context.Context, userID string) (*EmotionHistory, error) {
	s.logger.Debug("Retrieving emotion history", zap.String("user_id", userID))

	httpReq, err := http.NewRequestWithContext(ctx, "GET", fmt.Sprintf("%s/history/%s", s.emotionServiceURL, userID), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to call emotion service: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("emotion service returned status %d", resp.StatusCode)
	}

	var history EmotionHistory
	if err := json.NewDecoder(resp.Body).Decode(&history); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &history, nil
}

// AnalyzeSentimentQuick provides quick sentiment analysis without full emotion breakdown
func (s *EmotionService) AnalyzeSentimentQuick(ctx context.Context, text string, userID string) (string, float32, error) {
	req := &EmotionAnalysisRequest{
		Text:   text,
		UserID: userID,
	}

	response, err := s.AnalyzeEmotion(ctx, req)
	if err != nil {
		return "neutral", 0.0, err
	}

	return response.Sentiment, response.SentimentScore, nil
}

// GetEmotionInsights provides aggregated emotion insights for a user
func (s *EmotionService) GetEmotionInsights(ctx context.Context, userID string) (map[string]interface{}, error) {
	history, err := s.GetUserEmotionHistory(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Calculate insights from history
	insights := make(map[string]interface{})
	
	if len(history.History) == 0 {
		insights["message"] = "No emotion history available"
		return insights, nil
	}

	// Calculate most common emotions
	emotionCounts := make(map[string]int)
	sentimentSum := float32(0)
	highConfidenceCount := 0

	for _, emotion := range history.History {
		emotionCounts[emotion.PrimaryEmotion]++
		sentimentSum += emotion.SentimentScore
		if emotion.Confidence >= 0.7 {
			highConfidenceCount++
		}
	}

	// Find most common emotion
	mostCommon := ""
	maxCount := 0
	for emotion, count := range emotionCounts {
		if count > maxCount {
			maxCount = count
			mostCommon = emotion
		}
	}

	insights["total_analyses"] = len(history.History)
	insights["most_common_emotion"] = mostCommon
	insights["average_sentiment"] = sentimentSum / float32(len(history.History))
	insights["high_confidence_percentage"] = float32(highConfidenceCount) / float32(len(history.History)) * 100
	insights["emotion_distribution"] = emotionCounts

	return insights, nil
}

// Helper function to get minimum of two integers
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}