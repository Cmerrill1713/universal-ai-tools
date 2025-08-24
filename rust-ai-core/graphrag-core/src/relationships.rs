//! Relationship extraction and analysis for GraphRAG

use crate::entities::{Entity, EntityType};
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{info, instrument};
use uuid::Uuid;

/// Types of relationships between entities
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum RelationshipType {
    // General relationships
    RelatedTo,
    PartOf,
    Uses,
    Creates,
    Manages,
    WorksAt,
    LocatedIn,
    
    // Technical relationships
    DependsOn,
    Implements,
    Extends,
    Configures,
    Integrates,
    
    // Business relationships
    CompetitorOf,
    PartnerWith,
    OwnerOf,
    ReportsTo,
    
    // Temporal relationships
    Before,
    After,
    During,
    
    Custom(String),
}

impl RelationshipType {
    pub fn as_str(&self) -> &str {
        match self {
            RelationshipType::RelatedTo => "RELATED_TO",
            RelationshipType::PartOf => "PART_OF",
            RelationshipType::Uses => "USES",
            RelationshipType::Creates => "CREATES",
            RelationshipType::Manages => "MANAGES",
            RelationshipType::WorksAt => "WORKS_AT",
            RelationshipType::LocatedIn => "LOCATED_IN",
            RelationshipType::DependsOn => "DEPENDS_ON",
            RelationshipType::Implements => "IMPLEMENTS",
            RelationshipType::Extends => "EXTENDS",
            RelationshipType::Configures => "CONFIGURES",
            RelationshipType::Integrates => "INTEGRATES",
            RelationshipType::CompetitorOf => "COMPETITOR_OF",
            RelationshipType::PartnerWith => "PARTNER_WITH",
            RelationshipType::OwnerOf => "OWNER_OF",
            RelationshipType::ReportsTo => "REPORTS_TO",
            RelationshipType::Before => "BEFORE",
            RelationshipType::After => "AFTER",
            RelationshipType::During => "DURING",
            RelationshipType::Custom(s) => s,
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s.to_uppercase().as_str() {
            "RELATED_TO" => RelationshipType::RelatedTo,
            "PART_OF" => RelationshipType::PartOf,
            "USES" => RelationshipType::Uses,
            "CREATES" => RelationshipType::Creates,
            "MANAGES" => RelationshipType::Manages,
            "WORKS_AT" => RelationshipType::WorksAt,
            "LOCATED_IN" => RelationshipType::LocatedIn,
            "DEPENDS_ON" => RelationshipType::DependsOn,
            "IMPLEMENTS" => RelationshipType::Implements,
            "EXTENDS" => RelationshipType::Extends,
            "CONFIGURES" => RelationshipType::Configures,
            "INTEGRATES" => RelationshipType::Integrates,
            "COMPETITOR_OF" => RelationshipType::CompetitorOf,
            "PARTNER_WITH" => RelationshipType::PartnerWith,
            "OWNER_OF" => RelationshipType::OwnerOf,
            "REPORTS_TO" => RelationshipType::ReportsTo,
            "BEFORE" => RelationshipType::Before,
            "AFTER" => RelationshipType::After,
            "DURING" => RelationshipType::During,
            _ => RelationshipType::Custom(s.to_string()),
        }
    }

    /// Get the inverse relationship type if applicable
    pub fn inverse(&self) -> Option<Self> {
        match self {
            RelationshipType::PartOf => Some(RelationshipType::RelatedTo), // Simplified
            RelationshipType::Uses => Some(RelationshipType::RelatedTo),
            RelationshipType::Creates => Some(RelationshipType::RelatedTo),
            RelationshipType::Manages => Some(RelationshipType::ReportsTo),
            RelationshipType::ReportsTo => Some(RelationshipType::Manages),
            RelationshipType::Before => Some(RelationshipType::After),
            RelationshipType::After => Some(RelationshipType::Before),
            RelationshipType::OwnerOf => Some(RelationshipType::RelatedTo),
            _ => None,
        }
    }
}

/// Represents a relationship between two entities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Relationship {
    pub id: Uuid,
    pub source_entity_id: Uuid,
    pub target_entity_id: Uuid,
    pub relationship_type: RelationshipType,
    pub confidence: f64,
    pub description: Option<String>,
    pub properties: HashMap<String, String>,
    pub evidence: Vec<String>, // Text snippets that support this relationship
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Relationship extraction engine
pub struct RelationshipExtractor {
    model_name: String,
    // In a real implementation, this would contain the loaded model
    _model_handle: Option<()>,
}

impl RelationshipExtractor {
    /// Create a new relationship extractor
    #[instrument(skip(model_name))]
    pub async fn new(model_name: &str) -> Result<Self> {
        info!("Initializing relationship extractor with model: {}", model_name);

        // In production, this would load the actual relationship extraction model
        let _model_handle = Some(());

        Ok(Self {
            model_name: model_name.to_string(),
            _model_handle,
        })
    }

    /// Extract relationships from text given a set of entities
    #[instrument(skip(self, text, entities), fields(text_length = text.len(), entity_count = entities.len()))]
    pub async fn extract(&self, text: &str, entities: &[Entity]) -> Result<Vec<Relationship>> {
        info!("Extracting relationships from text");

        let relationships = self.extract_with_rules(text, entities).await?;

        info!("Extracted {} relationships", relationships.len());
        Ok(relationships)
    }

    /// Rule-based relationship extraction (demonstration implementation)
    async fn extract_with_rules(&self, text: &str, entities: &[Entity]) -> Result<Vec<Relationship>> {
        let mut relationships = Vec::new();

        // Create a map for quick entity lookup by name
        let entity_map: HashMap<String, &Entity> = entities
            .iter()
            .map(|e| (e.name.to_lowercase(), e))
            .collect();

        // Define relationship patterns
        let patterns = vec![
            // "X works at Y" pattern
            (r"(\w+(?:\s\w+)*)\s+works?\s+at\s+(\w+(?:\s\w+)*)", RelationshipType::WorksAt),
            // "X uses Y" pattern
            (r"(\w+(?:\s\w+)*)\s+uses?\s+(\w+(?:\s\w+)*)", RelationshipType::Uses),
            // "X creates Y" pattern  
            (r"(\w+(?:\s\w+)*)\s+creates?\s+(\w+(?:\s\w+)*)", RelationshipType::Creates),
            // "X manages Y" pattern
            (r"(\w+(?:\s\w+)*)\s+manages?\s+(\w+(?:\s\w+)*)", RelationshipType::Manages),
            // "X is part of Y" pattern
            (r"(\w+(?:\s\w+)*)\s+is\s+part\s+of\s+(\w+(?:\s\w+)*)", RelationshipType::PartOf),
            // "X integrates with Y" pattern
            (r"(\w+(?:\s\w+)*)\s+integrates?\s+with\s+(\w+(?:\s\w+)*)", RelationshipType::Integrates),
            // "X depends on Y" pattern
            (r"(\w+(?:\s\w+)*)\s+depends?\s+on\s+(\w+(?:\s\w+)*)", RelationshipType::DependsOn),
        ];

        for (pattern, relationship_type) in patterns {
            let regex = regex::Regex::new(pattern)?;
            
            for cap in regex.captures_iter(text) {
                if let (Some(source_match), Some(target_match)) = (cap.get(1), cap.get(2)) {
                    let source_text = source_match.as_str().trim().to_lowercase();
                    let target_text = target_match.as_str().trim().to_lowercase();

                    // Find matching entities
                    if let (Some(source_entity), Some(target_entity)) = (
                        self.find_matching_entity(&source_text, &entity_map),
                        self.find_matching_entity(&target_text, &entity_map)
                    ) {
                        // Don't create self-relationships
                        if source_entity.id == target_entity.id {
                            continue;
                        }

                        let relationship = Relationship {
                            id: Uuid::new_v4(),
                            source_entity_id: source_entity.id,
                            target_entity_id: target_entity.id,
                            relationship_type: relationship_type.clone(),
                            confidence: 0.75, // Rule-based confidence
                            description: Some(cap.get(0).unwrap().as_str().to_string()),
                            properties: HashMap::new(),
                            evidence: vec![cap.get(0).unwrap().as_str().to_string()],
                            created_at: chrono::Utc::now(),
                        };

                        relationships.push(relationship);
                    }
                }
            }
        }

        // Extract co-occurrence relationships (entities appearing close to each other)
        let cooccurrence_relationships = self.extract_cooccurrence_relationships(text, entities).await?;
        relationships.extend(cooccurrence_relationships);

        // Post-process relationships
        self.post_process_relationships(&mut relationships, entities).await?;

        Ok(relationships)
    }

    /// Find matching entity by name or alias
    fn find_matching_entity<'a>(&self, text: &str, entity_map: &HashMap<String, &'a Entity>) -> Option<&'a Entity> {
        // Direct match
        if let Some(entity) = entity_map.get(text) {
            return Some(entity);
        }

        // Check aliases and partial matches
        for (_, entity) in entity_map {
            if entity.name.to_lowercase().contains(text) || 
               text.contains(&entity.name.to_lowercase()) ||
               entity.aliases.iter().any(|alias| alias.to_lowercase() == text) {
                return Some(entity);
            }
        }

        None
    }

    /// Extract co-occurrence relationships between entities
    async fn extract_cooccurrence_relationships(&self, text: &str, entities: &[Entity]) -> Result<Vec<Relationship>> {
        let mut relationships = Vec::new();
        let window_size = 50; // Characters

        // Find entity positions in text
        let mut entity_positions = Vec::new();
        for entity in entities {
            let entity_name_lower = entity.name.to_lowercase();
            let text_lower = text.to_lowercase();
            
            let mut start = 0;
            while let Some(pos) = text_lower[start..].find(&entity_name_lower) {
                entity_positions.push((start + pos, entity));
                start += pos + entity_name_lower.len();
            }
        }

        // Sort by position
        entity_positions.sort_by_key(|(pos, _)| *pos);

        // Find co-occurring entities within window
        for i in 0..entity_positions.len() {
            for j in (i + 1)..entity_positions.len() {
                let (pos1, entity1) = entity_positions[i];
                let (pos2, entity2) = entity_positions[j];

                // Break if entities are too far apart
                if pos2 - pos1 > window_size {
                    break;
                }

                // Skip if same entity
                if entity1.id == entity2.id {
                    continue;
                }

                // Determine relationship type based on entity types
                let relationship_type = self.infer_relationship_type(&entity1.entity_type, &entity2.entity_type);

                let relationship = Relationship {
                    id: Uuid::new_v4(),
                    source_entity_id: entity1.id,
                    target_entity_id: entity2.id,
                    relationship_type,
                    confidence: 0.5, // Lower confidence for co-occurrence
                    description: Some("Co-occurrence relationship".to_string()),
                    properties: HashMap::new(),
                    evidence: vec![format!("Entities appear together in text")],
                    created_at: chrono::Utc::now(),
                };

                relationships.push(relationship);
            }
        }

        Ok(relationships)
    }

    /// Infer relationship type based on entity types
    fn infer_relationship_type(&self, source_type: &EntityType, target_type: &EntityType) -> RelationshipType {
        match (source_type, target_type) {
            (EntityType::Person, EntityType::Organization) => RelationshipType::WorksAt,
            (EntityType::Person, EntityType::Technology) => RelationshipType::Uses,
            (EntityType::Organization, EntityType::Technology) => RelationshipType::Uses,
            (EntityType::Technology, EntityType::Technology) => RelationshipType::Integrates,
            (EntityType::Product, EntityType::Technology) => RelationshipType::DependsOn,
            (EntityType::Event, EntityType::Person) => RelationshipType::RelatedTo,
            (EntityType::Event, EntityType::Organization) => RelationshipType::RelatedTo,
            _ => RelationshipType::RelatedTo,
        }
    }

    /// Post-process relationships to improve quality
    async fn post_process_relationships(&self, relationships: &mut Vec<Relationship>, _entities: &[Entity]) -> Result<()> {
        // Remove duplicate relationships
        let mut seen = std::collections::HashSet::new();
        relationships.retain(|rel| {
            let key = (rel.source_entity_id, rel.target_entity_id, rel.relationship_type.as_str());
            seen.insert(key)
        });

        // Boost confidence for relationships with multiple evidence
        for relationship in relationships.iter_mut() {
            if relationship.evidence.len() > 1 {
                relationship.confidence = (relationship.confidence * 1.2).min(1.0);
            }
        }

        // Add properties based on relationship type
        for relationship in relationships.iter_mut() {
            match relationship.relationship_type {
                RelationshipType::WorksAt => {
                    relationship.properties.insert("category".to_string(), "employment".to_string());
                }
                RelationshipType::Uses => {
                    relationship.properties.insert("category".to_string(), "usage".to_string());
                }
                RelationshipType::Integrates => {
                    relationship.properties.insert("category".to_string(), "technical".to_string());
                }
                _ => {}
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::entities::{Entity, EntityType};

    fn create_test_entities() -> Vec<Entity> {
        vec![
            Entity {
                id: Uuid::new_v4(),
                name: "John Doe".to_string(),
                entity_type: EntityType::Person,
                description: None,
                aliases: vec![],
                confidence: 0.9,
                source_spans: vec![],
                properties: HashMap::new(),
                created_at: chrono::Utc::now(),
            },
            Entity {
                id: Uuid::new_v4(),
                name: "Microsoft".to_string(),
                entity_type: EntityType::Organization,
                description: None,
                aliases: vec!["Microsoft Corp".to_string()],
                confidence: 0.95,
                source_spans: vec![],
                properties: HashMap::new(),
                created_at: chrono::Utc::now(),
            },
            Entity {
                id: Uuid::new_v4(),
                name: "Rust".to_string(),
                entity_type: EntityType::Technology,
                description: None,
                aliases: vec![],
                confidence: 0.9,
                source_spans: vec![],
                properties: HashMap::new(),
                created_at: chrono::Utc::now(),
            },
        ]
    }

    #[tokio::test]
    async fn test_relationship_extraction() {
        let extractor = RelationshipExtractor::new("test-model").await.unwrap();
        let entities = create_test_entities();
        
        let text = "John Doe works at Microsoft and uses Rust programming language.";
        let relationships = extractor.extract(text, &entities).await.unwrap();
        
        assert!(!relationships.is_empty());
        
        // Check that we found expected relationships
        let types: Vec<_> = relationships.iter().map(|r| &r.relationship_type).collect();
        assert!(types.iter().any(|t| matches!(t, RelationshipType::WorksAt)));
        assert!(types.iter().any(|t| matches!(t, RelationshipType::Uses)));
    }

    #[test]
    fn test_relationship_type_inverse() {
        assert_eq!(RelationshipType::Before.inverse(), Some(RelationshipType::After));
        assert_eq!(RelationshipType::After.inverse(), Some(RelationshipType::Before));
        assert_eq!(RelationshipType::Manages.inverse(), Some(RelationshipType::ReportsTo));
    }
}