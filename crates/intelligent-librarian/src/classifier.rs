//! Intelligent document classification system

use crate::models::*;
use anyhow::Result;
use async_trait::async_trait;
use std::collections::HashMap;
use tracing::{info, debug};

/// Document classification engine
pub struct DocumentClassifier {
    classification_rules: Vec<ClassificationRule>,
    ml_models: HashMap<String, Box<dyn ClassificationModel>>,
    cache: HashMap<String, ClassificationResult>,
}

/// Classification rule
#[derive(Debug, Clone)]
pub struct ClassificationRule {
    pub name: String,
    pub pattern: String,
    pub content_type: ContentType,
    pub category: DocumentCategory,
    pub confidence_threshold: f64,
    pub conditions: Vec<ClassificationCondition>,
}

/// Classification condition
#[derive(Debug, Clone)]
pub enum ClassificationCondition {
    FileExtension(String),
    MimeType(String),
    ContentContains(String),
    ContentRegex(String),
    MetadataField(String, String),
    SizeRange(u64, u64),
    AuthorPattern(String),
}

/// Classification result
#[derive(Debug, Clone)]
pub struct ClassificationResult {
    pub content_type: ContentType,
    pub category: DocumentCategory,
    pub confidence: f64,
    pub applied_rules: Vec<String>,
    pub reasoning: String,
}

/// Trait for ML-based classification models
#[async_trait]
pub trait ClassificationModel: Send + Sync {
    async fn classify(&self, content: &str, metadata: &DocumentMetadata) -> Result<ClassificationResult>;
    async fn train(&mut self, training_data: &[TrainingExample]) -> Result<()>;
    async fn get_accuracy(&self) -> Result<f64>;
}

/// Training example for classification models
#[derive(Debug, Clone)]
pub struct TrainingExample {
    pub content: String,
    pub metadata: DocumentMetadata,
    pub true_content_type: ContentType,
    pub true_category: DocumentCategory,
}

impl DocumentClassifier {
    pub async fn new() -> Result<Self> {
        let mut classifier = Self {
            classification_rules: Vec::new(),
            ml_models: HashMap::new(),
            cache: HashMap::new(),
        };

        classifier.initialize_default_rules().await?;
        classifier.initialize_ml_models().await?;

        Ok(classifier)
    }

    /// Classify a document using rules and ML models
    pub async fn classify(&self, document: &Document, analysis: &ContentAnalysis) -> Result<ClassificationResult> {
        let cache_key = format!("{}:{}", document.id, document.metadata.modified_at.timestamp());

        if let Some(cached) = self.cache.get(&cache_key) {
            debug!("Using cached classification for document {}", document.id);
            return Ok(cached.clone());
        }

        // Try rule-based classification first
        let rule_result = self.classify_with_rules(document, analysis).await?;

        // If rule-based classification has high confidence, use it
        if rule_result.confidence > 0.8 {
            info!("High confidence rule-based classification for document {}", document.id);
            return Ok(rule_result);
        }

        // Otherwise, use ML models for classification
        let ml_result = self.classify_with_ml(document, analysis).await?;

        // Combine results if both are available
        let final_result = if rule_result.confidence > 0.5 && ml_result.confidence > 0.5 {
            self.combine_classification_results(&rule_result, &ml_result)
        } else if rule_result.confidence > ml_result.confidence {
            rule_result
        } else {
            ml_result
        };

        info!("Classified document {} as {:?} with confidence {:.2}",
              document.id, final_result.content_type, final_result.confidence);

        Ok(final_result)
    }

    /// Classify using predefined rules
    async fn classify_with_rules(&self, document: &Document, analysis: &ContentAnalysis) -> Result<ClassificationResult> {
        let mut best_match: Option<ClassificationResult> = None;
        let mut applied_rules = Vec::new();

        for rule in &self.classification_rules {
            if let Some(result) = self.apply_rule(rule, document, analysis).await? {
                applied_rules.push(rule.name.clone());

                if best_match.is_none() || result.confidence > best_match.as_ref().unwrap().confidence {
                    best_match = Some(result);
                }
            }
        }

        match best_match {
            Some(mut result) => {
                result.applied_rules = applied_rules;
                Ok(result)
            }
            None => {
                // Default classification
                Ok(ClassificationResult {
                    content_type: ContentType::Text,
                    category: DocumentCategory::Other,
                    confidence: 0.3,
                    applied_rules: vec!["default".to_string()],
                    reasoning: "No specific rules matched, using default classification".to_string(),
                })
            }
        }
    }

    /// Apply a specific classification rule
    async fn apply_rule(&self, rule: &ClassificationRule, document: &Document, _analysis: &ContentAnalysis) -> Result<Option<ClassificationResult>> {
        let mut matches = 0;
        let total_conditions = rule.conditions.len();
        let mut reasoning = Vec::new();

        for condition in &rule.conditions {
            let matches_condition = match condition {
                ClassificationCondition::FileExtension(ext) => {
                    document.metadata.mime_type.as_ref()
                        .map(|mime| mime.contains(ext))
                        .unwrap_or(false)
                }
                ClassificationCondition::MimeType(mime) => {
                    document.metadata.mime_type.as_ref()
                        .map(|m| m == mime)
                        .unwrap_or(false)
                }
                ClassificationCondition::ContentContains(text) => {
                    document.content.to_lowercase().contains(&text.to_lowercase())
                }
                ClassificationCondition::ContentRegex(pattern) => {
                    regex::Regex::new(pattern)?.is_match(&document.content)
                }
                ClassificationCondition::MetadataField(field, value) => {
                    match field.as_str() {
                        "title" => document.metadata.title.to_lowercase().contains(&value.to_lowercase()),
                        "author" => document.metadata.authors.iter().any(|a| a.to_lowercase().contains(&value.to_lowercase())),
                        _ => false,
                    }
                }
                ClassificationCondition::SizeRange(min, max) => {
                    document.metadata.file_size.map(|size| size >= *min && size <= *max).unwrap_or(false)
                }
                ClassificationCondition::AuthorPattern(pattern) => {
                    document.metadata.authors.iter().any(|author| {
                        regex::Regex::new(pattern).ok()
                            .map(|re| re.is_match(author))
                            .unwrap_or(false)
                    })
                }
            };

            if matches_condition {
                matches += 1;
                reasoning.push(format!("Matched condition: {:?}", condition));
            }
        }

        let confidence = if total_conditions > 0 {
            (matches as f64) / (total_conditions as f64)
        } else {
            0.0
        };

        if confidence >= rule.confidence_threshold {
            Ok(Some(ClassificationResult {
                content_type: rule.content_type.clone(),
                category: rule.category.clone(),
                confidence,
                applied_rules: vec![rule.name.clone()],
                reasoning: reasoning.join("; "),
            }))
        } else {
            Ok(None)
        }
    }

    /// Classify using ML models
    async fn classify_with_ml(&self, document: &Document, analysis: &ContentAnalysis) -> Result<ClassificationResult> {
        // Use the most appropriate ML model based on content type
        let model_key = self.select_model_for_content(&document.content, analysis);

        if let Some(model) = self.ml_models.get(&model_key) {
            model.classify(&document.content, &document.metadata).await
        } else {
            // Fallback to default classification
            Ok(ClassificationResult {
                content_type: ContentType::Text,
                category: DocumentCategory::Other,
                confidence: 0.4,
                applied_rules: vec!["ml_fallback".to_string()],
                reasoning: "No suitable ML model available, using fallback classification".to_string(),
            })
        }
    }

    /// Select the most appropriate ML model for the content
    fn select_model_for_content(&self, _content: &str, analysis: &ContentAnalysis) -> String {
        // Simple heuristic to select model
        if analysis.code_languages.len() > 0 {
            "code_classifier".to_string()
        } else if analysis.content_type == ContentType::Image {
            "image_classifier".to_string()
        } else if analysis.technical_level == TechnicalLevel::Expert {
            "technical_classifier".to_string()
        } else {
            "general_classifier".to_string()
        }
    }

    /// Combine multiple classification results
    fn combine_classification_results(&self, rule_result: &ClassificationResult, ml_result: &ClassificationResult) -> ClassificationResult {
        // Weighted combination based on confidence
        let rule_weight = rule_result.confidence;
        let ml_weight = ml_result.confidence;
        let total_weight = rule_weight + ml_weight;

        let combined_confidence = (rule_weight * rule_result.confidence + ml_weight * ml_result.confidence) / total_weight;

        // Choose the result with higher confidence for type/category
        let (content_type, category) = if rule_result.confidence > ml_result.confidence {
            (rule_result.content_type.clone(), rule_result.category.clone())
        } else {
            (ml_result.content_type.clone(), ml_result.category.clone())
        };

        ClassificationResult {
            content_type,
            category,
            confidence: combined_confidence,
            applied_rules: {
                let mut rules = rule_result.applied_rules.clone();
                rules.extend(ml_result.applied_rules.clone());
                rules
            },
            reasoning: format!("Combined rule-based ({:.2}) and ML ({:.2}) classification",
                              rule_result.confidence, ml_result.confidence),
        }
    }

    /// Initialize default classification rules
    async fn initialize_default_rules(&mut self) -> Result<()> {
        self.classification_rules.extend(vec![
            // Code files
            ClassificationRule {
                name: "rust_code".to_string(),
                pattern: "rust".to_string(),
                content_type: ContentType::Code,
                category: DocumentCategory::Code,
                confidence_threshold: 0.7,
                conditions: vec![
                    ClassificationCondition::FileExtension("rs".to_string()),
                    ClassificationCondition::ContentContains("fn ".to_string()),
                ],
            },
            ClassificationRule {
                name: "python_code".to_string(),
                pattern: "python".to_string(),
                content_type: ContentType::Code,
                category: DocumentCategory::Code,
                confidence_threshold: 0.7,
                conditions: vec![
                    ClassificationCondition::FileExtension("py".to_string()),
                    ClassificationCondition::ContentContains("def ".to_string()),
                ],
            },
            ClassificationRule {
                name: "javascript_code".to_string(),
                pattern: "javascript".to_string(),
                content_type: ContentType::Code,
                category: DocumentCategory::Code,
                confidence_threshold: 0.7,
                conditions: vec![
                    ClassificationCondition::FileExtension("js".to_string()),
                    ClassificationCondition::ContentContains("function ".to_string()),
                ],
            },
            // Documentation
            ClassificationRule {
                name: "markdown_docs".to_string(),
                pattern: "markdown".to_string(),
                content_type: ContentType::Markdown,
                category: DocumentCategory::Documentation,
                confidence_threshold: 0.8,
                conditions: vec![
                    ClassificationCondition::FileExtension("md".to_string()),
                    ClassificationCondition::ContentContains("# ".to_string()),
                ],
            },
            // Configuration files
            ClassificationRule {
                name: "config_files".to_string(),
                pattern: "config".to_string(),
                content_type: ContentType::Configuration,
                category: DocumentCategory::Configuration,
                confidence_threshold: 0.8,
                conditions: vec![
                    ClassificationCondition::FileExtension("toml".to_string()),
                    ClassificationCondition::FileExtension("yaml".to_string()),
                    ClassificationCondition::FileExtension("json".to_string()),
                ],
            },
            // Research documents
            ClassificationRule {
                name: "research_papers".to_string(),
                pattern: "research".to_string(),
                content_type: ContentType::Research,
                category: DocumentCategory::Research,
                confidence_threshold: 0.6,
                conditions: vec![
                    ClassificationCondition::ContentContains("abstract".to_string()),
                    ClassificationCondition::ContentContains("references".to_string()),
                ],
            },
        ]);

        info!("Initialized {} classification rules", self.classification_rules.len());
        Ok(())
    }

    /// Initialize ML models for classification
    async fn initialize_ml_models(&mut self) -> Result<()> {
        // Placeholder for ML model initialization
        // In a real implementation, this would load pre-trained models
        info!("ML models initialization placeholder - would load actual models in production");
        Ok(())
    }
}
