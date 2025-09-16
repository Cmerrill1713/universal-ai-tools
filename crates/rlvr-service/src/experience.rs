use crate::models::*;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Experience replay and management for RLVR training
pub struct ExperienceManager {
    buffers: HashMap<String, ExperienceBuffer>,
    global_stats: ExperienceStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExperienceStats {
    pub total_experiences: usize,
    pub average_reward: f64,
    pub reward_variance: f64,
    pub success_rate: f64,
    pub last_updated: chrono::DateTime<chrono::Utc>,
}

impl ExperienceManager {
    pub fn new() -> Self {
        Self {
            buffers: HashMap::new(),
            global_stats: ExperienceStats {
                total_experiences: 0,
                average_reward: 0.0,
                reward_variance: 0.0,
                success_rate: 0.0,
                last_updated: chrono::Utc::now(),
            },
        }
    }

    /// Add experience to a specific task buffer
    pub fn add_experience(&mut self, task_id: &str, experience: TrainingExample) {
        let buffer = self.buffers.entry(task_id.to_string()).or_insert_with(|| {
            ExperienceBuffer::new(1000) // Default buffer size
        });

        buffer.add_experience(experience);
        self.update_global_stats();
    }

    /// Sample experiences from a specific task buffer
    pub fn sample_experiences(&self, task_id: &str, batch_size: usize) -> Option<Vec<TrainingExample>> {
        self.buffers.get(task_id).map(|buffer| buffer.sample_batch(batch_size))
    }

    /// Sample experiences across all buffers
    pub fn sample_global_experiences(&self, batch_size: usize) -> Vec<TrainingExample> {
        let mut all_experiences = Vec::new();

        for buffer in self.buffers.values() {
            all_experiences.extend(buffer.experiences.iter().cloned());
        }

        // Shuffle and sample
        use rand::seq::SliceRandom;
        use rand::thread_rng;
        let mut rng = thread_rng();
        all_experiences.shuffle(&mut rng);

        all_experiences.into_iter().take(batch_size).collect()
    }

    /// Get experiences for a specific iteration range
    pub fn get_experiences_by_iteration(&self, task_id: &str, min_iter: usize, max_iter: usize) -> Vec<TrainingExample> {
        if let Some(buffer) = self.buffers.get(task_id) {
            buffer.experiences
                .iter()
                .filter(|exp| exp.iteration >= min_iter && exp.iteration <= max_iter)
                .cloned()
                .collect()
        } else {
            Vec::new()
        }
    }

    /// Analyze experience patterns
    pub fn analyze_patterns(&self, task_id: &str) -> Result<ExperienceAnalysis> {
        let buffer = self.buffers.get(task_id)
            .ok_or_else(|| anyhow::anyhow!("No experiences found for task: {}", task_id))?;

        if buffer.experiences.is_empty() {
            return Ok(ExperienceAnalysis::default());
        }

        let mut rewards: Vec<f64> = buffer.experiences.iter().map(|exp| exp.reward).collect();
        rewards.sort_by(|a, b| a.partial_cmp(b).unwrap());

        let average_reward = rewards.iter().sum::<f64>() / rewards.len() as f64;
        let median_reward = rewards[rewards.len() / 2];

        let variance = rewards.iter()
            .map(|r| (r - average_reward).powi(2))
            .sum::<f64>() / rewards.len() as f64;

        let success_rate = buffer.experiences.iter()
            .filter(|exp| exp.verifier_feedback.confidence > 0.7)
            .count() as f64 / buffer.experiences.len() as f64;

        // Analyze improvement trends
        let mut improvement_trend = 0.0;
        for i in 1..buffer.experiences.len() {
            let prev_reward = buffer.experiences[i-1].reward;
            let curr_reward = buffer.experiences[i].reward;
            improvement_trend += curr_reward - prev_reward;
        }
        improvement_trend /= (buffer.experiences.len() - 1) as f64;

        // Analyze error patterns
        let mut error_counts = HashMap::new();
        for exp in &buffer.experiences {
            for error_type in &exp.verifier_feedback.error_types {
                *error_counts.entry(error_type.clone()).or_insert(0) += 1;
            }
        }

        Ok(ExperienceAnalysis {
            total_experiences: buffer.experiences.len(),
            average_reward,
            median_reward,
            reward_variance: variance,
            success_rate,
            improvement_trend,
            common_errors: error_counts,
            confidence_distribution: self.calculate_confidence_distribution(buffer),
        })
    }

    /// Calculate confidence score distribution
    fn calculate_confidence_distribution(&self, buffer: &ExperienceBuffer) -> HashMap<String, usize> {
        let mut distribution = HashMap::new();

        for exp in &buffer.experiences {
            let confidence_range = match exp.verifier_feedback.confidence {
                c if c < 0.2 => "very_low",
                c if c < 0.4 => "low",
                c if c < 0.6 => "medium",
                c if c < 0.8 => "high",
                _ => "very_high",
            };

            *distribution.entry(confidence_range.to_string()).or_insert(0) += 1;
        }

        distribution
    }

    /// Update global statistics
    fn update_global_stats(&mut self) {
        let mut total_experiences = 0;
        let mut total_reward = 0.0;
        let mut successful_experiences = 0;

        for buffer in self.buffers.values() {
            total_experiences += buffer.experiences.len();

            for exp in &buffer.experiences {
                total_reward += exp.reward;
                if exp.verifier_feedback.confidence > 0.7 {
                    successful_experiences += 1;
                }
            }
        }

        self.global_stats.total_experiences = total_experiences;
        self.global_stats.average_reward = if total_experiences > 0 {
            total_reward / total_experiences as f64
        } else {
            0.0
        };
        self.global_stats.success_rate = if total_experiences > 0 {
            successful_experiences as f64 / total_experiences as f64
        } else {
            0.0
        };
        self.global_stats.last_updated = chrono::Utc::now();
    }

    /// Get global statistics
    pub fn get_global_stats(&self) -> &ExperienceStats {
        &self.global_stats
    }

    /// Clear experiences for a specific task
    pub fn clear_task_experiences(&mut self, task_id: &str) {
        self.buffers.remove(task_id);
        self.update_global_stats();
    }

    /// Export experiences for analysis
    pub fn export_experiences(&self, task_id: &str) -> Result<Vec<TrainingExample>> {
        if let Some(buffer) = self.buffers.get(task_id) {
            Ok(buffer.experiences.clone())
        } else {
            Ok(Vec::new())
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ExperienceAnalysis {
    pub total_experiences: usize,
    pub average_reward: f64,
    pub median_reward: f64,
    pub reward_variance: f64,
    pub success_rate: f64,
    pub improvement_trend: f64,
    pub common_errors: HashMap<String, usize>,
    pub confidence_distribution: HashMap<String, usize>,
}
