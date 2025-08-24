//! Entity extraction and recognition for GraphRAG

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{info, instrument, warn};
use uuid::Uuid;

/// Types of entities that can be extracted
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum EntityType {
    Person,
    Organization,
    Location,
    Event,
    Concept,
    Technology,
    Product,
    Document,
    Custom(String),
}

impl EntityType {
    pub fn as_str(&self) -> &str {
        match self {
            EntityType::Person => "PERSON",
            EntityType::Organization => "ORGANIZATION", 
            EntityType::Location => "LOCATION",
            EntityType::Event => "EVENT",
            EntityType::Concept => "CONCEPT",
            EntityType::Technology => "TECHNOLOGY",
            EntityType::Product => "PRODUCT",
            EntityType::Document => "DOCUMENT",
            EntityType::Custom(s) => s,
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s.to_uppercase().as_str() {
            "PERSON" | "PER" => EntityType::Person,
            "ORGANIZATION" | "ORG" => EntityType::Organization,
            "LOCATION" | "LOC" => EntityType::Location,
            "EVENT" => EntityType::Event,
            "CONCEPT" => EntityType::Concept,
            "TECHNOLOGY" | "TECH" => EntityType::Technology,
            "PRODUCT" => EntityType::Product,
            "DOCUMENT" | "DOC" => EntityType::Document,
            _ => EntityType::Custom(s.to_string()),
        }
    }
}

/// Represents an entity extracted from text
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entity {
    pub id: Uuid,
    pub name: String,
    pub entity_type: EntityType,
    pub description: Option<String>,
    pub aliases: Vec<String>,
    pub confidence: f64,
    pub source_spans: Vec<TextSpan>,
    pub properties: HashMap<String, String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Represents a span of text in the source document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextSpan {
    pub start: usize,
    pub end: usize,
    pub text: String,
}

/// Entity extraction engine
pub struct EntityExtractor {
    model_name: String,
    // In a real implementation, this would contain the loaded model
    _model_handle: Option<()>,
}

impl EntityExtractor {
    /// Create a new entity extractor with the specified model
    #[instrument(skip(model_name))]
    pub async fn new(model_name: &str) -> Result<Self> {
        info!("Initializing entity extractor with model: {}", model_name);

        // In production, this would load the actual NER model
        // For now, we'll simulate model loading
        let _model_handle = Some(());

        Ok(Self {
            model_name: model_name.to_string(),
            _model_handle,
        })
    }

    /// Extract entities from the given text
    #[instrument(skip(self, text), fields(text_length = text.len()))]
    pub async fn extract(&self, text: &str) -> Result<Vec<Entity>> {
        info!("Extracting entities from text");

        // For demonstration, we'll use a simple rule-based approach
        // In production, this would use a proper NER model like spaCy, Transformers, etc.
        let entities = self.extract_with_rules(text).await?;

        info!("Extracted {} entities", entities.len());
        Ok(entities)
    }

    /// Rule-based entity extraction (demonstration implementation)
    async fn extract_with_rules(&self, text: &str) -> Result<Vec<Entity>> {
        let mut entities = Vec::new();

        // Simple patterns for demonstration
        let patterns = vec![
            // Person names (capitalized words)
            (r"\b[A-Z][a-z]+ [A-Z][a-z]+\b", EntityType::Person),
            // Organizations (words with "Inc", "Corp", "LLC", etc.)
            (r"\b[A-Z][A-Za-z\s]+ (?:Inc|Corp|LLC|Ltd|Company)\b", EntityType::Organization),
            // Technologies (common tech terms)
            (r"\b(?:AI|API|REST|GraphQL|PostgreSQL|Redis|Neo4j|Docker|Kubernetes|Rust|Go|TypeScript|Python|JavaScript)\b", EntityType::Technology),
            // Locations (words with "City", "State", etc.)
            (r"\b[A-Z][a-z]+ (?:City|State|Country|Avenue|Street|Road)\b", EntityType::Location),
            // Products (capitalized brands/products)
            (r"\b[A-Z][A-Za-z]+ [A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+)*\b", EntityType::Product),
        ];

        for (pattern, entity_type) in patterns {
            let regex = regex::Regex::new(pattern)?;
            
            for mat in regex.find_iter(text) {
                let entity_text = mat.as_str().to_string();
                let start = mat.start();
                let end = mat.end();

                // Check if we already have this entity
                if entities.iter().any(|e: &Entity| e.name == entity_text) {
                    continue;
                }

                let entity = Entity {
                    id: Uuid::new_v4(),
                    name: entity_text.clone(),
                    entity_type: entity_type.clone(),
                    description: None,
                    aliases: Vec::new(),
                    confidence: 0.8, // Rule-based confidence
                    source_spans: vec![TextSpan {
                        start,
                        end,
                        text: entity_text,
                    }],
                    properties: HashMap::new(),
                    created_at: chrono::Utc::now(),
                };

                entities.push(entity);
            }
        }

        // Additional processing: merge similar entities, resolve aliases, etc.
        self.post_process_entities(&mut entities).await?;

        Ok(entities)
    }

    /// Post-process extracted entities to improve quality
    async fn post_process_entities(&self, entities: &mut Vec<Entity>) -> Result<()> {
        // Deduplicate similar entities
        let mut to_remove = Vec::new();
        
        for i in 0..entities.len() {
            for j in (i + 1)..entities.len() {
                if self.are_similar_entities(&entities[i], &entities[j]) {
                    // Merge entities
                    let mut merged = entities[i].clone();
                    merged.aliases.push(entities[j].name.clone());
                    merged.source_spans.extend(entities[j].source_spans.clone());
                    merged.confidence = (merged.confidence + entities[j].confidence) / 2.0;
                    
                    entities[i] = merged;
                    to_remove.push(j);
                }
            }
        }

        // Remove duplicates (in reverse order to maintain indices)
        to_remove.sort_unstable();
        to_remove.reverse();
        for idx in to_remove {
            entities.remove(idx);
        }

        // Enhance entities with additional properties
        for entity in entities.iter_mut() {
            self.enhance_entity(entity).await?;
        }

        Ok(())
    }

    /// Check if two entities are similar enough to be merged
    fn are_similar_entities(&self, e1: &Entity, e2: &Entity) -> bool {
        // Same entity type and similar names
        e1.entity_type == e2.entity_type && 
        (e1.name.to_lowercase() == e2.name.to_lowercase() ||
         self.string_similarity(&e1.name, &e2.name) > 0.8)
    }

    /// Calculate string similarity using Levenshtein distance
    fn string_similarity(&self, s1: &str, s2: &str) -> f64 {
        let len1 = s1.chars().count();
        let len2 = s2.chars().count();
        
        if len1 == 0 && len2 == 0 {
            return 1.0;
        }
        
        let max_len = len1.max(len2);
        let distance = self.levenshtein_distance(s1, s2);
        
        1.0 - (distance as f64 / max_len as f64)
    }

    /// Calculate Levenshtein distance between two strings
    fn levenshtein_distance(&self, s1: &str, s2: &str) -> usize {
        let chars1: Vec<char> = s1.chars().collect();
        let chars2: Vec<char> = s2.chars().collect();
        
        let len1 = chars1.len();
        let len2 = chars2.len();
        
        if len1 == 0 {
            return len2;
        }
        if len2 == 0 {
            return len1;
        }
        
        let mut matrix = vec![vec![0; len2 + 1]; len1 + 1];
        
        for i in 0..=len1 {
            matrix[i][0] = i;
        }
        for j in 0..=len2 {
            matrix[0][j] = j;
        }
        
        for i in 1..=len1 {
            for j in 1..=len2 {
                let cost = if chars1[i - 1] == chars2[j - 1] { 0 } else { 1 };
                matrix[i][j] = (matrix[i - 1][j] + 1)
                    .min(matrix[i][j - 1] + 1)
                    .min(matrix[i - 1][j - 1] + cost);
            }
        }
        
        matrix[len1][len2]
    }

    /// Enhance entity with additional properties and context
    async fn enhance_entity(&self, entity: &mut Entity) -> Result<()> {
        // Add type-specific properties
        match entity.entity_type {
            EntityType::Person => {
                // Could add properties like "title", "profession", etc.
                if entity.name.contains("Dr.") || entity.name.contains("PhD") {
                    entity.properties.insert("title".to_string(), "Doctor".to_string());
                }
                if entity.name.contains("CEO") || entity.name.contains("CTO") {
                    entity.properties.insert("role".to_string(), "Executive".to_string());
                }
            }
            EntityType::Organization => {
                // Could add properties like "industry", "size", etc.
                entity.properties.insert("category".to_string(), "company".to_string());
            }
            EntityType::Technology => {
                // Add technology category
                if entity.name.contains("AI") || entity.name.contains("ML") {
                    entity.properties.insert("category".to_string(), "artificial_intelligence".to_string());
                } else if entity.name.contains("database") || entity.name.contains("PostgreSQL") || entity.name.contains("Redis") {
                    entity.properties.insert("category".to_string(), "database".to_string());
                } else if entity.name.contains("language") || entity.name.contains("Rust") || entity.name.contains("Go") {
                    entity.properties.insert("category".to_string(), "programming_language".to_string());
                }
            }
            _ => {}
        }

        // Add confidence boost for well-formed entities
        if entity.name.len() > 3 && entity.name.chars().any(|c| c.is_uppercase()) {
            entity.confidence = (entity.confidence * 1.1).min(1.0);
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_entity_extraction() {
        let extractor = EntityExtractor::new("test-model").await.unwrap();
        
        let text = "John Doe works at Microsoft Corp and uses Rust programming language to build AI systems.";
        let entities = extractor.extract(text).await.unwrap();
        
        assert!(!entities.is_empty());
        
        // Check that we extracted expected entity types
        let types: Vec<_> = entities.iter().map(|e| &e.entity_type).collect();
        assert!(types.iter().any(|t| matches!(t, EntityType::Person)));
        assert!(types.iter().any(|t| matches!(t, EntityType::Technology)));
    }

    #[tokio::test]
    async fn test_entity_similarity() {
        let extractor = EntityExtractor::new("test-model").await.unwrap();
        
        let similarity = extractor.string_similarity("Microsoft", "Microsoft Corp");
        assert!(similarity > 0.5);
        
        let similarity = extractor.string_similarity("AI", "Artificial Intelligence");
        assert!(similarity < 0.5); // Different strings
    }
}