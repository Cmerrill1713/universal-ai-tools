package shared

import (
	"encoding/json"
	"time"
)

// Message types for inter-service communication
type MessageType string

const (
	MessageTypeRequest      MessageType = "request"
	MessageTypeResponse     MessageType = "response"
	MessageTypeBroadcast    MessageType = "broadcast"
	MessageTypeHealthCheck  MessageType = "health_check"
	MessageTypeStreamStart  MessageType = "stream_start"
	MessageTypeStreamData   MessageType = "stream_data"
	MessageTypeStreamEnd    MessageType = "stream_end"
)

// Service types
type ServiceType string

const (
	ServiceTypeRustVision     ServiceType = "rust_vision"
	ServiceTypeRustAI         ServiceType = "rust_ai_core"
	ServiceTypeRustAnalytics  ServiceType = "rust_analytics"
	ServiceTypeNodeBackend    ServiceType = "node_backend"
	ServiceTypeGoMessageBroker ServiceType = "go_message_broker"
	ServiceTypeGoLoadBalancer ServiceType = "go_load_balancer"
	ServiceTypeGoCache        ServiceType = "go_cache"
	ServiceTypeGoStream       ServiceType = "go_stream"
	ServiceTypeMLGo          ServiceType = "ml_go"
	ServiceTypeMLRust        ServiceType = "ml_rust"
)

// Base message structure for all communications
type Message struct {
	ID          string          `json:"id"`
	Type        MessageType     `json:"type"`
	Source      ServiceType     `json:"source"`
	Destination ServiceType     `json:"destination,omitempty"`
	Timestamp   time.Time       `json:"timestamp"`
	Payload     json.RawMessage `json:"payload"`
	Metadata    map[string]any  `json:"metadata,omitempty"`
	TraceID     string          `json:"trace_id,omitempty"`
}

// Service health status
type HealthStatus struct {
	Service       ServiceType    `json:"service"`
	Status        string         `json:"status"` // healthy, degraded, unhealthy
	Latency       time.Duration  `json:"latency"`
	LastChecked   time.Time      `json:"last_checked"`
	ErrorCount    int            `json:"error_count"`
	RequestCount  int64          `json:"request_count"`
	MemoryUsage   int64          `json:"memory_usage_bytes"`
	CPUUsage      float64        `json:"cpu_usage_percent"`
	Metadata      map[string]any `json:"metadata,omitempty"`
}

// Rust service request/response structures
type RustServiceRequest struct {
	Method  string         `json:"method"`
	Path    string         `json:"path"`
	Headers map[string]string `json:"headers,omitempty"`
	Body    json.RawMessage   `json:"body"`
}

type RustServiceResponse struct {
	StatusCode int               `json:"status_code"`
	Headers    map[string]string `json:"headers,omitempty"`
	Body       json.RawMessage   `json:"body"`
	Error      string            `json:"error,omitempty"`
}

// Vision processing structures
type VisionRequest struct {
	ImageData   []byte         `json:"image_data"`
	Format      string         `json:"format"` // jpg, png, etc
	Processing  string         `json:"processing"` // enhance, detect, segment
	Parameters  map[string]any `json:"parameters,omitempty"`
}

type VisionResponse struct {
	ProcessedData []byte         `json:"processed_data"`
	Metadata      map[string]any `json:"metadata"`
	ProcessingTime time.Duration `json:"processing_time"`
}

// AI inference structures
type AIRequest struct {
	Model       string         `json:"model"`
	Prompt      string         `json:"prompt"`
	Temperature float32        `json:"temperature,omitempty"`
	MaxTokens   int            `json:"max_tokens,omitempty"`
	Stream      bool           `json:"stream"`
	Parameters  map[string]any `json:"parameters,omitempty"`
}

type AIResponse struct {
	Response   string         `json:"response"`
	TokensUsed int            `json:"tokens_used"`
	Latency    time.Duration  `json:"latency"`
	Metadata   map[string]any `json:"metadata,omitempty"`
}

// Cache structures
type CacheEntry struct {
	Key        string         `json:"key"`
	Value      json.RawMessage `json:"value"`
	TTL        time.Duration  `json:"ttl"`
	Service    ServiceType    `json:"service"`
	CreatedAt  time.Time      `json:"created_at"`
	AccessCount int64         `json:"access_count"`
}

// Stream structures
type StreamConfig struct {
	StreamID    string         `json:"stream_id"`
	Source      ServiceType    `json:"source"`
	Type        string         `json:"type"` // vision, audio, parameters
	BufferSize  int            `json:"buffer_size"`
	MaxLatency  time.Duration  `json:"max_latency"`
}

type StreamChunk struct {
	StreamID   string         `json:"stream_id"`
	Sequence   int64          `json:"sequence"`
	Data       []byte         `json:"data"`
	Timestamp  time.Time      `json:"timestamp"`
	IsLast     bool           `json:"is_last"`
	Metadata   map[string]any `json:"metadata,omitempty"`
}

// Dynamic schema validation request
type SchemaValidationRequest struct {
	SchemaID string          `json:"schema_id"`
	Data     json.RawMessage `json:"data"`
}

type SchemaValidationResponse struct {
	Valid      bool     `json:"valid"`
	Errors     []string `json:"errors,omitempty"`
	SchemaVersion string `json:"schema_version"`
}