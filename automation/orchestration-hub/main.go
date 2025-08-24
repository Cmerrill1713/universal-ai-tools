package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

// Service represents a registered automation service
type Service struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Type        string    `json:"type"`
	Endpoint    string    `json:"endpoint"`
	HealthCheck string    `json:"health_check"`
	Status      string    `json:"status"`
	LastSeen    time.Time `json:"last_seen"`
	Capabilities []string `json:"capabilities"`
}

// AutomationEvent represents an event in the automation pipeline
type AutomationEvent struct {
	ID        string                 `json:"id"`
	Type      string                 `json:"type"`
	Source    string                 `json:"source"`
	Target    string                 `json:"target"`
	Payload   map[string]interface{} `json:"payload"`
	Timestamp time.Time              `json:"timestamp"`
	Status    string                 `json:"status"`
}

// OrchestrationHub manages all automation services
type OrchestrationHub struct {
	services      map[string]*Service
	servicesMu    sync.RWMutex
	eventQueue    chan AutomationEvent
	eventHandlers map[string][]EventHandler
	handlersMu    sync.RWMutex
	wsClients     map[*websocket.Conn]bool
	clientsMu     sync.RWMutex
	upgrader      websocket.Upgrader
}

// EventHandler processes automation events
type EventHandler func(event AutomationEvent) error

// NewOrchestrationHub creates a new orchestration hub
func NewOrchestrationHub() *OrchestrationHub {
	return &OrchestrationHub{
		services:      make(map[string]*Service),
		eventQueue:    make(chan AutomationEvent, 1000),
		eventHandlers: make(map[string][]EventHandler),
		wsClients:     make(map[*websocket.Conn]bool),
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // Allow all origins in development
			},
		},
	}
}

// RegisterService registers a new automation service
func (h *OrchestrationHub) RegisterService(w http.ResponseWriter, r *http.Request) {
	var service Service
	if err := json.NewDecoder(r.Body).Decode(&service); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	service.LastSeen = time.Now()
	service.Status = "online"

	h.servicesMu.Lock()
	h.services[service.ID] = &service
	h.servicesMu.Unlock()

	log.Printf("Service registered: %s (%s) at %s", service.Name, service.Type, service.Endpoint)

	// Notify all services of new registration
	h.broadcastEvent(AutomationEvent{
		ID:        generateID(),
		Type:      "service.registered",
		Source:    "orchestration-hub",
		Payload:   map[string]interface{}{"service": service},
		Timestamp: time.Now(),
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "registered",
		"service": service,
	})
}

// DiscoverServices returns all registered services
func (h *OrchestrationHub) DiscoverServices(w http.ResponseWriter, r *http.Request) {
	h.servicesMu.RLock()
	services := make([]*Service, 0, len(h.services))
	for _, service := range h.services {
		services = append(services, service)
	}
	h.servicesMu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(services)
}

// TriggerAutomation initiates an automation workflow
func (h *OrchestrationHub) TriggerAutomation(w http.ResponseWriter, r *http.Request) {
	var event AutomationEvent
	if err := json.NewDecoder(r.Body).Decode(&event); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	event.ID = generateID()
	event.Timestamp = time.Now()
	event.Status = "pending"

	// Queue event for processing
	select {
	case h.eventQueue <- event:
		log.Printf("Automation triggered: %s from %s to %s", event.Type, event.Source, event.Target)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":   "queued",
			"event_id": event.ID,
		})
	default:
		http.Error(w, "Event queue full", http.StatusServiceUnavailable)
	}
}

// ProcessEvents handles queued automation events
func (h *OrchestrationHub) ProcessEvents(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case event := <-h.eventQueue:
			h.processEvent(event)
		}
	}
}

func (h *OrchestrationHub) processEvent(event AutomationEvent) {
	log.Printf("Processing event: %s", event.ID)

	// Route event based on type
	switch event.Type {
	case "problem.detected":
		h.handleProblemDetected(event)
	case "chaos.inject":
		h.handleChaosInjection(event)
	case "security.vulnerability":
		h.handleSecurityVulnerability(event)
	case "performance.degradation":
		h.handlePerformanceDegradation(event)
	case "migration.required":
		h.handleMigrationRequired(event)
	default:
		// Call registered handlers
		h.callEventHandlers(event)
	}

	// Broadcast event to WebSocket clients
	h.broadcastEvent(event)
}

func (h *OrchestrationHub) handleProblemDetected(event AutomationEvent) {
	// Route to Evolution Healer
	h.routeToService("evolution-healer", event)
	
	// Request decision from Architecture AI
	h.requestDecision("architecture-ai", event)
}

func (h *OrchestrationHub) handleChaosInjection(event AutomationEvent) {
	// Coordinate chaos test
	log.Printf("Initiating chaos injection: %v", event.Payload)
	
	// Notify monitoring services
	h.notifyServices("monitoring", event)
	
	// Execute chaos scenario
	h.routeToService("chaos-engine", event)
}

func (h *OrchestrationHub) handleSecurityVulnerability(event AutomationEvent) {
	severity, _ := event.Payload["severity"].(string)
	dependency, _ := event.Payload["dependency"].(string)
	
	log.Printf("🚨 Handling security vulnerability: %s (%s)", dependency, severity)
	
	// Create immediate response based on severity
	switch severity {
	case "critical", "high":
		// Immediate action required
		log.Printf("⚡ Critical vulnerability - triggering emergency response")
		h.triggerEmergencyResponse(event)
		
		// Create automated fix attempt
		fixEvent := AutomationEvent{
			ID:        generateID(),
			Type:      "security.fix",
			Source:    "orchestration-hub",
			Target:    "evolution-healer",
			Timestamp: time.Now(),
			Status:    "pending",
			Payload: map[string]interface{}{
				"vulnerability": event.Payload,
				"priority":      "high",
				"auto_fix":      true,
			},
		}
		h.eventQueue <- fixEvent
		
	case "medium":
		// Schedule fix for next maintenance window
		h.scheduleMaintenanceFix(event)
		
	case "low":
		// Add to technical debt backlog
		h.addToTechnicalDebt(event)
	}
	
	// Always notify security team
	h.notifySecurityTeam(event)
	
	if severity == "critical" || severity == "high" {
		// Immediate auto-patch
		h.routeToService("evolution-healer", event)
	} else {
		// Schedule for next maintenance window
		h.scheduleEvent(event, time.Now().Add(24*time.Hour))
	}
}

func (h *OrchestrationHub) handlePerformanceDegradation(event AutomationEvent) {
	// Get optimization recommendations
	h.requestDecision("architecture-ai", event)
	
	// Trigger performance analysis
	h.routeToService("performance-analyzer", event)
}

func (h *OrchestrationHub) handleMigrationRequired(event AutomationEvent) {
	// Validate migration safety
	h.routeToService("migration-validator", event)
	
	// Get approval from Architecture AI
	h.requestDecision("architecture-ai", event)
}

func (h *OrchestrationHub) routeToService(serviceType string, event AutomationEvent) {
	h.servicesMu.RLock()
	defer h.servicesMu.RUnlock()

	for _, service := range h.services {
		if service.Type == serviceType && service.Status == "online" {
			go h.sendToService(service, event)
			return
		}
	}
	
	log.Printf("No available service of type: %s", serviceType)
}

func (h *OrchestrationHub) sendToService(service *Service, event AutomationEvent) {
	client := &http.Client{Timeout: 30 * time.Second}
	
	payload, _ := json.Marshal(event)
	resp, err := client.Post(
		service.Endpoint+"/automation/handle",
		"application/json",
		bytes.NewBuffer(payload),
	)
	
	if err != nil {
		log.Printf("Failed to send event to %s: %v", service.Name, err)
		service.Status = "error"
		return
	}
	defer resp.Body.Close()
	
	if resp.StatusCode == http.StatusOK {
		log.Printf("Event sent successfully to %s", service.Name)
	}
}

func (h *OrchestrationHub) requestDecision(serviceType string, event AutomationEvent) {
	decisionRequest := AutomationEvent{
		ID:        generateID(),
		Type:      "decision.request",
		Source:    "orchestration-hub",
		Target:    serviceType,
		Payload:   event.Payload,
		Timestamp: time.Now(),
	}
	
	h.routeToService(serviceType, decisionRequest)
}

func (h *OrchestrationHub) notifyServices(serviceType string, event AutomationEvent) {
	h.servicesMu.RLock()
	defer h.servicesMu.RUnlock()

	for _, service := range h.services {
		if service.Type == serviceType {
			go h.sendToService(service, event)
		}
	}
}

func (h *OrchestrationHub) scheduleEvent(event AutomationEvent, executeAt time.Time) {
	go func() {
		time.Sleep(time.Until(executeAt))
		h.eventQueue <- event
	}()
}

func (h *OrchestrationHub) callEventHandlers(event AutomationEvent) {
	h.handlersMu.RLock()
	handlers := h.eventHandlers[event.Type]
	h.handlersMu.RUnlock()

	for _, handler := range handlers {
		go func(h EventHandler) {
			if err := h(event); err != nil {
				log.Printf("Handler error: %v", err)
			}
		}(handler)
	}
}

func (h *OrchestrationHub) broadcastEvent(event AutomationEvent) {
	h.clientsMu.RLock()
	defer h.clientsMu.RUnlock()

	message, _ := json.Marshal(event)
	for client := range h.wsClients {
		client.WriteMessage(websocket.TextMessage, message)
	}
}

// WebSocket handler for real-time event streaming
func (h *OrchestrationHub) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	h.clientsMu.Lock()
	h.wsClients[conn] = true
	h.clientsMu.Unlock()

	defer func() {
		h.clientsMu.Lock()
		delete(h.wsClients, conn)
		h.clientsMu.Unlock()
	}()

	// Keep connection alive
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

// Health check endpoint
func (h *OrchestrationHub) HealthCheck(w http.ResponseWriter, r *http.Request) {
	h.servicesMu.RLock()
	serviceCount := len(h.services)
	h.servicesMu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":        "healthy",
		"service_count": serviceCount,
		"queue_size":    len(h.eventQueue),
		"timestamp":     time.Now(),
	})
}

func generateID() string {
	return fmt.Sprintf("%d-%d", time.Now().UnixNano(), rand.Intn(10000))
}

// Week 2: Security Automation Helper Methods
func (h *OrchestrationHub) triggerEmergencyResponse(event AutomationEvent) {
	log.Printf("🚨 EMERGENCY RESPONSE TRIGGERED for: %v", event.Payload)
	
	// Create high-priority response event
	emergencyEvent := AutomationEvent{
		ID:        generateID(),
		Type:      "emergency.response",
		Source:    "orchestration-hub",
		Target:    "all-services",
		Timestamp: time.Now(),
		Status:    "urgent",
		Payload: map[string]interface{}{
			"trigger": event.Payload,
			"severity": "critical",
			"immediate_action_required": true,
		},
	}
	
	// Broadcast to all services immediately
	h.broadcastEvent(emergencyEvent)
	
	// Route to evolution healer
	h.routeToService("evolution-healer", emergencyEvent)
}

func (h *OrchestrationHub) scheduleMaintenanceFix(event AutomationEvent) {
	log.Printf("📅 Scheduling maintenance fix for: %v", event.Payload)
	
	maintenanceEvent := AutomationEvent{
		ID:        generateID(),
		Type:      "maintenance.scheduled",
		Source:    "orchestration-hub",
		Target:    "scheduler",
		Timestamp: time.Now(),
		Status:    "scheduled",
		Payload: map[string]interface{}{
			"vulnerability": event.Payload,
			"priority": "medium",
			"schedule_window": "next_maintenance",
		},
	}
	
	h.eventQueue <- maintenanceEvent
}

func (h *OrchestrationHub) addToTechnicalDebt(event AutomationEvent) {
	log.Printf("📝 Adding to technical debt backlog: %v", event.Payload)
	
	debtEvent := AutomationEvent{
		ID:        generateID(),
		Type:      "technical_debt.added",
		Source:    "orchestration-hub",
		Target:    "project-management",
		Timestamp: time.Now(),
		Status:    "backlog",
		Payload: map[string]interface{}{
			"issue": event.Payload,
			"priority": "low",
			"category": "security",
		},
	}
	
	h.eventQueue <- debtEvent
}

func (h *OrchestrationHub) notifySecurityTeam(event AutomationEvent) {
	log.Printf("📧 Notifying security team: %v", event.Payload)
	
	notificationEvent := AutomationEvent{
		ID:        generateID(),
		Type:      "notification.security",
		Source:    "orchestration-hub",
		Target:    "security-team",
		Timestamp: time.Now(),
		Status:    "pending",
		Payload: map[string]interface{}{
			"alert": event.Payload,
			"notification_type": "security_vulnerability",
			"urgency": event.Payload["severity"],
		},
	}
	
	h.eventQueue <- notificationEvent
}

func (h *OrchestrationHub) handleTechnologyAlert(event AutomationEvent) {
	alertType, _ := event.Payload["alert_type"].(string)
	
	log.Printf("🔍 Processing technology alert: %s", alertType)
	
	switch alertType {
	case "new_library":
		h.evaluateNewLibrary(event)
	case "migration_recommendation":
		h.processMigrationRecommendation(event)
	case "technology_update":
		h.handleTechnologyUpdate(event)
	}
}

func (h *OrchestrationHub) evaluateNewLibrary(event AutomationEvent) {
	name, _ := event.Payload["name"].(string)
	relevanceScore, _ := event.Payload["relevance_score"].(float64)
	
	log.Printf("📚 Evaluating new library: %s (relevance: %.2f)", name, relevanceScore)
	
	if relevanceScore > 0.8 {
		// High relevance - create evaluation task
		evalEvent := AutomationEvent{
			ID:        generateID(),
			Type:      "library.evaluation",
			Source:    "orchestration-hub",
			Target:    "architecture-ai",
			Timestamp: time.Now(),
			Status:    "pending",
			Payload: map[string]interface{}{
				"library": event.Payload,
				"priority": "high",
				"evaluation_type": "adoption_potential",
			},
		}
		
		h.eventQueue <- evalEvent
	}
}

func (h *OrchestrationHub) processMigrationRecommendation(event AutomationEvent) {
	fromTech, _ := event.Payload["from_technology"].(string)
	toTech, _ := event.Payload["to_technology"].(string)
	confidence, _ := event.Payload["confidence_score"].(float64)
	
	log.Printf("🔄 Processing migration recommendation: %s → %s (confidence: %.2f)", fromTech, toTech, confidence)
	
	if confidence > 0.75 {
		// High confidence - create migration planning task
		migrationEvent := AutomationEvent{
			ID:        generateID(),
			Type:      "migration.planning",
			Source:    "orchestration-hub",
			Target:    "architecture-ai",
			Timestamp: time.Now(),
			Status:    "planning",
			Payload: map[string]interface{}{
				"recommendation": event.Payload,
				"priority": "high",
				"create_roadmap": true,
			},
		}
		
		h.eventQueue <- migrationEvent
	}
}

func (h *OrchestrationHub) handleTechnologyUpdate(event AutomationEvent) {
	technology, _ := event.Payload["technology"].(string)
	breaking, _ := event.Payload["breaking_changes"].(bool)
	
	log.Printf("📱 Technology update: %s (breaking: %v)", technology, breaking)
	
	if breaking {
		// Breaking changes - create assessment task
		assessmentEvent := AutomationEvent{
			ID:        generateID(),
			Type:      "breaking_change.assessment",
			Source:    "orchestration-hub",
			Target:    "architecture-ai",
			Timestamp: time.Now(),
			Status:    "urgent",
			Payload: map[string]interface{}{
				"update": event.Payload,
				"impact_analysis": true,
				"migration_plan": true,
			},
		}
		
		h.eventQueue <- assessmentEvent
	}
}

// Week 2: Security Automation Endpoint Handlers
func (h *OrchestrationHub) HandleSecurityAlert(w http.ResponseWriter, r *http.Request) {
	var alertData map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&alertData); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Create security alert event
	event := AutomationEvent{
		ID:        generateID(),
		Type:      "security.vulnerability",
		Source:    "tech-scanner",
		Target:    "orchestration-hub",
		Timestamp: time.Now(),
		Status:    "pending",
		Payload:   alertData,
	}

	// Queue for processing
	select {
	case h.eventQueue <- event:
		log.Printf("🚨 Security alert received: %v", alertData)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":     "accepted",
			"event_id":   event.ID,
			"message":    "Security alert processed",
		})
	default:
		http.Error(w, "Event queue full", http.StatusServiceUnavailable)
	}
}

func (h *OrchestrationHub) HandleChaosEvent(w http.ResponseWriter, r *http.Request) {
	var chaosData map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&chaosData); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	eventType, _ := chaosData["type"].(string)
	
	// Create chaos event
	event := AutomationEvent{
		ID:        generateID(),
		Type:      fmt.Sprintf("chaos.%s", eventType),
		Source:    "chaos-engine",
		Target:    "orchestration-hub",
		Timestamp: time.Now(),
		Status:    "active",
		Payload:   chaosData,
	}

	// Queue for processing
	select {
	case h.eventQueue <- event:
		log.Printf("🔥 Chaos event received: %s", eventType)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":     "accepted",
			"event_id":   event.ID,
			"message":    "Chaos event processed",
		})
	default:
		http.Error(w, "Event queue full", http.StatusServiceUnavailable)
	}
}

func (h *OrchestrationHub) HandleTechAlert(w http.ResponseWriter, r *http.Request) {
	var techData map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&techData); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	alertType, _ := techData["type"].(string)
	
	// Create technology alert event
	event := AutomationEvent{
		ID:        generateID(),
		Type:      fmt.Sprintf("technology.%s", alertType),
		Source:    "tech-scanner",
		Target:    "orchestration-hub",
		Timestamp: time.Now(),
		Status:    "pending",
		Payload:   techData,
	}

	// Queue for processing
	select {
	case h.eventQueue <- event:
		log.Printf("🔍 Technology alert received: %s", alertType)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":     "accepted",
			"event_id":   event.ID,
			"message":    "Technology alert processed",
		})
	default:
		http.Error(w, "Event queue full", http.StatusServiceUnavailable)
	}
}

func main() {
	hub := NewOrchestrationHub()
	ctx := context.Background()

	// Start event processor
	go hub.ProcessEvents(ctx)

	// Start service health checker
	go hub.MonitorServices(ctx)

	router := mux.NewRouter()
	
	// Service management
	router.HandleFunc("/api/services/register", hub.RegisterService).Methods("POST")
	router.HandleFunc("/api/services/discover", hub.DiscoverServices).Methods("GET")
	
	// Automation control
	router.HandleFunc("/api/automation/trigger", hub.TriggerAutomation).Methods("POST")
	
	// Week 2: Security automation endpoints
	router.HandleFunc("/api/v1/evolution/alert", hub.HandleSecurityAlert).Methods("POST")
	router.HandleFunc("/api/chaos/event", hub.HandleChaosEvent).Methods("POST")
	router.HandleFunc("/api/security/alert", hub.HandleTechAlert).Methods("POST")
	
	// WebSocket for real-time events
	router.HandleFunc("/ws/events", hub.HandleWebSocket)
	
	// Health check
	router.HandleFunc("/health", hub.HealthCheck).Methods("GET")

	log.Println("Orchestration Hub starting on :8100")
	log.Fatal(http.ListenAndServe(":8100", router))
}

// MonitorServices checks service health periodically
func (h *OrchestrationHub) MonitorServices(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			h.checkServiceHealth()
		}
	}
}

func (h *OrchestrationHub) checkServiceHealth() {
	h.servicesMu.Lock()
	defer h.servicesMu.Unlock()

	client := &http.Client{Timeout: 5 * time.Second}
	
	for _, service := range h.services {
		resp, err := client.Get(service.HealthCheck)
		if err != nil || resp.StatusCode != http.StatusOK {
			service.Status = "offline"
			log.Printf("Service %s is offline", service.Name)
		} else {
			service.Status = "online"
			service.LastSeen = time.Now()
		}
		
		if resp != nil {
			resp.Body.Close()
		}
	}
}