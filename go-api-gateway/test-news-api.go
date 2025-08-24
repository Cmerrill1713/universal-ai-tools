// Test script for News API functionality
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"
)

type NewsResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Items      []NewsItem `json:"items"`
		Total      int        `json:"total"`
		Category   string     `json:"category"`
		CachedAt   time.Time  `json:"cachedAt,omitempty"`
		NextUpdate time.Time  `json:"nextUpdate,omitempty"`
		Sources    []string   `json:"sources,omitempty"`
	} `json:"data"`
	Metadata struct {
		Timestamp      string `json:"timestamp"`
		RequestID      string `json:"requestId"`
		CacheHit       bool   `json:"cacheHit"`
		FetchTime      string `json:"fetchTime"`
		Implementation string `json:"implementation"`
		Version        string `json:"version"`
	} `json:"metadata"`
}

type NewsItem struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Summary     string    `json:"summary"`
	Source      string    `json:"source"`
	URL         string    `json:"url"`
	Category    string    `json:"category"`
	HasVideo    bool      `json:"hasVideo"`
	PublishedAt time.Time `json:"publishedAt"`
	ReadTime    int       `json:"readTime"`
}

func main() {
	baseURL := "http://localhost:8080"
	
	fmt.Println("🧪 Testing News API endpoints...")
	
	// Test 1: Get categories
	fmt.Println("\n1. Testing /api/v1/news/categories")
	resp, err := http.Get(baseURL + "/api/v1/news/categories")
	if err != nil {
		log.Printf("❌ Error fetching categories: %v", err)
	} else {
		fmt.Printf("✅ Categories endpoint: Status %d\n", resp.StatusCode)
		resp.Body.Close()
	}
	
	// Test 2: Get all news
	fmt.Println("\n2. Testing /api/v1/news (all categories)")
	resp, err = http.Get(baseURL + "/api/v1/news?limit=5")
	if err != nil {
		log.Printf("❌ Error fetching news: %v", err)
	} else {
		defer resp.Body.Close()
		var newsResp NewsResponse
		if err := json.NewDecoder(resp.Body).Decode(&newsResp); err != nil {
			log.Printf("❌ Error decoding response: %v", err)
		} else {
			fmt.Printf("✅ All news: Status %d, Items: %d, Cache: %v\n", 
				resp.StatusCode, len(newsResp.Data.Items), newsResp.Metadata.CacheHit)
			
			if len(newsResp.Data.Items) > 0 {
				item := newsResp.Data.Items[0]
				fmt.Printf("   Sample: '%s' from %s (%s)\n", 
					truncate(item.Title, 50), item.Source, item.Category)
			}
		}
	}
	
	// Test 3: Get AI/ML news
	fmt.Println("\n3. Testing /api/v1/news?category=ai-ml")
	resp, err = http.Get(baseURL + "/api/v1/news?category=ai-ml&limit=3")
	if err != nil {
		log.Printf("❌ Error fetching AI/ML news: %v", err)
	} else {
		defer resp.Body.Close()
		var newsResp NewsResponse
		if err := json.NewDecoder(resp.Body).Decode(&newsResp); err != nil {
			log.Printf("❌ Error decoding response: %v", err)
		} else {
			fmt.Printf("✅ AI/ML news: Status %d, Items: %d\n", 
				resp.StatusCode, len(newsResp.Data.Items))
		}
	}
	
	// Test 4: Get stats
	fmt.Println("\n4. Testing /api/v1/news/stats")
	resp, err = http.Get(baseURL + "/api/v1/news/stats")
	if err != nil {
		log.Printf("❌ Error fetching stats: %v", err)
	} else {
		fmt.Printf("✅ Stats endpoint: Status %d\n", resp.StatusCode)
		resp.Body.Close()
	}
	
	// Test 5: Test refresh
	fmt.Println("\n5. Testing /api/v1/news/refresh")
	resp, err = http.Get(baseURL + "/api/v1/news/refresh")
	if err != nil {
		log.Printf("❌ Error refreshing cache: %v", err)
	} else {
		fmt.Printf("✅ Refresh endpoint: Status %d\n", resp.StatusCode)
		resp.Body.Close()
	}
	
	fmt.Println("\n🎉 News API test completed!")
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}