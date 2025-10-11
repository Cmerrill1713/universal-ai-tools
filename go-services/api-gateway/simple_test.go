package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
)

func main() {
	fmt.Println("🧪 Starting Simple API Gateway Test...")

	// Create a simple HTTP server without gorilla/mux
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status": "healthy",
			"message": "Simple server working",
		})
	})

	http.HandleFunc("/api/test", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Simple API route working",
			"path": r.URL.Path,
			"method": r.Method,
		})
	})

	http.HandleFunc("/api/auth/status", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Simple auth route working",
			"path": r.URL.Path,
			"method": r.Method,
		})
	})

	fmt.Println("✅ Simple server listening on :8082")
	log.Fatal(http.ListenAndServe(":8082", nil))
}
