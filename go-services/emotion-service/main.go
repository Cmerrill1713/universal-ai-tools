package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/rs/cors"
	_ "github.com/lib/pq"
)

// Emotion Service Configuration
type EmotionConfig struct {
	Port           int    `json:"port"`
	Host           string `json:"host"`
	DatabaseURL    string `json:"database_url"`
	ConfidenceThreshold float32 `json:"confidence_threshold"`
}

// Emotion Analysis Request
type EmotionRequest struct {
	Text     string `json:"text"`
	UserID   string `json:"user_id,omitempty"`
	Context  string `json:"context,omitempty"`
	Language string `json:"language,omitempty"`
}

// Emotion Score represents individual emotion confidence
type EmotionScore struct {
	Emotion    string  `json:"emotion"`
	Confidence float32 `json:"confidence"`
	Intensity  string  `json:"intensity"` // low, medium, high
}

// Emotion Analysis Response
type EmotionResponse struct {
	Success          bool           `json:"success"`
	Message          string         `json:"message,omitempty"`
	PrimaryEmotion   string         `json:"primary_emotion"`
	EmotionScores    []EmotionScore `json:"emotion_scores"`
	Sentiment        string         `json:"sentiment"` // positive, negative, neutral
	SentimentScore   float32        `json:"sentiment_score"`
	Confidence       float32        `json:"confidence"`
	ProcessingTime   int64          `json:"processing_time_ms"`
	Analysis         EmotionAnalysis `json:"analysis"`
}

// Detailed emotion analysis
type EmotionAnalysis struct {
	TextLength      int      `json:"text_length"`
	KeyPhrases      []string `json:"key_phrases"`
	EmotionalWords  []string `json:"emotional_words"`
	Subjectivity    float32  `json:"subjectivity"` // 0-1 (objective to subjective)
	Arousal         float32  `json:"arousal"`      // 0-1 (calm to excited)
	Valence         float32  `json:"valence"`      // -1 to 1 (negative to positive)
}

// Health Response
type HealthResponse struct {
	Status           string `json:"status"`
	EmotionEngine    bool   `json:"emotion_engine"`
	DatabaseConnected bool  `json:"database_connected"`
	Uptime           int64  `json:"uptime_seconds"`
	AnalysisCount    int64  `json:"analysis_count"`
}

// Stored emotion analysis for learning
type StoredEmotion struct {
	ID               int64           `json:"id"`
	UserID           string          `json:"user_id"`
	Text             string          `json:"text"`
	PrimaryEmotion   string          `json:"primary_emotion"`
	SentimentScore   float32         `json:"sentiment_score"`
	Context          string          `json:"context,omitempty"`
	Confidence       float32         `json:"confidence"`
	Timestamp        time.Time       `json:"timestamp"`
}

// Emotion Service implementation
type EmotionService struct {
	config       EmotionConfig
	db           *sql.DB
	startTime    time.Time
	analysisCount int64
	
	// Emotion lexicons and patterns
	positiveWords  map[string]float32
	negativeWords  map[string]float32
	emotionPatterns map[string][]*regexp.Regexp
	intensifiers   map[string]float32
}

// Initialize Emotion Service
func NewEmotionService() *EmotionService {
	config := EmotionConfig{
		Port:                8088,
		Host:                "0.0.0.0", 
		DatabaseURL:         "postgres://postgres:postgres@localhost:54322/postgres?sslmode=disable",
		ConfidenceThreshold: 0.6,
	}

	// Override with environment variables
	if port := os.Getenv("EMOTION_PORT"); port != "" {
		if p, err := strconv.Atoi(port); err == nil {
			config.Port = p
		}
	}

	if dbURL := os.Getenv("DATABASE_URL"); dbURL != "" {
		config.DatabaseURL = dbURL
	}

	service := &EmotionService{
		config:    config,
		startTime: time.Now(),
	}

	service.initEmotionLexicons()
	return service
}

// Initialize emotion lexicons and patterns
func (es *EmotionService) initEmotionLexicons() {
	// Positive emotion words with weights
	es.positiveWords = map[string]float32{
		"happy":      0.8, "joy":        0.9, "excited":    0.8, "love":       0.9, "amazing":    0.7,
		"wonderful":  0.8, "fantastic":  0.8, "great":      0.6, "good":       0.5, "excellent":  0.8,
		"awesome":    0.7, "brilliant":  0.8, "perfect":    0.8, "beautiful":  0.7, "delighted":  0.8,
		"thrilled":   0.9, "ecstatic":   0.9, "cheerful":   0.7, "pleased":    0.6, "satisfied":  0.6,
		"grateful":   0.7, "optimistic": 0.7, "confident":  0.7, "proud":      0.7, "hopeful":    0.6,
		"calm":       0.5, "peaceful":   0.6, "relaxed":    0.6, "content":    0.6, "serene":     0.7,
	}

	// Negative emotion words with weights
	es.negativeWords = map[string]float32{
		"sad":        -0.7, "angry":      -0.8, "hate":       -0.9, "terrible":   -0.8, "awful":      -0.8,
		"horrible":   -0.8, "disgusting": -0.8, "disappointed": -0.7, "frustrated": -0.7, "annoyed":   -0.6,
		"furious":    -0.9, "outraged":   -0.9, "depressed":  -0.8, "miserable":  -0.8, "devastated": -0.9,
		"worried":    -0.6, "anxious":    -0.7, "scared":     -0.7, "fearful":    -0.7, "nervous":    -0.6,
		"stressed":   -0.7, "overwhelmed": -0.7, "confused":  -0.5, "lost":       -0.6, "hopeless":   -0.8,
		"tired":      -0.4, "exhausted":  -0.6, "bored":      -0.4, "lonely":     -0.7, "isolated":   -0.7,
	}

	// Intensifiers that modify emotion strength
	es.intensifiers = map[string]float32{
		"very":       1.3, "extremely":  1.5, "really":     1.2, "quite":      1.1, "rather":     1.1,
		"incredibly": 1.4, "absolutely": 1.4, "totally":    1.3, "completely": 1.4, "utterly":    1.4,
		"slightly":   0.7, "somewhat":   0.8, "kind of":    0.8, "sort of":    0.8, "a bit":      0.7,
		"a little":   0.7, "barely":     0.5, "hardly":     0.5, "not very":   0.4, "not really": 0.3,
	}

	// Emotion pattern recognition (regex patterns for complex emotions)
	es.emotionPatterns = map[string][]*regexp.Regexp{
		"excitement": {
			regexp.MustCompile(`(?i)\b(can't wait|so excited|thrilled|pumped up|over the moon)\b`),
			regexp.MustCompile(`(?i)\b(amazing|incredible|fantastic).*(!+)\b`),
		},
		"frustration": {
			regexp.MustCompile(`(?i)\b(fed up|sick of|tired of|had enough)\b`),
			regexp.MustCompile(`(?i)\b(why (is|are|does|do|did)|what the|this is ridiculous)\b`),
		},
		"anxiety": {
			regexp.MustCompile(`(?i)\b(worried about|concerned about|nervous about|anxious about)\b`),
			regexp.MustCompile(`(?i)\b(what if|i'm afraid|scared that|worried that)\b`),
		},
		"gratitude": {
			regexp.MustCompile(`(?i)\b(thank you|thanks|grateful|appreciate|blessed)\b`),
			regexp.MustCompile(`(?i)\b(so kind|really helped|means a lot)\b`),
		},
		"surprise": {
			regexp.MustCompile(`(?i)\b(wow|whoa|omg|unbelievable|didn't expect)\b`),
			regexp.MustCompile(`(?i)\b(surprised|shocked|stunned|amazed)\b`),
		},
		"disappointment": {
			regexp.MustCompile(`(?i)\b(let down|disappointed|expected more|not what i hoped)\b`),
			regexp.MustCompile(`(?i)\b(such a shame|what a waste|really hoped)\b`),
		},
	}
}

// Initialize database connection and tables
func (es *EmotionService) initDatabase() error {
	var err error
	es.db, err = sql.Open("postgres", es.config.DatabaseURL)
	if err != nil {
		return fmt.Errorf("failed to connect to database: %v", err)
	}

	// Test connection
	if err := es.db.Ping(); err != nil {
		return fmt.Errorf("database ping failed: %v", err)
	}

	// Create tables if they don't exist
	err = es.createTables()
	if err != nil {
		return fmt.Errorf("failed to create tables: %v", err)
	}

	log.Printf("✅ Connected to PostgreSQL database")
	return nil
}

// Create necessary database tables
func (es *EmotionService) createTables() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS emotion_analyses (
			id SERIAL PRIMARY KEY,
			user_id VARCHAR(255) NOT NULL,
			text TEXT NOT NULL,
			primary_emotion VARCHAR(100) NOT NULL,
			sentiment_score REAL NOT NULL,
			confidence REAL NOT NULL,
			context VARCHAR(255),
			arousal REAL DEFAULT 0.5,
			valence REAL DEFAULT 0.0,
			subjectivity REAL DEFAULT 0.5,
			timestamp TIMESTAMPTZ DEFAULT NOW()
		)`,
		
		// Create indexes for better query performance
		`CREATE INDEX IF NOT EXISTS idx_emotion_user_id ON emotion_analyses(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_emotion_timestamp ON emotion_analyses(timestamp)`,
		`CREATE INDEX IF NOT EXISTS idx_emotion_primary ON emotion_analyses(primary_emotion)`,
	}

	for _, query := range queries {
		if _, err := es.db.Exec(query); err != nil {
			return fmt.Errorf("failed to execute query: %v", err)
		}
	}

	return nil
}

// Main emotion analysis logic
func (es *EmotionService) analyzeEmotion(req EmotionRequest) (*EmotionResponse, error) {
	start := time.Now()

	text := strings.ToLower(strings.TrimSpace(req.Text))
	if text == "" {
		return nil, fmt.Errorf("text cannot be empty")
	}

	// Tokenize text
	words := strings.Fields(text)
	
	// Initialize emotion scores
	emotionScores := make(map[string]float32)
	
	// Analyze word-level emotions
	sentimentSum := float32(0.0)
	emotionalWords := []string{}
	
	for i, word := range words {
		// Check for intensifiers before current word
		intensifier := float32(1.0)
		if i > 0 {
			if modifier, exists := es.intensifiers[words[i-1]]; exists {
				intensifier = modifier
			}
		}
		
		// Check positive emotions
		if score, exists := es.positiveWords[word]; exists {
			adjustedScore := score * intensifier
			sentimentSum += adjustedScore
			emotionalWords = append(emotionalWords, word)
			
			// Map to broader emotion categories
			if adjustedScore > 0.7 {
				emotionScores["joy"] += adjustedScore
			} else if adjustedScore > 0.5 {
				emotionScores["contentment"] += adjustedScore
			}
		}
		
		// Check negative emotions  
		if score, exists := es.negativeWords[word]; exists {
			adjustedScore := score * intensifier
			sentimentSum += adjustedScore
			emotionalWords = append(emotionalWords, word)
			
			// Map to broader emotion categories
			if adjustedScore < -0.7 {
				if word == "angry" || word == "furious" || word == "outraged" {
					emotionScores["anger"] += float32(math.Abs(float64(adjustedScore)))
				} else if word == "sad" || word == "depressed" || word == "miserable" {
					emotionScores["sadness"] += float32(math.Abs(float64(adjustedScore)))
				} else if word == "scared" || word == "fearful" || word == "anxious" {
					emotionScores["fear"] += float32(math.Abs(float64(adjustedScore)))
				} else {
					emotionScores["negative"] += float32(math.Abs(float64(adjustedScore)))
				}
			}
		}
	}
	
	// Pattern-based emotion detection
	for emotion, patterns := range es.emotionPatterns {
		for _, pattern := range patterns {
			if pattern.MatchString(req.Text) {
				emotionScores[emotion] += 0.6
				break // Only count each pattern once per emotion
			}
		}
	}
	
	// Normalize scores and find primary emotion
	primaryEmotion := "neutral"
	maxScore := float32(0.0)
	
	var finalScores []EmotionScore
	for emotion, score := range emotionScores {
		if score > maxScore {
			maxScore = score
			primaryEmotion = emotion
		}
		
		// Determine intensity
		intensity := "low"
		if score > 0.7 {
			intensity = "high"
		} else if score > 0.4 {
			intensity = "medium"
		}
		
		finalScores = append(finalScores, EmotionScore{
			Emotion:    emotion,
			Confidence: float32(math.Min(float64(score), 1.0)),
			Intensity:  intensity,
		})
	}
	
	// Determine overall sentiment
	sentiment := "neutral"
	sentimentScore := sentimentSum / float32(len(words))
	if sentimentScore > 0.1 {
		sentiment = "positive"
	} else if sentimentScore < -0.1 {
		sentiment = "negative"
	}
	
	// Calculate valence, arousal, and subjectivity
	valence := float32(math.Max(-1.0, math.Min(1.0, float64(sentimentScore*2))))
	arousal := float32(math.Min(1.0, float64(maxScore)))
	subjectivity := float32(math.Min(1.0, float64(len(emotionalWords))/float64(len(words))))
	
	// Overall confidence based on emotional word density and pattern matches
	confidence := float32(math.Min(1.0, float64(len(emotionalWords))/float64(len(words))*3 + float64(maxScore)*0.5))
	
	// Build analysis details
	analysis := EmotionAnalysis{
		TextLength:     len(req.Text),
		KeyPhrases:     []string{}, // TODO: implement key phrase extraction
		EmotionalWords: emotionalWords,
		Subjectivity:   subjectivity,
		Arousal:        arousal,
		Valence:        valence,
	}

	response := &EmotionResponse{
		Success:        true,
		PrimaryEmotion: primaryEmotion,
		EmotionScores:  finalScores,
		Sentiment:      sentiment,
		SentimentScore: sentimentScore,
		Confidence:     confidence,
		ProcessingTime: time.Since(start).Milliseconds(),
		Analysis:       analysis,
	}

	// Store analysis if database is available and confidence is high enough
	if es.db != nil && confidence >= es.config.ConfidenceThreshold {
		es.storeEmotion(StoredEmotion{
			UserID:         req.UserID,
			Text:           req.Text,
			PrimaryEmotion: primaryEmotion,
			SentimentScore: sentimentScore,
			Context:        req.Context,
			Confidence:     confidence,
		})
	}

	es.analysisCount++
	return response, nil
}

// Store emotion analysis in database
func (es *EmotionService) storeEmotion(emotion StoredEmotion) error {
	query := `
		INSERT INTO emotion_analyses (user_id, text, primary_emotion, sentiment_score, confidence, context, arousal, valence, subjectivity)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`
	
	// Use default values for arousal, valence, subjectivity for now
	_, err := es.db.Exec(
		query,
		emotion.UserID,
		emotion.Text,
		emotion.PrimaryEmotion,
		emotion.SentimentScore,
		emotion.Confidence,
		emotion.Context,
		0.5, // arousal
		emotion.SentimentScore, // valence approximated from sentiment
		0.5, // subjectivity
	)
	
	return err
}

// HTTP Handlers

// Health check endpoint
func (es *EmotionService) healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Test database connection
	dbHealthy := false
	if es.db != nil {
		dbHealthy = es.db.Ping() == nil
	}

	health := HealthResponse{
		Status:            "healthy",
		EmotionEngine:     true,
		DatabaseConnected: dbHealthy,
		Uptime:            int64(time.Since(es.startTime).Seconds()),
		AnalysisCount:     es.analysisCount,
	}

	json.NewEncoder(w).Encode(health)
}

// Emotion analysis endpoint
func (es *EmotionService) analyzeHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req EmotionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid JSON: %v", err), http.StatusBadRequest)
		return
	}

	if req.Text == "" {
		http.Error(w, "Text field is required", http.StatusBadRequest)
		return
	}

	// Set default user ID if not provided
	if req.UserID == "" {
		req.UserID = "default"
	}

	response, err := es.analyzeEmotion(req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(response)
}

// Get user emotion history
func (es *EmotionService) historyHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if es.db == nil {
		http.Error(w, "Database not available", http.StatusServiceUnavailable)
		return
	}

	vars := mux.Vars(r)
	userID := vars["userID"]
	if userID == "" {
		userID = "default"
	}

	// Get recent emotion history
	query := `
		SELECT id, user_id, text, primary_emotion, sentiment_score, confidence, context, timestamp
		FROM emotion_analyses 
		WHERE user_id = $1 
		ORDER BY timestamp DESC 
		LIMIT 20
	`

	rows, err := es.db.Query(query, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var history []StoredEmotion
	for rows.Next() {
		var emotion StoredEmotion
		err := rows.Scan(
			&emotion.ID,
			&emotion.UserID,
			&emotion.Text,
			&emotion.PrimaryEmotion,
			&emotion.SentimentScore,
			&emotion.Confidence,
			&emotion.Context,
			&emotion.Timestamp,
		)
		if err != nil {
			continue
		}
		history = append(history, emotion)
	}

	response := map[string]interface{}{
		"user_id": userID,
		"history": history,
		"count":   len(history),
	}

	json.NewEncoder(w).Encode(response)
}

// Start the Emotion Service
func (es *EmotionService) Start() error {
	// Initialize database
	if err := es.initDatabase(); err != nil {
		log.Printf("Warning: Database initialization failed: %v", err)
		log.Printf("Continuing without database storage...")
	}

	router := mux.NewRouter()

	// API routes
	router.HandleFunc("/health", es.healthHandler).Methods("GET")
	router.HandleFunc("/analyze", es.analyzeHandler).Methods("POST")
	router.HandleFunc("/history/{userID}", es.historyHandler).Methods("GET")

	// CORS configuration
	c := cors.New(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"*"},
	})

	handler := c.Handler(router)
	addr := fmt.Sprintf("%s:%d", es.config.Host, es.config.Port)

	log.Printf("😊 Starting Emotion Service on %s", addr)
	log.Printf("🧠 Emotion lexicons loaded: %d positive, %d negative", len(es.positiveWords), len(es.negativeWords))
	log.Printf("🎯 Pattern recognition: %d emotion patterns", len(es.emotionPatterns))
	log.Printf("📊 Confidence threshold: %.2f", es.config.ConfidenceThreshold)

	return http.ListenAndServe(addr, handler)
}

func main() {
	service := NewEmotionService()
	
	log.Printf("🚀 Universal AI Tools - Emotion Service")
	log.Printf("🎭 Advanced Sentiment and Emotion Analysis Service")
	
	if err := service.Start(); err != nil {
		log.Fatalf("❌ Failed to start Emotion service: %v", err)
	}
}