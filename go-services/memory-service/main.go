package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/lib/pq"
	"github.com/rs/cors"
	_ "github.com/lib/pq"
)

// Memory Service Configuration
type MemoryConfig struct {
	Port           int    `json:"port"`
	Host           string `json:"host"`
	DatabaseURL    string `json:"database_url"`
	LearningWindow int    `json:"learning_window_hours"`
}

// Interaction represents a user interaction with the AI
type Interaction struct {
	ID             int64           `json:"id"`
	UserID         string          `json:"user_id"`
	UserInput      string          `json:"user_input"`
	AssistantResponse string       `json:"assistant_response"`
	Context        json.RawMessage `json:"context,omitempty"`
	SuccessRating  int             `json:"success_rating"` // 1-5 scale
	Timestamp      time.Time       `json:"timestamp"`
	TaskType       string          `json:"task_type,omitempty"`
	Metadata       json.RawMessage `json:"metadata,omitempty"`
}

// UserPreferences represents learned user preferences
type UserPreferences struct {
	UserID            string                 `json:"user_id"`
	PreferredVoice    string                 `json:"preferred_voice"`
	PreferredTasks    []string              `json:"preferred_tasks"`
	WorkingHours      []int                 `json:"working_hours"`
	CommunicationStyle string               `json:"communication_style"`
	CustomSettings    map[string]interface{} `json:"custom_settings"`
	LastUpdated       time.Time             `json:"last_updated"`
}

// MemoryQuery represents a query for similar interactions
type MemoryQuery struct {
	Query     string    `json:"query"`
	UserID    string    `json:"user_id,omitempty"`
	TaskType  string    `json:"task_type,omitempty"`
	TimeRange string    `json:"time_range,omitempty"` // "24h", "7d", "30d"
	Limit     int       `json:"limit,omitempty"`
}

// MemoryResponse represents search results
type MemoryResponse struct {
	Success      bool          `json:"success"`
	Results      []Interaction `json:"results"`
	TotalCount   int           `json:"total_count"`
	SearchTime   int64         `json:"search_time_ms"`
	Suggestions  []string      `json:"suggestions,omitempty"`
}

// Learning insights
type LearningInsights struct {
	UserID              string             `json:"user_id"`
	TotalInteractions   int                `json:"total_interactions"`
	SuccessRate         float64            `json:"success_rate"`
	TopTasks            []string           `json:"top_tasks"`
	PreferredTimes      []int              `json:"preferred_times"`
	ImprovementAreas    []string           `json:"improvement_areas"`
	Preferences         UserPreferences    `json:"preferences"`
	RecentPatterns      []string           `json:"recent_patterns"`
	GeneratedAt         time.Time          `json:"generated_at"`
}

// Memory Service implementation
type MemoryService struct {
	config MemoryConfig
	db     *sql.DB
	startTime time.Time
}

// Initialize Memory Service
func NewMemoryService() *MemoryService {
	config := MemoryConfig{
		Port:           8087,
		Host:           "0.0.0.0",
		DatabaseURL:    "postgres://postgres:postgres@localhost:54322/postgres?sslmode=disable",
		LearningWindow: 168, // 7 days
	}

	// Override with environment variables
	if port := os.Getenv("MEMORY_PORT"); port != "" {
		if p, err := strconv.Atoi(port); err == nil {
			config.Port = p
		}
	}

	if dbURL := os.Getenv("DATABASE_URL"); dbURL != "" {
		config.DatabaseURL = dbURL
	}

	return &MemoryService{
		config:    config,
		startTime: time.Now(),
	}
}

// Initialize database connection and tables
func (ms *MemoryService) initDatabase() error {
	var err error
	ms.db, err = sql.Open("postgres", ms.config.DatabaseURL)
	if err != nil {
		return fmt.Errorf("failed to connect to database: %v", err)
	}

	// Test connection
	if err := ms.db.Ping(); err != nil {
		return fmt.Errorf("database ping failed: %v", err)
	}

	// Create tables if they don't exist
	err = ms.createTables()
	if err != nil {
		return fmt.Errorf("failed to create tables: %v", err)
	}

	log.Printf("✅ Connected to PostgreSQL database")
	return nil
}

// Create necessary database tables
func (ms *MemoryService) createTables() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS user_interactions (
			id SERIAL PRIMARY KEY,
			user_id VARCHAR(255) NOT NULL,
			user_input TEXT NOT NULL,
			assistant_response TEXT NOT NULL,
			context JSONB DEFAULT '{}',
			success_rating INTEGER CHECK (success_rating >= 1 AND success_rating <= 5),
			timestamp TIMESTAMPTZ DEFAULT NOW(),
			task_type VARCHAR(255),
			metadata JSONB DEFAULT '{}'
		)`,
		
		`CREATE TABLE IF NOT EXISTS user_preferences (
			user_id VARCHAR(255) PRIMARY KEY,
			preferred_voice VARCHAR(255) DEFAULT 'Alex',
			preferred_tasks TEXT[] DEFAULT '{}',
			working_hours INTEGER[] DEFAULT '{}',
			communication_style VARCHAR(255) DEFAULT 'friendly',
			custom_settings JSONB DEFAULT '{}',
			last_updated TIMESTAMPTZ DEFAULT NOW()
		)`,
		
		// Create indexes for better search performance
		`CREATE INDEX IF NOT EXISTS idx_interactions_user_id ON user_interactions(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_interactions_timestamp ON user_interactions(timestamp)`,
		`CREATE INDEX IF NOT EXISTS idx_interactions_task_type ON user_interactions(task_type)`,
		`CREATE INDEX IF NOT EXISTS idx_interactions_text_search ON user_interactions USING gin(to_tsvector('english', user_input || ' ' || assistant_response))`,
	}

	for _, query := range queries {
		if _, err := ms.db.Exec(query); err != nil {
			return fmt.Errorf("failed to execute query: %v", err)
		}
	}

	return nil
}

// Store a new interaction
func (ms *MemoryService) storeInteraction(interaction Interaction) error {
	query := `
		INSERT INTO user_interactions (user_id, user_input, assistant_response, context, success_rating, task_type, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, timestamp
	`
	
	err := ms.db.QueryRow(
		query,
		interaction.UserID,
		interaction.UserInput,
		interaction.AssistantResponse,
		interaction.Context,
		interaction.SuccessRating,
		interaction.TaskType,
		interaction.Metadata,
	).Scan(&interaction.ID, &interaction.Timestamp)
	
	return err
}

// Search for similar interactions
func (ms *MemoryService) searchSimilar(query MemoryQuery) (*MemoryResponse, error) {
	start := time.Now()
	
	var whereClause strings.Builder
	var args []interface{}
	argCount := 0

	whereClause.WriteString("WHERE 1=1")

	// User filter
	if query.UserID != "" {
		argCount++
		whereClause.WriteString(fmt.Sprintf(" AND user_id = $%d", argCount))
		args = append(args, query.UserID)
	}

	// Task type filter
	if query.TaskType != "" {
		argCount++
		whereClause.WriteString(fmt.Sprintf(" AND task_type = $%d", argCount))
		args = append(args, query.TaskType)
	}

	// Time range filter
	if query.TimeRange != "" {
		argCount++
		timeFilter := ms.parseTimeRange(query.TimeRange)
		whereClause.WriteString(fmt.Sprintf(" AND timestamp >= $%d", argCount))
		args = append(args, timeFilter)
	}

	// Text search using full-text search
	if query.Query != "" {
		argCount++
		whereClause.WriteString(fmt.Sprintf(" AND to_tsvector('english', user_input || ' ' || assistant_response) @@ plainto_tsquery('english', $%d)", argCount))
		args = append(args, query.Query)
	}

	limit := query.Limit
	if limit == 0 || limit > 50 {
		limit = 10
	}

	sqlQuery := fmt.Sprintf(`
		SELECT id, user_id, user_input, assistant_response, context, success_rating, timestamp, task_type, metadata
		FROM user_interactions 
		%s 
		ORDER BY timestamp DESC 
		LIMIT %d
	`, whereClause.String(), limit)

	rows, err := ms.db.Query(sqlQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("search query failed: %v", err)
	}
	defer rows.Close()

	var results []Interaction
	for rows.Next() {
		var interaction Interaction
		err := rows.Scan(
			&interaction.ID,
			&interaction.UserID,
			&interaction.UserInput,
			&interaction.AssistantResponse,
			&interaction.Context,
			&interaction.SuccessRating,
			&interaction.Timestamp,
			&interaction.TaskType,
			&interaction.Metadata,
		)
		if err != nil {
			continue
		}
		results = append(results, interaction)
	}

	// Get total count
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM user_interactions %s", whereClause.String())
	var totalCount int
	ms.db.QueryRow(countQuery, args...).Scan(&totalCount)

	return &MemoryResponse{
		Success:    true,
		Results:    results,
		TotalCount: totalCount,
		SearchTime: time.Since(start).Milliseconds(),
	}, nil
}

// Learn user preferences from interactions
func (ms *MemoryService) learnPreferences(userID string) (*UserPreferences, error) {
	// Get recent interactions for learning
	query := `
		SELECT task_type, success_rating, EXTRACT(hour FROM timestamp) as hour, metadata
		FROM user_interactions 
		WHERE user_id = $1 AND timestamp >= NOW() - INTERVAL '%d hours'
		ORDER BY timestamp DESC
	`

	rows, err := ms.db.Query(fmt.Sprintf(query, ms.config.LearningWindow), userID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch learning data: %v", err)
	}
	defer rows.Close()

	taskCounts := make(map[string]int)
	hourCounts := make(map[int]int)
	var totalRating, totalInteractions int

	for rows.Next() {
		var taskType sql.NullString
		var rating sql.NullInt32
		var hour int
		var metadata json.RawMessage

		rows.Scan(&taskType, &rating, &hour, &metadata)

		if taskType.Valid {
			taskCounts[taskType.String]++
		}
		
		if rating.Valid {
			totalRating += int(rating.Int32)
			totalInteractions++
		}
		
		hourCounts[hour]++
	}

	// Build preferences
	preferences := UserPreferences{
		UserID:      userID,
		LastUpdated: time.Now(),
	}

	// Find preferred tasks (top 3)
	for task, count := range taskCounts {
		if count >= 2 { // Only include tasks done multiple times
			preferences.PreferredTasks = append(preferences.PreferredTasks, task)
		}
	}

	// Find preferred working hours (hours with most activity)
	for hour, count := range hourCounts {
		if count >= 2 {
			preferences.WorkingHours = append(preferences.WorkingHours, hour)
		}
	}

	// Determine communication style based on success rates
	if totalInteractions > 0 {
		successRate := float64(totalRating) / float64(totalInteractions)
		if successRate >= 4.0 {
			preferences.CommunicationStyle = "detailed"
		} else if successRate >= 3.0 {
			preferences.CommunicationStyle = "friendly"
		} else {
			preferences.CommunicationStyle = "concise"
		}
	}

	// Store or update preferences
	ms.storePreferences(preferences)

	return &preferences, nil
}

// Store user preferences
func (ms *MemoryService) storePreferences(prefs UserPreferences) error {
	query := `
		INSERT INTO user_preferences (user_id, preferred_voice, preferred_tasks, working_hours, communication_style, custom_settings)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (user_id) DO UPDATE SET
			preferred_voice = EXCLUDED.preferred_voice,
			preferred_tasks = EXCLUDED.preferred_tasks,
			working_hours = EXCLUDED.working_hours,
			communication_style = EXCLUDED.communication_style,
			custom_settings = EXCLUDED.custom_settings,
			last_updated = NOW()
	`

	customSettingsJSON, _ := json.Marshal(prefs.CustomSettings)
	
	_, err := ms.db.Exec(
		query,
		prefs.UserID,
		prefs.PreferredVoice,
		pq.Array(prefs.PreferredTasks),
		pq.Array(prefs.WorkingHours),
		prefs.CommunicationStyle,
		customSettingsJSON,
	)

	return err
}

// Generate learning insights
func (ms *MemoryService) generateInsights(userID string) (*LearningInsights, error) {
	preferences, err := ms.learnPreferences(userID)
	if err != nil {
		return nil, err
	}

	// Get interaction statistics
	var totalInteractions int
	var avgRating float64
	
	query := `
		SELECT COUNT(*), AVG(success_rating)
		FROM user_interactions 
		WHERE user_id = $1
	`
	ms.db.QueryRow(query, userID).Scan(&totalInteractions, &avgRating)

	insights := LearningInsights{
		UserID:            userID,
		TotalInteractions: totalInteractions,
		SuccessRate:       avgRating,
		Preferences:       *preferences,
		GeneratedAt:       time.Now(),
	}

	return &insights, nil
}

// Utility function to parse time range
func (ms *MemoryService) parseTimeRange(timeRange string) time.Time {
	now := time.Now()
	
	switch timeRange {
	case "1h":
		return now.Add(-1 * time.Hour)
	case "24h":
		return now.Add(-24 * time.Hour)
	case "7d":
		return now.Add(-7 * 24 * time.Hour)
	case "30d":
		return now.Add(-30 * 24 * time.Hour)
	default:
		return now.Add(-24 * time.Hour)
	}
}

// HTTP Handlers

// Health check
func (ms *MemoryService) healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Test database connection
	dbHealthy := ms.db.Ping() == nil

	health := map[string]interface{}{
		"status":     "healthy",
		"database":   dbHealthy,
		"uptime":     int64(time.Since(ms.startTime).Seconds()),
	}

	json.NewEncoder(w).Encode(health)
}

// Store interaction
func (ms *MemoryService) storeHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var interaction Interaction
	if err := json.NewDecoder(r.Body).Decode(&interaction); err != nil {
		http.Error(w, fmt.Sprintf("Invalid JSON: %v", err), http.StatusBadRequest)
		return
	}

	// Set default user ID if not provided
	if interaction.UserID == "" {
		interaction.UserID = "default"
	}

	err := ms.storeInteraction(interaction)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"success": true,
		"message": "Interaction stored successfully",
		"id":      interaction.ID,
	}

	json.NewEncoder(w).Encode(response)
}

// Search interactions
func (ms *MemoryService) searchHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var query MemoryQuery
	if err := json.NewDecoder(r.Body).Decode(&query); err != nil {
		http.Error(w, fmt.Sprintf("Invalid JSON: %v", err), http.StatusBadRequest)
		return
	}

	results, err := ms.searchSimilar(query)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(results)
}

// Get learning insights
func (ms *MemoryService) insightsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	vars := mux.Vars(r)
	userID := vars["userID"]
	if userID == "" {
		userID = "default"
	}

	insights, err := ms.generateInsights(userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(insights)
}

// Start the Memory Service
func (ms *MemoryService) Start() error {
	// Initialize database
	if err := ms.initDatabase(); err != nil {
		return err
	}

	router := mux.NewRouter()

	// API routes
	router.HandleFunc("/health", ms.healthHandler).Methods("GET")
	router.HandleFunc("/store", ms.storeHandler).Methods("POST")
	router.HandleFunc("/search", ms.searchHandler).Methods("POST")
	router.HandleFunc("/insights/{userID}", ms.insightsHandler).Methods("GET")

	// CORS configuration
	c := cors.New(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"*"},
	})

	handler := c.Handler(router)
	addr := fmt.Sprintf("%s:%d", ms.config.Host, ms.config.Port)

	log.Printf("🧠 Starting Memory Service on %s", addr)
	log.Printf("📚 Connected to database: %s", ms.config.DatabaseURL)
	log.Printf("⏱️  Learning window: %d hours", ms.config.LearningWindow)

	return http.ListenAndServe(addr, handler)
}

func main() {
	service := NewMemoryService()
	
	log.Printf("🚀 Universal AI Tools - Memory Service")
	log.Printf("🧠 AI Learning and Memory Management Service")
	
	if err := service.Start(); err != nil {
		log.Fatalf("❌ Failed to start Memory service: %v", err)
	}
}