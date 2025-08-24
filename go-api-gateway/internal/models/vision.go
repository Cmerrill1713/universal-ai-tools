// Vision models for Universal AI Tools
// Integrates with Rust vision-bridge service

package models

import (
	"time"
)

// VisionRequest represents a request to analyze an image
type VisionRequest struct {
	ImageData        []byte                 `json:"image_data,omitempty"`        // Raw image bytes
	ImageBase64      string                 `json:"image_base64,omitempty"`      // Base64 encoded image
	ImageURL         string                 `json:"image_url,omitempty"`         // URL to image
	Options          VisionOptions          `json:"options"`                     // Analysis options
	GenerationParams *GenerationParameters  `json:"generation_params,omitempty"` // For image generation
	RefinementParams *RefinementParameters  `json:"refinement_params,omitempty"` // For image refinement
	Question         string                 `json:"question,omitempty"`          // For visual reasoning
}

// VisionOptions configures how images should be analyzed
type VisionOptions struct {
	IncludeText          bool    `json:"include_text"`           // Enable OCR text extraction
	ConfidenceThreshold  float32 `json:"confidence_threshold"`   // Minimum confidence for objects
	MaxObjects          int     `json:"max_objects"`            // Maximum objects to detect
	IncludeEmbedding    bool    `json:"include_embedding"`      // Generate image embedding
	DetectionMode       string  `json:"detection_mode"`         // "fast", "accurate", "comprehensive"
}

// VisionAnalysis represents the complete analysis of an image
type VisionAnalysis struct {
	Objects         []DetectedObject `json:"objects"`          // Detected objects
	Scene           SceneAnalysis    `json:"scene"`            // Scene description
	Text            []DetectedText   `json:"text"`             // Extracted text (OCR)
	Confidence      float32          `json:"confidence"`       // Overall confidence
	ProcessingTimeMs int64           `json:"processing_time_ms"` // Processing time
}

// DetectedObject represents an object found in the image
type DetectedObject struct {
	Class      string       `json:"class"`      // Object class name
	Confidence float32      `json:"confidence"` // Detection confidence (0-1)
	BBox       BoundingBox  `json:"bbox"`       // Bounding box coordinates
}

// BoundingBox represents object location in the image
type BoundingBox struct {
	X      float32 `json:"x"`      // Left coordinate (0-1)
	Y      float32 `json:"y"`      // Top coordinate (0-1)
	Width  float32 `json:"width"`  // Width (0-1)
	Height float32 `json:"height"` // Height (0-1)
}

// SceneAnalysis represents overall scene understanding
type SceneAnalysis struct {
	Description string   `json:"description"` // Natural language description
	Tags        []string `json:"tags"`        // Scene tags
	Mood        string   `json:"mood"`        // Scene mood/atmosphere
	Confidence  float32  `json:"confidence"`  // Analysis confidence
}

// DetectedText represents text found in the image via OCR
type DetectedText struct {
	Text       string      `json:"text"`       // Extracted text
	BBox       BoundingBox `json:"bbox"`       // Text location
	Confidence float32     `json:"confidence"` // OCR confidence
	Language   string      `json:"language"`   // Detected language
}

// VisionEmbedding represents an image embedding vector
type VisionEmbedding struct {
	Vector    []float32 `json:"vector"`    // Embedding vector
	Model     string    `json:"model"`     // Model used for embedding
	Dimension int       `json:"dimension"` // Vector dimension
}

// GenerationParameters for image generation
type GenerationParameters struct {
	Width          *int32   `json:"width,omitempty"`           // Image width
	Height         *int32   `json:"height,omitempty"`          // Image height
	Steps          *int32   `json:"steps,omitempty"`           // Generation steps
	GuidanceScale  *float32 `json:"guidance_scale,omitempty"`  // Guidance scale
	Seed           *int64   `json:"seed,omitempty"`            // Random seed
	NegativePrompt *string  `json:"negative_prompt,omitempty"` // Negative prompt
}

// RefinementParameters for image refinement
type RefinementParameters struct {
	Strength *float32 `json:"strength,omitempty"` // Refinement strength (0-1)
	Steps    *int32   `json:"steps,omitempty"`    // Refinement steps
	Guidance *float32 `json:"guidance,omitempty"` // Guidance scale
	Backend  *string  `json:"backend,omitempty"`  // Backend to use (mlx, cuda, etc.)
}

// GeneratedImage represents a generated image
type GeneratedImage struct {
	ID         string                `json:"id"`         // Unique identifier
	Base64     string                `json:"base64"`     // Base64 encoded image
	Prompt     string                `json:"prompt"`     // Generation prompt
	Model      string                `json:"model"`      // Model used
	Parameters GenerationParameters  `json:"parameters"` // Generation parameters
	Quality    ImageQuality          `json:"quality"`    // Quality metrics
	Timestamp  time.Time             `json:"timestamp"`  // Generation time
}

// RefinedImage represents a refined image
type RefinedImage struct {
	ID               string               `json:"id"`                // Unique identifier
	Base64           string               `json:"base64"`            // Base64 encoded refined image
	OriginalPrompt   string               `json:"original_prompt"`   // Original context
	Model            string               `json:"model"`             // Refinement model
	Parameters       RefinementParameters `json:"parameters"`        // Refinement parameters
	ImprovementScore float32              `json:"improvement_score"` // Quality improvement (0-1)
	Timestamp        time.Time            `json:"timestamp"`         // Refinement time
}

// ImageQuality represents quality metrics for generated images
type ImageQuality struct {
	ClipScore       float32 `json:"clip_score"`       // CLIP alignment score
	AestheticScore  float32 `json:"aesthetic_score"`  // Aesthetic quality
	SafetyScore     float32 `json:"safety_score"`     // Safety/appropriateness
	PromptAlignment float32 `json:"prompt_alignment"` // Prompt-image alignment
}

// ReasoningResult represents visual reasoning output
type ReasoningResult struct {
	Answer     string  `json:"answer"`     // Answer to the question
	Confidence float32 `json:"confidence"` // Answer confidence
	Reasoning  string  `json:"reasoning"`  // Explanation of reasoning
}

// VisionResponse wraps vision service responses
type VisionResponse struct {
	Success          bool        `json:"success"`           // Request success status
	Data             interface{} `json:"data,omitempty"`    // Response data
	Error            *string     `json:"error,omitempty"`   // Error message
	ProcessingTimeMs int64       `json:"processing_time_ms"` // Total processing time
	Model            string      `json:"model"`             // Model used
	Cached           bool        `json:"cached"`            // Whether result was cached
	Metadata         VisionMetadata `json:"metadata"`       // Request metadata
}

// VisionMetadata contains request tracking information
type VisionMetadata struct {
	RequestID      string    `json:"request_id"`      // Unique request identifier
	Timestamp      time.Time `json:"timestamp"`       // Request timestamp
	ServiceVersion string    `json:"service_version"` // Vision service version
	CacheHit       bool      `json:"cache_hit"`       // Whether response was cached
	FetchTime      string    `json:"fetch_time"`      // Time to fetch result
}

// VisionServiceStats represents vision service statistics
type VisionServiceStats struct {
	RequestsTotal      int64   `json:"requests_total"`       // Total requests processed
	RequestsSuccessful int64   `json:"requests_successful"`  // Successful requests
	RequestsFailed     int64   `json:"requests_failed"`      // Failed requests
	CacheHitRate       float32 `json:"cache_hit_rate"`       // Cache hit percentage
	AvgProcessingTime  float32 `json:"avg_processing_time"`  // Average processing time (ms)
	RustServiceUp      bool    `json:"rust_service_up"`      // Rust service health
	PythonBridgeUp     bool    `json:"python_bridge_up"`     // Python bridge health
	ModelsLoaded       int     `json:"models_loaded"`        // Number of loaded models
}

// Default values for vision options
func DefaultVisionOptions() VisionOptions {
	return VisionOptions{
		IncludeText:         false,
		ConfidenceThreshold: 0.5,
		MaxObjects:          10,
		IncludeEmbedding:    false,
		DetectionMode:       "fast",
	}
}

// Default values for generation parameters
func DefaultGenerationParameters() GenerationParameters {
	width := int32(512)
	height := int32(512)
	steps := int32(20)
	guidance := float32(7.5)
	
	return GenerationParameters{
		Width:         &width,
		Height:        &height,
		Steps:         &steps,
		GuidanceScale: &guidance,
	}
}

// Default values for refinement parameters
func DefaultRefinementParameters() RefinementParameters {
	strength := float32(0.8)
	steps := int32(20)
	guidance := float32(7.5)
	backend := "mlx"
	
	return RefinementParameters{
		Strength: &strength,
		Steps:    &steps,
		Guidance: &guidance,
		Backend:  &backend,
	}
}