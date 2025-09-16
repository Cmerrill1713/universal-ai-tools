use crate::models::*;
use anyhow::Result;
use async_trait::async_trait;
use serde_json::json;
use reqwest::Client;
use serde::{Deserialize, Serialize};

/// Generator model that produces outputs based on prompts and feedback
#[async_trait]
pub trait GeneratorModel: Send + Sync {
    async fn generate(&self, prompt: &str, context: Option<&str>, feedback: Option<&str>) -> Result<GeneratorOutput>;
    async fn batch_generate(&self, prompts: &[String], contexts: &[Option<String>]) -> Result<Vec<GeneratorOutput>>;
    async fn update_policy(&mut self, experiences: &[TrainingExample]) -> Result<()>;
    async fn get_policy_entropy(&self) -> Result<f64>;
}

/// LLM Router request/response models
#[derive(Debug, Serialize, Deserialize)]
struct LLMRouterMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct LLMRouterRequest {
    messages: Vec<LLMRouterMessage>,
    model: Option<String>,
    max_tokens: Option<u32>,
    temperature: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
struct LLMRouterResponse {
    response: String,
    model: Option<String>,
    provider: Option<String>,
    status: Option<String>,
    usage: Option<LLMRouterUsage>,
}

#[derive(Debug, Serialize, Deserialize)]
struct LLMRouterUsage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

/// Default generator implementation using real LLM router
pub struct DefaultGenerator {
    state: PolicyState,
    llm_client: Client,
    llm_router_endpoint: String,
    generation_cache: std::collections::HashMap<String, GeneratorOutput>,
}

impl DefaultGenerator {
    pub fn new(llm_endpoint: String) -> Self {
        Self {
            state: PolicyState::default(),
            llm_client: Client::new(),
            llm_router_endpoint: llm_endpoint,
            generation_cache: std::collections::HashMap::new(),
        }
    }

    /// Generate output using LLM with optional feedback integration
    async fn llm_generate(&self, prompt: &str, context: Option<&str>, feedback: Option<&str>) -> Result<GeneratorOutput> {
        let enhanced_prompt = if let Some(feedback) = feedback {
            format!(
                "Previous attempt feedback: {}\n\nOriginal prompt: {}\n\nContext: {}\n\nPlease generate an improved response based on the feedback:",
                feedback,
                prompt,
                context.unwrap_or("None")
            )
        } else {
            format!(
                "Prompt: {}\n\nContext: {}\n\nPlease generate a high-quality response:",
                prompt,
                context.unwrap_or("None")
            )
        };

        // Prepare request for LLM router
        let prompt_length = enhanced_prompt.len();
        let messages = vec![
            LLMRouterMessage {
                role: "user".to_string(),
                content: enhanced_prompt,
            }
        ];

        let request = LLMRouterRequest {
            messages,
            model: Some("llama3.2:3b".to_string()), // Default model
            max_tokens: Some(1000),
            temperature: Some(0.7),
        };

        // Make request to LLM router
        let response = self.llm_client
            .post(&format!("{}/chat", self.llm_router_endpoint))
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!("LLM router request failed with status: {}", response.status()));
        }

        let router_response: LLMRouterResponse = response.json().await?;
        let generated_text = router_response.response;

        // Calculate confidence based on response characteristics
        let confidence = self.calculate_confidence(&generated_text, prompt);

        Ok(GeneratorOutput {
            text: generated_text,
            confidence,
            reasoning: Some(format!("Generated using LLM router with confidence {:.2}", confidence)),
            metadata: serde_json::json!({
                "model": "llm-router",
                "temperature": 0.7,
                "has_feedback": feedback.is_some(),
                "router_endpoint": self.llm_router_endpoint,
                "prompt_length": prompt_length
            }),
        })
    }

    /// Calculate confidence based on output characteristics
    fn calculate_confidence(&self, output: &str, prompt: &str) -> f64 {
        let mut confidence: f64 = 0.5;

        // Length-based confidence
        if output.len() > 50 && output.len() < 2000 {
            confidence += 0.1;
        }

        // Completeness indicators
        if output.contains('.') || output.contains('!') || output.contains('?') {
            confidence += 0.1;
        }

        // Code-specific checks
        if prompt.contains("code") || prompt.contains("function") || prompt.contains("implement") {
            if output.contains("fn ") || output.contains("def ") || output.contains("function ") {
                confidence += 0.1;
            }
            if output.contains("return") || output.contains("println") || output.contains("print") {
                confidence += 0.1;
            }
        }

        // Avoid overconfidence
        confidence.min(0.95)
    }

    /// Apply policy gradient updates based on experiences
    fn apply_policy_gradient(&mut self, experiences: &[TrainingExample]) -> Result<()> {
        if experiences.is_empty() {
            return Ok(());
        }

        // Calculate policy gradient
        let mut policy_gradient = vec![0.0; self.state.parameters.len()];
        let _total_reward = 0.0;

        for experience in experiences {
            // total_reward += experience.reward;

            // Simple policy gradient update (REINFORCE-style)
            let reward_normalized = experience.reward / experiences.len() as f64;

            for (i, param) in self.state.parameters.iter().enumerate() {
                // Simplified gradient calculation
                policy_gradient[i] += reward_normalized * param * 0.01;
            }
        }

        // Update parameters
        for (i, gradient) in policy_gradient.iter().enumerate() {
            if i < self.state.parameters.len() {
                self.state.parameters[i] += self.state.learning_rate * gradient;
            }
        }

        // Add entropy regularization
        self.add_entropy_regularization();

        Ok(())
    }

    /// Add entropy regularization to prevent policy collapse
    fn add_entropy_regularization(&mut self) {
        use rand::Rng;
        let mut rng = rand::thread_rng();

        for param in &mut self.state.parameters {
            let noise = rng.gen_range(-0.01..0.01);
            *param += self.state.entropy_coefficient * noise;
        }
    }
}

#[async_trait]
impl GeneratorModel for DefaultGenerator {
    async fn generate(&self, prompt: &str, context: Option<&str>, feedback: Option<&str>) -> Result<GeneratorOutput> {
        // Check cache first
        let cache_key = format!("{}:{}:{}", prompt, context.unwrap_or(""), feedback.unwrap_or(""));
        if let Some(cached) = self.generation_cache.get(&cache_key) {
            return Ok(cached.clone());
        }

        // Generate using LLM
        let output = self.llm_generate(prompt, context, feedback).await?;

        Ok(output)
    }

    async fn batch_generate(&self, prompts: &[String], contexts: &[Option<String>]) -> Result<Vec<GeneratorOutput>> {
        let mut results = Vec::new();

        for (prompt, context) in prompts.iter().zip(contexts.iter()) {
            let output = self.generate(prompt, context.as_ref().map(|s| s.as_str()), None).await?;
            results.push(output);
        }

        Ok(results)
    }

    async fn update_policy(&mut self, experiences: &[TrainingExample]) -> Result<()> {
        self.apply_policy_gradient(experiences)?;
        Ok(())
    }

    async fn get_policy_entropy(&self) -> Result<f64> {
        // Calculate policy entropy based on parameter distribution
        let variance = self.state.parameters.iter()
            .map(|&x| x * x)
            .sum::<f64>() / self.state.parameters.len() as f64;

        Ok(variance.sqrt())
    }
}
