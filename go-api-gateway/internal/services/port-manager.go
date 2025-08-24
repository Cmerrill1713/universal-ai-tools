// Dynamic Port Management System
// Provides intelligent port allocation, conflict detection, and service coordination

package services

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"sort"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	"universal-ai-tools/go-api-gateway/internal/config"
)

// PortManager handles dynamic port allocation and management
type PortManager struct {
	config          *config.Config
	logger          *zap.Logger
	redis           redis.Cmdable
	mutex           sync.RWMutex
	allocatedPorts  map[int]*PortAllocation
	portRanges      []PortRange
	serviceRegistry map[string]*ServicePortInfo
}

// PortAllocation represents an allocated port
type PortAllocation struct {
	Port        int                    `json:"port"`
	ServiceName string                 `json:"serviceName"`
	ServiceType string                 `json:"serviceType"`
	AllocatedAt time.Time              `json:"allocatedAt"`
	ExpiresAt   *time.Time             `json:"expiresAt,omitempty"`
	Metadata    map[string]interface{} `json:"metadata"`
	Status      string                 `json:"status"` // allocated, active, released
}

// PortRange defines available port ranges for different service types
type PortRange struct {
	Name        string `json:"name"`
	StartPort   int    `json:"startPort"`
	EndPort     int    `json:"endPort"`
	ServiceType string `json:"serviceType"`
	Priority    int    `json:"priority"` // Lower number = higher priority
}

// ServicePortInfo tracks service port requirements
type ServicePortInfo struct {
	ServiceName     string   `json:"serviceName"`
	ServiceType     string   `json:"serviceType"`
	PreferredPort   *int     `json:"preferredPort,omitempty"`
	RequiredPorts   int      `json:"requiredPorts"`
	PortRangeType   string   `json:"portRangeType"`
	AllowDynamic    bool     `json:"allowDynamic"`
	Dependencies    []string `json:"dependencies"`
	LastAllocatedAt time.Time `json:"lastAllocatedAt"`
}

// NewPortManager creates a new dynamic port manager
func NewPortManager(cfg *config.Config, logger *zap.Logger, redisClient redis.Cmdable) *PortManager {
	pm := &PortManager{
		config:          cfg,
		logger:          logger,
		redis:           redisClient,
		allocatedPorts:  make(map[int]*PortAllocation),
		serviceRegistry: make(map[string]*ServicePortInfo),
	}

	// Initialize default port ranges
	pm.portRanges = []PortRange{
		// System/Database Services (Reserved - High Priority)
		{Name: "system-db", StartPort: 5000, EndPort: 5999, ServiceType: "database", Priority: 1},
		{Name: "system-cache", StartPort: 6000, EndPort: 6999, ServiceType: "cache", Priority: 1},
		{Name: "system-monitoring", StartPort: 7000, EndPort: 7999, ServiceType: "monitoring", Priority: 1},
		
		// Application Services (Medium Priority)
		{Name: "api-gateway", StartPort: 8000, EndPort: 8099, ServiceType: "gateway", Priority: 2},
		{Name: "microservices", StartPort: 8100, EndPort: 8299, ServiceType: "microservice", Priority: 2},
		{Name: "ml-services", StartPort: 8300, EndPort: 8499, ServiceType: "ml", Priority: 2},
		{Name: "bridge-services", StartPort: 8500, EndPort: 8699, ServiceType: "bridge", Priority: 2},
		
		// Development/Testing (Lower Priority)
		{Name: "development", StartPort: 9000, EndPort: 9499, ServiceType: "development", Priority: 3},
		{Name: "testing", StartPort: 9500, EndPort: 9999, ServiceType: "testing", Priority: 3},
		
		// Dynamic Allocation Pool (Lowest Priority)
		{Name: "dynamic-pool", StartPort: 10000, EndPort: 11999, ServiceType: "dynamic", Priority: 4},
	}

	// Load existing allocations from Redis
	pm.loadExistingAllocations()

	// Register known services
	pm.registerKnownServices()

	return pm
}

// AllocatePort dynamically allocates a port for a service
func (pm *PortManager) AllocatePort(serviceName, serviceType string, preferredPort *int) (*PortAllocation, error) {
	pm.mutex.Lock()
	defer pm.mutex.Unlock()

	ctx := context.Background()
	
	// Check if service already has an allocation
	if existing := pm.findExistingAllocation(serviceName); existing != nil {
		if pm.isPortAvailable(existing.Port) {
			existing.Status = "active"
			pm.logger.Info("Reusing existing port allocation", 
				zap.String("service", serviceName), 
				zap.Int("port", existing.Port))
			return existing, nil
		} else {
			// Port no longer available, release and reallocate
			pm.releasePortInternal(existing.Port)
		}
	}

	// Try preferred port first
	if preferredPort != nil {
		if pm.isPortAvailable(*preferredPort) && !pm.isPortAllocated(*preferredPort) {
			return pm.allocatePortInternal(serviceName, serviceType, *preferredPort, ctx)
		}
		pm.logger.Warn("Preferred port not available, finding alternative",
			zap.String("service", serviceName),
			zap.Int("preferred_port", *preferredPort))
	}

	// Find best port range for service type
	portRange := pm.findBestPortRange(serviceType)
	if portRange == nil {
		return nil, fmt.Errorf("no suitable port range found for service type: %s", serviceType)
	}

	// Find available port in range
	port, err := pm.findAvailablePortInRange(*portRange)
	if err != nil {
		return nil, fmt.Errorf("failed to find available port in range %s: %w", portRange.Name, err)
	}

	return pm.allocatePortInternal(serviceName, serviceType, port, ctx)
}

// ReleasePort releases an allocated port
func (pm *PortManager) ReleasePort(port int) error {
	pm.mutex.Lock()
	defer pm.mutex.Unlock()

	return pm.releasePortInternal(port)
}

// GetPortAllocation retrieves port allocation info
func (pm *PortManager) GetPortAllocation(serviceName string) *PortAllocation {
	pm.mutex.RLock()
	defer pm.mutex.RUnlock()

	return pm.findExistingAllocation(serviceName)
}

// GetAllAllocations returns all current port allocations
func (pm *PortManager) GetAllAllocations() []*PortAllocation {
	pm.mutex.RLock()
	defer pm.mutex.RUnlock()

	allocations := make([]*PortAllocation, 0, len(pm.allocatedPorts))
	for _, allocation := range pm.allocatedPorts {
		allocations = append(allocations, allocation)
	}

	// Sort by port number
	sort.Slice(allocations, func(i, j int) bool {
		return allocations[i].Port < allocations[j].Port
	})

	return allocations
}

// GetPortUtilization returns port usage statistics
func (pm *PortManager) GetPortUtilization() map[string]interface{} {
	pm.mutex.RLock()
	defer pm.mutex.RUnlock()

	stats := make(map[string]interface{})
	rangeStats := make(map[string]map[string]interface{})

	for _, portRange := range pm.portRanges {
		allocated := 0
		total := portRange.EndPort - portRange.StartPort + 1
		
		for port := portRange.StartPort; port <= portRange.EndPort; port++ {
			if pm.isPortAllocated(port) {
				allocated++
			}
		}

		rangeStats[portRange.Name] = map[string]interface{}{
			"allocated":    allocated,
			"total":        total,
			"available":    total - allocated,
			"utilization":  float64(allocated) / float64(total) * 100,
			"service_type": portRange.ServiceType,
		}
	}

	stats["port_ranges"] = rangeStats
	stats["total_allocated"] = len(pm.allocatedPorts)
	stats["timestamp"] = time.Now()

	return stats
}

// Internal methods

func (pm *PortManager) allocatePortInternal(serviceName, serviceType string, port int, ctx context.Context) (*PortAllocation, error) {
	allocation := &PortAllocation{
		Port:        port,
		ServiceName: serviceName,
		ServiceType: serviceType,
		AllocatedAt: time.Now(),
		Status:      "allocated",
		Metadata: map[string]interface{}{
			"allocated_by": "dynamic-port-manager",
			"process_id":   fmt.Sprintf("%s-%d", serviceName, time.Now().Unix()),
		},
	}

	// Store in memory
	pm.allocatedPorts[port] = allocation

	// Store in Redis for persistence
	if pm.redis != nil {
		key := fmt.Sprintf("port-allocation:%d", port)
		data, _ := json.Marshal(allocation)
		pm.redis.Set(ctx, key, data, 24*time.Hour) // 24 hour TTL
	}

	pm.logger.Info("Port allocated successfully",
		zap.String("service", serviceName),
		zap.Int("port", port),
		zap.String("type", serviceType))

	return allocation, nil
}

func (pm *PortManager) releasePortInternal(port int) error {
	allocation, exists := pm.allocatedPorts[port]
	if !exists {
		return fmt.Errorf("port %d is not allocated", port)
	}

	// Remove from memory
	delete(pm.allocatedPorts, port)

	// Remove from Redis
	if pm.redis != nil {
		ctx := context.Background()
		key := fmt.Sprintf("port-allocation:%d", port)
		pm.redis.Del(ctx, key)
	}

	pm.logger.Info("Port released successfully",
		zap.String("service", allocation.ServiceName),
		zap.Int("port", port))

	return nil
}

func (pm *PortManager) isPortAvailable(port int) bool {
	conn, err := net.Dial("tcp", fmt.Sprintf("localhost:%d", port))
	if err != nil {
		return true // Port is available (connection failed)
	}
	conn.Close()
	return false // Port is in use
}

func (pm *PortManager) isPortAllocated(port int) bool {
	_, exists := pm.allocatedPorts[port]
	return exists
}

func (pm *PortManager) findExistingAllocation(serviceName string) *PortAllocation {
	for _, allocation := range pm.allocatedPorts {
		if allocation.ServiceName == serviceName {
			return allocation
		}
	}
	return nil
}

func (pm *PortManager) findBestPortRange(serviceType string) *PortRange {
	var bestRange *PortRange
	
	for i, portRange := range pm.portRanges {
		if portRange.ServiceType == serviceType || portRange.ServiceType == "dynamic" {
			if bestRange == nil || portRange.Priority < bestRange.Priority {
				bestRange = &pm.portRanges[i]
			}
		}
	}

	return bestRange
}

func (pm *PortManager) findAvailablePortInRange(portRange PortRange) (int, error) {
	// Try ports in range, starting from the beginning
	for port := portRange.StartPort; port <= portRange.EndPort; port++ {
		if !pm.isPortAllocated(port) && pm.isPortAvailable(port) {
			return port, nil
		}
	}

	return 0, fmt.Errorf("no available ports in range %d-%d", portRange.StartPort, portRange.EndPort)
}

func (pm *PortManager) loadExistingAllocations() {
	if pm.redis == nil {
		return
	}

	ctx := context.Background()
	keys, err := pm.redis.Keys(ctx, "port-allocation:*").Result()
	if err != nil {
		pm.logger.Warn("Failed to load existing port allocations", zap.Error(err))
		return
	}

	for _, key := range keys {
		data, err := pm.redis.Get(ctx, key).Result()
		if err != nil {
			continue
		}

		var allocation PortAllocation
		if err := json.Unmarshal([]byte(data), &allocation); err != nil {
			continue
		}

		// Verify port is still in use
		if !pm.isPortAvailable(allocation.Port) {
			pm.allocatedPorts[allocation.Port] = &allocation
			pm.logger.Debug("Restored port allocation",
				zap.String("service", allocation.ServiceName),
				zap.Int("port", allocation.Port))
		} else {
			// Port no longer in use, clean up
			pm.redis.Del(ctx, key)
		}
	}

	pm.logger.Info("Port allocations loaded",
		zap.Int("allocations_restored", len(pm.allocatedPorts)))
}

func (pm *PortManager) registerKnownServices() {
	knownServices := []*ServicePortInfo{
		{ServiceName: "legacy-typescript", ServiceType: "legacy", PreferredPort: intPtr(9999), RequiredPorts: 1, PortRangeType: "testing", AllowDynamic: false},
		{ServiceName: "go-api-gateway", ServiceType: "gateway", PreferredPort: intPtr(8081), RequiredPorts: 1, PortRangeType: "api-gateway", AllowDynamic: true},
		{ServiceName: "python-vision", ServiceType: "ml", PreferredPort: intPtr(8000), RequiredPorts: 1, PortRangeType: "ml-services", AllowDynamic: true},
		{ServiceName: "rust-vision-bridge", ServiceType: "bridge", PreferredPort: intPtr(8084), RequiredPorts: 1, PortRangeType: "bridge-services", AllowDynamic: true},
		{ServiceName: "rust-llm-router", ServiceType: "microservice", PreferredPort: intPtr(8082), RequiredPorts: 1, PortRangeType: "microservices", AllowDynamic: true},
		{ServiceName: "hrm-mlx-service", ServiceType: "ml", PreferredPort: intPtr(8085), RequiredPorts: 1, PortRangeType: "ml-services", AllowDynamic: true},
	}

	for _, service := range knownServices {
		pm.serviceRegistry[service.ServiceName] = service
	}

	pm.logger.Info("Known services registered with port manager",
		zap.Int("services_registered", len(knownServices)))
}

// Helper function
func intPtr(i int) *int {
	return &i
}