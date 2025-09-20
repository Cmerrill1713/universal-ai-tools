package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"
)

func TestSelfCorrectionLoggingAndHandlers(t *testing.T) {
	tempDir := t.TempDir()
	logFile := tempDir + "/self_corrections.jsonl"
	os.Setenv("SELF_CORRECTION_LOG_PATH", logFile)
	defer os.Unsetenv("SELF_CORRECTION_LOG_PATH")

	service := NewChatService()
	now := time.Now()
	service.modelStats["hrm"] = &ModelStats{Success: 0, Failure: 10, LastUpdated: now}
	service.modelStats["mlx"] = &ModelStats{Success: 0, Failure: 10, LastUpdated: now}
	service.modelStats["ollama"] = &ModelStats{Success: 0, Failure: 10, LastUpdated: now}
	service.modelStats["lm-studio"] = &ModelStats{Success: 0, Failure: 10, LastUpdated: now}

	service.lastUserMessage = "Give me a brief status update"
	service.lastAssistantResponse = "I can help you with many tasks."

	candidate, ok := service.runSelfCorrectionPipeline()
	if !ok {
		t.Fatalf("expected a self-correction candidate")
	}
	if candidate.Source == "" {
		t.Fatalf("expected candidate source to be set")
	}

	entries, err := service.loadSelfCorrectionEntries(10)
	if err != nil {
		t.Fatalf("loadSelfCorrectionEntries error: %v", err)
	}
	if len(entries) == 0 {
		t.Fatalf("expected at least one log entry")
	}

	req := httptest.NewRequest(http.MethodGet, "/self-corrections?limit=5", nil)
	w := httptest.NewRecorder()
	service.selfCorrectionsHandler(w, req)
	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected status: %d", resp.StatusCode)
	}
	var payload map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload["success"] != true {
		t.Fatalf("handler did not return success")
	}

	reqSummary := httptest.NewRequest(http.MethodGet, "/self-corrections/summary", nil)
	wSummary := httptest.NewRecorder()
	service.selfCorrectionSummaryHandler(wSummary, reqSummary)
	if wSummary.Result().StatusCode != http.StatusOK {
		t.Fatalf("summary handler status %d", wSummary.Result().StatusCode)
	}
}
