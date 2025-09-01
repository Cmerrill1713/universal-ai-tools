package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"sync"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.uber.org/zap"
	
	// ML Libraries for Go
	"gorgonia.org/gorgonia"
	"gorgonia.org/tensor"
	onnxruntime "github.com/yalue/onnxruntime_go"
	tf "github.com/galeone/tensorflow/tensorflow/go"
	"github.com/sjwhitworth/golearn/base"
	"github.com/sjwhitworth/golearn/ensemble"
	"github.com/sjwhitworth/golearn/evaluation"
	"github.com/sjwhitworth/golearn/trees"
)

// ModelType represents different ML model types
type ModelType string

const (
	ModelTypeGorgonia    ModelType = "gorgonia"    // Native Go neural networks
	ModelTypeONNX        ModelType = "onnx"         // ONNX Runtime
	ModelTypeTensorFlow  ModelType = "tensorflow"   // TensorFlow
	ModelTypeGoLearn     ModelType = "golearn"      // Classical ML
)

// Model represents a loaded ML model
type Model struct {
	ID          string
	Type        ModelType
	Framework   string
	Model       interface{} // Actual model object
	InputShape  []int
	OutputShape []int
	Metadata    map[string]interface{}
	LoadedAt    time.Time
}

// InferenceRequest represents an inference request
type InferenceRequest struct {
	ModelID    string                 `json:"model_id"`
	Input      interface{}            `json:"input"`
	Parameters InferenceParameters    `json:"parameters"`
}

// InferenceParameters contains inference configuration
type InferenceParameters struct {
	BatchSize   int     `json:"batch_size,omitempty"`
	Temperature float32 `json:"temperature,omitempty"`
	TopK        int     `json:"top_k,omitempty"`
	TopP        float32 `json:"top_p,omitempty"`
	MaxLength   int     `json:"max_length,omitempty"`
	UseGPU      bool    `json:"use_gpu"`
	CacheResult bool    `json:"cache_result"`
}

// InferenceResponse represents the inference result
type InferenceResponse struct {
	ModelID   string                 `json:"model_id"`
	Output    interface{}            `json:"output"`
	LatencyMS int64                  `json:"latency_ms"`
	Framework string                 `json:"framework"`
	Metadata  map[string]interface{} `json:"metadata"`
}

// MLService manages ML models and inference with high concurrency
type MLService struct {
	models       sync.Map // model_id -> *Model
	cache        *InferenceCache
	metrics      *MLMetrics
	logger       *zap.Logger
	shutdownChan chan struct{}
	
	// Concurrency management
	workerPool   *WorkerPool
	requestQueue chan *InferenceJob
	semaphore    chan struct{} // Rate limiting
}

// InferenceJob represents a queued inference request
type InferenceJob struct {
	Request    *InferenceRequest
	Response   chan InferenceJobResult
	StartTime  time.Time
	ID         string
}

// InferenceJobResult contains the result of an inference job
type InferenceJobResult struct {
	Response *InferenceResponse
	Error    error
}

// WorkerPool manages concurrent inference workers
type WorkerPool struct {
	workers    []*Worker
	jobQueue   chan *InferenceJob
	numWorkers int
	logger     *zap.Logger
}

// Worker processes inference jobs
type Worker struct {
	id         int
	jobQueue   chan *InferenceJob
	quit       chan bool
	mlService  *MLService
	logger     *zap.Logger
}

// MLMetrics tracks ML service metrics
type MLMetrics struct {
	inferenceTotal    *prometheus.CounterVec
	inferenceLatency  *prometheus.HistogramVec
	modelsLoaded      prometheus.Gauge
	cacheHits         prometheus.Counter
	cacheMisses       prometheus.Counter
}

func NewMLMetrics() *MLMetrics {
	return &MLMetrics{
		inferenceTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "ml_inference_total",
				Help: "Total number of ML inferences",
			},
			[]string{"model_id", "framework"},
		),
		inferenceLatency: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "ml_inference_latency_ms",
				Help:    "ML inference latency in milliseconds",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"model_id", "framework"},
		),
		modelsLoaded: prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "ml_models_loaded",
				Help: "Number of models currently loaded",
			},
		),
		cacheHits: prometheus.NewCounter(
			prometheus.CounterOpts{
				Name: "ml_cache_hits_total",
				Help: "Total number of cache hits",
			},
		),
		cacheMisses: prometheus.NewCounter(
			prometheus.CounterOpts{
				Name: "ml_cache_misses_total",
				Help: "Total number of cache misses",
			},
		),
	}
}

// NewMLService creates a new ML service with high concurrency
func NewMLService(logger *zap.Logger) (*MLService, error) {
	metrics := NewMLMetrics()
	
	// Register metrics
	prometheus.MustRegister(
		metrics.inferenceTotal,
		metrics.inferenceLatency,
		metrics.modelsLoaded,
		metrics.cacheHits,
		metrics.cacheMisses,
	)
	
	// Configure concurrency based on CPU cores
	numWorkers := runtime.NumCPU() * 2 // 2x CPU cores for I/O bound tasks
	maxConcurrentRequests := numWorkers * 10 // Buffer for queuing
	
	service := &MLService{
		cache:        NewInferenceCache(1000),
		metrics:      metrics,
		logger:       logger,
		shutdownChan: make(chan struct{}),
		requestQueue: make(chan *InferenceJob, maxConcurrentRequests),
		semaphore:    make(chan struct{}, maxConcurrentRequests),
	}
	
	// Initialize worker pool
	service.workerPool = NewWorkerPool(numWorkers, service.requestQueue, service, logger)
	
	// Start background goroutines
	go service.startQueueProcessor()
	go service.startMetricsReporter()
	
	logger.Info("ML Service initialized with high concurrency",
		zap.Int("workers", numWorkers),
		zap.Int("max_concurrent_requests", maxConcurrentRequests))
	
	return service, nil
}

// NewWorkerPool creates a new worker pool
func NewWorkerPool(numWorkers int, jobQueue chan *InferenceJob, mlService *MLService, logger *zap.Logger) *WorkerPool {
	pool := &WorkerPool{
		workers:    make([]*Worker, numWorkers),
		jobQueue:   jobQueue,
		numWorkers: numWorkers,
		logger:     logger,
	}
	
	// Create and start workers
	for i := 0; i < numWorkers; i++ {
		worker := &Worker{
			id:        i,
			jobQueue:  jobQueue,
			quit:      make(chan bool),
			mlService: mlService,
			logger:    logger,
		}
		pool.workers[i] = worker
		go worker.start()
	}
	
	logger.Info("Worker pool started", zap.Int("workers", numWorkers))
	return pool
}

// Worker start method
func (w *Worker) start() {
	w.logger.Debug("Worker started", zap.Int("worker_id", w.id))
	
	for {
		select {
		case job := <-w.jobQueue:
			w.processJob(job)
		case <-w.quit:
			w.logger.Debug("Worker shutting down", zap.Int("worker_id", w.id))
			return
		}
	}
}

// Process a single inference job
func (w *Worker) processJob(job *InferenceJob) {
	startTime := time.Now()
	w.logger.Debug("Processing job", 
		zap.Int("worker_id", w.id),
		zap.String("job_id", job.ID),
		zap.String("model_id", job.Request.ModelID))
	
	// Perform the actual inference
	response, err := w.mlService.performInference(job.Request)
	
	// Send result back
	job.Response <- InferenceJobResult{
		Response: response,
		Error:    err,
	}
	
	duration := time.Since(startTime)
	w.logger.Debug("Job completed",
		zap.Int("worker_id", w.id),
		zap.String("job_id", job.ID),
		zap.Duration("duration", duration),
		zap.Error(err))
}

// Queue processor for managing job flow
func (s *MLService) startQueueProcessor() {
	s.logger.Info("Queue processor started")
	
	for {
		select {
		case <-s.shutdownChan:
			s.logger.Info("Queue processor shutting down")
			return
		default:
			// Monitor queue depth and adjust if needed
			queueDepth := len(s.requestQueue)
			if queueDepth > cap(s.requestQueue)/2 {
				s.logger.Warn("High queue depth detected",
					zap.Int("depth", queueDepth),
					zap.Int("capacity", cap(s.requestQueue)))
			}
			
			time.Sleep(1 * time.Second)
		}
	}
}

// Metrics reporter for performance monitoring
func (s *MLService) startMetricsReporter() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	
	for {
		select {
		case <-ticker.C:
			s.reportMetrics()
		case <-s.shutdownChan:
			s.logger.Info("Metrics reporter shutting down")
			return
		}
	}
}

// Report performance metrics
func (s *MLService) reportMetrics() {
	queueDepth := len(s.requestQueue)
	semaphoreUsage := len(s.semaphore)
	
	s.logger.Info("Performance metrics",
		zap.Int("queue_depth", queueDepth),
		zap.Int("active_requests", semaphoreUsage),
		zap.Int("workers", s.workerPool.numWorkers))
}

// LoadGorgoniaModel loads a Gorgonia neural network model
func (s *MLService) LoadGorgoniaModel(modelID string, modelPath string) error {
	// Create a new graph
	g := gorgonia.NewGraph()
	
	// Example: Load a simple feedforward network
	// In production, you'd load from file
	x := gorgonia.NewTensor(g, tensor.Float32, 2, gorgonia.WithShape(1, 784), gorgonia.WithName("x"))
	w1 := gorgonia.NewTensor(g, tensor.Float32, 2, gorgonia.WithShape(784, 128), gorgonia.WithName("w1"))
	b1 := gorgonia.NewTensor(g, tensor.Float32, 2, gorgonia.WithShape(1, 128), gorgonia.WithName("b1"))
	
	// Build the network
	fc1 := gorgonia.Must(gorgonia.Mul(x, w1))
	fc1 = gorgonia.Must(gorgonia.Add(fc1, b1))
	fc1 = gorgonia.Must(gorgonia.Rectify(fc1))
	
	model := &Model{
		ID:          modelID,
		Type:        ModelTypeGorgonia,
		Framework:   "gorgonia",
		Model:       g,
		InputShape:  []int{1, 784},
		OutputShape: []int{1, 128},
		Metadata:    map[string]interface{}{"architecture": "feedforward"},
		LoadedAt:    time.Now(),
	}
	
	s.models.Store(modelID, model)
	s.metrics.modelsLoaded.Inc()
	
	s.logger.Info("Loaded Gorgonia model", zap.String("model_id", modelID))
	return nil
}

// LoadONNXModel loads an ONNX model
func (s *MLService) LoadONNXModel(modelID string, modelPath string) error {
	// Initialize ONNX Runtime
	onnxruntime.SetSharedLibraryPath("/usr/local/lib/libonnxruntime.so")
	err := onnxruntime.InitializeEnvironment()
	if err != nil {
		return fmt.Errorf("failed to initialize ONNX runtime: %w", err)
	}
	
	// Create session
	session, err := onnxruntime.NewSession(modelPath, nil)
	if err != nil {
		return fmt.Errorf("failed to create ONNX session: %w", err)
	}
	
	// Get input/output info
	inputs, err := session.GetInputInfo()
	if err != nil {
		return fmt.Errorf("failed to get input info: %w", err)
	}
	
	outputs, err := session.GetOutputInfo()
	if err != nil {
		return fmt.Errorf("failed to get output info: %w", err)
	}
	
	model := &Model{
		ID:          modelID,
		Type:        ModelTypeONNX,
		Framework:   "onnx",
		Model:       session,
		InputShape:  inputs[0].Dimensions,
		OutputShape: outputs[0].Dimensions,
		Metadata:    map[string]interface{}{"format": "onnx"},
		LoadedAt:    time.Now(),
	}
	
	s.models.Store(modelID, model)
	s.metrics.modelsLoaded.Inc()
	
	s.logger.Info("Loaded ONNX model", zap.String("model_id", modelID))
	return nil
}

// LoadTensorFlowModel loads a TensorFlow model
func (s *MLService) LoadTensorFlowModel(modelID string, modelPath string) error {
	// Load saved model
	model, err := tf.LoadSavedModel(modelPath, []string{"serve"}, nil)
	if err != nil {
		return fmt.Errorf("failed to load TensorFlow model: %w", err)
	}
	
	m := &Model{
		ID:        modelID,
		Type:      ModelTypeTensorFlow,
		Framework: "tensorflow",
		Model:     model,
		Metadata:  map[string]interface{}{"format": "saved_model"},
		LoadedAt:  time.Now(),
	}
	
	s.models.Store(modelID, m)
	s.metrics.modelsLoaded.Inc()
	
	s.logger.Info("Loaded TensorFlow model", zap.String("model_id", modelID))
	return nil
}

// LoadGoLearnModel loads a classical ML model using GoLearn
func (s *MLService) LoadGoLearnModel(modelID string, modelType string) error {
	var model base.Classifier
	
	switch modelType {
	case "random_forest":
		rf := ensemble.NewRandomForest(100, 5)
		model = rf
		
	case "decision_tree":
		dt := trees.NewID3DecisionTree(0.6)
		model = dt
		
	default:
		return fmt.Errorf("unsupported GoLearn model type: %s", modelType)
	}
	
	m := &Model{
		ID:        modelID,
		Type:      ModelTypeGoLearn,
		Framework: "golearn",
		Model:     model,
		Metadata:  map[string]interface{}{"algorithm": modelType},
		LoadedAt:  time.Now(),
	}
	
	s.models.Store(modelID, m)
	s.metrics.modelsLoaded.Inc()
	
	s.logger.Info("Loaded GoLearn model", 
		zap.String("model_id", modelID),
		zap.String("type", modelType))
	return nil
}

// Infer runs inference on a model with high concurrency support
func (s *MLService) Infer(ctx context.Context, req *InferenceRequest) (*InferenceResponse, error) {
	// Rate limiting
	select {
	case s.semaphore <- struct{}{}:
		defer func() { <-s.semaphore }()
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
		return nil, fmt.Errorf("service overloaded, please retry")
	}
	
	// Quick cache check first
	if req.Parameters.CacheResult {
		if cached := s.cache.Get(req); cached != nil {
			s.metrics.cacheHits.Inc()
			return cached, nil
		}
		s.metrics.cacheMisses.Inc()
	}
	
	// Create job for worker pool
	jobID := fmt.Sprintf("job-%d", time.Now().UnixNano())
	job := &InferenceJob{
		Request:   req,
		Response:  make(chan InferenceJobResult, 1),
		StartTime: time.Now(),
		ID:        jobID,
	}
	
	// Submit to worker pool
	select {
	case s.requestQueue <- job:
		// Job queued successfully
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
		return nil, fmt.Errorf("inference queue full, please retry")
	}
	
	// Wait for result
	select {
	case result := <-job.Response:
		if result.Error != nil {
			return nil, result.Error
		}
		
		// Cache successful results
		if req.Parameters.CacheResult && result.Response != nil {
			s.cache.Set(req, result.Response)
		}
		
		return result.Response, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// performInference does the actual inference work (called by workers)
func (s *MLService) performInference(req *InferenceRequest) (*InferenceResponse, error) {
	start := time.Now()
	
	// Get model
	modelInterface, ok := s.models.Load(req.ModelID)
	if !ok {
		return nil, fmt.Errorf("model not found: %s", req.ModelID)
	}
	
	model := modelInterface.(*Model)
	
	// Run inference based on model type
	var output interface{}
	var err error
	
	switch model.Type {
	case ModelTypeGorgonia:
		output, err = s.inferGorgonia(model, req)
		
	case ModelTypeONNX:
		output, err = s.inferONNX(model, req)
		
	case ModelTypeTensorFlow:
		output, err = s.inferTensorFlow(model, req)
		
	case ModelTypeGoLearn:
		output, err = s.inferGoLearn(model, req)
		
	default:
		return nil, fmt.Errorf("unsupported model type: %s", model.Type)
	}
	
	if err != nil {
		return nil, fmt.Errorf("inference failed: %w", err)
	}
	
	latencyMS := time.Since(start).Milliseconds()
	
	response := &InferenceResponse{
		ModelID:   req.ModelID,
		Output:    output,
		LatencyMS: latencyMS,
		Framework: model.Framework,
		Metadata: map[string]interface{}{
			"gpu_used":   req.Parameters.UseGPU,
			"batch_size": req.Parameters.BatchSize,
			"worker_processed": true,
		},
	}
	
	// Update metrics
	s.metrics.inferenceTotal.WithLabelValues(req.ModelID, model.Framework).Inc()
	s.metrics.inferenceLatency.WithLabelValues(req.ModelID, model.Framework).Observe(float64(latencyMS))
	
	return response, nil
}

// inferGorgonia runs inference using Gorgonia
func (s *MLService) inferGorgonia(model *Model, req *InferenceRequest) (interface{}, error) {
	g := model.Model.(*gorgonia.ExprGraph)
	
	// Create VM
	vm := gorgonia.NewTapeMachine(g)
	defer vm.Close()
	
	// Run the graph
	if err := vm.RunAll(); err != nil {
		return nil, err
	}
	
	// Get output (simplified - in production you'd handle this properly)
	return map[string]interface{}{
		"predictions": []float32{0.1, 0.9},
		"type":        "classification",
	}, nil
}

// inferONNX runs inference using ONNX Runtime
func (s *MLService) inferONNX(model *Model, req *InferenceRequest) (interface{}, error) {
	session := model.Model.(*onnxruntime.Session)
	
	// Convert input to tensor
	inputTensor, err := onnxruntime.NewTensor(model.InputShape, req.Input)
	if err != nil {
		return nil, err
	}
	defer inputTensor.Destroy()
	
	// Run inference
	outputs, err := session.Run([]onnxruntime.Value{inputTensor})
	if err != nil {
		return nil, err
	}
	
	// Extract output
	outputData := outputs[0].GetFloatData()
	
	return map[string]interface{}{
		"predictions": outputData,
		"shape":       model.OutputShape,
	}, nil
}

// inferTensorFlow runs inference using TensorFlow
func (s *MLService) inferTensorFlow(model *Model, req *InferenceRequest) (interface{}, error) {
	savedModel := model.Model.(*tf.SavedModel)
	
	// Create input tensor
	inputData := req.Input.([]float32)
	inputTensor, err := tf.NewTensor(inputData)
	if err != nil {
		return nil, err
	}
	
	// Run inference
	output, err := savedModel.Session.Run(
		map[tf.Output]*tf.Tensor{
			savedModel.Graph.Operation("serving_default_input").Output(0): inputTensor,
		},
		[]tf.Output{
			savedModel.Graph.Operation("StatefulPartitionedCall").Output(0),
		},
		nil,
	)
	
	if err != nil {
		return nil, err
	}
	
	// Extract output
	return output[0].Value(), nil
}

// inferGoLearn runs inference using GoLearn
func (s *MLService) inferGoLearn(model *Model, req *InferenceRequest) (interface{}, error) {
	classifier := model.Model.(base.Classifier)
	
	// Convert input to DenseInstances
	// This is simplified - in production you'd handle data properly
	attrs := make([]base.Attribute, 0)
	for i := 0; i < 4; i++ {
		attrs = append(attrs, base.NewFloatAttribute(fmt.Sprintf("feature_%d", i)))
	}
	
	instances := base.NewDenseInstances()
	for _, attr := range attrs {
		instances.AddAttribute(attr)
	}
	
	// Add the input data
	inputData := req.Input.([]float32)
	instances.AddRow(inputData)
	
	// Predict
	predictions, err := classifier.Predict(instances)
	if err != nil {
		return nil, err
	}
	
	return map[string]interface{}{
		"predictions": predictions,
		"type":        "classification",
	}, nil
}

// InferenceCache provides simple caching for inference results
type InferenceCache struct {
	mu       sync.RWMutex
	cache    map[string]*InferenceResponse
	maxSize  int
}

func NewInferenceCache(maxSize int) *InferenceCache {
	return &InferenceCache{
		cache:   make(map[string]*InferenceResponse),
		maxSize: maxSize,
	}
}

func (c *InferenceCache) Get(req *InferenceRequest) *InferenceResponse {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	key := c.getCacheKey(req)
	return c.cache[key]
}

func (c *InferenceCache) Set(req *InferenceRequest, resp *InferenceResponse) {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	// Simple size limit
	if len(c.cache) >= c.maxSize {
		// Remove oldest (simplified - use LRU in production)
		for k := range c.cache {
			delete(c.cache, k)
			break
		}
	}
	
	key := c.getCacheKey(req)
	c.cache[key] = resp
}

func (c *InferenceCache) getCacheKey(req *InferenceRequest) string {
	data, _ := json.Marshal(req)
	return string(data)
}

// HTTP Handlers
func (s *MLService) loadModelHandler(c *gin.Context) {
	var req struct {
		ModelID   string `json:"model_id"`
		ModelType string `json:"model_type"`
		ModelPath string `json:"model_path,omitempty"`
		Framework string `json:"framework"`
	}
	
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	
	var err error
	switch req.Framework {
	case "gorgonia":
		err = s.LoadGorgoniaModel(req.ModelID, req.ModelPath)
	case "onnx":
		err = s.LoadONNXModel(req.ModelID, req.ModelPath)
	case "tensorflow":
		err = s.LoadTensorFlowModel(req.ModelID, req.ModelPath)
	case "golearn":
		err = s.LoadGoLearnModel(req.ModelID, req.ModelType)
	default:
		err = fmt.Errorf("unsupported framework: %s", req.Framework)
	}
	
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(200, gin.H{"status": "model loaded", "model_id": req.ModelID})
}

func (s *MLService) inferHandler(c *gin.Context) {
	var req InferenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	
	resp, err := s.Infer(c.Request.Context(), &req)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(200, resp)
}

func (s *MLService) listModelsHandler(c *gin.Context) {
	models := make([]map[string]interface{}, 0)
	
	s.models.Range(func(key, value interface{}) bool {
		model := value.(*Model)
		models = append(models, map[string]interface{}{
			"id":         model.ID,
			"framework":  model.Framework,
			"type":       model.Type,
			"loaded_at":  model.LoadedAt,
			"metadata":   model.Metadata,
		})
		return true
	})
	
	c.JSON(200, gin.H{"models": models})
}

func (s *MLService) healthHandler(c *gin.Context) {
	modelCount := 0
	s.models.Range(func(_, _ interface{}) bool {
		modelCount++
		return true
	})
	
	c.JSON(200, gin.H{
		"status":       "healthy",
		"service":      "ml-inference",
		"models_loaded": modelCount,
	})
}

func main() {
	// Setup logger
	logger, _ := zap.NewProduction()
	defer logger.Sync()
	
	// Create ML service
	mlService, err := NewMLService(logger)
	if err != nil {
		logger.Fatal("Failed to create ML service", zap.Error(err))
	}
	
	// Setup Gin router
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(gin.Recovery())
	
	// Model management
	router.POST("/models/load", mlService.loadModelHandler)
	router.GET("/models", mlService.listModelsHandler)
	
	// Inference
	router.POST("/infer", mlService.inferHandler)
	
	// Health and metrics
	router.GET("/health", mlService.healthHandler)
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))
	
	// Start server
	srv := &http.Server{
		Addr:    ":8085",
		Handler: router,
	}
	
	go func() {
		logger.Info("Starting ML inference service", zap.String("port", "8085"))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("Failed to start server", zap.Error(err))
		}
	}()
	
	// Wait for shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan
	
	logger.Info("Shutting down ML inference service")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	if err := srv.Shutdown(ctx); err != nil {
		logger.Error("Server shutdown error", zap.Error(err))
	}
}