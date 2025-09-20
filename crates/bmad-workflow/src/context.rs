//! BMAD Context Management - Context preservation and engineering
//! 
//! This module provides context preservation, context engineering, and
//! intelligent context management for BMAD workflows.

use crate::{ProjectArtifact, UserInput};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// Context preservation system
#[derive(Debug)]
pub struct ContextPreservation {
    pub context_store: ContextStore,
    pub context_engine: ContextEngineer,
    pub context_cache: ContextCache,
    pub preservation_strategy: PreservationStrategy,
}

/// Context store for persisting context
#[derive(Debug)]
pub struct ContextStore {
    pub contexts: std::collections::HashMap<Uuid, ContextArtifact>,
    pub context_relationships: std::collections::HashMap<Uuid, Vec<Uuid>>,
    pub context_index: ContextIndex,
}

/// Context engineer for intelligent context management
#[derive(Debug)]
pub struct ContextEngineer {
    pub context_analyzer: ContextAnalyzer,
    pub context_optimizer: ContextOptimizer,
    pub context_synthesizer: ContextSynthesizer,
}

/// Context cache for efficient retrieval
#[derive(Debug)]
pub struct ContextCache {
    pub cache: std::collections::HashMap<String, CachedContext>,
    pub cache_stats: CacheStats,
    pub cache_policy: CachePolicy,
}

/// Context artifact
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextArtifact {
    pub id: Uuid,
    pub name: String,
    pub content: String,
    pub context_type: ContextType,
    pub metadata: ContextMetadata,
    pub relationships: Vec<ContextRelationship>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub access_count: u32,
    pub relevance_score: f32,
}

/// Types of context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ContextType {
    ProjectOverview,
    TechnicalSpecification,
    UserRequirements,
    DesignDecision,
    ImplementationDetail,
    TestingContext,
    DeploymentContext,
    DocumentationContext,
    ErrorContext,
    LearningContext,
}

/// Context metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextMetadata {
    pub source: String,
    pub confidence_score: f32,
    pub importance_score: f32,
    pub complexity_score: f32,
    pub tags: Vec<String>,
    pub version: u32,
    pub dependencies: Vec<Uuid>,
}

/// Context relationship
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextRelationship {
    pub target_id: Uuid,
    pub relationship_type: RelationshipType,
    pub strength: f32,
    pub description: String,
}

/// Types of context relationships
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RelationshipType {
    DependsOn,
    Implements,
    Extends,
    ConflictsWith,
    RelatedTo,
    Supersedes,
    PartOf,
}

/// Context index for efficient search
#[derive(Debug)]
pub struct ContextIndex {
    pub keyword_index: std::collections::HashMap<String, Vec<Uuid>>,
    pub type_index: std::collections::HashMap<ContextType, Vec<Uuid>>,
    pub relevance_index: std::collections::HashMap<f32, Vec<Uuid>>,
}

/// Cached context
#[derive(Debug, Clone)]
pub struct CachedContext {
    pub context: ContextArtifact,
    pub cached_at: DateTime<Utc>,
    pub access_count: u32,
    pub last_accessed: DateTime<Utc>,
}

/// Cache statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheStats {
    pub hit_count: u32,
    pub miss_count: u32,
    pub total_requests: u32,
    pub hit_rate: f32,
    pub cache_size: usize,
}

/// Cache policy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CachePolicy {
    LRU,        // Least Recently Used
    LFU,        // Least Frequently Used
    TTL,        // Time To Live
    SizeBased,  // Based on cache size
}

/// Preservation strategies
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PreservationStrategy {
    FullPreservation,    // Preserve all context
    SelectivePreservation, // Preserve only important context
    CompressedPreservation, // Compress context before preservation
    HierarchicalPreservation, // Preserve in hierarchical structure
}

/// Context analyzer
#[derive(Debug)]
pub struct ContextAnalyzer {
    pub analysis_rules: Vec<AnalysisRule>,
    pub quality_metrics: QualityMetrics,
}

/// Analysis rule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisRule {
    pub name: String,
    pub condition: String,
    pub action: AnalysisAction,
    pub priority: u32,
}

/// Analysis actions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AnalysisAction {
    Preserve,
    Compress,
    Archive,
    Delete,
    Flag,
}

/// Quality metrics for context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityMetrics {
    pub completeness_score: f32,
    pub accuracy_score: f32,
    pub relevance_score: f32,
    pub consistency_score: f32,
    pub freshness_score: f32,
}

/// Context optimizer
#[derive(Debug)]
pub struct ContextOptimizer {
    pub optimization_rules: Vec<OptimizationRule>,
    pub optimization_strategies: Vec<OptimizationStrategy>,
}

/// Optimization rule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationRule {
    pub name: String,
    pub condition: String,
    pub optimization: OptimizationType,
    pub expected_improvement: f32,
}

/// Types of optimizations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OptimizationType {
    Compression,
    Deduplication,
    Summarization,
    Indexing,
    Caching,
    Archiving,
}

/// Optimization strategy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationStrategy {
    pub name: String,
    pub description: String,
    pub applicable_types: Vec<ContextType>,
    pub performance_impact: PerformanceImpact,
}

/// Performance impact levels
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PerformanceImpact {
    Low,
    Medium,
    High,
}

/// Context synthesizer
#[derive(Debug)]
pub struct ContextSynthesizer {
    pub synthesis_rules: Vec<SynthesisRule>,
    pub synthesis_strategies: Vec<SynthesisStrategy>,
}

/// Synthesis rule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SynthesisRule {
    pub name: String,
    pub input_types: Vec<ContextType>,
    pub output_type: ContextType,
    pub synthesis_method: SynthesisMethod,
}

/// Synthesis methods
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SynthesisMethod {
    Concatenation,
    Summarization,
    Abstraction,
    Integration,
    Transformation,
}

/// Synthesis strategy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SynthesisStrategy {
    pub name: String,
    pub description: String,
    pub applicable_scenarios: Vec<String>,
    pub quality_threshold: f32,
}

impl ContextPreservation {
    /// Create a new context preservation system
    pub fn new(strategy: PreservationStrategy) -> Self {
        Self {
            context_store: ContextStore::new(),
            context_engine: ContextEngineer::new(),
            context_cache: ContextCache::new(),
            preservation_strategy: strategy,
        }
    }
    
    /// Preserve context from artifacts
    pub async fn preserve_context(&mut self, artifacts: &[ProjectArtifact], user_input: &UserInput) -> Result<Vec<ContextArtifact>, Box<dyn std::error::Error>> {
        let mut context_artifacts = Vec::new();
        
        for artifact in artifacts {
            let context_artifact = self.create_context_artifact(artifact, user_input).await?;
            self.context_store.add_context(context_artifact.clone());
            context_artifacts.push(context_artifact);
        }
        
        // Create project overview context
        let project_context = self.create_project_context(user_input).await?;
        self.context_store.add_context(project_context.clone());
        context_artifacts.push(project_context);
        
        // Analyze and optimize contexts
        self.context_engine.analyze_contexts(&mut context_artifacts).await?;
        self.context_engine.optimize_contexts(&mut context_artifacts).await?;
        
        Ok(context_artifacts)
    }
    
    /// Create context artifact from project artifact
    async fn create_context_artifact(&self, artifact: &ProjectArtifact, user_input: &UserInput) -> Result<ContextArtifact, Box<dyn std::error::Error>> {
        let context_type = self.map_artifact_to_context_type(&artifact.artifact_type);
        let metadata = ContextMetadata {
            source: format!("artifact:{}", artifact.id),
            confidence_score: artifact.metadata.quality_score,
            importance_score: artifact.metadata.completeness_score,
            complexity_score: artifact.metadata.complexity_score,
            tags: artifact.metadata.tags.clone(),
            version: artifact.version,
            dependencies: artifact.dependencies.clone(),
        };
        
        Ok(ContextArtifact {
            id: Uuid::new_v4(),
            name: artifact.title.clone(),
            content: artifact.content.clone(),
            context_type,
            metadata,
            relationships: vec![],
            created_at: Utc::now(),
            updated_at: Utc::now(),
            access_count: 0,
            relevance_score: 0.8,
        })
    }
    
    /// Create project context from user input
    async fn create_project_context(&self, user_input: &UserInput) -> Result<ContextArtifact, Box<dyn std::error::Error>> {
        let content = format!(
            "Project: {}\nDescription: {}\nTarget Users: {}\nKey Features: {}\nConstraints: {}\nSuccess Metrics: {}\nTechnical Preferences: {}",
            user_input.project_name,
            user_input.project_description,
            user_input.target_users.join(", "),
            user_input.key_features.join(", "),
            user_input.constraints.join(", "),
            user_input.success_metrics.join(", "),
            user_input.technical_preferences.join(", ")
        );
        
        let metadata = ContextMetadata {
            source: "user_input".to_string(),
            confidence_score: 1.0,
            importance_score: 1.0,
            complexity_score: 0.5,
            tags: vec!["project".to_string(), "overview".to_string()],
            version: 1,
            dependencies: vec![],
        };
        
        Ok(ContextArtifact {
            id: Uuid::new_v4(),
            name: format!("Project Context: {}", user_input.project_name),
            content,
            context_type: ContextType::ProjectOverview,
            metadata,
            relationships: vec![],
            created_at: Utc::now(),
            updated_at: Utc::now(),
            access_count: 0,
            relevance_score: 1.0,
        })
    }
    
    /// Map artifact type to context type
    fn map_artifact_to_context_type(&self, artifact_type: &str) -> ContextType {
        match artifact_type {
            "PRD" => ContextType::UserRequirements,
            "TechnicalArchitecture" => ContextType::TechnicalSpecification,
            "UXBrief" => ContextType::DesignDecision,
            "APISpecification" => ContextType::TechnicalSpecification,
            "DatabaseSchema" => ContextType::TechnicalSpecification,
            "DeploymentPlan" => ContextType::DeploymentContext,
            "TestingStrategy" => ContextType::TestingContext,
            "SecurityPlan" => ContextType::TechnicalSpecification,
            "PerformancePlan" => ContextType::TechnicalSpecification,
            "DocumentationPlan" => ContextType::DocumentationContext,
            _ => ContextType::ImplementationDetail,
        }
    }
    
    /// Retrieve context by ID
    pub fn get_context(&mut self, context_id: Uuid) -> Option<ContextArtifact> {
        // Check cache first
        if let Some(cached) = self.context_cache.get_cached_context(context_id) {
            return Some(cached.context.clone());
        }
        
        // Get from store
        if let Some(context) = self.context_store.get_context(context_id) {
            // Update access count
            self.context_store.increment_access_count(context_id);
            
            // Cache the context
            self.context_cache.cache_context(context.clone());
            
            Some(context)
        } else {
            None
        }
    }
    
    /// Search contexts by query
    pub fn search_contexts(&self, query: &str) -> Vec<ContextArtifact> {
        let mut results = Vec::new();
        
        // Search in keyword index
        let keywords: Vec<String> = query.to_lowercase().split_whitespace().map(|s| s.to_string()).collect();
        
        for keyword in keywords {
            if let Some(context_ids) = self.context_store.context_index.keyword_index.get(&keyword) {
                for context_id in context_ids {
                    if let Some(context) = self.context_store.contexts.get(context_id) {
                        if !results.iter().any(|c| c.id == *context_id) {
                            results.push(context.clone());
                        }
                    }
                }
            }
        }
        
        // Sort by relevance score
        results.sort_by(|a, b| b.relevance_score.partial_cmp(&a.relevance_score).unwrap_or(std::cmp::Ordering::Equal));
        
        results
    }
}

impl ContextStore {
    /// Create a new context store
    pub fn new() -> Self {
        Self {
            contexts: std::collections::HashMap::new(),
            context_relationships: std::collections::HashMap::new(),
            context_index: ContextIndex {
                keyword_index: std::collections::HashMap::new(),
                type_index: std::collections::HashMap::new(),
                relevance_index: std::collections::HashMap::new(),
            },
        }
    }
    
    /// Add context to store
    pub fn add_context(&mut self, context: ContextArtifact) {
        let context_id = context.id;
        
        // Add to contexts
        self.contexts.insert(context_id, context.clone());
        
        // Update indexes
        self.update_keyword_index(&context);
        self.update_type_index(&context);
        self.update_relevance_index(&context);
    }
    
    /// Get context by ID
    pub fn get_context(&self, context_id: Uuid) -> Option<ContextArtifact> {
        self.contexts.get(&context_id).cloned()
    }
    
    /// Increment access count
    pub fn increment_access_count(&mut self, context_id: Uuid) {
        if let Some(context) = self.contexts.get_mut(&context_id) {
            context.access_count += 1;
            context.updated_at = Utc::now();
        }
    }
    
    /// Update keyword index
    fn update_keyword_index(&mut self, context: &ContextArtifact) {
        let keywords: Vec<String> = context.content
            .to_lowercase()
            .split_whitespace()
            .map(|s| s.to_string())
            .collect();
        
        for keyword in keywords {
            self.context_index.keyword_index
                .entry(keyword)
                .or_insert_with(Vec::new)
                .push(context.id);
        }
    }
    
    /// Update type index
    fn update_type_index(&mut self, context: &ContextArtifact) {
        self.context_index.type_index
            .entry(context.context_type.clone())
            .or_insert_with(Vec::new)
            .push(context.id);
    }
    
    /// Update relevance index
    fn update_relevance_index(&mut self, context: &ContextArtifact) {
        let relevance_key = (context.relevance_score * 10.0).round() / 10.0;
        self.context_index.relevance_index
            .entry(relevance_key)
            .or_insert_with(Vec::new)
            .push(context.id);
    }
}

impl ContextEngineer {
    /// Create a new context engineer
    pub fn new() -> Self {
        Self {
            context_analyzer: ContextAnalyzer::new(),
            context_optimizer: ContextOptimizer::new(),
            context_synthesizer: ContextSynthesizer::new(),
        }
    }
    
    /// Analyze contexts
    pub async fn analyze_contexts(&self, contexts: &mut [ContextArtifact]) -> Result<(), Box<dyn std::error::Error>> {
        for context in contexts.iter_mut() {
            let quality_metrics = self.context_analyzer.analyze_context(context).await?;
            
            // Update context based on analysis
            context.metadata.confidence_score = quality_metrics.accuracy_score;
            context.metadata.importance_score = quality_metrics.relevance_score;
            context.relevance_score = quality_metrics.relevance_score;
        }
        
        Ok(())
    }
    
    /// Optimize contexts
    pub async fn optimize_contexts(&self, contexts: &mut [ContextArtifact]) -> Result<(), Box<dyn std::error::Error>> {
        for context in contexts.iter_mut() {
            self.context_optimizer.optimize_context(context).await?;
        }
        
        Ok(())
    }
}

impl ContextAnalyzer {
    /// Create a new context analyzer
    pub fn new() -> Self {
        Self {
            analysis_rules: vec![
                AnalysisRule {
                    name: "Completeness Check".to_string(),
                    condition: "content_length < 100".to_string(),
                    action: AnalysisAction::Flag,
                    priority: 1,
                },
                AnalysisRule {
                    name: "Quality Check".to_string(),
                    condition: "confidence_score < 0.5".to_string(),
                    action: AnalysisAction::Flag,
                    priority: 2,
                },
            ],
            quality_metrics: QualityMetrics {
                completeness_score: 0.0,
                accuracy_score: 0.0,
                relevance_score: 0.0,
                consistency_score: 0.0,
                freshness_score: 0.0,
            },
        }
    }
    
    /// Analyze context
    pub async fn analyze_context(&self, context: &ContextArtifact) -> Result<QualityMetrics, Box<dyn std::error::Error>> {
        let completeness_score = self.assess_completeness(context);
        let accuracy_score = self.assess_accuracy(context);
        let relevance_score = self.assess_relevance(context);
        let consistency_score = self.assess_consistency(context);
        let freshness_score = self.assess_freshness(context);
        
        Ok(QualityMetrics {
            completeness_score,
            accuracy_score,
            relevance_score,
            consistency_score,
            freshness_score,
        })
    }
    
    /// Assess completeness
    fn assess_completeness(&self, context: &ContextArtifact) -> f32 {
        let word_count = context.content.split_whitespace().count() as f32;
        if word_count >= 100.0 {
            0.9
        } else if word_count >= 50.0 {
            0.7
        } else {
            0.5
        }
    }
    
    /// Assess accuracy
    fn assess_accuracy(&self, context: &ContextArtifact) -> f32 {
        context.metadata.confidence_score
    }
    
    /// Assess relevance
    fn assess_relevance(&self, context: &ContextArtifact) -> f32 {
        context.metadata.importance_score
    }
    
    /// Assess consistency
    fn assess_consistency(&self, context: &ContextArtifact) -> f32 {
        // Simple consistency check based on content structure
        let has_structure = context.content.contains('\n') || context.content.contains('.');
        if has_structure {
            0.8
        } else {
            0.6
        }
    }
    
    /// Assess freshness
    fn assess_freshness(&self, context: &ContextArtifact) -> f32 {
        let age_days = (Utc::now() - context.created_at).num_days() as f32;
        if age_days <= 1.0 {
            1.0
        } else if age_days <= 7.0 {
            0.8
        } else if age_days <= 30.0 {
            0.6
        } else {
            0.4
        }
    }
}

impl ContextOptimizer {
    /// Create a new context optimizer
    pub fn new() -> Self {
        Self {
            optimization_rules: vec![
                OptimizationRule {
                    name: "Content Compression".to_string(),
                    condition: "content_length > 1000".to_string(),
                    optimization: OptimizationType::Compression,
                    expected_improvement: 0.3,
                },
                OptimizationRule {
                    name: "Deduplication".to_string(),
                    condition: "duplicate_content_detected".to_string(),
                    optimization: OptimizationType::Deduplication,
                    expected_improvement: 0.2,
                },
            ],
            optimization_strategies: vec![
                OptimizationStrategy {
                    name: "Smart Compression".to_string(),
                    description: "Compress content while preserving key information".to_string(),
                    applicable_types: vec![ContextType::TechnicalSpecification, ContextType::DocumentationContext],
                    performance_impact: PerformanceImpact::Medium,
                },
            ],
        }
    }
    
    /// Optimize context
    pub async fn optimize_context(&self, context: &mut ContextArtifact) -> Result<(), Box<dyn std::error::Error>> {
        // Apply optimization rules
        for rule in &self.optimization_rules {
            if self.evaluate_condition(rule, context) {
                self.apply_optimization(rule, context).await?;
            }
        }
        
        Ok(())
    }
    
    /// Evaluate optimization condition
    fn evaluate_condition(&self, rule: &OptimizationRule, context: &ContextArtifact) -> bool {
        match rule.condition.as_str() {
            "content_length > 1000" => context.content.len() > 1000,
            "duplicate_content_detected" => false, // Would implement duplicate detection
            _ => false,
        }
    }
    
    /// Apply optimization
    async fn apply_optimization(&self, rule: &OptimizationRule, context: &mut ContextArtifact) -> Result<(), Box<dyn std::error::Error>> {
        match rule.optimization {
            OptimizationType::Compression => {
                // Simple compression - keep first and last parts
                if context.content.len() > 1000 {
                    let words: Vec<&str> = context.content.split_whitespace().collect();
                    let keep_words = 500;
                    if words.len() > keep_words {
                        let start = &words[..keep_words/2];
                        let end = &words[words.len() - keep_words/2..];
                        context.content = format!("{} ... [compressed] ... {}", 
                            start.join(" "), end.join(" "));
                    }
                }
            },
            OptimizationType::Deduplication => {
                // Would implement deduplication logic
            },
            _ => {}
        }
        
        Ok(())
    }
}

impl ContextSynthesizer {
    /// Create a new context synthesizer
    pub fn new() -> Self {
        Self {
            synthesis_rules: vec![
                SynthesisRule {
                    name: "Project Overview Synthesis".to_string(),
                    input_types: vec![ContextType::ProjectOverview, ContextType::UserRequirements],
                    output_type: ContextType::ProjectOverview,
                    synthesis_method: SynthesisMethod::Integration,
                },
            ],
            synthesis_strategies: vec![
                SynthesisStrategy {
                    name: "Intelligent Integration".to_string(),
                    description: "Intelligently integrate multiple contexts".to_string(),
                    applicable_scenarios: vec!["project_planning".to_string(), "development_guidance".to_string()],
                    quality_threshold: 0.8,
                },
            ],
        }
    }
}

impl ContextCache {
    /// Create a new context cache
    pub fn new() -> Self {
        Self {
            cache: std::collections::HashMap::new(),
            cache_stats: CacheStats {
                hit_count: 0,
                miss_count: 0,
                total_requests: 0,
                hit_rate: 0.0,
                cache_size: 0,
            },
            cache_policy: CachePolicy::LRU,
        }
    }
    
    /// Cache context
    pub fn cache_context(&mut self, context: ContextArtifact) {
        let key = context.id.to_string();
        let cached_context = CachedContext {
            context,
            cached_at: Utc::now(),
            access_count: 0,
            last_accessed: Utc::now(),
        };
        
        self.cache.insert(key, cached_context);
        self.update_cache_stats();
    }
    
    /// Get cached context
    pub fn get_cached_context(&mut self, context_id: Uuid) -> Option<CachedContext> {
        let key = context_id.to_string();
        
        if let Some(cached) = self.cache.get_mut(&key) {
            cached.access_count += 1;
            cached.last_accessed = Utc::now();
            self.cache_stats.hit_count += 1;
            self.update_cache_stats();
            Some(cached.clone())
        } else {
            self.cache_stats.miss_count += 1;
            self.update_cache_stats();
            None
        }
    }
    
    /// Update cache statistics
    fn update_cache_stats(&mut self) {
        self.cache_stats.total_requests = self.cache_stats.hit_count + self.cache_stats.miss_count;
        self.cache_stats.cache_size = self.cache.len();
        
        if self.cache_stats.total_requests > 0 {
            self.cache_stats.hit_rate = self.cache_stats.hit_count as f32 / self.cache_stats.total_requests as f32;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_context_preservation_creation() {
        let preservation = ContextPreservation::new(PreservationStrategy::FullPreservation);
        assert!(matches!(preservation.preservation_strategy, PreservationStrategy::FullPreservation));
    }
    
    #[test]
    fn test_context_store_creation() {
        let store = ContextStore::new();
        assert!(store.contexts.is_empty());
        assert!(store.context_index.keyword_index.is_empty());
    }
    
    #[test]
    fn test_context_artifact_creation() {
        let artifact = ContextArtifact {
            id: Uuid::new_v4(),
            name: "Test Context".to_string(),
            content: "Test content".to_string(),
            context_type: ContextType::ProjectOverview,
            metadata: ContextMetadata {
                source: "test".to_string(),
                confidence_score: 0.8,
                importance_score: 0.9,
                complexity_score: 0.5,
                tags: vec!["test".to_string()],
                version: 1,
                dependencies: vec![],
            },
            relationships: vec![],
            created_at: Utc::now(),
            updated_at: Utc::now(),
            access_count: 0,
            relevance_score: 0.8,
        };
        
        assert_eq!(artifact.name, "Test Context");
        assert!(matches!(artifact.context_type, ContextType::ProjectOverview));
    }
    
    #[tokio::test]
    async fn test_context_analysis() {
        let analyzer = ContextAnalyzer::new();
        let context = ContextArtifact {
            id: Uuid::new_v4(),
            name: "Test Context".to_string(),
            content: "This is a test context with sufficient content to analyze properly".to_string(),
            context_type: ContextType::ProjectOverview,
            metadata: ContextMetadata {
                source: "test".to_string(),
                confidence_score: 0.8,
                importance_score: 0.9,
                complexity_score: 0.5,
                tags: vec!["test".to_string()],
                version: 1,
                dependencies: vec![],
            },
            relationships: vec![],
            created_at: Utc::now(),
            updated_at: Utc::now(),
            access_count: 0,
            relevance_score: 0.8,
        };
        
        let metrics = analyzer.analyze_context(&context).await.unwrap();
        assert!(metrics.completeness_score > 0.0);
        assert!(metrics.accuracy_score > 0.0);
    }
}
