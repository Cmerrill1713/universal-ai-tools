// Universal AI Tools Go API Gateway
// Migration implementation with critical TypeScript endpoint compatibility

package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"universal-ai-tools/go-api-gateway/internal/api"
	"universal-ai-tools/go-api-gateway/internal/config"
	"universal-ai-tools/go-api-gateway/internal/database"
	"universal-ai-tools/go-api-gateway/internal/services"
)

func main() {
	// Initialize configuration
	cfg, err := config.Load()
	if err != nil {
		panic(fmt.Sprintf("Failed to load configuration: %v", err))
	}

	// Initialize logger
	logger, err := initLogger(cfg)
	if err != nil {
		panic(fmt.Sprintf("Failed to initialize logger: %v", err))
	}
	defer logger.Sync()

	logger.Info("🚀 Starting Universal AI Tools Go API Gateway",
		zap.String("version", cfg.Version),
		zap.String("environment", cfg.Environment),
		zap.Int("port", cfg.Server.Port),
		zap.Bool("migration_mode", cfg.Migration.EnableCompatibilityMode))

	// Initialize database coordinator
	dbCoordinator, err := database.NewCoordinator(cfg, logger)
	if err != nil {
		logger.Fatal("Failed to initialize database coordinator", zap.Error(err))
	}
	defer dbCoordinator.Close()

	// Initialize services container
	services, err := initServices(cfg, logger, dbCoordinator)
	if err != nil {
		logger.Fatal("Failed to initialize services", zap.Error(err))
	}

	// Setup Gin router with middleware
	router := setupRouter(cfg, logger)

	// Register API routes
	registerAPIRoutes(router, services, logger)

	// Setup HTTP server with production-ready timeouts
	server := &http.Server{
		Addr:              fmt.Sprintf(":%d", cfg.Server.Port),
		Handler:           router,
		ReadTimeout:       time.Duration(cfg.Server.ReadTimeout) * time.Second,
		WriteTimeout:      time.Duration(cfg.Server.WriteTimeout) * time.Second,
		IdleTimeout:       time.Duration(cfg.Server.IdleTimeout) * time.Second,
		ReadHeaderTimeout: 10 * time.Second,
		MaxHeaderBytes:    1 << 20, // 1MB
	}

	// Start server in goroutine
	go func() {
		logger.Info("🌐 HTTP server starting",
			zap.String("address", server.Addr),
			zap.Int("max_connections", cfg.Server.MaxConns))

		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("HTTP server failed", zap.Error(err))
		}
	}()

	// Log migration status
	if cfg.Migration.EnableCompatibilityMode {
		logger.Info("🔄 Migration compatibility mode enabled",
			zap.String("typescript_endpoint", cfg.Migration.TypeScriptEndpoint),
			zap.Int("proxy_timeout", cfg.Migration.ProxyTimeout))
	}

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("🛑 Shutting down server...")

	// Create a deadline to wait for
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Attempt graceful shutdown
	if err := server.Shutdown(ctx); err != nil {
		logger.Fatal("Server forced to shutdown", zap.Error(err))
	}

	logger.Info("✅ Server exited gracefully")
}

// initLogger initializes the logger based on configuration
func initLogger(cfg *config.Config) (*zap.Logger, error) {
	var logger *zap.Logger
	var err error

	if cfg.Environment == "production" {
		config := zap.NewProductionConfig()
		config.Level = zap.NewAtomicLevelAt(zap.InfoLevel)
		if cfg.Logging.Level == "debug" {
			config.Level = zap.NewAtomicLevelAt(zap.DebugLevel)
		}
		logger, err = config.Build()
	} else {
		config := zap.NewDevelopmentConfig()
		config.Level = zap.NewAtomicLevelAt(zap.DebugLevel)
		logger, err = config.Build()
	}

	return logger, err
}

// initServices initializes all service dependencies
func initServices(cfg *config.Config, logger *zap.Logger, dbCoordinator *database.Coordinator) (*services.Container, error) {
	// Initialize services container
	container := &services.Container{
		Config:        cfg,
		Logger:        logger,
		DatabaseCoord: dbCoordinator,
	}

	// Initialize JWT service first (needed by Auth service)
	jwtService := services.NewJWTService(cfg, logger)
	container.JWT = jwtService

	// Initialize Redis caching service (critical performance optimization)
	redisService, err := services.NewRedisService(cfg, logger)
	if err != nil {
		logger.Warn("Failed to initialize Redis service - continuing without cache", zap.Error(err))
	} else {
		container.Redis = redisService
		logger.Info("🚀 Redis caching service initialized successfully - performance boost enabled")
		
		// Clean up test keys from previous runs
		if err := redisService.CleanupExpired(); err != nil {
			logger.Warn("Failed to cleanup expired Redis keys", zap.Error(err))
		}
	}

	// Initialize Auth service with database connections
	authService := services.NewAuthService(
		cfg,
		logger,
		dbCoordinator.GetPostgreSQL(),
		dbCoordinator.GetRedis(),
		jwtService,
	)
	container.Auth = authService

	// Initialize chat service with Redis
	chatService := services.NewChatService(cfg, logger, dbCoordinator.GetRedis())
	container.Chat = chatService
	
	// Initialize LM Studio client if configured
	if cfg.LMStudio.Endpoint != "" {
		lmStudioClient := services.NewLMStudioClient(cfg, logger)
		container.LMStudio = lmStudioClient
		logger.Info("LM Studio client initialized", 
			zap.String("endpoint", cfg.LMStudio.Endpoint),
			zap.String("model", cfg.LMStudio.Model))
	}
	
	// Initialize Ollama client (always available for local inference)
	ollamaClient := services.NewOllamaClient(cfg, logger)
	container.Ollama = ollamaClient
	logger.Info("Ollama client initialized", 
		zap.String("endpoint", "http://localhost:11434"))

	// Initialize memory service
	memoryService, err := services.NewMemoryService(cfg, logger, dbCoordinator)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize memory service: %w", err)
	}
	container.Memory = memoryService

	// Initialize agent service
	agentService, err := services.NewAgentService(cfg, logger, dbCoordinator)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize agent service: %w", err)
	}
	container.Agent = agentService

	// Initialize context service
	contextService, err := services.NewContextService(cfg, logger, dbCoordinator)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize context service: %w", err)
	}
	container.Context = contextService

	// Initialize database service
	databaseService, err := services.NewDatabaseService(cfg, logger, dbCoordinator)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize database service: %w", err)
	}
	container.Database = databaseService

	// Initialize hardware auth service
	hardwareAuthService, err := services.NewHardwareAuthService(cfg, logger, dbCoordinator)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize hardware auth service: %w", err)
	}
	container.Hardware = hardwareAuthService

	// Initialize migration service for TypeScript compatibility
	if cfg.Migration.EnableCompatibilityMode {
		migrationService, err := services.NewMigrationService(cfg, logger)
		if err != nil {
			logger.Warn("Failed to initialize migration service", zap.Error(err))
		} else {
			container.Migration = migrationService
		}
	}

	// Initialize metrics service
	metricsService, err := services.NewMetricsService(cfg, logger)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize metrics service: %w", err)
	}
	container.Metrics = metricsService

	// Initialize news service
	newsService, err := services.NewNewsService(cfg, logger, dbCoordinator)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize news service: %w", err)
	}
	container.News = newsService

	// Initialize port management service
	portManager := services.NewPortManager(cfg, logger, redisService.GetClient())
	container.PortManager = portManager

	// Initialize vision service with dynamic port allocation
	visionService := services.NewVisionService(cfg, logger, portManager)
	container.Vision = visionService

	// Initialize HRM service with dynamic port allocation
	hrmService := services.NewHRMService(cfg, logger, portManager)
	container.HRM = hrmService

	// Initialize emotion service with dynamic port allocation
	emotionService, err := services.NewEmotionService(cfg, logger, portManager)
	if err != nil {
		logger.Warn("Failed to initialize emotion service", zap.Error(err))
	} else {
		container.Emotion = emotionService
		logger.Info("🎭 Emotion analysis service initialized with automated port management")
	}

	// Initialize Rust AI client with dynamic port allocation
	if cfg.RustAI.Endpoint != "" {
		rustAIClient := services.NewRustAIClient(cfg, logger, portManager)
		container.RustAI = rustAIClient
	} else {
		// Always initialize RustAI client with dynamic port allocation for local AI core
		rustAIClient := services.NewRustAIClient(cfg, logger, portManager)
		container.RustAI = rustAIClient
	}

	return container, nil
}

// setupRouter configures the Gin router with middleware
func setupRouter(cfg *config.Config, logger *zap.Logger) *gin.Engine {
	// Set gin mode
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()

	// Recovery middleware
	router.Use(gin.Recovery())

	// CORS middleware
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowOrigins = cfg.Security.CORSAllowedOrigins
	corsConfig.AllowCredentials = true
	corsConfig.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization", "X-Requested-With"}
	router.Use(cors.New(corsConfig))

	// Security headers middleware
	router.Use(func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Next()
	})

	// Request logging middleware
	router.Use(func(c *gin.Context) {
		start := time.Now()
		c.Next()
		duration := time.Since(start)

		logger.Info("Request completed",
			zap.String("method", c.Request.Method),
			zap.String("path", c.Request.URL.Path),
			zap.Int("status", c.Writer.Status()),
			zap.Duration("duration", duration),
			zap.String("client_ip", c.ClientIP()))
	})

	return router
}

// registerAPIRoutes registers all API routes with handlers
func registerAPIRoutes(router *gin.Engine, services *services.Container, logger *zap.Logger) {
	// API v1 group
	v1 := router.Group("/api/v1")

	// Health endpoints (matches TypeScript /api/health)
	healthHandler := api.NewHealthHandler(services, logger)
	router.GET("/api/health", healthHandler.BasicHealth)
	router.GET("/health", healthHandler.BasicHealth)
	v1.GET("/health", healthHandler.DetailedHealth)
	v1.GET("/health/ready", healthHandler.ReadinessCheck)
	v1.GET("/health/live", healthHandler.LivenessCheck)

	// Chat endpoints (matches TypeScript /api/v1/chat)
	chatHandler := api.NewChatHandler(
		services.Config,
		logger,
		services.Chat,
		services.RustAI,
		services.LMStudio, // Add LM Studio client
		services.Ollama,   // Add Ollama client
		services.HRM,      // Add HRM service for enhanced reasoning
		services.Redis,    // Add Redis caching for massive performance boost
	)
	chatHandler.RegisterRoutes(v1)

	// Legacy compatibility routes (matches TypeScript /api/chat)
	legacyAPI := router.Group("/api")
	legacyChatGroup := legacyAPI.Group("/chat")
	legacyChatGroup.POST("", chatHandler.SendMessage)       // POST /api/chat
	legacyChatGroup.POST("/", chatHandler.SendMessage)      // POST /api/chat/
	legacyChatGroup.POST("/enhanced", chatHandler.SendEnhancedMessage) // POST /api/chat/enhanced

	// Agent endpoints
	agentHandler := api.NewAgentHandler(services, logger)
	agentHandler.RegisterRoutes(v1)

	// Hardware authentication endpoints
	hardwareAuthHandler := api.NewHardwareAuthHandler(services, logger)
	hardwareAuthHandler.RegisterRoutes(v1)

	// Database endpoints
	databaseHandler := api.NewDatabaseHandler(services, logger)
	databaseHandler.RegisterRoutes(v1)

	// Context management endpoints
	contextHandler := api.NewContextHandler(services, logger)
	contextHandler.RegisterRoutes(v1)

	// Memory management endpoints
	memoryHandler := api.NewMemoryHandler(services, logger)
	memoryHandler.RegisterRoutes(v1)

	// Authentication endpoints
	authHandler := api.NewAuthHandler(services.Config, logger, services.Auth, services.JWT)
	authHandler.RegisterRoutes(v1)

	// News endpoints
	newsHandler := api.NewNewsHandler(services.Config, logger, services.News)
	newsHandler.RegisterRoutes(v1)

	// Vision endpoints
	visionHandler := api.NewVisionHandler(services.Config, logger, services.Vision)
	visionHandler.RegisterRoutes(v1)

	// Voice endpoints
	voiceHandler := api.NewVoiceHandler(services.Config, logger)
	voiceHandler.RegisterRoutes(v1)

	// MLX model grading endpoints
	gradingHandler := api.NewGradingHandler()
	gradingHandler.RegisterRoutes(router)

	// HRM endpoints
	hrmHandler := api.NewHRMHandler(services.Config, logger, services.HRM)
	hrmHandler.RegisterRoutes(v1)

	// Service Discovery endpoints (Enhanced service monitoring and discovery)
	serviceDiscoveryHandler := api.NewServiceDiscoveryHandler(services.Config, logger, services)
	serviceDiscoveryHandler.RegisterRoutes(v1)

	// Port Management endpoints (Dynamic port allocation and management)
	portManagerHandler := api.NewPortManagerHandler(services.Config, logger, services.PortManager)
	portManagerHandler.RegisterRoutes(v1)

	// Emotion analysis endpoints
	if services.Emotion != nil {
		emotionHandler := api.NewEmotionHandler(services, logger)
		emotionHandler.RegisterRoutes(v1)
	}

	// AppFlowy project management endpoints
	appFlowyHandler := api.NewAppFlowyHandler(services.Config, logger, services)
	appFlowyHandler.RegisterRoutes(v1)

	// Migration compatibility proxy
	if services.Migration != nil {
		migrationHandler := api.NewMigrationHandler(services, logger)
		migrationHandler.RegisterRoutes(router.Group("")) // Register at root level for proxying
	}

	// Metrics endpoint with Redis performance data
	if services.Config.Metrics.Enabled {
		router.GET("/metrics", func(c *gin.Context) {
			metrics := gin.H{
				"status":            "metrics_enabled",
				"go_implementation": true,
			}
			
			// Add Redis performance metrics if Redis is available
			if services.Redis != nil {
				redisStats := services.Redis.GetStats()
				metrics["redis"] = redisStats
			}
			
			c.JSON(http.StatusOK, metrics)
		})
	}

	logger.Info("✅ API routes registered successfully",
		zap.Int("total_routes", len(router.Routes())),
		zap.Bool("migration_mode", services.Migration != nil),
		zap.Bool("rust_ai_enabled", services.RustAI != nil))
}
