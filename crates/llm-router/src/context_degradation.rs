//! Intelligent Context Degradation Detection
//! 
//! This module implements adaptive context management that detects when
//! context quality starts to degrade rather than using hard thresholds.

use crate::models::Message;
use crate::context::MessageRole;
// use crate::RouterError; // Not used in this module
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::collections::VecDeque;

/// Context quality metrics for degradation detection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextQualityMetrics {
    pub coherence_score: f32,        // How coherent the conversation is
    pub relevance_score: f32,        // How relevant recent messages are
    pub information_density: f32,     // Information per token ratio
    pub repetition_score: f32,       // How much repetition exists
    pub topic_drift: f32,            // How much topics have drifted
    pub context_freshness: f32,      // How fresh the context is
    pub overall_quality: f32,        // Overall quality score (0.0-1.0)
}

/// Context degradation detector with adaptive thresholds
#[derive(Debug)]
pub struct ContextDegradationDetector {
    quality_history: VecDeque<ContextQualityMetrics>,
    degradation_threshold: f32,
    adaptation_rate: f32,
    min_threshold: f32,
    max_threshold: f32,
    current_threshold: f32,
    session_patterns: HashMap<String, SessionPattern>,
}

#[derive(Debug, Clone)]
pub struct SessionPattern {
    pub typical_quality: f32,
    pub quality_variance: f32,
    pub degradation_point: f32,
    pub message_count_at_degradation: usize,
    pub adaptation_count: u32,
}

#[derive(Debug, Clone)]
pub struct DegradationAnalysis {
    pub should_compress: bool,
    pub compression_urgency: CompressionUrgency,
    pub quality_score: f32,
    pub degradation_reasons: Vec<String>,
    pub recommended_action: RecommendedAction,
    pub adaptive_threshold: f32,
}

#[derive(Debug, Clone)]
pub enum CompressionUrgency {
    Low,      // No immediate action needed
    Medium,   // Should compress soon
    High,     // Compress now
    Critical, // Emergency compression needed
}

#[derive(Debug, Clone)]
pub enum RecommendedAction {
    Continue,           // Keep current context
    LightCompression,   // Remove oldest messages
    ModerateCompression, // Summarize older context
    HeavyCompression,   // Major context restructuring
    EmergencyDump,      // Dump to memory immediately
}

impl ContextDegradationDetector {
    pub fn new() -> Self {
        Self {
            quality_history: VecDeque::with_capacity(50),
            degradation_threshold: 0.7,  // Start conservative
            adaptation_rate: 0.05,      // 5% adaptation per analysis
            min_threshold: 0.4,         // Never go below 40%
            max_threshold: 0.9,         // Never go above 90%
            current_threshold: 0.7,
            session_patterns: HashMap::new(),
        }
    }
    
    /// Analyze context quality and determine if compression is needed
    pub fn analyze_context_degradation(
        &mut self,
        messages: &[Message],
        session_id: &str,
        current_tokens: u32,
        _max_tokens: u32,
    ) -> DegradationAnalysis {
        // Calculate current quality metrics
        let quality = self.calculate_context_quality(messages, current_tokens, _max_tokens);
        
        // Add to history
        self.quality_history.push_back(quality.clone());
        if self.quality_history.len() > 50 {
            self.quality_history.pop_front();
        }
        
        // Analyze degradation patterns
        let degradation_reasons = self.identify_degradation_reasons(&quality, messages);
        
        // Determine compression urgency
        let compression_urgency = self.determine_compression_urgency(&quality, &degradation_reasons);
        
        // Decide if compression is needed
        let should_compress = self.should_compress_context(&quality, &degradation_reasons);
        
        // Get recommended action
        let recommended_action = self.get_recommended_action(&quality, &compression_urgency);
        
        // Adapt threshold based on this session's patterns
        self.adapt_threshold_for_session(session_id, &quality, messages.len());
        
        DegradationAnalysis {
            should_compress,
            compression_urgency,
            quality_score: quality.overall_quality,
            degradation_reasons,
            recommended_action,
            adaptive_threshold: self.current_threshold,
        }
    }
    
    /// Calculate comprehensive context quality metrics
    fn calculate_context_quality(
        &self,
        messages: &[Message],
        current_tokens: u32,
        max_tokens: u32,
    ) -> ContextQualityMetrics {
        let coherence_score = self.calculate_coherence_score(messages);
        let relevance_score = self.calculate_relevance_score(messages);
        let information_density = self.calculate_information_density(messages, current_tokens);
        let repetition_score = self.calculate_repetition_score(messages);
        let topic_drift = self.calculate_topic_drift(messages);
        let context_freshness = self.calculate_context_freshness(messages);
        
        // Calculate overall quality (weighted average)
        let overall_quality = coherence_score * 0.25 +
            relevance_score * 0.20 +
            information_density * 0.15 +
            (1.0 - repetition_score) * 0.15 +  // Lower repetition is better
            (1.0 - topic_drift) * 0.15 +       // Lower drift is better
            context_freshness * 0.10;
        
        ContextQualityMetrics {
            coherence_score,
            relevance_score,
            information_density,
            repetition_score,
            topic_drift,
            context_freshness,
            overall_quality,
        }
    }
    
    /// Calculate conversation coherence
    fn calculate_coherence_score(&self, messages: &[Message]) -> f32 {
        if messages.len() < 2 {
            return 1.0;
        }
        
        let mut coherence_sum = 0.0;
        let mut comparisons = 0;
        
        // Check coherence between adjacent messages
        for i in 1..messages.len() {
            let prev_msg = &messages[i - 1];
            let curr_msg = &messages[i];
            
            // Simple coherence based on topic overlap and role transitions
            let topic_overlap = self.calculate_topic_overlap(&prev_msg.content, &curr_msg.content);
            let role_coherence = self.calculate_role_coherence(prev_msg.role.clone(), curr_msg.role.clone());
            
            coherence_sum += (topic_overlap + role_coherence) / 2.0;
            comparisons += 1;
        }
        
        if comparisons > 0 {
            coherence_sum / comparisons as f32
        } else {
            1.0
        }
    }
    
    /// Calculate relevance of recent messages
    fn calculate_relevance_score(&self, messages: &[Message]) -> f32 {
        if messages.len() < 3 {
            return 1.0;
        }
        
        // Focus on last few messages
        let recent_count = 3.min(messages.len());
        let recent_messages: Vec<_> = messages.iter().rev().take(recent_count).collect();
        
        // Calculate topic consistency in recent messages
        let mut relevance_sum = 0.0;
        let mut comparisons = 0;
        
        for i in 1..recent_messages.len() {
            let topic_overlap = self.calculate_topic_overlap(
                &recent_messages[i - 1].content,
                &recent_messages[i].content,
            );
            relevance_sum += topic_overlap;
            comparisons += 1;
        }
        
        if comparisons > 0 {
            relevance_sum / comparisons as f32
        } else {
            1.0
        }
    }
    
    /// Calculate information density (information per token)
    fn calculate_information_density(&self, messages: &[Message], tokens: u32) -> f32 {
        if tokens == 0 {
            return 0.0;
        }
        
        // Count unique words and concepts
        let unique_concepts = self.count_unique_concepts(messages);
        let density = unique_concepts as f32 / tokens as f32;
        
        // Normalize to 0-1 range (assume 0.1 is good density)
        (density / 0.1).min(1.0)
    }
    
    /// Calculate repetition score (higher = more repetitive)
    fn calculate_repetition_score(&self, messages: &[Message]) -> f32 {
        if messages.len() < 2 {
            return 0.0;
        }
        
        let mut repetition_count = 0;
        let mut total_comparisons = 0;
        
        // Check for repeated phrases and concepts
        for i in 0..messages.len() {
            for j in (i + 1)..messages.len() {
                let similarity = self.calculate_content_similarity(
                    &messages[i].content,
                    &messages[j].content,
                );
                
                if similarity > 0.7 {
                    repetition_count += 1;
                }
                total_comparisons += 1;
            }
        }
        
        if total_comparisons > 0 {
            repetition_count as f32 / total_comparisons as f32
        } else {
            0.0
        }
    }
    
    /// Calculate topic drift (how much topics have changed)
    fn calculate_topic_drift(&self, messages: &[Message]) -> f32 {
        if messages.len() < 4 {
            return 0.0;
        }
        
        // Compare early vs recent messages
        let early_count = 3.min(messages.len() / 3);
        let recent_count = 3.min(messages.len() / 3);
        
        let early_topics: Vec<_> = messages.iter().take(early_count)
            .map(|m| self.extract_topics(&m.content))
            .collect();
        let recent_topics: Vec<_> = messages.iter().rev().take(recent_count)
            .map(|m| self.extract_topics(&m.content))
            .collect();
        
        // Calculate topic overlap between early and recent
        let mut total_overlap = 0.0;
        let mut comparisons = 0;
        
        for early_topic in &early_topics {
            for recent_topic in &recent_topics {
                let overlap = self.calculate_topic_list_overlap(early_topic, recent_topic);
                total_overlap += overlap;
                comparisons += 1;
            }
        }
        
        if comparisons > 0 {
            1.0 - (total_overlap / comparisons as f32)  // Higher drift = lower overlap
        } else {
            0.0
        }
    }
    
    /// Calculate context freshness (how recent the important information is)
    fn calculate_context_freshness(&self, messages: &[Message]) -> f32 {
        if messages.len() == 0 {
            return 1.0;
        }
        
        // Weight recent messages more heavily
        let mut freshness_sum = 0.0;
        let total_messages = messages.len() as f32;
        
        for (i, message) in messages.iter().enumerate() {
            let position_weight = (i as f32 + 1.0) / total_messages;  // Later messages get higher weight
            let content_weight = self.calculate_content_importance(&message.content);
            freshness_sum += position_weight * content_weight;
        }
        
        freshness_sum / total_messages
    }
    
    /// Identify specific reasons for context degradation
    fn identify_degradation_reasons(&self, quality: &ContextQualityMetrics, messages: &[Message]) -> Vec<String> {
        let mut reasons = Vec::new();
        
        if quality.coherence_score < 0.6 {
            reasons.push("Low conversation coherence".to_string());
        }
        
        if quality.relevance_score < 0.5 {
            reasons.push("Recent messages lack relevance".to_string());
        }
        
        if quality.information_density < 0.3 {
            reasons.push("Low information density".to_string());
        }
        
        if quality.repetition_score > 0.4 {
            reasons.push("High repetition detected".to_string());
        }
        
        if quality.topic_drift > 0.7 {
            reasons.push("Significant topic drift".to_string());
        }
        
        if quality.context_freshness < 0.4 {
            reasons.push("Context becoming stale".to_string());
        }
        
        if messages.len() > 50 {
            reasons.push("Context length exceeding optimal range".to_string());
        }
        
        reasons
    }
    
    /// Determine compression urgency based on quality metrics
    fn determine_compression_urgency(&self, quality: &ContextQualityMetrics, reasons: &[String]) -> CompressionUrgency {
        let severity_score = reasons.len() as f32 / 6.0;  // Normalize by max possible reasons
        let quality_penalty = 1.0 - quality.overall_quality;
        let urgency_score = severity_score + quality_penalty;
        
        match urgency_score {
            x if x >= 0.8 => CompressionUrgency::Critical,
            x if x >= 0.6 => CompressionUrgency::High,
            x if x >= 0.4 => CompressionUrgency::Medium,
            _ => CompressionUrgency::Low,
        }
    }
    
    /// Determine if context should be compressed
    fn should_compress_context(&self, quality: &ContextQualityMetrics, reasons: &[String]) -> bool {
        // Multiple degradation indicators
        if reasons.len() >= 3 {
            return true;
        }
        
        // Critical quality drop
        if quality.overall_quality < self.current_threshold {
            return true;
        }
        
        // Specific critical issues
        if quality.coherence_score < 0.4 || quality.relevance_score < 0.3 {
            return true;
        }
        
        false
    }
    
    /// Get recommended action based on analysis
    fn get_recommended_action(&self, quality: &ContextQualityMetrics, urgency: &CompressionUrgency) -> RecommendedAction {
        match urgency {
            CompressionUrgency::Critical => RecommendedAction::EmergencyDump,
            CompressionUrgency::High => RecommendedAction::HeavyCompression,
            CompressionUrgency::Medium => RecommendedAction::ModerateCompression,
            CompressionUrgency::Low => {
                if quality.overall_quality < 0.8 {
                    RecommendedAction::LightCompression
                } else {
                    RecommendedAction::Continue
                }
            }
        }
    }
    
    /// Adapt threshold based on session patterns
    fn adapt_threshold_for_session(&mut self, session_id: &str, quality: &ContextQualityMetrics, message_count: usize) {
        let pattern = self.session_patterns.entry(session_id.to_string()).or_insert(SessionPattern {
            typical_quality: quality.overall_quality,
            quality_variance: 0.0,
            degradation_point: self.current_threshold,
            message_count_at_degradation: message_count,
            adaptation_count: 0,
        });
        
        // Update pattern statistics
        pattern.typical_quality = (pattern.typical_quality + quality.overall_quality) / 2.0;
        pattern.adaptation_count += 1;
        
        // Adapt threshold based on this session's patterns
        if pattern.adaptation_count > 5 {  // After some experience with this session
            let adaptation = (pattern.typical_quality - self.current_threshold) * self.adaptation_rate;
            self.current_threshold = (self.current_threshold + adaptation)
                .max(self.min_threshold)
                .min(self.max_threshold);
        }
    }
    
    // Helper methods for content analysis
    
    fn calculate_topic_overlap(&self, content1: &str, content2: &str) -> f32 {
        let topics1 = self.extract_topics(content1);
        let topics2 = self.extract_topics(content2);
        self.calculate_topic_list_overlap(&topics1, &topics2)
    }
    
    fn calculate_topic_list_overlap(&self, topics1: &[String], topics2: &[String]) -> f32 {
        if topics1.is_empty() || topics2.is_empty() {
            return 0.0;
        }
        
        let intersection: Vec<_> = topics1.iter().filter(|t| topics2.contains(t)).collect();
        intersection.len() as f32 / topics1.len().max(topics2.len()) as f32
    }
    
    fn calculate_role_coherence(&self, role1: MessageRole, role2: MessageRole) -> f32 {
        match (role1, role2) {
            (MessageRole::User, MessageRole::Assistant) => 1.0,
            (MessageRole::Assistant, MessageRole::User) => 1.0,
            (MessageRole::System, _) => 0.8,
            (_, MessageRole::System) => 0.8,
            _ => 0.5,  // Same role repeated
        }
    }
    
    fn count_unique_concepts(&self, messages: &[Message]) -> usize {
        let mut concepts = std::collections::HashSet::new();
        
        for message in messages {
            let topics = self.extract_topics(&message.content);
            for topic in topics {
                concepts.insert(topic);
            }
        }
        
        concepts.len()
    }
    
    fn calculate_content_similarity(&self, content1: &str, content2: &str) -> f32 {
        // Simple similarity based on common words
        let content1_lower = content1.to_lowercase();
        let content2_lower = content2.to_lowercase();
        let words1: std::collections::HashSet<_> = content1_lower.split_whitespace().collect();
        let words2: std::collections::HashSet<_> = content2_lower.split_whitespace().collect();
        
        let intersection: Vec<_> = words1.intersection(&words2).collect();
        let union: Vec<_> = words1.union(&words2).collect();
        
        if union.is_empty() {
            0.0
        } else {
            intersection.len() as f32 / union.len() as f32
        }
    }
    
    fn calculate_content_importance(&self, content: &str) -> f32 {
        // Simple importance based on content characteristics
        let word_count = content.split_whitespace().count();
        let has_question = content.contains('?');
        let has_code = content.contains("```") || content.contains("`");
        let has_url = content.contains("http");
        
        let mut importance: f32 = 0.5;  // Base importance
        
        if word_count > 10 { importance += 0.2; }
        if has_question { importance += 0.1; }
        if has_code { importance += 0.1; }
        if has_url { importance += 0.1; }
        
        importance.min(1.0)
    }
    
    fn extract_topics(&self, content: &str) -> Vec<String> {
        let mut topics = Vec::new();
        let content_lower = content.to_lowercase();
        
        // Simple topic extraction
        if content_lower.contains("programming") || content_lower.contains("code") {
            topics.push("programming".to_string());
        }
        if content_lower.contains("database") || content_lower.contains("sql") {
            topics.push("database".to_string());
        }
        if content_lower.contains("api") || content_lower.contains("endpoint") {
            topics.push("api".to_string());
        }
        if content_lower.contains("error") || content_lower.contains("bug") {
            topics.push("debugging".to_string());
        }
        if content_lower.contains("test") || content_lower.contains("testing") {
            topics.push("testing".to_string());
        }
        if content_lower.contains("rust") {
            topics.push("rust".to_string());
        }
        if content_lower.contains("go") {
            topics.push("go".to_string());
        }
        if content_lower.contains("docker") {
            topics.push("docker".to_string());
        }
        
        topics
    }
    
    /// Get current adaptive threshold
    pub fn get_current_threshold(&self) -> f32 {
        self.current_threshold
    }
    
    /// Get session pattern for a specific session
    pub fn get_session_pattern(&self, session_id: &str) -> Option<&SessionPattern> {
        self.session_patterns.get(session_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    fn create_test_messages() -> Vec<Message> {
        vec![
            Message {
                role: MessageRole::User,
                content: "I need help with Rust programming".to_string(),
                name: None,
            },
            Message {
                role: MessageRole::Assistant,
                content: "I'd be happy to help with Rust!".to_string(),
                name: None,
            },
            Message {
                role: MessageRole::User,
                content: "How do I handle errors in Rust?".to_string(),
                name: None,
            },
        ]
    }
    
    #[test]
    fn test_context_quality_calculation() {
        let detector = ContextDegradationDetector::new();
        let messages = create_test_messages();
        
        let quality = detector.calculate_context_quality(&messages, 100, 1000);
        
        assert!(quality.overall_quality > 0.0);
        assert!(quality.overall_quality <= 1.0);
        assert!(quality.coherence_score > 0.0);
    }
    
    #[test]
    fn test_degradation_analysis() {
        let mut detector = ContextDegradationDetector::new();
        let messages = create_test_messages();
        
        let analysis = detector.analyze_context_degradation(&messages, "test_session", 100, 1000);
        
        assert!(analysis.quality_score > 0.0);
        assert!(analysis.adaptive_threshold > 0.0);
    }
    
    #[test]
    fn test_topic_extraction() {
        let detector = ContextDegradationDetector::new();
        let topics = detector.extract_topics("I need help with Rust programming and database queries");
        
        assert!(topics.contains(&"programming".to_string()));
        assert!(topics.contains(&"rust".to_string()));
        assert!(topics.contains(&"database".to_string()));
    }
}
