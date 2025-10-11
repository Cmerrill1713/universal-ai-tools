//! Embedding generation and management for the Intelligent Librarian

use anyhow::Result;
use std::collections::HashMap;

/// Embedding service for vector operations
pub struct EmbeddingService {
    // In a real implementation, this would connect to Supabase with pgvector
    // For now, we'll use in-memory storage for testing
    embeddings: HashMap<String, Vec<f32>>,
}

impl EmbeddingService {
    pub async fn new() -> Result<Self> {
        Ok(Self {
            embeddings: HashMap::new(),
        })
    }

    /// Generate embeddings for text content
    pub async fn generate_embedding(&mut self, text: &str) -> Result<Vec<f32>> {
        // In a real implementation, this would call an embedding model
        // For now, we'll generate a simple hash-based embedding
        let hash = self.simple_hash(text);
        let embedding = self.hash_to_embedding(hash);

        self.embeddings.insert(text.to_string(), embedding.clone());
        Ok(embedding)
    }

    /// Find similar documents based on embeddings
    pub async fn find_similar(&self, query_embedding: &[f32], limit: usize) -> Result<Vec<(String, f64)>> {
        let mut similarities = Vec::new();

        for (text, embedding) in &self.embeddings {
            let similarity = self.cosine_similarity(query_embedding, embedding);
            similarities.push((text.clone(), similarity));
        }

        similarities.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        similarities.truncate(limit);

        Ok(similarities)
    }

    /// Calculate cosine similarity between two embeddings
    fn cosine_similarity(&self, a: &[f32], b: &[f32]) -> f64 {
        if a.len() != b.len() {
            return 0.0;
        }

        let dot_product: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
        let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
        let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

        if norm_a == 0.0 || norm_b == 0.0 {
            return 0.0;
        }

        (dot_product / (norm_a * norm_b)) as f64
    }

    /// Simple hash function for text
    fn simple_hash(&self, text: &str) -> u64 {
        let mut hash = 0u64;
        for byte in text.bytes() {
            hash = hash.wrapping_mul(31).wrapping_add(byte as u64);
        }
        hash
    }

    /// Convert hash to embedding vector
    fn hash_to_embedding(&self, hash: u64) -> Vec<f32> {
        let mut embedding = vec![0.0; 384]; // Standard embedding dimension

        for i in 0..384 {
            let bit = (hash >> (i % 64)) & 1;
            embedding[i] = if bit == 1 { 1.0 } else { -1.0 };
        }

        embedding
    }
}
