//! Community detection for knowledge graphs

use crate::{KnowledgeNode, KnowledgeEdge, CommunityDetectionConfig};
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{info, instrument};
use uuid::Uuid;

/// Represents a community of related entities in the knowledge graph
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Community {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub member_ids: Vec<Uuid>,
    pub central_entities: Vec<Uuid>, // Most important entities in the community
    pub quality_score: f64, // Modularity or other quality metric
    pub size: usize,
    pub properties: HashMap<String, String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Community detection algorithms
#[derive(Debug, Clone)]
pub enum CommunityAlgorithm {
    Leiden,
    Louvain, 
    HierarchicalClustering,
}

impl CommunityAlgorithm {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "leiden" => CommunityAlgorithm::Leiden,
            "louvain" => CommunityAlgorithm::Louvain,
            "hierarchical" => CommunityAlgorithm::HierarchicalClustering,
            _ => CommunityAlgorithm::Leiden, // Default
        }
    }
}

/// Community detection engine
pub struct CommunityDetector {
    algorithm: CommunityAlgorithm,
    resolution: f64,
    max_iterations: usize,
    min_community_size: usize,
}

impl CommunityDetector {
    /// Create a new community detector
    pub fn new(config: CommunityDetectionConfig) -> Result<Self> {
        Ok(Self {
            algorithm: CommunityAlgorithm::from_str(&config.algorithm),
            resolution: config.resolution,
            max_iterations: config.max_iterations,
            min_community_size: config.min_community_size,
        })
    }

    /// Detect communities in the graph
    #[instrument(skip(self, nodes, edges), fields(node_count = nodes.len(), edge_count = edges.len()))]
    pub async fn detect_communities(&self, nodes: &[KnowledgeNode], edges: &[KnowledgeEdge]) -> Result<Vec<Community>> {
        info!("Running community detection with {:?} algorithm", self.algorithm);

        let communities = match self.algorithm {
            CommunityAlgorithm::Leiden => self.leiden_algorithm(nodes, edges).await?,
            CommunityAlgorithm::Louvain => self.louvain_algorithm(nodes, edges).await?,
            CommunityAlgorithm::HierarchicalClustering => self.hierarchical_clustering(nodes, edges).await?,
        };

        info!("Detected {} communities", communities.len());
        Ok(communities)
    }

    /// Leiden community detection algorithm
    async fn leiden_algorithm(&self, nodes: &[KnowledgeNode], edges: &[KnowledgeEdge]) -> Result<Vec<Community>> {
        // Build adjacency matrix
        let graph = self.build_graph(nodes, edges);
        
        // Initialize each node in its own community
        let mut communities: HashMap<Uuid, Vec<Uuid>> = nodes
            .iter()
            .map(|node| (node.id, vec![node.id]))
            .collect();

        let mut improved = true;
        let mut iteration = 0;

        while improved && iteration < self.max_iterations {
            improved = false;
            iteration += 1;

            // Local moving phase
            for node in nodes {
                let current_community = communities.keys()
                    .find(|&&comm_id| communities[&comm_id].contains(&node.id))
                    .copied();

                if let Some(current_comm_id) = current_community {
                    let mut best_community = current_comm_id;
                    let mut best_modularity = self.calculate_modularity(&graph, &communities);

                    // Try moving to neighboring communities
                    for edge in edges {
                        let neighbor_id = if edge.source_id == node.id {
                            edge.target_id
                        } else if edge.target_id == node.id {
                            edge.source_id
                        } else {
                            continue;
                        };

                        if let Some(neighbor_comm_id) = communities.keys()
                            .find(|&&comm_id| communities[&comm_id].contains(&neighbor_id))
                            .copied()
                        {
                            if neighbor_comm_id != current_comm_id {
                                // Try moving node to neighbor's community
                                let mut test_communities = communities.clone();
                                test_communities.get_mut(&current_comm_id).unwrap().retain(|&id| id != node.id);
                                test_communities.get_mut(&neighbor_comm_id).unwrap().push(node.id);

                                let test_modularity = self.calculate_modularity(&graph, &test_communities);
                                if test_modularity > best_modularity {
                                    best_modularity = test_modularity;
                                    best_community = neighbor_comm_id;
                                    improved = true;
                                }
                            }
                        }
                    }

                    // Move node to best community
                    if best_community != current_comm_id {
                        communities.get_mut(&current_comm_id).unwrap().retain(|&id| id != node.id);
                        communities.get_mut(&best_community).unwrap().push(node.id);
                    }
                }
            }
        }

        // Remove empty communities and convert to Community structs
        self.finalize_communities(communities, nodes).await
    }

    /// Louvain community detection algorithm (simplified)
    async fn louvain_algorithm(&self, nodes: &[KnowledgeNode], edges: &[KnowledgeEdge]) -> Result<Vec<Community>> {
        // Similar to Leiden but with different optimization strategy
        // For now, delegate to Leiden implementation
        self.leiden_algorithm(nodes, edges).await
    }

    /// Hierarchical clustering algorithm
    async fn hierarchical_clustering(&self, nodes: &[KnowledgeNode], edges: &[KnowledgeEdge]) -> Result<Vec<Community>> {
        // Build similarity matrix
        let similarity_matrix = self.build_similarity_matrix(nodes, edges);
        
        // Start with each node as its own cluster
        let mut clusters: Vec<Vec<Uuid>> = nodes.iter().map(|n| vec![n.id]).collect();
        
        // Merge clusters based on similarity
        while clusters.len() > 1 {
            let mut best_merge = None;
            let mut best_similarity = f64::NEG_INFINITY;
            
            // Find best pair to merge
            for i in 0..clusters.len() {
                for j in (i + 1)..clusters.len() {
                    let similarity = self.cluster_similarity(&clusters[i], &clusters[j], &similarity_matrix);
                    if similarity > best_similarity {
                        best_similarity = similarity;
                        best_merge = Some((i, j));
                    }
                }
            }
            
            // Stop if no good merges left
            if best_similarity < 0.3 { // Threshold
                break;
            }
            
            // Merge best clusters
            if let Some((i, j)) = best_merge {
                let mut merged = clusters[i].clone();
                merged.extend(clusters[j].clone());
                
                // Remove old clusters (in reverse order to maintain indices)
                clusters.remove(j);
                clusters.remove(i);
                clusters.push(merged);
            }
        }
        
        // Convert clusters to communities
        let mut communities = Vec::new();
        for (idx, cluster) in clusters.into_iter().enumerate() {
            if cluster.len() >= self.min_community_size {
                let community = Community {
                    id: Uuid::new_v4(),
                    name: format!("Community {}", idx + 1),
                    description: Some("Hierarchically clustered community".to_string()),
                    member_ids: cluster.clone(),
                    central_entities: self.find_central_entities(&cluster, edges),
                    quality_score: 0.7, // Placeholder
                    size: cluster.len(),
                    properties: HashMap::new(),
                    created_at: chrono::Utc::now(),
                };
                communities.push(community);
            }
        }
        
        Ok(communities)
    }

    /// Build graph representation from nodes and edges
    fn build_graph(&self, nodes: &[KnowledgeNode], edges: &[KnowledgeEdge]) -> HashMap<Uuid, Vec<(Uuid, f64)>> {
        let mut graph: HashMap<Uuid, Vec<(Uuid, f64)>> = HashMap::new();
        
        // Initialize all nodes
        for node in nodes {
            graph.insert(node.id, Vec::new());
        }
        
        // Add edges
        for edge in edges {
            graph.entry(edge.source_id)
                .or_default()
                .push((edge.target_id, edge.weight));
            
            graph.entry(edge.target_id)
                .or_default()
                .push((edge.source_id, edge.weight));
        }
        
        graph
    }

    /// Build similarity matrix for hierarchical clustering
    fn build_similarity_matrix(&self, nodes: &[KnowledgeNode], edges: &[KnowledgeEdge]) -> HashMap<(Uuid, Uuid), f64> {
        let mut matrix = HashMap::new();
        
        // Initialize with zero similarity
        for i in 0..nodes.len() {
            for j in (i + 1)..nodes.len() {
                matrix.insert((nodes[i].id, nodes[j].id), 0.0);
            }
        }
        
        // Add edge weights as similarity
        for edge in edges {
            let key = if edge.source_id < edge.target_id {
                (edge.source_id, edge.target_id)
            } else {
                (edge.target_id, edge.source_id)
            };
            matrix.insert(key, edge.weight * edge.confidence);
        }
        
        matrix
    }

    /// Calculate cluster similarity for hierarchical clustering
    fn cluster_similarity(&self, cluster1: &[Uuid], cluster2: &[Uuid], matrix: &HashMap<(Uuid, Uuid), f64>) -> f64 {
        let mut total_similarity = 0.0;
        let mut count = 0;
        
        for &node1 in cluster1 {
            for &node2 in cluster2 {
                let key = if node1 < node2 {
                    (node1, node2)
                } else {
                    (node2, node1)
                };
                if let Some(&similarity) = matrix.get(&key) {
                    total_similarity += similarity;
                    count += 1;
                }
            }
        }
        
        if count > 0 {
            total_similarity / count as f64
        } else {
            0.0
        }
    }

    /// Calculate modularity of community partition
    fn calculate_modularity(&self, graph: &HashMap<Uuid, Vec<(Uuid, f64)>>, communities: &HashMap<Uuid, Vec<Uuid>>) -> f64 {
        let total_edges: f64 = graph.values()
            .map(|neighbors| neighbors.iter().map(|(_, weight)| weight).sum::<f64>())
            .sum::<f64>() / 2.0; // Divide by 2 because edges are counted twice
        
        if total_edges == 0.0 {
            return 0.0;
        }
        
        let mut modularity = 0.0;
        
        for community_members in communities.values() {
            if community_members.is_empty() {
                continue;
            }
            
            // Calculate internal edges within community
            let mut internal_edges = 0.0;
            let mut total_degree = 0.0;
            
            for &node in community_members {
                if let Some(neighbors) = graph.get(&node) {
                    let degree: f64 = neighbors.iter().map(|(_, weight)| weight).sum();
                    total_degree += degree;
                    
                    for &(neighbor, weight) in neighbors {
                        if community_members.contains(&neighbor) {
                            internal_edges += weight;
                        }
                    }
                }
            }
            
            internal_edges /= 2.0; // Each edge counted twice
            let expected_internal = (total_degree * total_degree) / (4.0 * total_edges);
            
            modularity += (internal_edges / total_edges) - expected_internal;
        }
        
        modularity
    }

    /// Find central entities in a community
    fn find_central_entities(&self, community: &[Uuid], edges: &[KnowledgeEdge]) -> Vec<Uuid> {
        let mut degree_count: HashMap<Uuid, usize> = HashMap::new();
        
        // Count connections within the community
        for edge in edges {
            if community.contains(&edge.source_id) && community.contains(&edge.target_id) {
                *degree_count.entry(edge.source_id).or_insert(0) += 1;
                *degree_count.entry(edge.target_id).or_insert(0) += 1;
            }
        }
        
        // Sort by degree and take top entities
        let mut sorted_entities: Vec<_> = degree_count.into_iter().collect();
        sorted_entities.sort_by(|a, b| b.1.cmp(&a.1));
        
        sorted_entities.into_iter()
            .take(3) // Top 3 central entities
            .map(|(id, _)| id)
            .collect()
    }

    /// Convert community map to Community structs
    async fn finalize_communities(&self, mut communities: HashMap<Uuid, Vec<Uuid>>, nodes: &[KnowledgeNode]) -> Result<Vec<Community>> {
        // Remove empty communities
        communities.retain(|_, members| members.len() >= self.min_community_size);
        
        let mut result = Vec::new();
        
        for (idx, (_, members)) in communities.into_iter().enumerate() {
            // Generate community name based on dominant entity types
            let community_name = self.generate_community_name(&members, nodes, idx + 1);
            
            let community = Community {
                id: Uuid::new_v4(),
                name: community_name,
                description: Some("Algorithmically detected community".to_string()),
                member_ids: members.clone(),
                central_entities: Vec::new(), // Would be populated with centrality analysis
                quality_score: 0.8, // Would be calculated based on modularity
                size: members.len(),
                properties: HashMap::new(),
                created_at: chrono::Utc::now(),
            };
            
            result.push(community);
        }
        
        Ok(result)
    }

    /// Generate meaningful community name based on member entities
    fn generate_community_name(&self, members: &[Uuid], nodes: &[KnowledgeNode], default_num: usize) -> String {
        let member_nodes: Vec<_> = nodes.iter()
            .filter(|node| members.contains(&node.id))
            .collect();
        
        if member_nodes.is_empty() {
            return format!("Community {}", default_num);
        }
        
        // Count entity types
        let mut type_counts: HashMap<String, usize> = HashMap::new();
        for node in &member_nodes {
            let type_name = node.entity.entity_type.as_str();
            *type_counts.entry(type_name.to_string()).or_insert(0) += 1;
        }
        
        // Find dominant type
        if let Some((dominant_type, _)) = type_counts.iter().max_by_key(|(_, &count)| count) {
            match dominant_type.as_str() {
                "PERSON" => format!("People Network {}", default_num),
                "ORGANIZATION" => format!("Organization Cluster {}", default_num),
                "TECHNOLOGY" => format!("Tech Stack {}", default_num),
                "LOCATION" => format!("Geographic Region {}", default_num),
                _ => format!("{} Community {}", dominant_type, default_num),
            }
        } else {
            format!("Community {}", default_num)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{KnowledgeNode, KnowledgeEdge, entities::{Entity, EntityType}};
    use std::collections::HashMap;

    fn create_test_graph() -> (Vec<KnowledgeNode>, Vec<KnowledgeEdge>) {
        let nodes = vec![
            KnowledgeNode {
                id: Uuid::new_v4(),
                entity: Entity {
                    id: Uuid::new_v4(),
                    name: "Node 1".to_string(),
                    entity_type: EntityType::Person,
                    description: None,
                    aliases: vec![],
                    confidence: 0.9,
                    source_spans: vec![],
                    properties: HashMap::new(),
                    created_at: chrono::Utc::now(),
                },
                embeddings: vec![0.1, 0.2, 0.3],
                community_id: None,
                metadata: HashMap::new(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            },
            // Add more test nodes...
        ];
        
        let edges = vec![
            // Add test edges...
        ];
        
        (nodes, edges)
    }

    #[tokio::test]
    async fn test_community_detection() {
        let config = CommunityDetectionConfig {
            algorithm: "leiden".to_string(),
            resolution: 1.0,
            max_iterations: 100,
            min_community_size: 2,
        };
        
        let detector = CommunityDetector::new(config).unwrap();
        let (nodes, edges) = create_test_graph();
        
        let communities = detector.detect_communities(&nodes, &edges).await.unwrap();
        
        // Basic validation
        assert!(!communities.is_empty());
        for community in communities {
            assert!(community.size >= 2); // Min community size
            assert!(!community.member_ids.is_empty());
        }
    }
}