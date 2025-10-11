use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum ServiceType {
    LFM2,
    Ollama,
    LMStudio,
    OpenAI,
    Anthropic,
}

impl std::fmt::Display for ServiceType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl ServiceType {
    pub fn as_str(&self) -> &'static str {
        match self {
            ServiceType::LFM2 => "lfm2",
            ServiceType::Ollama => "ollama",
            ServiceType::LMStudio => "lm-studio",
            ServiceType::OpenAI => "openai",
            ServiceType::Anthropic => "anthropic",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "lfm2" => Some(ServiceType::LFM2),
            "ollama" => Some(ServiceType::Ollama),
            "lm-studio" | "lmstudio" => Some(ServiceType::LMStudio),
            "openai" => Some(ServiceType::OpenAI),
            "anthropic" => Some(ServiceType::Anthropic),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoutingDecision {
    pub should_use_local: bool,
    pub target_service: ServiceType,
    pub reasoning: String,
    pub complexity: TaskComplexity,
    pub estimated_tokens: u32,
    pub priority: u8,
    pub confidence: f64,
    pub routing_time_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TaskComplexity {
    Simple,
    Medium,
    Complex,
}

impl TaskComplexity {
    pub fn as_str(&self) -> &'static str {
        match self {
            TaskComplexity::Simple => "simple",
            TaskComplexity::Medium => "medium",
            TaskComplexity::Complex => "complex",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoordinationContext {
    pub task_type: String,
    pub complexity: String,
    pub urgency: UrgencyLevel,
    pub expected_response_length: ResponseLength,
    pub requires_creativity: bool,
    pub requires_accuracy: bool,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UrgencyLevel {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ResponseLength {
    Short,
    Medium,
    Long,
}

pub struct RoutingEngine {
    routing_rules: HashMap<String, RoutingRule>,
    complexity_analyzer: ComplexityAnalyzer,
}

#[derive(Debug, Clone)]
struct RoutingRule {
    service_type: ServiceType,
    conditions: Vec<RoutingCondition>,
    weight: f64,
}

#[derive(Debug, Clone)]
enum RoutingCondition {
    TokenLimit(u32),
    ComplexityMatch(TaskComplexity),
    KeywordPresence(Vec<String>),
    UrgencyLevel(UrgencyLevel),
    CreativityRequired(bool),
}

impl RoutingEngine {
    pub fn new() -> Self {
        let mut engine = Self {
            routing_rules: HashMap::new(),
            complexity_analyzer: ComplexityAnalyzer::new(),
        };

        engine.initialize_default_rules();
        engine
    }

    fn initialize_default_rules(&mut self) {
        // LFM2 rules - fast, simple tasks
        self.routing_rules.insert("lfm2_simple".to_string(), RoutingRule {
            service_type: ServiceType::LFM2,
            conditions: vec![
                RoutingCondition::TokenLimit(100),
                RoutingCondition::ComplexityMatch(TaskComplexity::Simple),
                RoutingCondition::UrgencyLevel(UrgencyLevel::High),
            ],
            weight: 1.0,
        });

        // Ollama rules - general purpose, medium complexity
        self.routing_rules.insert("ollama_general".to_string(), RoutingRule {
            service_type: ServiceType::Ollama,
            conditions: vec![
                RoutingCondition::TokenLimit(1000),
                RoutingCondition::ComplexityMatch(TaskComplexity::Medium),
            ],
            weight: 0.8,
        });

        // LM Studio rules - code and technical tasks
        self.routing_rules.insert("lmstudio_technical".to_string(), RoutingRule {
            service_type: ServiceType::LMStudio,
            conditions: vec![
                RoutingCondition::KeywordPresence(vec![
                    "code".to_string(), "program".to_string(), "function".to_string(),
                    "debug".to_string(), "implement".to_string(), "algorithm".to_string(),
                ]),
                RoutingCondition::TokenLimit(2000),
            ],
            weight: 0.9,
        });

        // OpenAI rules - complex reasoning and creative tasks
        self.routing_rules.insert("openai_creative".to_string(), RoutingRule {
            service_type: ServiceType::OpenAI,
            conditions: vec![
                RoutingCondition::ComplexityMatch(TaskComplexity::Complex),
                RoutingCondition::CreativityRequired(true),
                RoutingCondition::TokenLimit(4000),
            ],
            weight: 0.7,
        });

        // Anthropic rules - analysis, research, long-form content
        self.routing_rules.insert("anthropic_analysis".to_string(), RoutingRule {
            service_type: ServiceType::Anthropic,
            conditions: vec![
                RoutingCondition::KeywordPresence(vec![
                    "analyze".to_string(), "research".to_string(), "explain".to_string(),
                    "comprehensive".to_string(), "detailed".to_string(),
                ]),
                RoutingCondition::ComplexityMatch(TaskComplexity::Complex),
            ],
            weight: 0.8,
        });
    }

    pub async fn make_routing_decision(
        &self,
        user_request: &str,
        context: &CoordinationContext,
    ) -> Result<RoutingDecision, crate::CoordinatorError> {
        let start_time = std::time::Instant::now();

        // Analyze complexity
        let complexity = self.complexity_analyzer.analyze(user_request, context);
        let estimated_tokens = self.estimate_tokens(user_request);

        // Find matching rules
        let mut candidates = Vec::new();

        for (rule_name, rule) in &self.routing_rules {
            let score = self.calculate_rule_score(rule, user_request, context, &complexity, estimated_tokens);
            if score > 0.0 {
                candidates.push((rule.service_type.clone(), score, rule_name.clone()));
            }
        }

        // Sort by score and select best match
        candidates.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        let (target_service, confidence, rule_used) = candidates
            .first()
            .map(|(service, score, rule)| (service.clone(), *score, rule.clone()))
            .unwrap_or((ServiceType::Ollama, 0.5, "fallback".to_string()));

        let routing_time_ms = start_time.elapsed().as_millis() as u64;

        let decision = RoutingDecision {
            should_use_local: matches!(target_service, ServiceType::LFM2 | ServiceType::Ollama),
            target_service: target_service.clone(),
            reasoning: format!("Selected {} using rule '{}' with confidence {:.2}",
                target_service.as_str(), rule_used, confidence),
            complexity: complexity.clone(),
            estimated_tokens,
            priority: self.calculate_priority(confidence, &complexity),
            confidence,
            routing_time_ms,
        };

        tracing::info!(
            target_service = %target_service.as_str(),
            confidence = %confidence,
            routing_time_ms = %routing_time_ms,
            "Routing decision made"
        );

        Ok(decision)
    }

    fn calculate_rule_score(
        &self,
        rule: &RoutingRule,
        user_request: &str,
        context: &CoordinationContext,
        complexity: &TaskComplexity,
        estimated_tokens: u32,
    ) -> f64 {
        let mut score = rule.weight;

        for condition in &rule.conditions {
            let condition_score = match condition {
                RoutingCondition::TokenLimit(limit) => {
                    if estimated_tokens <= *limit {
                        1.0
                    } else {
                        0.5 // Partial penalty for exceeding token limit
                    }
                }
                RoutingCondition::ComplexityMatch(expected) => {
                    if complexity == expected { 1.0 } else { 0.3 }
                }
                RoutingCondition::KeywordPresence(keywords) => {
                    let request_lower = user_request.to_lowercase();
                    let matches = keywords.iter()
                        .filter(|keyword| request_lower.contains(&keyword.to_lowercase()))
                        .count();
                    if matches > 0 {
                        1.0 + (matches as f64 * 0.1) // Bonus for multiple keyword matches
                    } else {
                        0.2
                    }
                }
                RoutingCondition::UrgencyLevel(expected) => {
                    match (&context.urgency, expected) {
                        (UrgencyLevel::High, UrgencyLevel::High) => 1.2,
                        (UrgencyLevel::Medium, UrgencyLevel::Medium) => 1.0,
                        (UrgencyLevel::Low, UrgencyLevel::Low) => 1.0,
                        _ => 0.7,
                    }
                }
                RoutingCondition::CreativityRequired(required) => {
                    if context.requires_creativity == *required { 1.0 } else { 0.8 }
                }
            };

            score *= condition_score;
        }

        score
    }

    fn estimate_tokens(&self, text: &str) -> u32 {
        // Simple token estimation (roughly 4 characters per token)
        (text.len() as f64 / 4.0).ceil() as u32
    }

    fn calculate_priority(&self, confidence: f64, complexity: &TaskComplexity) -> u8 {
        let base_priority = match complexity {
            TaskComplexity::Simple => 1,
            TaskComplexity::Medium => 3,
            TaskComplexity::Complex => 5,
        };

        // Adjust based on confidence
        if confidence > 0.8 {
            base_priority
        } else if confidence > 0.6 {
            (base_priority + 1).min(5)
        } else {
            (base_priority + 2).min(5)
        }
    }
}

struct ComplexityAnalyzer {
    simple_keywords: Vec<String>,
    complex_keywords: Vec<String>,
}

impl ComplexityAnalyzer {
    fn new() -> Self {
        Self {
            simple_keywords: vec![
                "what".to_string(), "who".to_string(), "when".to_string(),
                "where".to_string(), "define".to_string(), "list".to_string(),
                "show".to_string(), "tell".to_string(),
            ],
            complex_keywords: vec![
                "analyze".to_string(), "explain".to_string(), "research".to_string(),
                "comprehensive".to_string(), "detailed".to_string(), "compare".to_string(),
                "evaluate".to_string(), "synthesize".to_string(), "critique".to_string(),
            ],
        }
    }

    fn analyze(&self, text: &str, context: &CoordinationContext) -> TaskComplexity {
        let text_lower = text.to_lowercase();
        let length = text.len();

        // Check for explicit complexity indicators
        let has_simple_keywords = self.simple_keywords.iter()
            .any(|keyword| text_lower.contains(keyword));
        let has_complex_keywords = self.complex_keywords.iter()
            .any(|keyword| text_lower.contains(keyword));

        // Consider context
        let requires_deep_analysis = context.requires_creativity ||
            matches!(context.expected_response_length, ResponseLength::Long);

        // Make decision based on multiple factors
        if has_complex_keywords || requires_deep_analysis || length > 500 {
            TaskComplexity::Complex
        } else if has_simple_keywords && length < 100 && !context.requires_accuracy {
            TaskComplexity::Simple
        } else {
            TaskComplexity::Medium
        }
    }
}

impl Default for RoutingEngine {
    fn default() -> Self {
        Self::new()
    }
}
