use crate::models::*;
use crate::generator::GeneratorModel;
use crate::mock_llm::MockLLMService;
use anyhow::Result;
use async_trait::async_trait;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Mock generator that uses MockLLMService for testing
pub struct MockGenerator {
    llm_service: Arc<Mutex<MockLLMService>>,
    policy_state: PolicyState,
}

impl MockGenerator {
    pub fn new() -> Self {
        Self {
            llm_service: Arc::new(Mutex::new(MockLLMService::new())),
            policy_state: PolicyState::default(),
        }
    }
    
    pub async fn reset_iterations(&self) {
        let mut llm = self.llm_service.lock().await;
        llm.reset_iterations();
    }
    
    pub async fn get_iteration_count(&self, task_type: &str) -> usize {
        let llm = self.llm_service.lock().await;
        llm.get_iteration_count(task_type)
    }
}

#[async_trait]
impl GeneratorModel for MockGenerator {
    async fn generate(&self, prompt: &str, context: Option<&str>, _feedback: Option<&str>) -> Result<GeneratorOutput> {
        let mut llm = self.llm_service.lock().await;
        let output_text = llm.generate(prompt, context).await?;
        
        Ok(GeneratorOutput {
            text: output_text,
            confidence: 0.8, // Mock confidence
            reasoning: Some("Mock reasoning for testing".to_string()),
            metadata: serde_json::json!({
                "model": "mock",
                "prompt_length": prompt.len(),
                "context_provided": context.is_some()
            }),
        })
    }
    
    async fn batch_generate(&self, prompts: &[String], contexts: &[Option<String>]) -> Result<Vec<GeneratorOutput>> {
        let mut results = Vec::new();
        for (i, prompt) in prompts.iter().enumerate() {
            let context = contexts.get(i).and_then(|c| c.as_ref().map(|s| s.as_str()));
            let result = self.generate(prompt, context, None).await?;
            results.push(result);
        }
        Ok(results)
    }
    
    async fn update_policy(&mut self, experiences: &[TrainingExample]) -> Result<()> {
        // Simulate policy update with experience
        let total_reward: f64 = experiences.iter().map(|e| e.reward).sum();
        let avg_reward = total_reward / experiences.len() as f64;
        
        // Update policy parameters based on average reward
        for param in &mut self.policy_state.parameters {
            *param += avg_reward * 0.01; // Small learning step
        }
        
        // Update learning rate based on performance
        if avg_reward > 0.8 {
            self.policy_state.learning_rate *= 0.95; // Decrease learning rate for good performance
        } else if avg_reward < 0.5 {
            self.policy_state.learning_rate *= 1.05; // Increase learning rate for poor performance
        }
        
        Ok(())
    }
    
    async fn get_policy_entropy(&self) -> Result<f64> {
        // Calculate entropy based on policy parameters
        let variance = self.policy_state.parameters.iter()
            .map(|p| p * p)
            .sum::<f64>() / self.policy_state.parameters.len() as f64;
        
        Ok(variance.sqrt())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_mock_generator_generation() {
        let mut generator = MockGenerator::new();
        
        let result = generator.generate("Write a hello world function", None).await.unwrap();
        assert!(result.contains("Hello"));
    }
    
    #[tokio::test]
    async fn test_mock_generator_batch() {
        let mut generator = MockGenerator::new();
        
        let prompts = vec![
            "Write a hello world function".to_string(),
            "Implement fibonacci".to_string(),
        ];
        
        let results = generator.batch_generate(&prompts, None).await.unwrap();
        assert_eq!(results.len(), 2);
        assert!(results[0].contains("Hello"));
        assert!(results[1].contains("fib"));
    }
    
    #[tokio::test]
    async fn test_policy_update() {
        let mut generator = MockGenerator::new();
        
        let experiences = vec![
            TrainingExample {
                iteration: 1,
                prompt: "test".to_string(),
                generated_output: "output".to_string(),
                verifier_feedback: VerifierFeedback {
                    confidence: 0.8,
                    correctness_score: 0.8,
                    quality_score: 0.8,
                    detailed_feedback: "good".to_string(),
                    error_types: vec![],
                    suggestions: vec![],
                },
                reward: 0.8,
                timestamp: chrono::Utc::now(),
            },
        ];
        
        let result = generator.update_policy(&experiences);
        assert!(result.is_ok());
    }
}
