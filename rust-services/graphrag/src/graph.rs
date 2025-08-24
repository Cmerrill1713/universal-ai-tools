//! Neo4j graph database service for entity and relationship management

use anyhow::{Result, Context};
use neo4rs::{Graph, Node, Relation, query};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{info, warn};

/// Graph service for Neo4j operations
pub struct GraphService {
    graph: Arc<Graph>,
}

/// Entity representation in the knowledge graph
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entity {
    pub id: String,
    pub name: String,
    pub entity_type: String,
    pub properties: serde_json::Value,
    pub embedding_id: Option<String>,
}

/// Relationship between entities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Relationship {
    pub id: String,
    pub source_id: String,
    pub target_id: String,
    pub relationship_type: String,
    pub properties: serde_json::Value,
    pub weight: f32,
}

impl GraphService {
    /// Create a new graph service connection
    pub async fn new(uri: &str, user: &str, password: &str) -> Result<Self> {
        let graph = Graph::new(uri, user, password)
            .await
            .context("Failed to connect to Neo4j")?;
        
        info!("Connected to Neo4j at {}", uri);
        
        Ok(Self {
            graph: Arc::new(graph),
        })
    }

    /// Create or update an entity
    pub async fn upsert_entity(&self, entity: &Entity) -> Result<()> {
        let query = query(
            "MERGE (n:Entity {id: $id})
             SET n.name = $name,
                 n.type = $entity_type,
                 n.properties = $properties,
                 n.embedding_id = $embedding_id,
                 n.updated_at = timestamp()
             RETURN n"
        )
        .param("id", entity.id.clone())
        .param("name", entity.name.clone())
        .param("entity_type", entity.entity_type.clone())
        .param("properties", entity.properties.to_string())
        .param("embedding_id", entity.embedding_id.clone());

        self.graph.run(query)
            .await
            .context("Failed to upsert entity")?;

        Ok(())
    }

    /// Create a relationship between entities
    pub async fn create_relationship(&self, relationship: &Relationship) -> Result<()> {
        let query = query(
            "MATCH (source:Entity {id: $source_id})
             MATCH (target:Entity {id: $target_id})
             MERGE (source)-[r:RELATES_TO {id: $id}]->(target)
             SET r.type = $relationship_type,
                 r.properties = $properties,
                 r.weight = $weight,
                 r.updated_at = timestamp()
             RETURN r"
        )
        .param("id", relationship.id.clone())
        .param("source_id", relationship.source_id.clone())
        .param("target_id", relationship.target_id.clone())
        .param("relationship_type", relationship.relationship_type.clone())
        .param("properties", relationship.properties.to_string())
        .param("weight", relationship.weight);

        self.graph.run(query)
            .await
            .context("Failed to create relationship")?;

        Ok(())
    }

    /// Find entities connected to a given entity
    pub async fn find_connected_entities(
        &self, 
        entity_id: &str, 
        max_hops: usize
    ) -> Result<Vec<Entity>> {
        let query = query(&format!(
            "MATCH (start:Entity {{id: $id}})
             MATCH path = (start)-[*1..{}]-(connected:Entity)
             WHERE connected.id <> start.id
             RETURN DISTINCT connected
             LIMIT 100",
            max_hops
        ))
        .param("id", entity_id.to_string());

        let mut result = self.graph.execute(query)
            .await
            .context("Failed to find connected entities")?;

        let mut entities = Vec::new();
        
        while let Ok(Some(row)) = result.next().await {
            if let Ok(node) = row.get::<Node>("connected") {
                let entity = Self::node_to_entity(node)?;
                entities.push(entity);
            }
        }

        Ok(entities)
    }

    /// Find shortest path between two entities
    pub async fn find_shortest_path(
        &self,
        source_id: &str,
        target_id: &str
    ) -> Result<Vec<String>> {
        let query = query(
            "MATCH path = shortestPath((source:Entity {id: $source_id})-[*]-(target:Entity {id: $target_id}))
             RETURN [n in nodes(path) | n.id] as path_ids"
        )
        .param("source_id", source_id.to_string())
        .param("target_id", target_id.to_string());

        let mut result = self.graph.execute(query)
            .await
            .context("Failed to find shortest path")?;

        if let Ok(Some(row)) = result.next().await {
            if let Ok(path_ids) = row.get::<Vec<String>>("path_ids") {
                return Ok(path_ids);
            }
        }

        Ok(Vec::new())
    }

    /// Calculate PageRank for entities
    pub async fn calculate_pagerank(&self) -> Result<()> {
        let query = query(
            "CALL gds.pageRank.stream('entity-graph')
             YIELD nodeId, score
             MATCH (n:Entity) WHERE id(n) = nodeId
             SET n.pagerank = score
             RETURN count(n) as updated"
        );

        self.graph.run(query)
            .await
            .context("Failed to calculate PageRank")?;

        Ok(())
    }

    /// Extract entities from text using advanced NLP patterns
    pub async fn extract_entities_from_text(&self, text: &str) -> Result<Vec<Entity>> {
        let mut entities = Vec::new();
        
        // Split text into sentences for better processing
        let sentences: Vec<&str> = text.split(&['.', '!', '?'][..]).collect();
        
        for sentence in sentences {
            if sentence.trim().is_empty() {
                continue;
            }
            
            // Extract named entities using multiple patterns
            entities.extend(self.extract_person_names(sentence)?);
            entities.extend(self.extract_organizations(sentence)?);
            entities.extend(self.extract_locations(sentence)?);
            entities.extend(self.extract_concepts(sentence)?);
            entities.extend(self.extract_dates_and_numbers(sentence)?);
        }
        
        // Deduplicate entities by name
        let mut seen = std::collections::HashSet::new();
        entities.retain(|entity| seen.insert(entity.name.clone()));
        
        Ok(entities)
    }
    
    /// Extract person names (Title Case words, common name patterns)
    fn extract_person_names(&self, text: &str) -> Result<Vec<Entity>> {
        let mut entities = Vec::new();
        let words: Vec<&str> = text.split_whitespace().collect();
        
        for i in 0..words.len() {
            let word = words[i];
            
            // Skip if not properly capitalized
            if !word.chars().next().map(|c| c.is_uppercase()).unwrap_or(false) {
                continue;
            }
            
            // Look for common name patterns
            if i + 1 < words.len() {
                let next_word = words[i + 1];
                if next_word.chars().next().map(|c| c.is_uppercase()).unwrap_or(false) {
                    // Potential "First Last" name
                    let full_name = format!("{} {}", word, next_word);
                    if self.looks_like_person_name(&full_name) {
                        entities.push(Entity {
                            id: format!("person_{}", uuid::Uuid::new_v4()),
                            name: full_name,
                            entity_type: "PERSON".to_string(),
                            properties: serde_json::json!({
                                "confidence": 0.8,
                                "source": "name_pattern_extraction"
                            }),
                            embedding_id: None,
                        });
                    }
                }
            }
        }
        
        Ok(entities)
    }
    
    /// Extract organizations (companies, institutions)
    fn extract_organizations(&self, text: &str) -> Result<Vec<Entity>> {
        let mut entities = Vec::new();
        let org_indicators = [
            "Inc", "LLC", "Corp", "Company", "Corporation", "Ltd", "Limited",
            "University", "College", "Institute", "Foundation", "Agency",
            "Department", "Ministry", "Bureau", "Committee"
        ];
        
        for indicator in &org_indicators {
            if let Some(pos) = text.find(indicator) {
                // Extract the organization name (look backwards for the name)
                let before = &text[..pos];
                if let Some(start) = before.rfind(char::is_whitespace) {
                    let org_name = format!("{} {}", &before[start..].trim(), indicator);
                    entities.push(Entity {
                        id: format!("org_{}", uuid::Uuid::new_v4()),
                        name: org_name.trim().to_string(),
                        entity_type: "ORGANIZATION".to_string(),
                        properties: serde_json::json!({
                            "confidence": 0.9,
                            "indicator": indicator,
                            "source": "org_pattern_extraction"
                        }),
                        embedding_id: None,
                    });
                }
            }
        }
        
        Ok(entities)
    }
    
    /// Extract locations (cities, countries, addresses)
    fn extract_locations(&self, text: &str) -> Result<Vec<Entity>> {
        let mut entities = Vec::new();
        let location_indicators = [
            "Street", "St", "Avenue", "Ave", "Road", "Rd", "Boulevard", "Blvd",
            "City", "County", "State", "Country", "District", "Region"
        ];
        
        for indicator in &location_indicators {
            if text.contains(indicator) {
                // Simple extraction - look for capitalized words near location indicators
                let words: Vec<&str> = text.split_whitespace().collect();
                for (i, word) in words.iter().enumerate() {
                    if word.contains(indicator) {
                        // Look for preceding capitalized words
                        if i > 0 && words[i-1].chars().next().map(|c| c.is_uppercase()).unwrap_or(false) {
                            let location = format!("{} {}", words[i-1], word);
                            entities.push(Entity {
                                id: format!("loc_{}", uuid::Uuid::new_v4()),
                                name: location,
                                entity_type: "LOCATION".to_string(),
                                properties: serde_json::json!({
                                    "confidence": 0.7,
                                    "indicator": indicator,
                                    "source": "location_pattern_extraction"
                                }),
                                embedding_id: None,
                            });
                        }
                    }
                }
            }
        }
        
        Ok(entities)
    }
    
    /// Extract key concepts and topics
    fn extract_concepts(&self, text: &str) -> Result<Vec<Entity>> {
        let mut entities = Vec::new();
        let concept_keywords = [
            "artificial intelligence", "machine learning", "deep learning",
            "blockchain", "cryptocurrency", "quantum computing", "cloud computing",
            "cybersecurity", "data science", "big data", "IoT", "API", "microservices",
            "database", "algorithm", "neural network", "automation", "robotics"
        ];
        
        let text_lower = text.to_lowercase();
        for concept in &concept_keywords {
            if text_lower.contains(concept) {
                entities.push(Entity {
                    id: format!("concept_{}", uuid::Uuid::new_v4()),
                    name: concept.to_string(),
                    entity_type: "CONCEPT".to_string(),
                    properties: serde_json::json!({
                        "confidence": 0.9,
                        "domain": "technology",
                        "source": "concept_extraction"
                    }),
                    embedding_id: None,
                });
            }
        }
        
        Ok(entities)
    }
    
    /// Extract dates and numbers
    fn extract_dates_and_numbers(&self, text: &str) -> Result<Vec<Entity>> {
        let mut entities = Vec::new();
        
        // Simple regex patterns for dates and numbers
        use regex::Regex;
        
        // Date patterns
        let date_regex = Regex::new(r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b")
            .unwrap();
        
        for date_match in date_regex.find_iter(text) {
            entities.push(Entity {
                id: format!("date_{}", uuid::Uuid::new_v4()),
                name: date_match.as_str().to_string(),
                entity_type: "DATE".to_string(),
                properties: serde_json::json!({
                    "confidence": 0.95,
                    "source": "date_extraction"
                }),
                embedding_id: None,
            });
        }
        
        // Number patterns (large numbers, percentages)
        let number_regex = Regex::new(r"\b(\d+%|\$\d+(?:,\d{3})*(?:\.\d{2})?|\d+(?:,\d{3})+)\b")
            .unwrap();
            
        for number_match in number_regex.find_iter(text) {
            entities.push(Entity {
                id: format!("number_{}", uuid::Uuid::new_v4()),
                name: number_match.as_str().to_string(),
                entity_type: "NUMBER".to_string(),
                properties: serde_json::json!({
                    "confidence": 0.85,
                    "source": "number_extraction"
                }),
                embedding_id: None,
            });
        }
        
        Ok(entities)
    }
    
    /// Check if a string looks like a person name
    fn looks_like_person_name(&self, name: &str) -> bool {
        let common_first_names = [
            "John", "Jane", "Michael", "Sarah", "David", "Lisa", "James", "Mary",
            "Robert", "Jennifer", "William", "Linda", "Richard", "Elizabeth",
            "Joseph", "Barbara", "Thomas", "Susan", "Christopher", "Jessica"
        ];
        
        let words: Vec<&str> = name.split_whitespace().collect();
        if words.len() != 2 {
            return false;
        }
        
        // Check if first word is a common first name
        common_first_names.contains(&words[0]) || 
        // Or if both words are properly capitalized and reasonable length
        (words[0].len() >= 2 && words[1].len() >= 2 && 
         words[0].chars().next().unwrap().is_uppercase() &&
         words[1].chars().next().unwrap().is_uppercase())
    }

    /// Convert Neo4j Node to Entity
    fn node_to_entity(node: Node) -> Result<Entity> {
        Ok(Entity {
            id: node.get::<String>("id").unwrap_or_default(),
            name: node.get::<String>("name").unwrap_or_default(),
            entity_type: node.get::<String>("type").unwrap_or_default(),
            properties: serde_json::from_str(
                &node.get::<String>("properties").unwrap_or_else(|_| "{}".to_string())
            ).unwrap_or_else(|_| serde_json::json!({})),
            embedding_id: node.get::<String>("embedding_id").ok(),
        })
    }

    /// Get entity by ID
    pub async fn get_entity(&self, entity_id: &str) -> Result<Option<Entity>> {
        let query = query(
            "MATCH (n:Entity {id: $id})
             RETURN n"
        )
        .param("id", entity_id.to_string());

        let mut result = self.graph.execute(query)
            .await
            .context("Failed to get entity")?;

        if let Ok(Some(row)) = result.next().await {
            if let Ok(node) = row.get::<Node>("n") {
                return Ok(Some(Self::node_to_entity(node)?));
            }
        }

        Ok(None)
    }

    /// Delete an entity and its relationships
    pub async fn delete_entity(&self, entity_id: &str) -> Result<()> {
        let query = query(
            "MATCH (n:Entity {id: $id})
             DETACH DELETE n"
        )
        .param("id", entity_id.to_string());

        self.graph.run(query)
            .await
            .context("Failed to delete entity")?;

        Ok(())
    }
}

/// Information about a relationship for API responses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelationshipInfo {
    pub relationship_type: String,
    pub target_entity: String,
    pub weight: f32,
    pub properties: serde_json::Value,
}