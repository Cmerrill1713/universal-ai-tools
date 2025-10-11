package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/gorilla/mux"
)

type SystemAccessRequest struct {
	Action  string `json:"action"`
	App     string `json:"app,omitempty"`
	Command string `json:"command,omitempty"`
	Path    string `json:"path,omitempty"`
	Content string `json:"content,omitempty"`
}

type SystemAccessResponse struct {
	Success  bool                   `json:"success"`
	Message  string                 `json:"message"`
	Output   string                 `json:"output,omitempty"`
	ExitCode int                    `json:"exit_code,omitempty"`
	Duration string                 `json:"duration,omitempty"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

type SystemAccessService struct {
	router *mux.Router
}

func NewSystemAccessService() *SystemAccessService {
	service := &SystemAccessService{
		router: mux.NewRouter(),
	}
	service.setupRoutes()
	return service
}

func (s *SystemAccessService) setupRoutes() {
	s.router.HandleFunc("/open-app", s.openAppHandler).Methods("POST")
	s.router.HandleFunc("/execute-command", s.executeCommandHandler).Methods("POST")
	s.router.HandleFunc("/execute", s.executeCommandHandler).Methods("POST") // Alias for /execute-command
	s.router.HandleFunc("/read-file", s.readFileHandler).Methods("POST")
	s.router.HandleFunc("/write-file", s.writeFileHandler).Methods("POST")
	s.router.HandleFunc("/health", s.healthHandler).Methods("GET")
}

func (s *SystemAccessService) openAppHandler(w http.ResponseWriter, r *http.Request) {
	var req SystemAccessRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Open application
	cmd := exec.Command("open", "-a", req.App)
	err := cmd.Run()

	response := SystemAccessResponse{
		Success: err == nil,
		Message: fmt.Sprintf("Opening %s", req.App),
	}

	if err != nil {
		response.Message = fmt.Sprintf("Failed to open %s: %v", req.App, err)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (s *SystemAccessService) executeCommandHandler(w http.ResponseWriter, r *http.Request) {
	var req SystemAccessRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	start := time.Now()

	// Security: Check for dangerous commands
	if s.isDangerousCommand(req.Command) {
		response := SystemAccessResponse{
			Success:  false,
			Message:  "Command blocked for security reasons",
			Output:   "",
			ExitCode: -1,
			Duration: time.Since(start).String(),
			Metadata: map[string]interface{}{
				"blocked_reason": "potentially_dangerous_command",
				"command":        req.Command,
			},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	// Execute command with enhanced error handling
	cmd := exec.Command("sh", "-c", req.Command)

	// Capture both stdout and stderr
	var stdout, stderr strings.Builder
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	exitCode := cmd.ProcessState.ExitCode()

	// Combine output
	output := stdout.String()
	if stderr.Len() > 0 {
		output += "\n--- STDERR ---\n" + stderr.String()
	}

	// Clean up output (remove excessive whitespace)
	output = s.cleanOutput(output)

	response := SystemAccessResponse{
		Success:  err == nil,
		Message:  fmt.Sprintf("Executed: %s", req.Command),
		Output:   output,
		ExitCode: exitCode,
		Duration: time.Since(start).String(),
		Metadata: map[string]interface{}{
			"command":             req.Command,
			"stdout_length":       stdout.Len(),
			"stderr_length":       stderr.Len(),
			"total_output_length": len(output),
		},
	}

	if err != nil {
		response.Message = fmt.Sprintf("Command failed: %v", err)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// isDangerousCommand checks if a command is potentially dangerous
func (s *SystemAccessService) isDangerousCommand(command string) bool {
	dangerousPatterns := []string{
		"rm -rf",
		"sudo",
		"su ",
		"passwd",
		"chmod 777",
		"chown",
		"kill -9",
		"pkill",
		"reboot",
		"shutdown",
		"halt",
		"init 0",
		"dd if=",
		"mkfs",
		"fdisk",
		"parted",
		"mount",
		"umount",
		"iptables",
		"ufw",
		"firewall",
		"crontab",
		"at ",
		"systemctl",
		"service ",
		"launchctl",
		"kextload",
		"kextunload",
		"nuke",
		"format",
		"wipe",
		"destroy",
		"delete all",
		"truncate",
		"> /dev/",
		"curl.*|sh",
		"wget.*|sh",
		"eval ",
		"exec ",
		"source ",
		". ",
	}

	commandLower := strings.ToLower(command)
	for _, pattern := range dangerousPatterns {
		if strings.Contains(commandLower, pattern) {
			return true
		}
	}

	// Check for commands that modify system files
	systemPaths := []string{
		"/etc/",
		"/usr/bin/",
		"/usr/sbin/",
		"/bin/",
		"/sbin/",
		"/System/",
		"/Library/",
		"/Applications/",
		"/var/",
		"/opt/",
	}

	for _, path := range systemPaths {
		if strings.Contains(command, path) && (strings.Contains(command, "rm") || strings.Contains(command, "mv") || strings.Contains(command, "cp")) {
			return true
		}
	}

	return false
}

// cleanOutput cleans up command output for better readability
func (s *SystemAccessService) cleanOutput(output string) string {
	// Remove excessive whitespace
	output = regexp.MustCompile(`\n\s*\n\s*\n`).ReplaceAllString(output, "\n\n")

	// Trim leading/trailing whitespace
	output = strings.TrimSpace(output)

	// Limit output length to prevent overwhelming responses
	maxLength := 10000
	if len(output) > maxLength {
		output = output[:maxLength] + "\n... (output truncated)"
	}

	return output
}

func (s *SystemAccessService) readFileHandler(w http.ResponseWriter, r *http.Request) {
	var req SystemAccessRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	start := time.Now()

	// Security: Check if path is safe
	if !s.isSafePath(req.Path) {
		response := SystemAccessResponse{
			Success:  false,
			Message:  "Path blocked for security reasons",
			Output:   "",
			ExitCode: -1,
			Duration: time.Since(start).String(),
			Metadata: map[string]interface{}{
				"blocked_reason": "unsafe_path",
				"path":           req.Path,
			},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	// Read file using Go's file operations for better security
	file, err := os.Open(req.Path)
	if err != nil {
		response := SystemAccessResponse{
			Success:  false,
			Message:  fmt.Sprintf("Failed to open file: %v", err),
			Output:   "",
			ExitCode: -1,
			Duration: time.Since(start).String(),
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}
	defer file.Close()

	// Get file info
	fileInfo, err := file.Stat()
	if err != nil {
		response := SystemAccessResponse{
			Success:  false,
			Message:  fmt.Sprintf("Failed to get file info: %v", err),
			Output:   "",
			ExitCode: -1,
			Duration: time.Since(start).String(),
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	// Check file size (limit to 1MB for safety)
	maxSize := int64(1024 * 1024) // 1MB
	if fileInfo.Size() > maxSize {
		response := SystemAccessResponse{
			Success:  false,
			Message:  "File too large (max 1MB)",
			Output:   "",
			ExitCode: -1,
			Duration: time.Since(start).String(),
			Metadata: map[string]interface{}{
				"file_size": fileInfo.Size(),
				"max_size":  maxSize,
			},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	// Read file content
	content, err := io.ReadAll(file)
	if err != nil {
		response := SystemAccessResponse{
			Success:  false,
			Message:  fmt.Sprintf("Failed to read file content: %v", err),
			Output:   "",
			ExitCode: -1,
			Duration: time.Since(start).String(),
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	response := SystemAccessResponse{
		Success:  true,
		Message:  fmt.Sprintf("Successfully read file: %s", req.Path),
		Output:   string(content),
		ExitCode: 0,
		Duration: time.Since(start).String(),
		Metadata: map[string]interface{}{
			"file_path":     req.Path,
			"file_size":     fileInfo.Size(),
			"file_mode":     fileInfo.Mode().String(),
			"file_mod_time": fileInfo.ModTime(),
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// isSafePath checks if a path is safe to access
func (s *SystemAccessService) isSafePath(path string) bool {
	// Resolve the absolute path
	absPath, err := filepath.Abs(path)
	if err != nil {
		return false
	}

	// Get current working directory
	cwd, err := os.Getwd()
	if err != nil {
		return false
	}

	// Check if path is within current working directory or user's home
	homeDir, err := os.UserHomeDir()
	if err != nil {
		homeDir = ""
	}

	// Allow paths within current directory or home directory
	if strings.HasPrefix(absPath, cwd) || (homeDir != "" && strings.HasPrefix(absPath, homeDir)) {
		return true
	}

	// Block system directories
	blockedPaths := []string{
		"/etc/",
		"/usr/bin/",
		"/usr/sbin/",
		"/bin/",
		"/sbin/",
		"/System/",
		"/Library/",
		"/Applications/",
		"/var/",
		"/opt/",
		"/root/",
		"/proc/",
		"/sys/",
		"/dev/",
	}

	for _, blockedPath := range blockedPaths {
		if strings.HasPrefix(absPath, blockedPath) {
			return false
		}
	}

	return true
}

func (s *SystemAccessService) writeFileHandler(w http.ResponseWriter, r *http.Request) {
	var req SystemAccessRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Write file
	cmd := exec.Command("sh", "-c", fmt.Sprintf("echo '%s' > %s", req.Content, req.Path))
	err := cmd.Run()

	response := SystemAccessResponse{
		Success: err == nil,
		Message: fmt.Sprintf("Writing to file: %s", req.Path),
	}

	if err != nil {
		response.Message = fmt.Sprintf("Failed to write file: %v", err)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (s *SystemAccessService) healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "healthy",
		"service":   "system-access",
		"timestamp": time.Now(),
		"version":   "2.0.0",
		"features": []string{
			"secure_command_execution",
			"file_operations",
			"application_launching",
			"path_validation",
			"output_cleaning",
			"metadata_tracking",
		},
		"security": map[string]interface{}{
			"dangerous_command_blocking": true,
			"path_validation":            true,
			"file_size_limits":           true,
			"output_truncation":          true,
		},
	})
}

func main() {
	service := NewSystemAccessService()

	port := "8019"
	if p := os.Getenv("PORT"); p != "" {
		port = p
	}

	log.Printf("System Access Service starting on port %s", port)

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      service.router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("System Access Service failed to start: %v", err)
	}
}
