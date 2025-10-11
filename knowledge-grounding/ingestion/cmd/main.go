package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sirupsen/logrus"
	"github.com/weaviate/weaviate-go-client/v4/weaviate"
)

// =============================================================================
// METRICS
// =============================================================================

var (
	ingestionRequests = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "knowledge_ingestion_requests_total",
			Help: "Total number of knowledge ingestion requests",
		},
		[]string{"source", "type", "status"},
	)

	ingestionDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "knowledge_ingestion_duration_seconds",
			Help:    "Time spent ingesting knowledge",
			Buckets: prometheus.ExponentialBuckets(0.1, 2, 10),
		},
		[]string{"source", "type"},
	)

	ingestionErrors = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "knowledge_ingestion_errors_total",
			Help: "Total number of knowledge ingestion errors",
		},
		[]string{"error_type", "source"},
	)
)

func init() {
	prometheus.MustRegister(ingestionRequests, ingestionDuration, ingestionErrors)
}

// =============================================================================
// DATA STRUCTURES
// =============================================================================

type KnowledgeDocument struct {
	ID          string                 `json:"id"`
	Title       string                 `json:"title"`
	Content     string                 `json:"content"`
	Source      string                 `json:"source"`
	Type        string                 `json:"type"`
	Metadata    map[string]interface{} `json:"metadata"`
	Timestamp   time.Time              `json:"timestamp"`
	Embeddings  []float32              `json:"embeddings,omitempty"`
}

type IngestionRequest struct {
	Documents []KnowledgeDocument `json:"documents"`
	Source    string              `json:"source"`
	Options   map[string]interface{} `json:"options,omitempty"`
}

type IngestionResponse struct {
	Success   bool     `json:"success"`
	Processed int      `json:"processed"`
	Failed    int      `json:"failed"`
	Errors    []string `json:"errors,omitempty"`
	Message   string   `json:"message"`
}

// =============================================================================
// KNOWLEDGE INGESTION SERVICE
// =============================================================================

type KnowledgeIngestionService struct {
	client    *weaviate.Client
	logger    *logrus.Logger
	prometheus *prometheus.Registry
}

func NewKnowledgeIngestionService() (*KnowledgeIngestionService, error) {
	weaviateURL := os.Getenv("WEAVIATE_URL")
	if weaviateURL == "" {
		weaviateURL = "http://weaviate-grounded:8080"
	}

	client := weaviate.New(weaviate.Config{
		Host:   weaviateURL,
		Scheme: "http",
	})

	logger := logrus.New()
	logger.SetLevel(logrus.InfoLevel)

	return &KnowledgeIngestionService{
		client:    client,
		logger:    logger,
		prometheus: prometheus.NewRegistry(),
	}, nil
}

func (s *KnowledgeIngestionService) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"service":   "knowledge-ingestion",
		"timestamp": time.Now().UTC(),
		"version":   "1.0.0",
	})
}

func (s *KnowledgeIngestionService) IngestKnowledge(c *gin.Context) {
	var req IngestionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		ingestionErrors.WithLabelValues("invalid_request", req.Source).Inc()
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	start := time.Now()
	processed := 0
	failed := 0
	var errors []string

	for _, doc := range req.Documents {
		if doc.ID == "" {
			doc.ID = uuid.New().String()
		}
		if doc.Timestamp.IsZero() {
			doc.Timestamp = time.Now()
		}

		if err := s.ingestDocument(doc, req.Source); err != nil {
			failed++
			errors = append(errors, fmt.Sprintf("Document %s: %v", doc.ID, err))
			ingestionErrors.WithLabelValues("ingestion_failed", req.Source).Inc()
		} else {
			processed++
		}
	}

	duration := time.Since(start)
	ingestionDuration.WithLabelValues(req.Source, "batch").Observe(duration.Seconds())
	ingestionRequests.WithLabelValues(req.Source, "batch", "success").Add(float64(processed))
	ingestionRequests.WithLabelValues(req.Source, "batch", "failed").Add(float64(failed))

	response := IngestionResponse{
		Success:   failed == 0,
		Processed: processed,
		Failed:    failed,
		Errors:    errors,
		Message:   fmt.Sprintf("Processed %d documents, %d failed", processed, failed),
	}

	status := http.StatusOK
	if failed > 0 {
		status = http.StatusPartialContent
	}

	c.JSON(status, response)
}

func (s *KnowledgeIngestionService) ingestDocument(doc KnowledgeDocument, source string) error {
	// Create document in Weaviate
	dataSchema := map[string]interface{}{
		"title":     doc.Title,
		"content":   doc.Content,
		"source":    doc.Source,
		"type":      doc.Type,
		"metadata":  doc.Metadata,
		"timestamp": doc.Timestamp.Format(time.RFC3339),
	}

	_, err := s.client.Data().Creator().
		WithClassName("KnowledgeDocument").
		WithID(doc.ID).
		WithProperties(dataSchema).
		Do(context.Background())

	if err != nil {
		s.logger.WithFields(logrus.Fields{
			"document_id": doc.ID,
			"source":      source,
			"error":       err,
		}).Error("Failed to ingest document")
		return err
	}

	s.logger.WithFields(logrus.Fields{
		"document_id": doc.ID,
		"source":      source,
		"title":       doc.Title,
	}).Info("Successfully ingested document")

	return nil
}

func (s *KnowledgeIngestionService) GetMetrics(c *gin.Context) {
	c.Header("Content-Type", "text/plain")
	promhttp.Handler().ServeHTTP(c.Writer, c.Request)
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

func main() {
	service, err := NewKnowledgeIngestionService()
	if err != nil {
		log.Fatal("Failed to create knowledge ingestion service:", err)
	}

	// Setup Gin router
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	// Health check endpoint
	r.GET("/health", service.HealthCheck)

	// Metrics endpoint
	r.GET("/metrics", service.GetMetrics)

	// Knowledge ingestion endpoints
	r.POST("/ingest", service.IngestKnowledge)
	r.POST("/ingest/batch", service.IngestKnowledge)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	log.Printf("Knowledge Ingestion Service starting on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
