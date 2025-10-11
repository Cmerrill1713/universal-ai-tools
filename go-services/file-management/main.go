package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
)

func healthCheck(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, `{"status": "healthy", "service": "file-management"}`)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8019"
	}

	http.HandleFunc("/health", healthCheck)
	
	fmt.Printf("File Management Service starting on port %s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}