// Smart LLM Router leveraging existing HRM model and DSPy integration
use crate::router::LLMRouter;
use crate::RouterError;
use crate::config::RouterConfig;
use crate::models::Message;
use crate::intelligent_cache::IntelligentCache;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use std::time::Instant;
use tokio::sync::Semaphore;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmartRoutingContext {
    pub prompt_complexity: PromptComplexity,
    pub task_type: TaskType,
    pub urgency_level: UrgencyLevel,
    pub expected_length: ResponseLength,
    pub user_preferences: UserPreferences,
    pub system_load: f32,
    pub time_constraints: TimeConstraints,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PromptComplexity {
    Simple,    // Basic QA, simple completion
    Medium,    // Analysis, summarization
    Complex,   // Reasoning, multi-step tasks
    Expert,    // Research, code generation
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TaskType {
    Question,
    Creative,
    Code,
    Analysis,
    Vision,
    Translation,
    Summarization,
    Reasoning,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum UrgencyLevel {
    Low,      // Can wait for best model
    Medium,   // Balance speed and quality
    High,     // Prioritize speed
    Critical, // Use fastest available
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ResponseLength {
    Short,   // < 100 tokens
    Medium,  // 100 - 500 tokens
    Long,    // 500 - 2000 tokens
    VeryLong, // > 2000 tokens
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPreferences {
    pub prioritize_speed: bool,
    pub prioritize_quality: bool,
    pub preferred_models: Vec<String>,
    pub budget_constraints: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeConstraints {
    pub max_response_time: Option<f32>,
    pub is_urgent: bool,
}

#[derive(Debug, Clone)]
pub struct ModelCapabilities {
    pub name: String,
    pub speed_tier: SpeedTier,
    pub capability_level: CapabilityLevel,
    pub specializations: Vec<Specialization>,
    pub avg_response_time: f32,
    pub quality_score: f32,
    pub cost_per_token: f32,
    pub is_available: bool,
}

#[derive(Debug, Clone)]
pub enum SpeedTier {
    Fast,      // < 1s response time
    Medium,    // 1-3s response time
    Slow,      // > 3s response time
}

#[derive(Debug, Clone, Copy)]
pub enum CapabilityLevel {
    Basic,     // Simple tasks
    Advanced,  // Complex reasoning
    Expert,    // Specialized tasks
}

#[derive(Debug, Clone, PartialEq)]
pub enum Specialization {
    General,
    Vision,
    Code,
    Creative,
    Math,
    Science,
    Language,
    Reasoning,
}

#[derive(Debug, Clone)]
pub struct PerformanceMetrics {
    pub model: String,
    pub response_time: f32,
    pub quality_score: f32,
    pub user_satisfaction: f32,
    pub timestamp: Instant,
    pub tokens_used: u32,
}

#[derive(Debug)]
pub struct SmartLLMRouter {
    base_router: Arc<RwLock<LLMRouter>>,
    model_capabilities: HashMap<String, ModelCapabilities>,
    performance_tracker: PerformanceTracker,
    context_analyzer: ContextAnalyzer,
    load_monitor: LoadMonitor,
    hrm_client: Option<HrmClient>,
    dspy_client: Option<DspyClient>,
    hrm_semaphore: Arc<Semaphore>,
    cache: IntelligentCache,
}

impl SmartLLMRouter {
    pub async fn new(config: RouterConfig) -> Result<Self, RouterError> {
        let base_router = Arc::new(RwLock::new(LLMRouter::new(config).await?));
        // Configure HRM max inflight from env (default 4)
        let hrm_max = std::env::var("ROUTER_HRM_MAX_INFLIGHT")
            .ok()
            .and_then(|s| s.parse::<usize>().ok())
            .unwrap_or(4);

        // Initialize model capabilities based on our experiments
        let mut model_capabilities = HashMap::new();

        // Fast models for simple tasks
        model_capabilities.insert("gemma3:1b".to_string(), ModelCapabilities {
            name: "gemma3:1b".to_string(),
            speed_tier: SpeedTier::Fast,
            capability_level: CapabilityLevel::Basic,
            specializations: vec![Specialization::General, Specialization::Code],
            avg_response_time: 0.79,
            quality_score: 0.85,
            cost_per_token: 0.001,
            is_available: true,
        });

        // Balanced models
        model_capabilities.insert("llava:7b".to_string(), ModelCapabilities {
            name: "llava:7b".to_string(),
            speed_tier: SpeedTier::Medium,
            capability_level: CapabilityLevel::Advanced,
            specializations: vec![Specialization::Vision, Specialization::General],
            avg_response_time: 1.47,
            quality_score: 0.90,
            cost_per_token: 0.002,
            is_available: true,
        });

        // FastVLM models - Apple Silicon optimized vision-language models
        model_capabilities.insert("fastvlm-0.5b".to_string(), ModelCapabilities {
            name: "fastvlm-0.5b".to_string(),
            speed_tier: SpeedTier::Fast,
            capability_level: CapabilityLevel::Advanced,
            specializations: vec![Specialization::Vision, Specialization::General],
            avg_response_time: 0.8,
            quality_score: 0.88,
            cost_per_token: 0.001, // Very cost-effective
            is_available: true,
        });

        model_capabilities.insert("fastvlm-7b".to_string(), ModelCapabilities {
            name: "fastvlm-7b".to_string(),
            speed_tier: SpeedTier::Medium,
            capability_level: CapabilityLevel::Expert,
            specializations: vec![Specialization::Vision, Specialization::General, Specialization::Reasoning],
            avg_response_time: 1.2,
            quality_score: 0.92,
            cost_per_token: 0.0015,
            is_available: true,
        });

        // Expert models for complex tasks
        model_capabilities.insert("llama2:latest".to_string(), ModelCapabilities {
            name: "llama2:latest".to_string(),
            speed_tier: SpeedTier::Medium,
            capability_level: CapabilityLevel::Expert,
            specializations: vec![Specialization::General, Specialization::Creative, Specialization::Reasoning],
            avg_response_time: 1.91,
            quality_score: 0.95,
            cost_per_token: 0.003,
            is_available: true,
        });

        // HRM model for complex reasoning - Hierarchical Reasoning Model with MLX optimization
        model_capabilities.insert("hrm-mlx".to_string(), ModelCapabilities {
            name: "hrm-mlx".to_string(),
            speed_tier: SpeedTier::Slow,
            capability_level: CapabilityLevel::Expert,
            specializations: vec![Specialization::Reasoning, Specialization::Math],
            avg_response_time: 3.0,
            quality_score: 0.98,
            cost_per_token: 0.001, // Very cost-effective
            is_available: true, // Re-enabled - HRM-MLX service is now running
        });

        Ok(Self {
            base_router,
            model_capabilities,
            performance_tracker: PerformanceTracker::new(),
            context_analyzer: ContextAnalyzer::new(),
            load_monitor: LoadMonitor::new(),
            hrm_client: std::env::var("HRM_BASE_URL").ok().map(|b| HrmClient::new(&b)),
            dspy_client: std::env::var("DSPY_BASE_URL").ok().map(|b| DspyClient::new(&b)),
            hrm_semaphore: Arc::new(Semaphore::new(hrm_max)),
            cache: IntelligentCache::new(),
        })
    }

    pub async fn route_request(&self, messages: &[Message]) -> Result<String, RouterError> {
        // Analyze request context using existing HRM/DSPy integration
        let context = self.context_analyzer.analyze(messages).await;

        // Get current system load
        let system_load = self.load_monitor.get_current_load().await;

        // Get recent performance data
        let performance_data = self.performance_tracker.get_recent_performance().await;

        // Select optimal model
        let optimal_model = self.select_optimal_model(&context, system_load, &performance_data).await?;

        // Route to selected model
        self.route_to_model(optimal_model, messages).await
    }

    async fn select_optimal_model(
        &self,
        context: &SmartRoutingContext,
        system_load: f32,
        performance_data: &HashMap<String, Vec<PerformanceMetrics>>,
    ) -> Result<String, RouterError> {
        let mut model_scores = HashMap::new();

        // Get available models from base router
        let router = self.base_router.read().await;
        let available_models = router.list_models().await?;
        drop(router);

        for (model_name, capabilities) in &self.model_capabilities {
            if !capabilities.is_available || !available_models.contains(&model_name) {
                continue;
            }

            let score = self.calculate_model_score(
                capabilities,
                context,
                system_load,
                performance_data,
            );
            model_scores.insert(model_name.clone(), score);
        }

        // If no models from capabilities are available, fall back to any available model
        if model_scores.is_empty() {
            if let Some(fallback_model) = available_models.first() {
                tracing::warn!("No configured models available, falling back to: {}", fallback_model);
                return Ok(fallback_model.clone());
            }
        }

        // Select the best model
        let best_model = model_scores
            .iter()
            .max_by(|a, b| a.1.partial_cmp(b.1).unwrap())
            .map(|(name, _)| name.clone())
            .ok_or_else(|| RouterError::ConfigError("No suitable model available".to_string()))?;

        Ok(best_model)
    }

    fn calculate_model_score(
        &self,
        capabilities: &ModelCapabilities,
        context: &SmartRoutingContext,
        system_load: f32,
        performance_data: &HashMap<String, Vec<PerformanceMetrics>>,
    ) -> f32 {
        // Calculate weighted score

        // Speed factor (higher is better for fast models)
        let speed_score = match capabilities.speed_tier {
            SpeedTier::Fast => 1.0,
            SpeedTier::Medium => 0.7,
            SpeedTier::Slow => 0.4,
        };

        // Capability factor (higher is better for complex tasks)
        let capability_score = match (capabilities.capability_level, &context.prompt_complexity) {
            (CapabilityLevel::Expert, PromptComplexity::Expert) => 1.0,
            (CapabilityLevel::Advanced, PromptComplexity::Complex) => 0.9,
            (CapabilityLevel::Basic, PromptComplexity::Simple) => 0.8,
            _ => 0.5,
        };

        // Specialization factor
        let specialization_score = if capabilities.specializations.contains(&self.get_required_specialization(&context.task_type)) {
            1.0
        } else {
            0.6
        };

        // Performance factor (based on recent performance)
        let performance_score = if let Some(metrics) = performance_data.get(&capabilities.name) {
            let recent_avg_quality = metrics.iter()
                .rev()
                .take(10)
                .map(|m| m.quality_score)
                .sum::<f32>() / metrics.len().min(10) as f32;
            recent_avg_quality
        } else {
            capabilities.quality_score
        };

        // Load factor (prefer faster models under high load)
        let load_factor = if system_load > 0.8 {
            match capabilities.speed_tier {
                SpeedTier::Fast => 1.2,
                SpeedTier::Medium => 1.0,
                SpeedTier::Slow => 0.6,
            }
        } else {
            1.0
        };

        // Time constraint factor
        let time_factor = if context.time_constraints.is_urgent {
            match capabilities.speed_tier {
                SpeedTier::Fast => 1.3,
                SpeedTier::Medium => 1.0,
                SpeedTier::Slow => 0.5,
            }
        } else {
            1.0
        };

        // User preference factor
        let preference_factor = if context.user_preferences.prioritize_speed {
            speed_score
        } else if context.user_preferences.prioritize_quality {
            capability_score * performance_score
        } else {
            1.0
        };

        let score = (speed_score * 0.2 +
                capability_score * 0.3 +
                specialization_score * 0.2 +
                performance_score * 0.2 +
                load_factor * 0.05 +
                time_factor * 0.05) * preference_factor;

        score
    }

    fn get_required_specialization(&self, task_type: &TaskType) -> Specialization {
        match task_type {
            TaskType::Vision => Specialization::Vision,
            TaskType::Code => Specialization::Code,
            TaskType::Creative => Specialization::Creative,
            TaskType::Analysis | TaskType::Reasoning => Specialization::Reasoning,
            _ => Specialization::General,
        }
    }

    async fn route_to_model(&self, model: String, messages: &[Message]) -> Result<String, RouterError> {
        // Check if this is an HRM model request
        if model == "hrm-mlx" {
            return self.route_to_hrm_model(messages).await;
        }

        // Check if this is a DSPy orchestration request
        if self.should_use_dspy(messages) {
            return self.route_to_dspy(messages).await;
        }

        // Route to standard LLM router
        let router = self.base_router.read().await;
        let resp = router.route_request(messages.to_vec(), None).await?;
        Ok(resp.content)
    }

    async fn route_to_hrm_model(&self, messages: &[Message]) -> Result<String, RouterError> {
        if let Some(hrm_client) = &self.hrm_client {
            let prompt = messages.last()
                .ok_or_else(|| RouterError::ConfigError("No messages in request".to_string()))?
                .content.clone();

            // Check cache first
            if let Some(hit) = self.cache.get_cached_response(&prompt, "hrm-mlx").await {
                return Ok(hit.cached_response.response);
            }

            // Concurrency guard for HRM calls
            let _permit = self.hrm_semaphore.clone().acquire_owned().await
                .map_err(|_| RouterError::NetworkError("Failed to acquire HRM permit".to_string()))?;

            // Execute HRM request and measure time
            let start = Instant::now();
            let hrm_response = hrm_client.process_request(&prompt).await
                .map_err(|e| RouterError::NetworkError(format!("HRM request failed: {}", e)))?;
            let dt_ms = start.elapsed().as_secs_f32() * 1000.0;

            // Cache response (quality score unknown -> 0.0)
            let _ = self.cache.cache_response(&prompt, &hrm_response, "hrm-mlx", dt_ms, 0.0).await;

            Ok(hrm_response)
        } else {
            Err(RouterError::ConfigError("HRM client not available".to_string()))
        }
    }

    async fn route_to_dspy(&self, messages: &[Message]) -> Result<String, RouterError> {
        if let Some(dspy_client) = &self.dspy_client {
            let prompt = messages.last()
                .ok_or_else(|| RouterError::ConfigError("No messages in request".to_string()))?
                .content.clone();

            let dspy_response = dspy_client.orchestrate_request(&prompt).await
                .map_err(|e| RouterError::NetworkError(format!("DSPy request failed: {}", e)))?;

            Ok(dspy_response)
        } else {
            // DSPy is optional - fall back to base router
            let router = self.base_router.read().await;
            let resp = router.route_request(messages.to_vec(), None).await?;
            Ok(resp.content)
        }
    }

    fn should_use_dspy(&self, messages: &[Message]) -> bool {
        // Use DSPy for complex multi-step tasks that benefit from orchestration
        let prompt = messages.last().map(|m| m.content.as_str()).unwrap_or("");

        // Check for complex reasoning patterns
        let complex_keywords = [
            "analyze", "compare", "evaluate", "explain step by step",
            "create a plan", "design", "develop", "implement",
            "coordinate", "orchestrate", "manage", "optimize"
        ];

        complex_keywords.iter().any(|keyword| prompt.to_lowercase().contains(keyword))
    }

    pub async fn record_performance(&mut self, model: String, metrics: PerformanceMetrics) {
        self.performance_tracker.record_metrics(model, metrics).await;
    }
}

// Supporting structures
#[derive(Debug)]
pub struct PerformanceTracker {
    metrics: Arc<RwLock<HashMap<String, Vec<PerformanceMetrics>>>>,
}

impl PerformanceTracker {
    pub fn new() -> Self {
        Self {
            metrics: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn record_metrics(&self, model: String, metrics: PerformanceMetrics) {
        let mut model_metrics = self.metrics.write().await;
        model_metrics.entry(model.clone()).or_insert_with(Vec::new).push(metrics);

        // Keep only recent metrics (last 100 per model)
        if let Some(metrics_vec) = model_metrics.get_mut(&model) {
            if metrics_vec.len() > 100 {
                metrics_vec.drain(0..metrics_vec.len() - 100);
            }
        }
    }

    pub async fn get_recent_performance(&self) -> HashMap<String, Vec<PerformanceMetrics>> {
        self.metrics.read().await.clone()
    }
}

#[derive(Debug)]
pub struct ContextAnalyzer;

impl ContextAnalyzer {
    pub fn new() -> Self {
        Self
    }

    pub async fn analyze(&self, messages: &[Message]) -> SmartRoutingContext {
        let prompt = messages
            .last()
            .map(|m| m.content.as_str())
            .unwrap_or("");

        // Analyze prompt complexity using existing HRM model logic
        let complexity = self.analyze_prompt_complexity(prompt);

        // Analyze task type
        let task_type = self.analyze_task_type(prompt);

        // Determine urgency level
        let urgency_level = self.analyze_urgency_level(prompt);

        // Estimate response length
        let expected_length = self.estimate_response_length(prompt);

        // Default user preferences (could be loaded from user profile)
        let user_preferences = UserPreferences {
            prioritize_speed: false,
            prioritize_quality: true,
            preferred_models: vec![],
            budget_constraints: None,
        };

        // Default time constraints
        let time_constraints = TimeConstraints {
            max_response_time: None,
            is_urgent: urgency_level == UrgencyLevel::Critical,
        };

        SmartRoutingContext {
            prompt_complexity: complexity,
            task_type,
            urgency_level,
            expected_length,
            user_preferences,
            system_load: 0.5, // Would be fetched from load monitor
            time_constraints,
        }
    }

    fn analyze_prompt_complexity(&self, prompt: &str) -> PromptComplexity {
        let word_count = prompt.split_whitespace().count();
        let has_questions = prompt.contains('?');
        let has_technical_terms = self.count_technical_terms(prompt);
        let has_reasoning_keywords = self.count_reasoning_keywords(prompt);

        if word_count < 10 && !has_questions && has_technical_terms == 0 {
            PromptComplexity::Simple
        } else if word_count < 50 && has_technical_terms < 3 && has_reasoning_keywords < 2 {
            PromptComplexity::Medium
        } else if word_count < 200 && has_technical_terms < 10 && has_reasoning_keywords < 5 {
            PromptComplexity::Complex
        } else {
            PromptComplexity::Expert
        }
    }

    fn analyze_task_type(&self, prompt: &str) -> TaskType {
        let prompt_lower = prompt.to_lowercase();

        if prompt_lower.contains("image") || prompt_lower.contains("picture") || prompt_lower.contains("visual") {
            TaskType::Vision
        } else if prompt_lower.contains("code") || prompt_lower.contains("program") || prompt_lower.contains("function") {
            TaskType::Code
        } else if prompt_lower.contains("write") || prompt_lower.contains("create") || prompt_lower.contains("story") {
            TaskType::Creative
        } else if prompt_lower.contains("analyze") || prompt_lower.contains("explain") || prompt_lower.contains("why") {
            TaskType::Analysis
        } else if prompt_lower.contains("reason") || prompt_lower.contains("think") || prompt_lower.contains("logic") {
            TaskType::Reasoning
        } else if prompt_lower.contains("translate") || prompt_lower.contains("language") {
            TaskType::Translation
        } else if prompt_lower.contains("summarize") || prompt_lower.contains("summary") {
            TaskType::Summarization
        } else {
            TaskType::Question
        }
    }

    fn analyze_urgency_level(&self, prompt: &str) -> UrgencyLevel {
        let prompt_lower = prompt.to_lowercase();

        if prompt_lower.contains("urgent") || prompt_lower.contains("asap") || prompt_lower.contains("immediately") {
            UrgencyLevel::Critical
        } else if prompt_lower.contains("quick") || prompt_lower.contains("fast") || prompt_lower.contains("soon") {
            UrgencyLevel::High
        } else if prompt_lower.contains("whenever") || prompt_lower.contains("no rush") {
            UrgencyLevel::Low
        } else {
            UrgencyLevel::Medium
        }
    }

    fn estimate_response_length(&self, prompt: &str) -> ResponseLength {
        let word_count = prompt.split_whitespace().count();

        if word_count < 20 {
            ResponseLength::Short
        } else if word_count < 100 {
            ResponseLength::Medium
        } else if word_count < 500 {
            ResponseLength::Long
        } else {
            ResponseLength::VeryLong
        }
    }

    fn count_technical_terms(&self, prompt: &str) -> usize {
        let technical_terms = [
            "algorithm", "function", "variable", "database", "api", "server",
            "client", "protocol", "framework", "library", "method", "class",
            "object", "inheritance", "polymorphism", "encapsulation", "abstraction"
        ];

        technical_terms.iter()
            .map(|term| prompt.to_lowercase().matches(term).count())
            .sum()
    }

    fn count_reasoning_keywords(&self, prompt: &str) -> usize {
        let reasoning_keywords = [
            "analyze", "compare", "evaluate", "explain", "reason", "logic",
            "step by step", "process", "method", "approach", "strategy",
            "consider", "think", "determine", "conclude", "infer"
        ];

        reasoning_keywords.iter()
            .map(|term| prompt.to_lowercase().matches(term).count())
            .sum()
    }
}

#[derive(Debug)]
pub struct LoadMonitor;

impl LoadMonitor {
    pub fn new() -> Self {
        Self
    }

    pub async fn get_current_load(&self) -> f32 {
        // In a real implementation, this would query system metrics
        // For now, return a simulated load value
        0.5
    }
}

// HRM and DSPy clients
#[derive(Debug)]
pub struct HrmClient {
    base_url: String,
}

impl HrmClient {
    pub fn new(base_url: &str) -> Self {
        Self {
            base_url: base_url.to_string(),
        }
    }

    pub async fn process_request(&self, prompt: &str) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        // Make HTTP request to HRM service
        let client = reqwest::Client::new();
        let response = client
            .post(&format!("{}/hrm/process", self.base_url.trim_end_matches('/')))
            .json(&serde_json::json!({
                "input": prompt,
                "taskType": "reasoning",
                "complexity": "auto"
            }))
            .send()
            .await?;

        let result: serde_json::Value = response.json().await?;
        // Prefer HRM's structured fields if available
        if let Some(out) = result.get("output").and_then(|v| v.as_str()) {
            return Ok(out.to_string());
        }
        if let Some(out) = result.get("result").and_then(|v| v.as_str()) {
            return Ok(out.to_string());
        }
        Ok(serde_json::to_string(&result).unwrap_or_default())
    }
}

#[derive(Debug)]
pub struct DspyClient {
    base_url: String,
}

impl DspyClient {
    pub fn new(base_url: &str) -> Self {
        Self {
            base_url: base_url.to_string(),
        }
    }

    pub async fn orchestrate_request(&self, prompt: &str) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        // Make HTTP request to DSPy orchestrator
        let client = reqwest::Client::new();
        let response = client
            .post(&format!("{}/orchestrate", self.base_url))
            .json(&serde_json::json!({
                "prompt": prompt,
                "context": "smart_routing"
            }))
            .send()
            .await?;

        let result: serde_json::Value = response.json().await?;
        Ok(result["response"].as_str().unwrap_or("").to_string())
    }
}
