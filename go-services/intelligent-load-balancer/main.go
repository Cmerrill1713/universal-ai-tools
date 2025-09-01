// Intelligent Load Balancer with ML-based Routing
// Uses machine learning to optimize routing decisions based on real-time metrics
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"net/http"
	"os"
	"os/signal"
	"sort"
	"sync"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/universal-ai-tools/go-services/shared"
	"go.uber.org/zap"
)

// ServiceMetrics represents real-time metrics for a service
type ServiceMetrics struct {
	ServiceName       string            `json:"service_name"`
	ResponseTime      float64           `json:"response_time"`
	ErrorRate         float64           `json:"error_rate"`
	CPUUsage          float64           `json:"cpu_usage"`
	MemoryUsage       float64           `json:"memory_usage"`
	ThroughputRPS     float64           `json:"throughput_rps"`
	ConnectionCount   int               `json:"connection_count"`
	HealthScore       float64           `json:"health_score"`
	LastUpdated       time.Time         `json:"last_updated"`
	CustomMetrics     map[string]float64 `json:"custom_metrics,omitempty"`
	MLFeatures        map[string]float64 `json:"ml_features,omitempty"`
}

// RoutingDecision represents an ML-based routing decision
type RoutingDecision struct {
	ServiceName       string            `json:"service_name"`
	Confidence        float64           `json:"confidence"`
	PredictedLatency  float64           `json:"predicted_latency"`
	LoadScore         float64           `json:"load_score"`
	RoutingReason     string            `json:"routing_reason"`
	Features          map[string]float64 `json:"features"`
	Timestamp         time.Time         `json:"timestamp"`
}

// MLModel represents a simple machine learning model for routing
type MLModel struct {
	Weights        map[string]float64 `json:"weights"`
	Bias           float64           `json:"bias"`
	LearningRate   float64           `json:"learning_rate"`
	TrainingCount  int               `json:"training_count"`
	LastTrained    time.Time         `json:"last_trained"`
	Accuracy       float64           `json:"accuracy"`
	mutex          sync.RWMutex
}

// IntelligentLoadBalancer implements ML-based load balancing
type IntelligentLoadBalancer struct {
	config           *shared.Config
	logger           *zap.Logger
	services         sync.Map // ServiceName -> ServiceMetrics
	mlModel          *MLModel
	routingHistory   []RoutingDecision
	metrics          *LoadBalancerMetrics
	resilience       *shared.ResilienceManager
	trafficPredictor *TrafficPredictor
	shutdownChan     chan struct{}
}

// LoadBalancerMetrics for Prometheus monitoring
type LoadBalancerMetrics struct {
	routingDecisions    *prometheus.CounterVec
	predictionAccuracy  prometheus.Gauge
	modelTrainingTime   prometheus.Histogram
	routingLatency      *prometheus.HistogramVec
	serviceHealthScore  *prometheus.GaugeVec
	trafficPrediction   *prometheus.GaugeVec
}

// TrafficPredictor predicts future traffic patterns
type TrafficPredictor struct {
	historicalData []TrafficPoint
	seasonalModel  map[int]float64 // hour -> expected traffic multiplier
	mutex          sync.RWMutex
}

type TrafficPoint struct {
	Timestamp time.Time `json:"timestamp"`
	RPS       float64   `json:"rps"`
	Hour      int       `json:"hour"`
	DayOfWeek int       `json:"day_of_week"`
}

func NewLoadBalancerMetrics() *LoadBalancerMetrics {
	return &LoadBalancerMetrics{
		routingDecisions: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "intelligent_lb_routing_decisions_total",
				Help: "Total number of routing decisions made",
			},
			[]string{"service", "reason", "confidence_level"},
		),
		predictionAccuracy: prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "intelligent_lb_prediction_accuracy",
				Help: "Current prediction accuracy of the ML model",
			},
		),
		modelTrainingTime: prometheus.NewHistogram(
			prometheus.HistogramOpts{
				Name:    "intelligent_lb_model_training_duration_seconds",
				Help:    "Time spent training the ML model",
				Buckets: prometheus.DefBuckets,
			},
		),
		routingLatency: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "intelligent_lb_routing_latency_seconds",
				Help:    "Latency of routing decisions",
				Buckets: []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5},
			},
			[]string{"service", "decision_type"},
		),
		serviceHealthScore: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "intelligent_lb_service_health_score",
				Help: "Health score of each service",
			},
			[]string{"service"},
		),
		trafficPrediction: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "intelligent_lb_traffic_prediction",
				Help: "Predicted traffic for the next period",
			},
			[]string{"service", "time_horizon"},
		),
	}
}

func NewMLModel() *MLModel {
	return &MLModel{
		Weights: map[string]float64{
			"response_time":      -0.3,
			"error_rate":         -0.5,
			"cpu_usage":          -0.2,
			"memory_usage":       -0.1,
			"throughput_rps":      0.4,
			"connection_count":   -0.1,
			"health_score":        0.6,
			"predicted_traffic":   0.2,
		},
		Bias:         0.5,
		LearningRate: 0.01,
		LastTrained:  time.Now(),
		Accuracy:     0.75, // Initial estimate
	}
}

func NewTrafficPredictor() *TrafficPredictor {
	return &TrafficPredictor{
		historicalData: make([]TrafficPoint, 0),
		seasonalModel:  make(map[int]float64),
	}
}

func NewIntelligentLoadBalancer(config *shared.Config, logger *zap.Logger) (*IntelligentLoadBalancer, error) {
	// Setup resilience patterns
	resilienceConfig := shared.DefaultResilienceConfig()
	resilienceConfig.Timeout = 2 * time.Second
	resilienceConfig.BulkheadSize = 100
	resilience := shared.NewResilienceManager(resilienceConfig)

	lb := &IntelligentLoadBalancer{
		config:           config,
		logger:           logger,
		mlModel:          NewMLModel(),
		routingHistory:   make([]RoutingDecision, 0),
		metrics:          NewLoadBalancerMetrics(),
		resilience:       resilience,
		trafficPredictor: NewTrafficPredictor(),
		shutdownChan:     make(chan struct{}),
	}

	// Register metrics
	prometheus.MustRegister(
		lb.metrics.routingDecisions,
		lb.metrics.predictionAccuracy,
		lb.metrics.modelTrainingTime,
		lb.metrics.routingLatency,
		lb.metrics.serviceHealthScore,
		lb.metrics.trafficPrediction,
	)

	// Initialize with some default services
	lb.initializeServices()

	return lb, nil
}

func (lb *IntelligentLoadBalancer) initializeServices() {
	defaultServices := []string{
		"rust-ml-inference",
		"go-ml-inference",
		"rust-parameter-analytics",
		"rust-ab-mcts",
		"node-backend",
	}

	for _, serviceName := range defaultServices {
		metrics := &ServiceMetrics{
			ServiceName:     serviceName,
			ResponseTime:    100.0, // 100ms default
			ErrorRate:       0.01,  // 1% default
			CPUUsage:        0.3,   // 30% default
			MemoryUsage:     0.4,   // 40% default
			ThroughputRPS:   10.0,  // 10 RPS default
			ConnectionCount: 0,
			HealthScore:     0.8,   // 80% default
			LastUpdated:     time.Now(),
			MLFeatures:      make(map[string]float64),
		}
		lb.services.Store(serviceName, metrics)
		lb.metrics.serviceHealthScore.WithLabelValues(serviceName).Set(metrics.HealthScore)
	}
}

func (lb *IntelligentLoadBalancer) Start() error {
	// Setup Gin router
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(gin.Recovery())

	// Health check endpoint
	router.GET("/health", lb.healthCheckHandler)

	// Routing decision endpoint
	router.POST("/route", lb.routingDecisionHandler)

	// Service metrics update endpoint
	router.POST("/metrics/:service", lb.updateServiceMetricsHandler)

	// ML model endpoints
	router.GET("/model/status", lb.modelStatusHandler)
	router.POST("/model/train", lb.trainModelHandler)
	router.GET("/model/predictions", lb.predictionsHandler)

	// Traffic prediction endpoints
	router.GET("/traffic/predictions", lb.trafficPredictionsHandler)
	router.POST("/traffic/feedback", lb.trafficFeedbackHandler)

	// Metrics endpoint
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// Start background tasks
	go lb.backgroundTraining()
	go lb.metricsCollection()
	go lb.trafficPrediction()

	// Start HTTP server
	srv := &http.Server{
		Addr:    ":" + lb.config.HTTP.Port,
		Handler: router,
	}

	go func() {
		lb.logger.Info("Starting intelligent load balancer", zap.String("port", lb.config.HTTP.Port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			lb.logger.Fatal("Failed to start server", zap.Error(err))
		}
	}()

	// Wait for shutdown signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	lb.logger.Info("Shutting down intelligent load balancer")
	close(lb.shutdownChan)

	// Graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	return srv.Shutdown(ctx)
}

func (lb *IntelligentLoadBalancer) routingDecisionHandler(c *gin.Context) {
	startTime := time.Now()

	var request struct {
		RequestType   string            `json:"request_type"`
		Payload       json.RawMessage   `json:"payload,omitempty"`
		Context       map[string]string `json:"context,omitempty"`
		Requirements  map[string]float64 `json:"requirements,omitempty"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	// Make intelligent routing decision
	decision := lb.makeRoutingDecision(request.RequestType, request.Context, request.Requirements)

	// Record metrics
	confidenceLevel := "low"
	if decision.Confidence > 0.8 {
		confidenceLevel = "high"
	} else if decision.Confidence > 0.6 {
		confidenceLevel = "medium"
	}

	lb.metrics.routingDecisions.WithLabelValues(
		decision.ServiceName,
		decision.RoutingReason,
		confidenceLevel,
	).Inc()

	lb.metrics.routingLatency.WithLabelValues(
		decision.ServiceName,
		"ml_decision",
	).Observe(time.Since(startTime).Seconds())

	// Store decision for learning
	lb.routingHistory = append(lb.routingHistory, decision)
	if len(lb.routingHistory) > 1000 {
		lb.routingHistory = lb.routingHistory[100:] // Keep last 900 decisions
	}

	c.JSON(200, decision)
}

func (lb *IntelligentLoadBalancer) makeRoutingDecision(requestType string, context map[string]string, requirements map[string]float64) RoutingDecision {
	// Get current traffic prediction
	predictedTraffic := lb.trafficPredictor.predictNextHour()

	// Collect service scores
	serviceScores := make(map[string]float64)
	var availableServices []string

	lb.services.Range(func(key, value interface{}) bool {
		serviceName := key.(string)
		metrics := value.(*ServiceMetrics)

		// Skip unhealthy services
		if metrics.HealthScore < 0.3 {
			return true
		}

		availableServices = append(availableServices, serviceName)

		// Calculate ML features
		features := lb.extractFeatures(metrics, predictedTraffic, requirements)
		
		// Apply ML model
		score := lb.mlModel.predict(features)
		serviceScores[serviceName] = score

		// Update service ML features for monitoring
		metrics.MLFeatures = features

		return true
	})

	if len(availableServices) == 0 {
		// Fallback to any available service
		lb.services.Range(func(key, value interface{}) bool {
			availableServices = append(availableServices, key.(string))
			return len(availableServices) < 1 // Just get one
		})
	}

	// Select best service
	bestService := ""
	bestScore := math.Inf(-1)
	reason := "ml_optimization"

	for _, serviceName := range availableServices {
		score := serviceScores[serviceName]
		
		// Add some exploration (epsilon-greedy)
		if rand.Float64() < 0.1 { // 10% exploration
			score += rand.Float64() * 0.2
			reason = "exploration"
		}

		if score > bestScore {
			bestScore = score
			bestService = serviceName
		}
	}

	// Fallback if no service selected
	if bestService == "" && len(availableServices) > 0 {
		bestService = availableServices[rand.Intn(len(availableServices))]
		reason = "random_fallback"
		bestScore = 0.5
	}

	// Calculate confidence based on score distribution
	confidence := lb.calculateConfidence(serviceScores, bestService)

	return RoutingDecision{
		ServiceName:      bestService,
		Confidence:       confidence,
		PredictedLatency: lb.predictLatency(bestService),
		LoadScore:        bestScore,
		RoutingReason:    reason,
		Features:         lb.extractGlobalFeatures(predictedTraffic),
		Timestamp:        time.Now(),
	}
}

func (lb *IntelligentLoadBalancer) extractFeatures(metrics *ServiceMetrics, predictedTraffic float64, requirements map[string]float64) map[string]float64 {
	features := map[string]float64{
		"response_time":      metrics.ResponseTime,
		"error_rate":         metrics.ErrorRate,
		"cpu_usage":          metrics.CPUUsage,
		"memory_usage":       metrics.MemoryUsage,
		"throughput_rps":     metrics.ThroughputRPS,
		"connection_count":   float64(metrics.ConnectionCount),
		"health_score":       metrics.HealthScore,
		"predicted_traffic":  predictedTraffic,
		"time_since_update":  time.Since(metrics.LastUpdated).Seconds(),
	}

	// Add requirement-based features
	for key, value := range requirements {
		features["req_"+key] = value
	}

	// Add temporal features
	now := time.Now()
	features["hour_of_day"] = float64(now.Hour()) / 24.0
	features["day_of_week"] = float64(now.Weekday()) / 7.0

	return features
}

func (lb *IntelligentLoadBalancer) extractGlobalFeatures(predictedTraffic float64) map[string]float64 {
	return map[string]float64{
		"predicted_traffic": predictedTraffic,
		"active_services":   float64(lb.countActiveServices()),
		"total_load":        lb.calculateTotalLoad(),
		"system_health":     lb.calculateSystemHealth(),
	}
}

func (m *MLModel) predict(features map[string]float64) float64 {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	score := m.Bias
	for feature, value := range features {
		if weight, exists := m.Weights[feature]; exists {
			score += weight * value
		}
	}

	// Apply sigmoid activation
	return 1.0 / (1.0 + math.Exp(-score))
}

func (lb *IntelligentLoadBalancer) calculateConfidence(scores map[string]float64, selectedService string) float64 {
	if len(scores) <= 1 {
		return 1.0
	}

	selectedScore := scores[selectedService]
	
	// Calculate score variance
	var otherScores []float64
	for service, score := range scores {
		if service != selectedService {
			otherScores = append(otherScores, score)
		}
	}

	if len(otherScores) == 0 {
		return 1.0
	}

	sort.Float64s(otherScores)
	secondBest := otherScores[len(otherScores)-1]

	// Confidence based on margin between best and second best
	margin := selectedScore - secondBest
	confidence := math.Tanh(margin*5) * 0.5 + 0.5 // Scale to [0,1]
	
	return math.Min(math.Max(confidence, 0.0), 1.0)
}

func (lb *IntelligentLoadBalancer) predictLatency(serviceName string) float64 {
	if serviceData, exists := lb.services.Load(serviceName); exists {
		metrics := serviceData.(*ServiceMetrics)
		// Simple prediction based on current metrics
		basLatency := metrics.ResponseTime
		loadFactor := 1.0 + (metrics.CPUUsage * 0.5) + (metrics.MemoryUsage * 0.2)
		return baseLatency * loadFactor
	}
	return 100.0 // Default prediction
}

func (lb *IntelligentLoadBalancer) countActiveServices() int {
	count := 0
	lb.services.Range(func(key, value interface{}) bool {
		metrics := value.(*ServiceMetrics)
		if metrics.HealthScore > 0.5 {
			count++
		}
		return true
	})
	return count
}

func (lb *IntelligentLoadBalancer) calculateTotalLoad() float64 {
	totalLoad := 0.0
	serviceCount := 0
	
	lb.services.Range(func(key, value interface{}) bool {
		metrics := value.(*ServiceMetrics)
		totalLoad += (metrics.CPUUsage + metrics.MemoryUsage) / 2.0
		serviceCount++
		return true
	})
	
	if serviceCount == 0 {
		return 0.0
	}
	return totalLoad / float64(serviceCount)
}

func (lb *IntelligentLoadBalancer) calculateSystemHealth() float64 {
	totalHealth := 0.0
	serviceCount := 0
	
	lb.services.Range(func(key, value interface{}) bool {
		metrics := value.(*ServiceMetrics)
		totalHealth += metrics.HealthScore
		serviceCount++
		return true
	})
	
	if serviceCount == 0 {
		return 0.0
	}
	return totalHealth / float64(serviceCount)
}

// Background training process
func (lb *IntelligentLoadBalancer) backgroundTraining() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if len(lb.routingHistory) > 20 {
				go lb.trainModel()
			}
		case <-lb.shutdownChan:
			return
		}
	}
}

func (lb *IntelligentLoadBalancer) trainModel() {
	startTime := time.Now()
	defer func() {
		lb.metrics.modelTrainingTime.Observe(time.Since(startTime).Seconds())
	}()

	// Simplified online learning
	// In production, this would use more sophisticated ML algorithms
	
	lb.mlModel.mutex.Lock()
	defer lb.mlModel.mutex.Unlock()

	correctPredictions := 0
	totalPredictions := len(lb.routingHistory)

	for _, decision := range lb.routingHistory {
		// Evaluate if the decision was good based on observed metrics
		if serviceData, exists := lb.services.Load(decision.ServiceName); exists {
			metrics := serviceData.(*ServiceMetrics)
			
			// Simple feedback: if service is still healthy, the decision was good
			actualPerformance := metrics.HealthScore
			predictedGood := decision.Confidence > 0.6
			actualGood := actualPerformance > 0.7

			if predictedGood == actualGood {
				correctPredictions++
			}

			// Update weights based on feedback (simplified gradient descent)
			error := actualPerformance - decision.Confidence
			for feature, value := range decision.Features {
				if _, exists := lb.mlModel.Weights[feature]; exists {
					lb.mlModel.Weights[feature] += lb.mlModel.LearningRate * error * value
				}
			}
		}
	}

	// Update model accuracy
	if totalPredictions > 0 {
		lb.mlModel.Accuracy = float64(correctPredictions) / float64(totalPredictions)
		lb.metrics.predictionAccuracy.Set(lb.mlModel.Accuracy)
	}

	lb.mlModel.TrainingCount++
	lb.mlModel.LastTrained = time.Now()

	lb.logger.Info("Model training completed",
		zap.Float64("accuracy", lb.mlModel.Accuracy),
		zap.Int("training_count", lb.mlModel.TrainingCount),
		zap.Int("decisions_processed", totalPredictions))
}

// Traffic prediction methods
func (tp *TrafficPredictor) predictNextHour() float64 {
	tp.mutex.RLock()
	defer tp.mutex.RUnlock()

	now := time.Now()
	nextHour := (now.Hour() + 1) % 24

	// Use seasonal model if available
	if multiplier, exists := tp.seasonalModel[nextHour]; exists {
		// Get recent average traffic
		recentTraffic := tp.getRecentAverageTraffic()
		return recentTraffic * multiplier
	}

	// Fallback to recent average
	return tp.getRecentAverageTraffic()
}

func (tp *TrafficPredictor) getRecentAverageTraffic() float64 {
	if len(tp.historicalData) == 0 {
		return 10.0 // Default baseline
	}

	// Calculate average of last 24 data points
	sum := 0.0
	count := 0
	cutoff := time.Now().Add(-24 * time.Hour)

	for i := len(tp.historicalData) - 1; i >= 0 && count < 24; i-- {
		point := tp.historicalData[i]
		if point.Timestamp.After(cutoff) {
			sum += point.RPS
			count++
		}
	}

	if count == 0 {
		return 10.0
	}

	return sum / float64(count)
}

// HTTP Handlers
func (lb *IntelligentLoadBalancer) updateServiceMetricsHandler(c *gin.Context) {
	serviceName := c.Param("service")
	
	var metrics ServiceMetrics
	if err := c.ShouldBindJSON(&metrics); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	metrics.ServiceName = serviceName
	metrics.LastUpdated = time.Now()
	
	lb.services.Store(serviceName, &metrics)
	lb.metrics.serviceHealthScore.WithLabelValues(serviceName).Set(metrics.HealthScore)

	c.JSON(200, gin.H{"status": "updated"})
}

func (lb *IntelligentLoadBalancer) modelStatusHandler(c *gin.Context) {
	lb.mlModel.mutex.RLock()
	status := map[string]interface{}{
		"weights":        lb.mlModel.Weights,
		"bias":           lb.mlModel.Bias,
		"learning_rate":  lb.mlModel.LearningRate,
		"training_count": lb.mlModel.TrainingCount,
		"last_trained":   lb.mlModel.LastTrained,
		"accuracy":       lb.mlModel.Accuracy,
	}
	lb.mlModel.mutex.RUnlock()

	c.JSON(200, status)
}

func (lb *IntelligentLoadBalancer) trainModelHandler(c *gin.Context) {
	go lb.trainModel()
	c.JSON(200, gin.H{"status": "training_started"})
}

func (lb *IntelligentLoadBalancer) predictionsHandler(c *gin.Context) {
	predictions := make(map[string]interface{})
	
	lb.services.Range(func(key, value interface{}) bool {
		serviceName := key.(string)
		metrics := value.(*ServiceMetrics)
		
		predictedTraffic := lb.trafficPredictor.predictNextHour()
		features := lb.extractFeatures(metrics, predictedTraffic, nil)
		score := lb.mlModel.predict(features)
		
		predictions[serviceName] = map[string]interface{}{
			"score":             score,
			"predicted_latency": lb.predictLatency(serviceName),
			"features":          features,
		}
		return true
	})

	c.JSON(200, predictions)
}

func (lb *IntelligentLoadBalancer) trafficPredictionsHandler(c *gin.Context) {
	nextHour := lb.trafficPredictor.predictNextHour()
	
	c.JSON(200, gin.H{
		"next_hour_prediction": nextHour,
		"current_hour":         time.Now().Hour(),
		"seasonal_model":       lb.trafficPredictor.seasonalModel,
	})
}

func (lb *IntelligentLoadBalancer) trafficFeedbackHandler(c *gin.Context) {
	var point TrafficPoint
	if err := c.ShouldBindJSON(&point); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	point.Timestamp = time.Now()
	point.Hour = point.Timestamp.Hour()
	point.DayOfWeek = int(point.Timestamp.Weekday())

	lb.trafficPredictor.mutex.Lock()
	lb.trafficPredictor.historicalData = append(lb.trafficPredictor.historicalData, point)
	
	// Keep last 7 days of data
	if len(lb.trafficPredictor.historicalData) > 168*24 {
		lb.trafficPredictor.historicalData = lb.trafficPredictor.historicalData[24:]
	}

	// Update seasonal model
	lb.trafficPredictor.updateSeasonalModel()
	lb.trafficPredictor.mutex.Unlock()

	c.JSON(200, gin.H{"status": "feedback_recorded"})
}

func (tp *TrafficPredictor) updateSeasonalModel() {
	// Calculate hourly averages
	hourlyData := make(map[int][]float64)
	
	for _, point := range tp.historicalData {
		hourlyData[point.Hour] = append(hourlyData[point.Hour], point.RPS)
	}

	// Update seasonal model with averages
	for hour, values := range hourlyData {
		if len(values) > 0 {
			sum := 0.0
			for _, value := range values {
				sum += value
			}
			tp.seasonalModel[hour] = sum / float64(len(values))
		}
	}
}

func (lb *IntelligentLoadBalancer) healthCheckHandler(c *gin.Context) {
	serviceCount := 0
	healthyServices := 0
	
	lb.services.Range(func(key, value interface{}) bool {
		serviceCount++
		metrics := value.(*ServiceMetrics)
		if metrics.HealthScore > 0.5 {
			healthyServices++
		}
		return true
	})

	status := "healthy"
	if float64(healthyServices)/float64(serviceCount) < 0.5 {
		status = "degraded"
	}

	c.JSON(200, gin.H{
		"status":           status,
		"service":          "intelligent-load-balancer",
		"services_total":   serviceCount,
		"services_healthy": healthyServices,
		"model_accuracy":   lb.mlModel.Accuracy,
		"training_count":   lb.mlModel.TrainingCount,
	})
}

// Background metrics collection
func (lb *IntelligentLoadBalancer) metricsCollection() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			lb.collectMetrics()
		case <-lb.shutdownChan:
			return
		}
	}
}

func (lb *IntelligentLoadBalancer) collectMetrics() {
	// Update traffic predictions
	nextHourPrediction := lb.trafficPredictor.predictNextHour()
	
	lb.services.Range(func(key, value interface{}) bool {
		serviceName := key.(string)
		lb.metrics.trafficPrediction.WithLabelValues(serviceName, "1h").Set(nextHourPrediction)
		return true
	})
}

// Traffic prediction background task
func (lb *IntelligentLoadBalancer) trafficPrediction() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			// Add current traffic data point
			currentRPS := lb.getCurrentRPS()
			point := TrafficPoint{
				Timestamp: time.Now(),
				RPS:       currentRPS,
				Hour:      time.Now().Hour(),
				DayOfWeek: int(time.Now().Weekday()),
			}

			lb.trafficPredictor.mutex.Lock()
			lb.trafficPredictor.historicalData = append(lb.trafficPredictor.historicalData, point)
			if len(lb.trafficPredictor.historicalData) > 168*24 {
				lb.trafficPredictor.historicalData = lb.trafficPredictor.historicalData[1:]
			}
			lb.trafficPredictor.updateSeasonalModel()
			lb.trafficPredictor.mutex.Unlock()

		case <-lb.shutdownChan:
			return
		}
	}
}

func (lb *IntelligentLoadBalancer) getCurrentRPS() float64 {
	totalRPS := 0.0
	serviceCount := 0
	
	lb.services.Range(func(key, value interface{}) bool {
		metrics := value.(*ServiceMetrics)
		totalRPS += metrics.ThroughputRPS
		serviceCount++
		return true
	})
	
	if serviceCount == 0 {
		return 0.0
	}
	return totalRPS
}

func main() {
	// Load configuration
	config, err := shared.LoadConfig("config.yaml")
	if err != nil {
		config = &shared.Config{
			Service: shared.ServiceConfig{
				Name:     "intelligent-load-balancer",
				LogLevel: "info",
			},
			HTTP: shared.HTTPConfig{
				Port: "8095",
			},
		}
	}

	// Setup logger
	logger, err := shared.SetupLogger(config.Service.LogLevel)
	if err != nil {
		panic(fmt.Sprintf("Failed to setup logger: %v", err))
	}

	// Create and start load balancer
	lb, err := NewIntelligentLoadBalancer(config, logger)
	if err != nil {
		logger.Fatal("Failed to create intelligent load balancer", zap.Error(err))
	}

	if err := lb.Start(); err != nil {
		logger.Fatal("Failed to start intelligent load balancer", zap.Error(err))
	}
}