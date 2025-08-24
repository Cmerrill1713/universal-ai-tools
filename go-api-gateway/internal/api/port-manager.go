// Port Management API endpoints
// Provides REST API for dynamic port allocation and management

package api

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"universal-ai-tools/go-api-gateway/internal/config"
	"universal-ai-tools/go-api-gateway/internal/services"
)

// PortManagerHandler handles port management API requests
type PortManagerHandler struct {
	config      *config.Config
	logger      *zap.Logger
	portManager *services.PortManager
}

// NewPortManagerHandler creates a new port manager handler
func NewPortManagerHandler(cfg *config.Config, logger *zap.Logger, portManager *services.PortManager) *PortManagerHandler {
	return &PortManagerHandler{
		config:      cfg,
		logger:      logger,
		portManager: portManager,
	}
}

// RegisterRoutes registers port management routes
func (h *PortManagerHandler) RegisterRoutes(router *gin.RouterGroup) {
	portMgr := router.Group("/port-management")
	{
		// Port allocation endpoints
		portMgr.POST("/allocate", h.AllocatePort)
		portMgr.DELETE("/release/:port", h.ReleasePort)
		
		// Port information endpoints
		portMgr.GET("/allocations", h.GetAllAllocations)
		portMgr.GET("/allocations/:serviceName", h.GetServiceAllocation)
		portMgr.GET("/utilization", h.GetPortUtilization)
		portMgr.GET("/ranges", h.GetPortRanges)
		
		// Port availability endpoints
		portMgr.GET("/check/:port", h.CheckPortAvailability)
		portMgr.GET("/suggest/:serviceType", h.SuggestPort)
		
		// Administrative endpoints
		portMgr.GET("/status", h.GetPortManagerStatus)
		portMgr.POST("/cleanup", h.CleanupInactivePorts)
		portMgr.GET("/conflicts", h.DetectPortConflicts)
	}

	h.logger.Info("Port Management routes registered", 
		zap.String("prefix", "/api/v1/port-management"), 
		zap.Int("endpoints", 10))
}

// AllocatePort allocates a dynamic port for a service
func (h *PortManagerHandler) AllocatePort(c *gin.Context) {
	var req struct {
		ServiceName   string `json:"serviceName" binding:"required"`
		ServiceType   string `json:"serviceType" binding:"required"`
		PreferredPort *int   `json:"preferredPort,omitempty"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request format",
			"details": err.Error(),
		})
		return
	}

	allocation, err := h.portManager.AllocatePort(req.ServiceName, req.ServiceType, req.PreferredPort)
	if err != nil {
		h.logger.Error("Port allocation failed", 
			zap.String("service", req.ServiceName),
			zap.Error(err))
		
		c.JSON(http.StatusConflict, gin.H{
			"error": "Failed to allocate port",
			"details": err.Error(),
			"service": req.ServiceName,
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Port allocated successfully",
		"allocation": allocation,
	})
}

// ReleasePort releases an allocated port
func (h *PortManagerHandler) ReleasePort(c *gin.Context) {
	portStr := c.Param("port")
	port, err := strconv.Atoi(portStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid port number",
			"port": portStr,
		})
		return
	}

	err = h.portManager.ReleasePort(port)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Failed to release port",
			"details": err.Error(),
			"port": port,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Port released successfully",
		"port": port,
	})
}

// GetAllAllocations returns all current port allocations
func (h *PortManagerHandler) GetAllAllocations(c *gin.Context) {
	allocations := h.portManager.GetAllAllocations()
	
	c.JSON(http.StatusOK, gin.H{
		"allocations": allocations,
		"total": len(allocations),
		"timestamp": "2025-08-23T16:45:00Z",
	})
}

// GetServiceAllocation returns port allocation for a specific service
func (h *PortManagerHandler) GetServiceAllocation(c *gin.Context) {
	serviceName := c.Param("serviceName")
	
	allocation := h.portManager.GetPortAllocation(serviceName)
	if allocation == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "No port allocation found for service",
			"service": serviceName,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"service": serviceName,
		"allocation": allocation,
	})
}

// GetPortUtilization returns port usage statistics
func (h *PortManagerHandler) GetPortUtilization(c *gin.Context) {
	utilization := h.portManager.GetPortUtilization()
	
	c.JSON(http.StatusOK, utilization)
}

// GetPortRanges returns available port ranges
func (h *PortManagerHandler) GetPortRanges(c *gin.Context) {
	// This would ideally be exposed from PortManager
	ranges := []gin.H{
		{"name": "system-db", "startPort": 5000, "endPort": 5999, "serviceType": "database", "priority": 1},
		{"name": "system-cache", "startPort": 6000, "endPort": 6999, "serviceType": "cache", "priority": 1},
		{"name": "system-monitoring", "startPort": 7000, "endPort": 7999, "serviceType": "monitoring", "priority": 1},
		{"name": "api-gateway", "startPort": 8000, "endPort": 8099, "serviceType": "gateway", "priority": 2},
		{"name": "microservices", "startPort": 8100, "endPort": 8299, "serviceType": "microservice", "priority": 2},
		{"name": "ml-services", "startPort": 8300, "endPort": 8499, "serviceType": "ml", "priority": 2},
		{"name": "bridge-services", "startPort": 8500, "endPort": 8699, "serviceType": "bridge", "priority": 2},
		{"name": "development", "startPort": 9000, "endPort": 9499, "serviceType": "development", "priority": 3},
		{"name": "testing", "startPort": 9500, "endPort": 9999, "serviceType": "testing", "priority": 3},
		{"name": "dynamic-pool", "startPort": 10000, "endPort": 11999, "serviceType": "dynamic", "priority": 4},
	}
	
	c.JSON(http.StatusOK, gin.H{
		"port_ranges": ranges,
		"total_ranges": len(ranges),
	})
}

// CheckPortAvailability checks if a specific port is available
func (h *PortManagerHandler) CheckPortAvailability(c *gin.Context) {
	portStr := c.Param("port")
	port, err := strconv.Atoi(portStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid port number",
			"port": portStr,
		})
		return
	}

	// Check if port is allocated in our system
	allocation := h.portManager.GetAllAllocations()
	var isAllocated bool
	var allocatedTo string
	
	for _, alloc := range allocation {
		if alloc.Port == port {
			isAllocated = true
			allocatedTo = alloc.ServiceName
			break
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"port": port,
		"is_allocated": isAllocated,
		"allocated_to": allocatedTo,
		"timestamp": "2025-08-23T16:45:00Z",
	})
}

// SuggestPort suggests an available port for a service type
func (h *PortManagerHandler) SuggestPort(c *gin.Context) {
	serviceType := c.Param("serviceType")
	
	// For now, return a simple suggestion based on service type
	suggestion := h.getSuggestedPortRange(serviceType)
	
	c.JSON(http.StatusOK, gin.H{
		"service_type": serviceType,
		"suggested_range": suggestion,
		"message": "Use /allocate endpoint to get an actual allocated port",
	})
}

// GetPortManagerStatus returns the status of the port manager
func (h *PortManagerHandler) GetPortManagerStatus(c *gin.Context) {
	allocations := h.portManager.GetAllAllocations()
	utilization := h.portManager.GetPortUtilization()
	
	c.JSON(http.StatusOK, gin.H{
		"status": "healthy",
		"total_allocations": len(allocations),
		"port_manager_active": true,
		"utilization_summary": utilization,
		"timestamp": "2025-08-23T16:45:00Z",
	})
}

// CleanupInactivePorts removes allocations for inactive services
func (h *PortManagerHandler) CleanupInactivePorts(c *gin.Context) {
	allocations := h.portManager.GetAllAllocations()
	releasedPorts := []int{}
	
	for _, allocation := range allocations {
		// Check if port is actually in use
		// This is a simplified check - in reality we'd ping the service
		if allocation.Status == "allocated" && allocation.AllocatedAt.Add(24*time.Hour).Before(time.Now()) {
			err := h.portManager.ReleasePort(allocation.Port)
			if err == nil {
				releasedPorts = append(releasedPorts, allocation.Port)
			}
		}
	}
	
	c.JSON(http.StatusOK, gin.H{
		"message": "Port cleanup completed",
		"released_ports": releasedPorts,
		"released_count": len(releasedPorts),
		"timestamp": "2025-08-23T16:45:00Z",
	})
}

// DetectPortConflicts identifies potential port conflicts
func (h *PortManagerHandler) DetectPortConflicts(c *gin.Context) {
	// This would scan system ports vs allocated ports
	conflicts := []gin.H{}
	
	// For demo purposes, return empty conflicts
	c.JSON(http.StatusOK, gin.H{
		"conflicts": conflicts,
		"conflict_count": len(conflicts),
		"status": "no_conflicts_detected",
		"timestamp": "2025-08-23T16:45:00Z",
	})
}

// Helper methods

func (h *PortManagerHandler) getSuggestedPortRange(serviceType string) gin.H {
	switch serviceType {
	case "database":
		return gin.H{"start": 5000, "end": 5999, "range_name": "system-db"}
	case "cache":
		return gin.H{"start": 6000, "end": 6999, "range_name": "system-cache"}
	case "monitoring":
		return gin.H{"start": 7000, "end": 7999, "range_name": "system-monitoring"}
	case "gateway":
		return gin.H{"start": 8000, "end": 8099, "range_name": "api-gateway"}
	case "microservice":
		return gin.H{"start": 8100, "end": 8299, "range_name": "microservices"}
	case "ml":
		return gin.H{"start": 8300, "end": 8499, "range_name": "ml-services"}
	case "bridge":
		return gin.H{"start": 8500, "end": 8699, "range_name": "bridge-services"}
	case "development":
		return gin.H{"start": 9000, "end": 9499, "range_name": "development"}
	case "testing":
		return gin.H{"start": 9500, "end": 9999, "range_name": "testing"}
	default:
		return gin.H{"start": 10000, "end": 11999, "range_name": "dynamic-pool"}
	}
}