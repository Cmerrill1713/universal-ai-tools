use crate::models::*;
use anyhow::Result;
use async_trait::async_trait;
use serde_json::Value;
use std::collections::HashMap;

/// Verifier model that evaluates generated outputs
#[async_trait]
pub trait VerifierModel: Send + Sync {
    async fn verify(&self, output: &str, prompt: &str, context: Option<&str>) -> Result<VerifierFeedback>;
    async fn batch_verify(&self, outputs: &[String], prompts: &[String]) -> Result<Vec<VerifierFeedback>>;
    async fn update_from_feedback(&mut self, examples: &[TrainingExample]) -> Result<()>;
    async fn get_accuracy(&self) -> Result<f64>;
}

/// Default verifier implementation using rule-based and LLM-based evaluation
pub struct DefaultVerifier {
    state: VerifierState,
    llm_client: reqwest::Client,
    llm_endpoint: String,
    cache: HashMap<String, VerifierFeedback>,
}

impl DefaultVerifier {
    pub fn new(llm_endpoint: String) -> Self {
        Self {
            state: VerifierState::default(),
            llm_client: reqwest::Client::new(),
            llm_endpoint,
            cache: HashMap::new(),
        }
    }

    /// Rule-based verification for common patterns
    fn rule_based_verification(&self, output: &str, _prompt: &str) -> VerifierFeedback {
        let mut correctness_score = 0.5;
        let mut quality_score = 0.5;
        let mut error_types = Vec::new();
        let mut suggestions = Vec::new();

        // Check for common issues
        if output.is_empty() {
            correctness_score = 0.0;
            error_types.push("empty_output".to_string());
            suggestions.push("Generate non-empty output".to_string());
        }

        if output.len() < 10 {
            correctness_score = 0.3;
            quality_score = 0.3;
            error_types.push("too_short".to_string());
            suggestions.push("Provide more detailed response".to_string());
        }

        if output.len() > 10000 {
            correctness_score = 0.7;
            quality_score = 0.6;
            error_types.push("too_long".to_string());
            suggestions.push("Consider conciseness".to_string());
        }

        // Check for code quality if it looks like code
        if output.contains("fn ") || output.contains("def ") || output.contains("function ") {
            if !output.contains("return") && !output.contains("println") && !output.contains("print") {
                correctness_score *= 0.8;
                error_types.push("incomplete_code".to_string());
                suggestions.push("Add return statement or output".to_string());
            }
        }

        // Check for proper formatting
        if output.contains("\n\n\n") {
            quality_score *= 0.9;
            suggestions.push("Improve formatting".to_string());
        }

        let confidence = (correctness_score + quality_score) / 2.0;
        let detailed_feedback = format!(
            "Correctness: {:.2}, Quality: {:.2}. Issues: {:?}",
            correctness_score, quality_score, error_types
        );

        VerifierFeedback {
            confidence,
            correctness_score,
            quality_score,
            detailed_feedback,
            error_types,
            suggestions,
        }
    }

    /// LLM-based verification for more nuanced evaluation
    async fn llm_verification(&self, output: &str, prompt: &str, context: Option<&str>) -> Result<VerifierFeedback> {
        let verification_prompt = format!(
            "Evaluate the following generated output for correctness and quality:\n\n\
            Original Prompt: {}\n\n\
            Context: {}\n\n\
            Generated Output: {}\n\n\
            Please provide:\n\
            1. Correctness score (0.0-1.0)\n\
            2. Quality score (0.0-1.0)\n\
            3. Detailed feedback\n\
            4. List of specific issues\n\
            5. Suggestions for improvement\n\n\
            Respond in JSON format with keys: correctness_score, quality_score, detailed_feedback, error_types, suggestions",
            prompt,
            context.unwrap_or("None"),
            output
        );

        let response = self.llm_client
            .post(&self.llm_endpoint)
            .json(&serde_json::json!({
                "prompt": verification_prompt,
                "max_tokens": 500,
                "temperature": 0.1
            }))
            .send()
            .await?;

        let response_text = response.text().await?;

        // Try to parse JSON response, fallback to rule-based if parsing fails
        match serde_json::from_str::<Value>(&response_text) {
            Ok(json) => {
                let correctness_score = json["correctness_score"].as_f64().unwrap_or(0.5);
                let quality_score = json["quality_score"].as_f64().unwrap_or(0.5);
                let detailed_feedback = json["detailed_feedback"].as_str().unwrap_or("LLM evaluation").to_string();

                let error_types = json["error_types"]
                    .as_array()
                    .map(|arr| arr.iter().filter_map(|v| v.as_str()).map(|s| s.to_string()).collect())
                    .unwrap_or_default();

                let suggestions = json["suggestions"]
                    .as_array()
                    .map(|arr| arr.iter().filter_map(|v| v.as_str()).map(|s| s.to_string()).collect())
                    .unwrap_or_default();

                Ok(VerifierFeedback {
                    confidence: (correctness_score + quality_score) / 2.0,
                    correctness_score,
                    quality_score,
                    detailed_feedback,
                    error_types,
                    suggestions,
                })
            }
            Err(_) => {
                // Fallback to rule-based verification
                Ok(self.rule_based_verification(output, prompt))
            }
        }
    }
}

#[async_trait]
impl VerifierModel for DefaultVerifier {
    async fn verify(&self, output: &str, prompt: &str, context: Option<&str>) -> Result<VerifierFeedback> {
        // Check cache first
        let cache_key = format!("{}:{}", prompt, output);
        if let Some(cached) = self.cache.get(&cache_key) {
            return Ok(cached.clone());
        }

        // Combine rule-based and LLM verification
        let rule_feedback = self.rule_based_verification(output, prompt);

        // Use LLM verification for more complex cases
        let llm_feedback = if output.len() > 50 && !rule_feedback.error_types.is_empty() {
            self.llm_verification(output, prompt, context).await.unwrap_or(rule_feedback.clone())
        } else {
            rule_feedback.clone()
        };

        // Weighted combination
        let final_feedback = VerifierFeedback {
            confidence: (rule_feedback.confidence * 0.3 + llm_feedback.confidence * 0.7),
            correctness_score: (rule_feedback.correctness_score * 0.3 + llm_feedback.correctness_score * 0.7),
            quality_score: (rule_feedback.quality_score * 0.3 + llm_feedback.quality_score * 0.7),
            detailed_feedback: format!("Rule-based: {}\nLLM-based: {}", rule_feedback.detailed_feedback, llm_feedback.detailed_feedback),
            error_types: {
                let mut errors = rule_feedback.error_types.clone();
                errors.extend(llm_feedback.error_types);
                errors.sort();
                errors.dedup();
                errors
            },
            suggestions: {
                let mut suggestions = rule_feedback.suggestions.clone();
                suggestions.extend(llm_feedback.suggestions);
                suggestions.sort();
                suggestions.dedup();
                suggestions
            },
        };

        Ok(final_feedback)
    }

    async fn batch_verify(&self, outputs: &[String], prompts: &[String]) -> Result<Vec<VerifierFeedback>> {
        let mut results = Vec::new();

        for (output, prompt) in outputs.iter().zip(prompts.iter()) {
            let feedback = self.verify(output, prompt, None).await?;
            results.push(feedback);
        }

        Ok(results)
    }

    async fn update_from_feedback(&mut self, examples: &[TrainingExample]) -> Result<()> {
        // Update verifier model based on training examples
        // This is a simplified implementation - in practice, you'd retrain the verifier

        let mut count = 0;

        for example in examples {
            // Simulate verifier learning from feedback
            let predicted_confidence = self.state.model_weights.iter().sum::<f64>() / self.state.model_weights.len() as f64;
            let actual_confidence = example.verifier_feedback.confidence;

            // Simple gradient update
            let error = actual_confidence - predicted_confidence;
            for weight in &mut self.state.model_weights {
                *weight += 0.001 * error; // Learning rate
            }

            count += 1;
        }

        if count > 0 {
            self.state.training_examples += count;
            self.state.last_updated = chrono::Utc::now();
        }

        Ok(())
    }

    async fn get_accuracy(&self) -> Result<f64> {
        // Return estimated accuracy based on training examples
        Ok(0.85) // Simplified - would calculate from validation set
    }
}
