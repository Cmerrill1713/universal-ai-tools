package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/rs/cors"
)

// TTS Service Configuration
type TTSConfig struct {
	Port         int    `json:"port"`
	Host         string `json:"host"`
	DefaultVoice string `json:"default_voice"`
	CacheEnabled bool   `json:"cache_enabled"`
	CacheDir     string `json:"cache_dir"`
}

// TTS Request structure
type TTSRequest struct {
	Text     string  `json:"text"`
	Voice    string  `json:"voice,omitempty"`
	Rate     float32 `json:"rate,omitempty"`
	Volume   float32 `json:"volume,omitempty"`
	Language string  `json:"language,omitempty"`
}

// TTS Response structure
type TTSResponse struct {
	Success       bool   `json:"success"`
	Message       string `json:"message,omitempty"`
	AudioData     []byte `json:"audio_data,omitempty"`
	AudioBase64   string `json:"audio_base64,omitempty"`
	Duration      int    `json:"duration_ms"`
	Voice         string `json:"voice"`
	ProcessingTime int64 `json:"processing_time_ms"`
}

// Health Response structure
type HealthResponse struct {
	Status      string   `json:"status"`
	TTSReady    bool     `json:"tts_ready"`
	AvailableVoices []string `json:"available_voices"`
	Uptime      int64    `json:"uptime_seconds"`
}

// TTS Service implementation
type TTSService struct {
	config       TTSConfig
	upgrader     websocket.Upgrader
	startTime    time.Time
	activeJobs   sync.Map
	voiceCache   []string
	cacheMutex   sync.RWMutex
}

// Initialize TTS Service
func NewTTSService() *TTSService {
	config := TTSConfig{
		Port:         8086,
		Host:         "0.0.0.0",
		DefaultVoice: "Alex",
		CacheEnabled: true,
		CacheDir:     "/tmp/tts-cache",
	}

	// Override with environment variables
	if port := os.Getenv("TTS_PORT"); port != "" {
		if p, err := strconv.Atoi(port); err == nil {
			config.Port = p
		}
	}

	// Create cache directory
	if config.CacheEnabled {
		os.MkdirAll(config.CacheDir, 0755)
	}

	return &TTSService{
		config: config,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
		},
		startTime: time.Now(),
	}
}

// Get available voices on macOS
func (tts *TTSService) getAvailableVoices() []string {
	tts.cacheMutex.RLock()
	if len(tts.voiceCache) > 0 {
		defer tts.cacheMutex.RUnlock()
		return tts.voiceCache
	}
	tts.cacheMutex.RUnlock()

	tts.cacheMutex.Lock()
	defer tts.cacheMutex.Unlock()

	// Use macOS 'say' command to get voices
	cmd := exec.Command("say", "-v", "?")
	output, err := cmd.Output()
	if err != nil {
		log.Printf("Warning: Failed to get voices: %v", err)
		return []string{"Alex", "Victoria", "Samantha"}
	}

	var voices []string
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		if strings.TrimSpace(line) != "" {
			// Extract voice name (first word before space)
			parts := strings.Fields(line)
			if len(parts) > 0 {
				voices = append(voices, parts[0])
			}
		}
	}

	if len(voices) == 0 {
		voices = []string{"Alex", "Victoria", "Samantha", "Daniel"}
	}

	tts.voiceCache = voices
	return voices
}

// Synthesize speech using macOS native TTS
func (tts *TTSService) synthesizeText(req TTSRequest) (*TTSResponse, error) {
	start := time.Now()

	// Set defaults
	voice := req.Voice
	if voice == "" {
		voice = tts.config.DefaultVoice
	}

	rate := req.Rate
	if rate == 0 {
		rate = 200 // Default speech rate
	}

	// Validate voice
	availableVoices := tts.getAvailableVoices()
	voiceValid := false
	for _, v := range availableVoices {
		if strings.EqualFold(v, voice) {
			voice = v
			voiceValid = true
			break
		}
	}

	if !voiceValid {
		voice = tts.config.DefaultVoice
	}

	// Build say command
	args := []string{
		"-v", voice,
		"-r", fmt.Sprintf("%.0f", rate),
	}

	// Check cache first
	var cacheFile string
	if tts.config.CacheEnabled {
		hash := fmt.Sprintf("%x", req.Text+voice)
		cacheFile = filepath.Join(tts.config.CacheDir, hash+".aiff")
		
		if _, err := os.Stat(cacheFile); err == nil {
			// Cache hit - read cached audio
			audioData, err := os.ReadFile(cacheFile)
			if err == nil {
				return &TTSResponse{
					Success:        true,
					AudioData:      audioData,
					Duration:       len(audioData) / 44, // Rough estimate
					Voice:          voice,
					ProcessingTime: time.Since(start).Milliseconds(),
				}, nil
			}
		}

		// Cache miss - generate and cache
		args = append(args, "-o", cacheFile, "--data-format=LEF32@22050")
	}

	// Add text to synthesize
	args = append(args, req.Text)

	// Execute TTS command
	cmd := exec.Command("say", args...)
	err := cmd.Run()
	if err != nil {
		return nil, fmt.Errorf("TTS synthesis failed: %v", err)
	}

	var audioData []byte
	if tts.config.CacheEnabled && cacheFile != "" {
		// Read generated audio file
		audioData, err = os.ReadFile(cacheFile)
		if err != nil {
			return nil, fmt.Errorf("failed to read generated audio: %v", err)
		}
	}

	return &TTSResponse{
		Success:        true,
		Message:        "Speech synthesized successfully",
		AudioData:      audioData,
		Duration:       len(audioData) / 44, // Rough estimate
		Voice:          voice,
		ProcessingTime: time.Since(start).Milliseconds(),
	}, nil
}

// HTTP Handlers

// Health check endpoint
func (tts *TTSService) healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	
	// Test if 'say' command is available
	cmd := exec.Command("say", "-v", "?")
	err := cmd.Run()
	ttsReady := err == nil

	health := HealthResponse{
		Status:          "healthy",
		TTSReady:        ttsReady,
		AvailableVoices: tts.getAvailableVoices(),
		Uptime:          int64(time.Since(tts.startTime).Seconds()),
	}

	json.NewEncoder(w).Encode(health)
}

// Synthesis endpoint (HTTP)
func (tts *TTSService) synthesizeHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req TTSRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid JSON: %v", err), http.StatusBadRequest)
		return
	}

	if req.Text == "" {
		http.Error(w, "Text field is required", http.StatusBadRequest)
		return
	}

	response, err := tts.synthesizeText(req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(response)
}

// Speak endpoint (immediate playback, no audio return)
func (tts *TTSService) speakHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req TTSRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid JSON: %v", err), http.StatusBadRequest)
		return
	}

	if req.Text == "" {
		http.Error(w, "Text field is required", http.StatusBadRequest)
		return
	}

	start := time.Now()

	// Set defaults
	voice := req.Voice
	if voice == "" {
		voice = tts.config.DefaultVoice
	}

	rate := req.Rate
	if rate == 0 {
		rate = 200
	}

	// Execute immediate TTS (no file output)
	cmd := exec.Command("say", "-v", voice, "-r", fmt.Sprintf("%.0f", rate), req.Text)
	err := cmd.Run()

	response := TTSResponse{
		Success:        err == nil,
		Voice:          voice,
		ProcessingTime: time.Since(start).Milliseconds(),
	}

	if err != nil {
		response.Message = fmt.Sprintf("Speech playback failed: %v", err)
		http.Error(w, response.Message, http.StatusInternalServerError)
		return
	}

	response.Message = "Speech played successfully"
	json.NewEncoder(w).Encode(response)
}

// Get available voices endpoint
func (tts *TTSService) voicesHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	
	voices := tts.getAvailableVoices()
	response := map[string]interface{}{
		"voices": voices,
		"default": tts.config.DefaultVoice,
	}
	
	json.NewEncoder(w).Encode(response)
}

// WebSocket handler for streaming TTS
func (tts *TTSService) websocketHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := tts.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	log.Printf("TTS WebSocket connection established")

	for {
		var req TTSRequest
		err := conn.ReadJSON(&req)
		if err != nil {
			log.Printf("WebSocket read error: %v", err)
			break
		}

		if req.Text == "" {
			conn.WriteJSON(TTSResponse{
				Success: false,
				Message: "Text field is required",
			})
			continue
		}

		response, err := tts.synthesizeText(req)
		if err != nil {
			conn.WriteJSON(TTSResponse{
				Success: false,
				Message: err.Error(),
			})
			continue
		}

		// Send response via WebSocket
		if err := conn.WriteJSON(response); err != nil {
			log.Printf("WebSocket write error: %v", err)
			break
		}
	}
}

// Start the TTS service
func (tts *TTSService) Start() error {
	router := mux.NewRouter()

	// API routes
	router.HandleFunc("/health", tts.healthHandler).Methods("GET")
	router.HandleFunc("/synthesize", tts.synthesizeHandler).Methods("POST")
	router.HandleFunc("/speak", tts.speakHandler).Methods("POST")
	router.HandleFunc("/voices", tts.voicesHandler).Methods("GET")
	router.HandleFunc("/ws", tts.websocketHandler)

	// CORS configuration
	c := cors.New(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"*"},
	})

	handler := c.Handler(router)
	addr := fmt.Sprintf("%s:%d", tts.config.Host, tts.config.Port)

	log.Printf("🗣️  Starting TTS Service on %s", addr)
	log.Printf("📱 Available voices: %v", tts.getAvailableVoices())
	log.Printf("🎯 Default voice: %s", tts.config.DefaultVoice)

	return http.ListenAndServe(addr, handler)
}

func main() {
	service := NewTTSService()
	
	log.Printf("🚀 Universal AI Tools - TTS Service")
	log.Printf("🎤 Native macOS Text-to-Speech Service")
	
	if err := service.Start(); err != nil {
		log.Fatalf("❌ Failed to start TTS service: %v", err)
	}
}