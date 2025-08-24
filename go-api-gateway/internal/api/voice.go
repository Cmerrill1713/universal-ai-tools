package api

import (
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"universal-ai-tools/go-api-gateway/internal/config"
	"universal-ai-tools/go-api-gateway/internal/handlers"
)

// VoiceHandler handles voice-related API routes
type VoiceHandler struct {
	config      *config.Config
	logger      *zap.Logger
	voiceHandler *handlers.VoiceHandler
}

// NewVoiceHandler creates a new voice API handler
func NewVoiceHandler(config *config.Config, logger *zap.Logger) *VoiceHandler {
	return &VoiceHandler{
		config:       config,
		logger:       logger,
		voiceHandler: handlers.NewVoiceHandler(),
	}
}

// RegisterRoutes registers all voice-related routes
func (vh *VoiceHandler) RegisterRoutes(r *gin.RouterGroup) {
	voice := r.Group("/voice")
	{
		// Voice system endpoints
		voice.GET("/status", vh.voiceHandler.GetVoiceStatus)
		voice.GET("/voices", vh.voiceHandler.GetVoices)
		
		// Text-to-speech endpoints
		voice.POST("/tts", vh.voiceHandler.TextToSpeech)
		voice.POST("/speak", vh.voiceHandler.TextToSpeech) // Alias for compatibility
		
		// Speech-to-text endpoints
		voice.POST("/stt", vh.voiceHandler.SpeechToText)
		voice.POST("/transcribe", vh.voiceHandler.SpeechToText) // Alias for compatibility
		
		// Voice session management
		voice.POST("/session/start", vh.voiceHandler.StartVoiceSession)
		voice.GET("/session/start", vh.voiceHandler.StartVoiceSession) // Allow GET for easy testing
	}
	
	vh.logger.Info("Voice API routes registered",
		zap.String("prefix", "/api/v1/voice"),
		zap.Int("endpoints", 7))
}