package main

import (
    "bytes"
    "encoding/json"
    "log"
    "net/http"
    "os"
    "time"

    "github.com/gin-gonic/gin"
)

type BuildContextRequest struct {
    Message string                 `json:"message"`
    Limit   int                    `json:"limit"`
    Filters map[string]interface{} `json:"filters"`
}

type SearchRequest struct {
    Query   string                 `json:"query"`
    Limit   int                    `json:"limit"`
    Filters map[string]interface{} `json:"filters"`
}

type KnowledgeResult struct {
    ID        string                 `json:"id"`
    Title     string                 `json:"title"`
    Content   string                 `json:"content"`
    Source    string                 `json:"source"`
    Relevance float64                `json:"relevance"`
    Metadata  map[string]interface{} `json:"metadata"`
}

type BuildContextResponse struct {
    Context string           `json:"context"`
    Sources []KnowledgeResult `json:"sources"`
    Tokens  int              `json:"tokens"`
    GeneratedAt string       `json:"generated_at"`
}

func getEnv(key, def string) string { if v := os.Getenv(key); v != "" { return v }; return def }

func buildContextHandler(c *gin.Context) {
    var req BuildContextRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    if req.Limit == 0 { req.Limit = 5 }

    gatewayURL := getEnv("KNOWLEDGE_GATEWAY_URL", "")
    var sources []KnowledgeResult
    if gatewayURL != "" && req.Message != "" {
        // Ask knowledge gateway for relevant docs
        sr := SearchRequest{Query: req.Message, Limit: req.Limit, Filters: req.Filters}
        body, _ := json.Marshal(sr)
        resp, err := http.Post(gatewayURL+"/api/v1/search", "application/json", bytes.NewReader(body))
        if err == nil && resp.StatusCode == http.StatusOK {
            var payload struct { Results []KnowledgeResult `json:"results"` }
            _ = json.NewDecoder(resp.Body).Decode(&payload)
            _ = resp.Body.Close()
            sources = payload.Results
        }
    }

    // Collapse sources into a single context string (simple concatenation)
    ctx := req.Message
    for _, s := range sources {
        if s.Content != "" {
            ctx += "\n\n---\n" + s.Title + "\n" + s.Content
        }
    }

    c.JSON(http.StatusOK, BuildContextResponse{
        Context: ctx,
        Sources: sources,
        Tokens:  len(ctx),
        GeneratedAt: time.Now().UTC().Format(time.RFC3339),
    })
}

func main() {
    r := gin.Default()
    r.GET("/health", func(c *gin.Context){ c.JSON(http.StatusOK, gin.H{"status":"healthy","service":"knowledge-context"}) })
    api := r.Group("/api/v1")
    api.POST("/context/build", buildContextHandler)

    port := getEnv("PORT", "8083")
    log.Printf("Knowledge Context service on :%s", port)
    if err := r.Run(":"+port); err != nil {
        log.Fatal(err)
    }
}
