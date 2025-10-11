package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

func main() {
	// Flags to customize output
	dirName := flag.String("dir", "UniversalAITools-Output", "Name of the directory to create on Desktop")
	fileName := flag.String("file", "README.txt", "Name of the file to create inside the directory")
	content := flag.String("content", "Created by Universal AI Tools CLI\n", "Content to write into the file")
	flag.Parse()

	homeDir, err := os.UserHomeDir()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to resolve home directory: %v\n", err)
		os.Exit(1)
	}

	desktopPath := filepath.Join(homeDir, "Desktop")
	outputDir := filepath.Join(desktopPath, *dirName)
	outputFile := filepath.Join(outputDir, *fileName)

	// Ensure Desktop exists
	if stat, err := os.Stat(desktopPath); err != nil || !stat.IsDir() {
		fmt.Fprintf(os.Stderr, "Desktop path not found or not a directory: %s\n", desktopPath)
		os.Exit(1)
	}

	// Create directory (idempotent)
	if err := os.MkdirAll(outputDir, 0o755); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to create directory %s: %v\n", outputDir, err)
		os.Exit(1)
	}

	// Prepare file content with a timestamp footer
	finalContent := fmt.Sprintf("%s\nTimestamp: %s\n", *content, time.Now().Format(time.RFC3339))

	if err := os.WriteFile(outputFile, []byte(finalContent), 0o644); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to write file %s: %v\n", outputFile, err)
		os.Exit(1)
	}

	fmt.Printf("✅ Created %s\n", outputFile)
}
