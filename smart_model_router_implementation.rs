// Smart Model Router Implementation
// This demonstrates how to implement intelligent model selection

use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use tokio::time::Instant;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatRequest {
    pub messages: Vec<Message>,
    pub model: Option<String>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    pub content: String,
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
}

#[derive(Debug, Clone)]
pub enum SpeedTier {
    Fast,      // < 1s response time
    Medium,    // 1-3s response time
    Slow,      // > 3s response time
}

#[derive(Debug, Clone)]
pub enum CapabilityLevel {
    Basic,     // Simple tasks
    Advanced,  // Complex reasoning
    Expert,    // Specialized tasks
}

#[derive(Debug, Clone)]
pub enum Specialization {
    General,
    Vision,
    Code,
    Creative,
    Math,
    Science,
    Language,
}

#[derive(Debug, Clone)]
pub struct RequestContext {
    pub prompt_complexity: PromptComplexity,
    pub prompt_type: PromptType,
    pub user_preferences: UserPreferences,
    pub system_load: f32,
    pub time_constraints: TimeConstraints,
}

#[derive(Debug, Clone)]
pub enum PromptComplexity {
    Simple,    // Basic questions, simple tasks
    Medium,    // Moderate complexity
    Complex,   // Advanced reasoning, multi-step tasks
    Expert,    // Highly specialized, domain-specific
}

#[derive(Debug, Clone)]
pub enum PromptType {
    Question,
    Creative,
    Code,
    Analysis,
    Vision,
    Translation,
    Summarization,
}

#[derive(Debug, Clone)]
pub struct UserPreferences {
    pub prioritize_speed: bool,
    pub prioritize_quality: bool,
    pub preferred_models: Vec<String>,
    pub budget_constraints: Option<f32>,
}

#[derive(Debug, Clone)]
pub struct TimeConstraints {
    pub max_response_time: Option<f32>,
    pub is_urgent: bool,
}

#[derive(Debug, Clone)]
pub struct PerformanceMetrics {
    pub model: String,
    pub response_time: f32,
    pub quality_score: f32,
    pub user_satisfaction: f32,
    pub timestamp: Instant,
}

pub struct SmartLLMRouter {
    models: HashMap<String, ModelCapabilities>,
    performance_tracker: PerformanceTracker,
    context_analyzer: ContextAnalyzer,
    load_monitor: LoadMonitor,
}

impl SmartLLMRouter {
    pub fn new() -> Self {
        let mut models = HashMap::new();

        // Initialize model capabilities based on our experiments
        models.insert("gemma3:1b".to_string(), ModelCapabilities {
            name: "gemma3:1b".to_string(),
            speed_tier: SpeedTier::Fast,
            capability_level: CapabilityLevel::Basic,
            specializations: vec![Specialization::General, Specialization::Code],
            avg_response_time: 0.79,
            quality_score: 0.85,
            cost_per_token: 0.001,
        });

        models.insert("llava:7b".to_string(), ModelCapabilities {
            name: "llava:7b".to_string(),
            speed_tier: SpeedTier::Medium,
            capability_level: CapabilityLevel::Advanced,
            specializations: vec![Specialization::Vision, Specialization::General],
            avg_response_time: 1.47,
            quality_score: 0.90,
            cost_per_token: 0.002,
        });

        models.insert("llama2:latest".to_string(), ModelCapabilities {
            name: "llama2:latest".to_string(),
            speed_tier: SpeedTier::Medium,
            capability_level: CapabilityLevel::Expert,
            specializations: vec![Specialization::General, Specialization::Creative, Specialization::Analysis],
            avg_response_time: 1.91,
            quality_score: 0.95,
            cost_per_token: 0.003,
        });

        Self {
            models,
            performance_tracker: PerformanceTracker::new(),
            context_analyzer: ContextAnalyzer::new(),
            load_monitor: LoadMonitor::new(),
        }
    }

    pub async fn select_optimal_model(&self, request: &ChatRequest) -> Result<String, String> {
        // Analyze request context
        let context = self.context_analyzer.analyze(request).await;

        // Get current system load
        let system_load = self.load_monitor.get_current_load().await;

        // Get recent performance data
        let performance_data = self.performance_tracker.get_recent_performance().await;

        // Score each model based on multiple factors
        let mut model_scores = HashMap::new();

        for (model_name, capabilities) in &self.models {
            let score = self.calculate_model_score(
                capabilities,
                &context,
                system_load,
                &performance_data,
            );
            model_scores.insert(model_name.clone(), score);
        }

        // Select the best model
        let best_model = model_scores
            .iter()
            .max_by(|a, b| a.1.partial_cmp(b.1).unwrap())
            .map(|(name, _)| name.clone())
            .ok_or("No suitable model found")?;

        Ok(best_model)
    }

    fn calculate_model_score(
        &self,
        capabilities: &ModelCapabilities,
        context: &RequestContext,
        system_load: f32,
        performance_data: &HashMap<String, Vec<PerformanceMetrics>>,
    ) -> f32 {
        let mut score = 0.0;

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
        let specialization_score = if capabilities.specializations.contains(&self.get_required_specialization(&context.prompt_type)) {
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

        // Calculate weighted score
        score = (speed_score * 0.2 +
                capability_score * 0.3 +
                specialization_score * 0.2 +
                performance_score * 0.2 +
                load_factor * 0.05 +
                time_factor * 0.05) * preference_factor;

        score
    }

    fn get_required_specialization(&self, prompt_type: &PromptType) -> Specialization {
        match prompt_type {
            PromptType::Vision => Specialization::Vision,
            PromptType::Code => Specialization::Code,
            PromptType::Creative => Specialization::Creative,
            PromptType::Analysis => Specialization::Math,
            _ => Specialization::General,
        }
    }

    pub async fn record_performance(&mut self, model: String, metrics: PerformanceMetrics) {
        self.performance_tracker.record_metrics(model, metrics).await;
    }
}

// Supporting structures
pub struct PerformanceTracker {
    metrics: HashMap<String, Vec<PerformanceMetrics>>,
}

impl PerformanceTracker {
    pub fn new() -> Self {
        Self {
            metrics: HashMap::new(),
        }
    }

    pub async fn record_metrics(&mut self, model: String, metrics: PerformanceMetrics) {
        self.metrics.entry(model).or_insert_with(Vec::new).push(metrics);

        // Keep only recent metrics (last 100 per model)
        if let Some(model_metrics) = self.metrics.get_mut(&model) {
            if model_metrics.len() > 100 {
                model_metrics.drain(0..model_metrics.len() - 100);
            }
        }
    }

    pub async fn get_recent_performance(&self) -> HashMap<String, Vec<PerformanceMetrics>> {
        self.metrics.clone()
    }
}

pub struct ContextAnalyzer;

impl ContextAnalyzer {
    pub fn new() -> Self {
        Self
    }

    pub async fn analyze(&self, request: &ChatRequest) -> RequestContext {
        let prompt = &request.messages.last().unwrap().content;

        // Analyze prompt complexity
        let complexity = self.analyze_complexity(prompt);

        // Analyze prompt type
        let prompt_type = self.analyze_prompt_type(prompt);

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
            is_urgent: false,
        };

        RequestContext {
            prompt_complexity: complexity,
            prompt_type,
            user_preferences,
            system_load: 0.5, // Would be fetched from load monitor
            time_constraints,
        }
    }

    fn analyze_complexity(&self, prompt: &str) -> PromptComplexity {
        let word_count = prompt.split_whitespace().count();
        let has_questions = prompt.contains('?');
        let has_technical_terms = self.count_technical_terms(prompt);

        if word_count < 10 && !has_questions {
            PromptComplexity::Simple
        } else if word_count < 50 && has_technical_terms < 3 {
            PromptComplexity::Medium
        } else if word_count < 200 && has_technical_terms < 10 {
            PromptComplexity::Complex
        } else {
            PromptComplexity::Expert
        }
    }

    fn analyze_prompt_type(&self, prompt: &str) -> PromptType {
        let prompt_lower = prompt.to_lowercase();

        if prompt_lower.contains("image") || prompt_lower.contains("picture") || prompt_lower.contains("visual") {
            PromptType::Vision
        } else if prompt_lower.contains("code") || prompt_lower.contains("program") || prompt_lower.contains("function") {
            PromptType::Code
        } else if prompt_lower.contains("write") || prompt_lower.contains("create") || prompt_lower.contains("story") {
            PromptType::Creative
        } else if prompt_lower.contains("analyze") || prompt_lower.contains("explain") || prompt_lower.contains("why") {
            PromptType::Analysis
        } else if prompt_lower.contains("translate") || prompt_lower.contains("language") {
            PromptType::Translation
        } else if prompt_lower.contains("summarize") || prompt_lower.contains("summary") {
            PromptType::Summarization
        } else {
            PromptType::Question
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
}

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

// Example usage
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut router = SmartLLMRouter::new();

    // Example request
    let request = ChatRequest {
        messages: vec![
            Message {
                role: "user".to_string(),
                content: "Write a creative story about a robot learning to paint".to_string(),
            }
        ],
        model: None,
        temperature: Some(0.7),
        max_tokens: Some(500),
    };

    // Select optimal model
    let selected_model = router.select_optimal_model(&request).await?;
    println!("Selected model: {}", selected_model);

    // Record performance after processing
    let metrics = PerformanceMetrics {
        model: selected_model.clone(),
        response_time: 1.2,
        quality_score: 0.9,
        user_satisfaction: 0.95,
        timestamp: Instant::now(),
    };

    router.record_performance(selected_model, metrics).await;

    Ok(())
}
