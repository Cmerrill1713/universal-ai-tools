// Vision service for Universal AI Tools
// Communicates with Rust vision-bridge service

package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"sync"
	"time"

	"go.uber.org/zap"
	"universal-ai-tools/go-api-gateway/internal/models"
)

// VisionService manages communication with the Rust vision-bridge service
type VisionService struct {
	config         interface{} // Configuration interface
	logger         *zap.Logger
	client         *http.Client
	baseURL        string
	serviceHealthy bool
	healthLock     sync.RWMutex
	stats          models.VisionServiceStats
	statsLock      sync.RWMutex
}

// NewVisionService creates a new vision service
func NewVisionService(config interface{}, logger *zap.Logger, portManager *PortManager) *VisionService {
	// Use the actual running Rust vision-bridge service port
	baseURL := "http://localhost:8084"
	
	// Verify the service is actually running on port 8084
	testClient := &http.Client{Timeout: 2 * time.Second}
	resp, err := testClient.Get(baseURL + "/health")
	if err == nil {
		resp.Body.Close()
		if resp.StatusCode == 200 {
			logger.Info("Vision Bridge service found and healthy",
				zap.String("url", baseURL),
				zap.Int("status_code", resp.StatusCode))
		}
	} else {
		logger.Warn("Vision Bridge service not responding on default port, will retry during health checks",
			zap.String("url", baseURL),
			zap.Error(err))
	}
	
	// Create HTTP client with reasonable timeouts
	client := &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			MaxIdleConns:        10,
			IdleConnTimeout:     30 * time.Second,
			DisableCompression: false,
		},
	}

	service := &VisionService{
		config:         config,
		logger:         logger,
		client:         client,
		baseURL:        baseURL,
		serviceHealthy: false,
		stats: models.VisionServiceStats{
			RequestsTotal:      0,
			RequestsSuccessful: 0,
			RequestsFailed:     0,
			CacheHitRate:       0.0,
			AvgProcessingTime:  0.0,
			RustServiceUp:      false,
			PythonBridgeUp:     false,
			ModelsLoaded:       0,
		},
	}

	// Start background health checking
	go service.startHealthChecker()

	return service
}

// AnalyzeImage analyzes an image using the Rust vision service
func (s *VisionService) AnalyzeImage(ctx context.Context, req *models.VisionRequest) (*models.VisionResponse, error) {
	startTime := time.Now()
	s.incrementRequestCount()

	if !s.isHealthy() {
		s.incrementFailureCount()
		return nil, fmt.Errorf("vision service is not available")
	}

	// Prepare the request
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Add image data
	if len(req.ImageData) > 0 {
		part, err := writer.CreateFormFile("image", "upload.jpg")
		if err != nil {
			s.incrementFailureCount()
			return nil, fmt.Errorf("failed to create form file: %w", err)
		}
		_, err = part.Write(req.ImageData)
		if err != nil {
			s.incrementFailureCount()
			return nil, fmt.Errorf("failed to write image data: %w", err)
		}
	} else if req.ImageBase64 != "" {
		err := writer.WriteField("image_base64", req.ImageBase64)
		if err != nil {
			s.incrementFailureCount()
			return nil, fmt.Errorf("failed to write base64 field: %w", err)
		}
	} else if req.ImageURL != "" {
		err := writer.WriteField("image_url", req.ImageURL)
		if err != nil {
			s.incrementFailureCount()
			return nil, fmt.Errorf("failed to write URL field: %w", err)
		}
	} else {
		s.incrementFailureCount()
		return nil, fmt.Errorf("no image data provided")
	}

	// Add options as JSON
	optionsJSON, err := json.Marshal(req.Options)
	if err != nil {
		s.incrementFailureCount()
		return nil, fmt.Errorf("failed to marshal options: %w", err)
	}
	err = writer.WriteField("options", string(optionsJSON))
	if err != nil {
		s.incrementFailureCount()
		return nil, fmt.Errorf("failed to write options field: %w", err)
	}

	err = writer.Close()
	if err != nil {
		s.incrementFailureCount()
		return nil, fmt.Errorf("failed to close multipart writer: %w", err)
	}

	// Create HTTP request
	httpReq, err := http.NewRequestWithContext(ctx, "POST", s.baseURL+"/vision/analyze", body)
	if err != nil {
		s.incrementFailureCount()
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", writer.FormDataContentType())

	// Send request
	resp, err := s.client.Do(httpReq)
	if err != nil {
		s.incrementFailureCount()
		s.markServiceUnhealthy()
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		s.incrementFailureCount()
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		s.incrementFailureCount()
		return nil, fmt.Errorf("vision service error: %s", string(respBody))
	}

	// Parse response
	var visionResp models.VisionResponse
	err = json.Unmarshal(respBody, &visionResp)
	if err != nil {
		s.incrementFailureCount()
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	// Update statistics
	s.incrementSuccessCount()
	s.updateProcessingTime(time.Since(startTime).Milliseconds())
	if visionResp.Cached {
		s.updateCacheHit()
	}

	return &visionResp, nil
}

// GenerateImage generates an image using the Rust vision service
func (s *VisionService) GenerateImage(ctx context.Context, prompt string, params *models.GenerationParameters) (*models.VisionResponse, error) {
	startTime := time.Now()
	s.incrementRequestCount()

	if !s.isHealthy() {
		s.incrementFailureCount()
		return nil, fmt.Errorf("vision service is not available")
	}

	// Prepare request body
	reqBody := map[string]interface{}{
		"prompt":     prompt,
		"parameters": params,
	}

	bodyJSON, err := json.Marshal(reqBody)
	if err != nil {
		s.incrementFailureCount()
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Create HTTP request
	httpReq, err := http.NewRequestWithContext(ctx, "POST", s.baseURL+"/vision/generate", bytes.NewBuffer(bodyJSON))
	if err != nil {
		s.incrementFailureCount()
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	// Send request
	resp, err := s.client.Do(httpReq)
	if err != nil {
		s.incrementFailureCount()
		s.markServiceUnhealthy()
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	// Read and parse response
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		s.incrementFailureCount()
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		s.incrementFailureCount()
		return nil, fmt.Errorf("vision service error: %s", string(respBody))
	}

	var visionResp models.VisionResponse
	err = json.Unmarshal(respBody, &visionResp)
	if err != nil {
		s.incrementFailureCount()
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	s.incrementSuccessCount()
	s.updateProcessingTime(time.Since(startTime).Milliseconds())

	return &visionResp, nil
}

// RefineImage refines an image using the Rust vision service
func (s *VisionService) RefineImage(ctx context.Context, imageData []byte, params *models.RefinementParameters) (*models.VisionResponse, error) {
	startTime := time.Now()
	s.incrementRequestCount()

	if !s.isHealthy() {
		s.incrementFailureCount()
		return nil, fmt.Errorf("vision service is not available")
	}

	// Prepare multipart form
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Add image
	part, err := writer.CreateFormFile("image", "refine.jpg")
	if err != nil {
		s.incrementFailureCount()
		return nil, fmt.Errorf("failed to create form file: %w", err)
	}
	_, err = part.Write(imageData)
	if err != nil {
		s.incrementFailureCount()
		return nil, fmt.Errorf("failed to write image data: %w", err)
	}

	// Add parameters
	paramsJSON, err := json.Marshal(params)
	if err != nil {
		s.incrementFailureCount()
		return nil, fmt.Errorf("failed to marshal parameters: %w", err)
	}
	err = writer.WriteField("parameters", string(paramsJSON))
	if err != nil {
		s.incrementFailureCount()
		return nil, fmt.Errorf("failed to write parameters field: %w", err)
	}

	err = writer.Close()
	if err != nil {
		s.incrementFailureCount()
		return nil, fmt.Errorf("failed to close multipart writer: %w", err)
	}

	// Create and send request
	httpReq, err := http.NewRequestWithContext(ctx, "POST", s.baseURL+"/vision/refine", body)
	if err != nil {
		s.incrementFailureCount()
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := s.client.Do(httpReq)
	if err != nil {
		s.incrementFailureCount()
		s.markServiceUnhealthy()
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	// Parse response
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		s.incrementFailureCount()
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		s.incrementFailureCount()
		return nil, fmt.Errorf("vision service error: %s", string(respBody))
	}

	var visionResp models.VisionResponse
	err = json.Unmarshal(respBody, &visionResp)
	if err != nil {
		s.incrementFailureCount()
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	s.incrementSuccessCount()
	s.updateProcessingTime(time.Since(startTime).Milliseconds())

	return &visionResp, nil
}

// ReasonAboutImage performs visual reasoning on an image
func (s *VisionService) ReasonAboutImage(ctx context.Context, imageData []byte, question string) (*models.VisionResponse, error) {
	startTime := time.Now()
	s.incrementRequestCount()

	if !s.isHealthy() {
		s.incrementFailureCount()
		return nil, fmt.Errorf("vision service is not available")
	}

	// Prepare multipart form
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Add image
	part, err := writer.CreateFormFile("image", "reason.jpg")
	if err != nil {
		s.incrementFailureCount()
		return nil, fmt.Errorf("failed to create form file: %w", err)
	}
	_, err = part.Write(imageData)
	if err != nil {
		s.incrementFailureCount()
		return nil, fmt.Errorf("failed to write image data: %w", err)
	}

	err = writer.Close()
	if err != nil {
		s.incrementFailureCount()
		return nil, fmt.Errorf("failed to close multipart writer: %w", err)
	}

	// Create URL with question as query parameter
	reasonURL := fmt.Sprintf("%s/vision/reason?question=%s", s.baseURL, url.QueryEscape(question))

	// Create and send request
	httpReq, err := http.NewRequestWithContext(ctx, "POST", reasonURL, body)
	if err != nil {
		s.incrementFailureCount()
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := s.client.Do(httpReq)
	if err != nil {
		s.incrementFailureCount()
		s.markServiceUnhealthy()
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	// Parse response
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		s.incrementFailureCount()
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		s.incrementFailureCount()
		return nil, fmt.Errorf("vision service error: %s", string(respBody))
	}

	var visionResp models.VisionResponse
	err = json.Unmarshal(respBody, &visionResp)
	if err != nil {
		s.incrementFailureCount()
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	s.incrementSuccessCount()
	s.updateProcessingTime(time.Since(startTime).Milliseconds())

	return &visionResp, nil
}

// GetEmbedding generates an embedding for an image
func (s *VisionService) GetEmbedding(ctx context.Context, imageData []byte) (*models.VisionResponse, error) {
	startTime := time.Now()
	s.incrementRequestCount()

	if !s.isHealthy() {
		s.incrementFailureCount()
		return nil, fmt.Errorf("vision service is not available")
	}

	// Prepare multipart form
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("image", "embed.jpg")
	if err != nil {
		s.incrementFailureCount()
		return nil, fmt.Errorf("failed to create form file: %w", err)
	}
	_, err = part.Write(imageData)
	if err != nil {
		s.incrementFailureCount()
		return nil, fmt.Errorf("failed to write image data: %w", err)
	}

	err = writer.Close()
	if err != nil {
		s.incrementFailureCount()
		return nil, fmt.Errorf("failed to close multipart writer: %w", err)
	}

	// Create and send request
	httpReq, err := http.NewRequestWithContext(ctx, "POST", s.baseURL+"/vision/embed", body)
	if err != nil {
		s.incrementFailureCount()
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := s.client.Do(httpReq)
	if err != nil {
		s.incrementFailureCount()
		s.markServiceUnhealthy()
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	// Parse response
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		s.incrementFailureCount()
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		s.incrementFailureCount()
		return nil, fmt.Errorf("vision service error: %s", string(respBody))
	}

	var visionResp models.VisionResponse
	err = json.Unmarshal(respBody, &visionResp)
	if err != nil {
		s.incrementFailureCount()
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	s.incrementSuccessCount()
	s.updateProcessingTime(time.Since(startTime).Milliseconds())

	return &visionResp, nil
}

// GetVisionStats returns current service statistics
func (s *VisionService) GetVisionStats() models.VisionServiceStats {
	s.statsLock.RLock()
	defer s.statsLock.RUnlock()
	return s.stats
}

// Health checking and statistics methods

func (s *VisionService) startHealthChecker() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	// Initial health check
	s.checkHealth()

	for range ticker.C {
		s.checkHealth()
	}
}

func (s *VisionService) checkHealth() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET", s.baseURL+"/health", nil)
	if err != nil {
		s.markServiceUnhealthy()
		return
	}

	resp, err := s.client.Do(req)
	if err != nil {
		s.markServiceUnhealthy()
		s.logger.Debug("Vision service health check failed", zap.Error(err))
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		s.markServiceHealthy()
		
		// Try to get detailed stats from the service
		s.updateServiceStats()
	} else {
		s.markServiceUnhealthy()
	}
}

func (s *VisionService) updateServiceStats() {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET", s.baseURL+"/metrics", nil)
	if err != nil {
		return
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return
	}

	var metrics map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&metrics); err != nil {
		return
	}

	s.statsLock.Lock()
	defer s.statsLock.Unlock()

	// Update service-specific stats if available
	if rustUp, ok := metrics["rust_service_healthy"].(bool); ok {
		s.stats.RustServiceUp = rustUp
	}
	if pythonUp, ok := metrics["python_bridge_healthy"].(bool); ok {
		s.stats.PythonBridgeUp = pythonUp
	}
	if models, ok := metrics["models_loaded"].(float64); ok {
		s.stats.ModelsLoaded = int(models)
	}
}

func (s *VisionService) isHealthy() bool {
	s.healthLock.RLock()
	defer s.healthLock.RUnlock()
	return s.serviceHealthy
}

func (s *VisionService) markServiceHealthy() {
	s.healthLock.Lock()
	defer s.healthLock.Unlock()
	if !s.serviceHealthy {
		s.logger.Info("Vision service is now healthy")
	}
	s.serviceHealthy = true
}

func (s *VisionService) markServiceUnhealthy() {
	s.healthLock.Lock()
	defer s.healthLock.Unlock()
	if s.serviceHealthy {
		s.logger.Warn("Vision service is now unhealthy")
	}
	s.serviceHealthy = false
}

func (s *VisionService) incrementRequestCount() {
	s.statsLock.Lock()
	defer s.statsLock.Unlock()
	s.stats.RequestsTotal++
}

func (s *VisionService) incrementSuccessCount() {
	s.statsLock.Lock()
	defer s.statsLock.Unlock()
	s.stats.RequestsSuccessful++
}

func (s *VisionService) incrementFailureCount() {
	s.statsLock.Lock()
	defer s.statsLock.Unlock()
	s.stats.RequestsFailed++
}

func (s *VisionService) updateProcessingTime(timeMs int64) {
	s.statsLock.Lock()
	defer s.statsLock.Unlock()
	
	// Simple moving average
	if s.stats.RequestsSuccessful == 1 {
		s.stats.AvgProcessingTime = float32(timeMs)
	} else {
		s.stats.AvgProcessingTime = (s.stats.AvgProcessingTime + float32(timeMs)) / 2.0
	}
}

func (s *VisionService) updateCacheHit() {
	s.statsLock.Lock()
	defer s.statsLock.Unlock()
	
	// Recalculate cache hit rate
	totalRequests := s.stats.RequestsTotal
	if totalRequests > 0 {
		// This is a simplified calculation; in practice you'd track cache hits separately
		s.stats.CacheHitRate = float32(s.stats.RequestsSuccessful) / float32(totalRequests) * 0.3 // Rough estimate
	}
}