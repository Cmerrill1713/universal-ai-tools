use anyhow::{Result, anyhow};
use serde_json::json;
use tracing::{info, debug};

use crate::models::{Document, GBRResult, SearchSession};
use crate::generator::GeneratorClient;
use crate::retriever::DocumentRetriever;

/// GBR (Gain Beyond RAG) calculator - measures improvement of S3 over naive RAG
pub struct GBRCalculator {
    generator_client: Box<dyn GeneratorClient>,
    baseline_retriever: Box<dyn DocumentRetriever>,
}

impl GBRCalculator {
    pub fn new(
        generator_client: Box<dyn GeneratorClient>,
        baseline_retriever: Box<dyn DocumentRetriever>,
    ) -> Self {
        Self {
            generator_client,
            baseline_retriever,
        }
    }
    
    /// Calculate GBR reward for a search session
    /// GBR = accuracy(S3) - accuracy(baseline RAG)
    pub async fn calculate_gbr(
        &self,
        session: &SearchSession,
        gold_answer: &str,
    ) -> Result<GBRResult> {
        info!("Calculating GBR for question: {}", session.original_question);
        
        // Step 1: Get S3 accuracy with the documents from iterative search
        let s3_accuracy = self.evaluate_answer_quality(
            &session.original_question,
            &session.final_documents,
            gold_answer,
        ).await?;
        
        // Step 2: Get baseline RAG accuracy with naive retrieval
        let baseline_docs = self.get_baseline_documents(&session.original_question).await?;
        let baseline_accuracy = self.evaluate_answer_quality(
            &session.original_question,
            &baseline_docs,
            gold_answer,
        ).await?;
        
        // Step 3: Calculate GBR score
        let gbr_score = s3_accuracy - baseline_accuracy;
        
        info!("GBR calculation complete: S3={:.3}, Baseline={:.3}, GBR={:.3}",
              s3_accuracy, baseline_accuracy, gbr_score);
        
        Ok(GBRResult {
            s3_accuracy,
            baseline_accuracy,
            gbr_score,
            s3_documents: session.final_documents.clone(),
            baseline_documents: baseline_docs,
        })
    }
    
    /// Get baseline documents using naive single-turn RAG
    async fn get_baseline_documents(&self, question: &str) -> Result<Vec<Document>> {
        // Simple single-turn retrieval with fixed k
        let baseline_k = 5; // Standard RAG typically uses 5-10 documents
        
        debug!("Retrieving {} baseline documents for: {}", baseline_k, question);
        let docs = self.baseline_retriever.retrieve(question, baseline_k).await?;
        
        Ok(docs)
    }
    
    /// Evaluate answer quality given documents
    async fn evaluate_answer_quality(
        &self,
        question: &str,
        documents: &[Document],
        gold_answer: &str,
    ) -> Result<f32> {
        // Generate answer using the documents
        let generated_answer = self.generator_client.generate_answer(
            question,
            documents,
        ).await?;
        
        // Calculate accuracy using LLM-based evaluation
        let accuracy = self.llm_evaluate_accuracy(
            question,
            &generated_answer.answer,
            gold_answer,
        ).await?;
        
        Ok(accuracy)
    }
    
    /// Use LLM to evaluate answer accuracy against gold standard
    async fn llm_evaluate_accuracy(
        &self,
        question: &str,
        generated_answer: &str,
        gold_answer: &str,
    ) -> Result<f32> {
        let prompt = format!(
            "Question: {}\n\n\
             Gold Standard Answer: {}\n\n\
             Generated Answer: {}\n\n\
             Evaluate how well the generated answer matches the gold standard answer. \
             Consider factual accuracy, completeness, and relevance. \
             Return a score between 0 and 1.\n\n\
             Respond with JSON: {{\"score\": 0.X, \"reasoning\": \"...\"}}",
            question, gold_answer, generated_answer
        );
        
        let evaluation = self.generator_client.evaluate(&prompt).await?;
        
        // Parse the evaluation response
        let eval_json: serde_json::Value = serde_json::from_str(&evaluation)
            .unwrap_or_else(|_| json!({"score": 0.5}));
        
        let score = eval_json["score"].as_f64().unwrap_or(0.5) as f32;
        
        Ok(score.clamp(0.0, 1.0))
    }
    
    /// Calculate reward for PPO training
    /// This is used during reinforcement learning to train the searcher
    pub async fn calculate_ppo_reward(
        &self,
        session: &SearchSession,
        gold_answer: Option<&str>,
    ) -> Result<f32> {
        // If we have a gold answer, use GBR
        if let Some(gold) = gold_answer {
            let gbr_result = self.calculate_gbr(session, gold).await?;
            return Ok(gbr_result.gbr_score);
        }
        
        // Otherwise use heuristic rewards
        let reward = self.calculate_heuristic_reward(session);
        Ok(reward)
    }
    
    /// Calculate heuristic reward when gold answer is not available
    fn calculate_heuristic_reward(&self, session: &SearchSession) -> f32 {
        let mut reward = 0.0;
        
        // Reward for finding relevant documents
        let avg_relevance = session.final_documents.iter()
            .map(|d| d.relevance_score)
            .sum::<f32>() / session.final_documents.len().max(1) as f32;
        reward += avg_relevance * 0.3;
        
        // Reward for efficiency (fewer turns is better)
        let efficiency_bonus = match session.turns.len() {
            1 => 0.3,
            2 => 0.2,
            3 => 0.1,
            _ => 0.0,
        };
        reward += efficiency_bonus;
        
        // Reward for document diversity (avoid redundancy)
        let diversity_score = self.calculate_diversity(&session.final_documents);
        reward += diversity_score * 0.2;
        
        // Penalty for too few documents
        if session.final_documents.len() < 3 {
            reward -= 0.1;
        }
        
        // Penalty for stopping too early without good reason
        if session.turns.len() == 1 && avg_relevance < 0.7 {
            reward -= 0.2;
        }
        
        reward.clamp(-1.0, 1.0)
    }
    
    /// Calculate diversity score for documents
    fn calculate_diversity(&self, documents: &[Document]) -> f32 {
        if documents.len() <= 1 {
            return 0.0;
        }
        
        // Simple diversity based on content difference
        // In production, would use embedding similarity
        let mut total_difference = 0.0;
        let mut comparisons = 0;
        
        for i in 0..documents.len() {
            for j in i+1..documents.len() {
                let similarity = self.simple_text_similarity(
                    &documents[i].content,
                    &documents[j].content,
                );
                total_difference += 1.0 - similarity;
                comparisons += 1;
            }
        }
        
        if comparisons > 0 {
            total_difference / comparisons as f32
        } else {
            0.0
        }
    }
    
    /// Simple text similarity using Jaccard coefficient
    fn simple_text_similarity(&self, text1: &str, text2: &str) -> f32 {
        let words1: std::collections::HashSet<&str> = text1.split_whitespace().collect();
        let words2: std::collections::HashSet<&str> = text2.split_whitespace().collect();
        
        if words1.is_empty() || words2.is_empty() {
            return 0.0;
        }
        
        let intersection = words1.intersection(&words2).count() as f32;
        let union = words1.union(&words2).count() as f32;
        
        if union > 0.0 {
            intersection / union
        } else {
            0.0
        }
    }
}

/// Batch GBR calculator for training evaluation
pub struct BatchGBRCalculator {
    calculator: GBRCalculator,
}

impl BatchGBRCalculator {
    pub fn new(calculator: GBRCalculator) -> Self {
        Self { calculator }
    }
    
    /// Calculate average GBR across multiple examples
    pub async fn calculate_batch_gbr(
        &self,
        sessions: &[(SearchSession, String)], // (session, gold_answer) pairs
    ) -> Result<f32> {
        let mut total_gbr = 0.0;
        let mut successful_calculations = 0;
        
        for (session, gold_answer) in sessions {
            match self.calculator.calculate_gbr(session, gold_answer).await {
                Ok(result) => {
                    total_gbr += result.gbr_score;
                    successful_calculations += 1;
                },
                Err(e) => {
                    debug!("Failed to calculate GBR for one example: {}", e);
                }
            }
        }
        
        if successful_calculations > 0 {
            Ok(total_gbr / successful_calculations as f32)
        } else {
            Err(anyhow!("No successful GBR calculations"))
        }
    }
    
    /// Calculate GBR statistics for reporting
    pub async fn calculate_statistics(
        &self,
        sessions: &[(SearchSession, String)],
    ) -> Result<GBRStatistics> {
        let mut gbr_scores = Vec::new();
        let mut s3_accuracies = Vec::new();
        let mut baseline_accuracies = Vec::new();
        
        for (session, gold_answer) in sessions {
            if let Ok(result) = self.calculator.calculate_gbr(session, gold_answer).await {
                gbr_scores.push(result.gbr_score);
                s3_accuracies.push(result.s3_accuracy);
                baseline_accuracies.push(result.baseline_accuracy);
            }
        }
        
        if gbr_scores.is_empty() {
            return Err(anyhow!("No successful calculations for statistics"));
        }
        
        Ok(GBRStatistics {
            mean_gbr: mean(&gbr_scores),
            std_gbr: std_dev(&gbr_scores),
            mean_s3_accuracy: mean(&s3_accuracies),
            mean_baseline_accuracy: mean(&baseline_accuracies),
            positive_gbr_rate: gbr_scores.iter().filter(|&&x| x > 0.0).count() as f32 
                / gbr_scores.len() as f32,
            sample_size: gbr_scores.len(),
        })
    }
}

#[derive(Debug, Clone)]
pub struct GBRStatistics {
    pub mean_gbr: f32,
    pub std_gbr: f32,
    pub mean_s3_accuracy: f32,
    pub mean_baseline_accuracy: f32,
    pub positive_gbr_rate: f32,
    pub sample_size: usize,
}

// Helper functions for statistics
fn mean(values: &[f32]) -> f32 {
    if values.is_empty() {
        return 0.0;
    }
    values.iter().sum::<f32>() / values.len() as f32
}

fn std_dev(values: &[f32]) -> f32 {
    if values.len() <= 1 {
        return 0.0;
    }
    
    let m = mean(values);
    let variance = values.iter()
        .map(|x| (x - m).powi(2))
        .sum::<f32>() / (values.len() - 1) as f32;
    
    variance.sqrt()
}