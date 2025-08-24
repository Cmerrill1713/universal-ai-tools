// GPU acceleration modules for vector operations
// Provides Metal acceleration on Apple Silicon and fallback CPU implementations

pub mod metal;

use anyhow::Result;
use async_trait::async_trait;
use ndarray::Array1;


/// Trait for GPU acceleration implementations
#[async_trait]
pub trait VectorAccelerator {
    /// Initialize the accelerator
    async fn initialize(&mut self) -> Result<()>;
    
    /// Check if acceleration is available
    fn is_available(&self) -> bool;
    
    /// Get device information
    fn device_info(&self) -> String;
    
    /// Compute similarity scores between query and candidate vectors
    async fn compute_similarities(
        &self,
        query_vector: &Array1<f32>,
        candidate_vectors: &[Array1<f32>],
        similarity_metric: &str,
    ) -> Result<Vec<f32>>;
    
    /// Batch vector operations for multiple queries
    async fn batch_similarities(
        &self,
        query_vectors: &[Array1<f32>],
        candidate_vectors: &[Array1<f32>],
        similarity_metric: &str,
    ) -> Result<Vec<Vec<f32>>>;
    
    /// Batch similarity search optimized for single query against many candidates
    async fn batch_similarity_search(
        &self,
        query_vector: Array1<f32>,
        candidate_vectors: Vec<Array1<f32>>,
        threshold: f32,
    ) -> Result<Vec<(usize, f32)>>;
    
    /// Find k-nearest neighbors using GPU acceleration
    async fn knn_search(
        &self,
        query_vector: &Array1<f32>,
        vectors: &[Array1<f32>],
        k: usize,
        similarity_metric: &str,
    ) -> Result<Vec<(usize, f32)>>;
    
    /// Vector normalization on GPU
    async fn normalize_vectors(&self, vectors: &mut [Array1<f32>]) -> Result<()>;
    
    /// Cleanup GPU resources
    async fn cleanup(&mut self) -> Result<()>;
}

/// CPU fallback implementation for vector operations
pub struct CPUAccelerator {
    thread_count: usize,
}

impl CPUAccelerator {
    pub fn new() -> Self {
        Self {
            thread_count: num_cpus::get(),
        }
    }
    
    /// Compute cosine similarity between two vectors
    fn cosine_similarity(a: &Array1<f32>, b: &Array1<f32>) -> f32 {
        let dot_product = a.dot(b);
        let norm_a = a.dot(a).sqrt();
        let norm_b = b.dot(b).sqrt();
        
        if norm_a == 0.0 || norm_b == 0.0 {
            0.0
        } else {
            dot_product / (norm_a * norm_b)
        }
    }
    
    /// Compute Euclidean distance between two vectors
    fn euclidean_distance(a: &Array1<f32>, b: &Array1<f32>) -> f32 {
        (a - b).mapv(|x| x * x).sum().sqrt()
    }
    
    /// Compute dot product between two vectors
    fn dot_product(a: &Array1<f32>, b: &Array1<f32>) -> f32 {
        a.dot(b)
    }
    
    /// Compute Manhattan distance between two vectors
    fn manhattan_distance(a: &Array1<f32>, b: &Array1<f32>) -> f32 {
        (a - b).mapv(|x| x.abs()).sum()
    }
    
    /// Compute similarity based on metric
    fn compute_similarity(&self, a: &Array1<f32>, b: &Array1<f32>, metric: &str) -> f32 {
        match metric.to_lowercase().as_str() {
            "cosine" => Self::cosine_similarity(a, b),
            "euclidean" => 1.0 / (1.0 + Self::euclidean_distance(a, b)), // Convert distance to similarity
            "dot" | "dotproduct" => Self::dot_product(a, b),
            "manhattan" => 1.0 / (1.0 + Self::manhattan_distance(a, b)), // Convert distance to similarity
            _ => Self::cosine_similarity(a, b), // Default to cosine
        }
    }
}

impl Default for CPUAccelerator {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl VectorAccelerator for CPUAccelerator {
    async fn initialize(&mut self) -> Result<()> {
        // CPU acceleration is always available
        Ok(())
    }
    
    fn is_available(&self) -> bool {
        true
    }
    
    fn device_info(&self) -> String {
        format!("CPU ({} threads)", self.thread_count)
    }
    
    async fn compute_similarities(
        &self,
        query_vector: &Array1<f32>,
        candidate_vectors: &[Array1<f32>],
        similarity_metric: &str,
    ) -> Result<Vec<f32>> {
        use rayon::prelude::*;
        
        let similarities = candidate_vectors
            .par_iter()
            .map(|candidate| self.compute_similarity(query_vector, candidate, similarity_metric))
            .collect();
        
        Ok(similarities)
    }
    
    async fn batch_similarities(
        &self,
        query_vectors: &[Array1<f32>],
        candidate_vectors: &[Array1<f32>],
        similarity_metric: &str,
    ) -> Result<Vec<Vec<f32>>> {
        use rayon::prelude::*;
        
        let results = query_vectors
            .par_iter()
            .map(|query| {
                candidate_vectors
                    .iter()
                    .map(|candidate| self.compute_similarity(query, candidate, similarity_metric))
                    .collect()
            })
            .collect();
        
        Ok(results)
    }
    
    async fn batch_similarity_search(
        &self,
        query_vector: Array1<f32>,
        candidate_vectors: Vec<Array1<f32>>,
        threshold: f32,
    ) -> Result<Vec<(usize, f32)>> {
        use rayon::prelude::*;
        
        let results: Vec<(usize, f32)> = candidate_vectors
            .par_iter()
            .enumerate()
            .filter_map(|(idx, candidate)| {
                let similarity = self.compute_similarity(&query_vector, candidate, "cosine");
                if similarity >= threshold {
                    Some((idx, similarity))
                } else {
                    None
                }
            })
            .collect();
        
        Ok(results)
    }
    
    async fn knn_search(
        &self,
        query_vector: &Array1<f32>,
        vectors: &[Array1<f32>],
        k: usize,
        similarity_metric: &str,
    ) -> Result<Vec<(usize, f32)>> {
        use rayon::prelude::*;
        
        let mut similarities: Vec<(usize, f32)> = vectors
            .par_iter()
            .enumerate()
            .map(|(idx, vector)| (idx, self.compute_similarity(query_vector, vector, similarity_metric)))
            .collect();
        
        // Sort by similarity in descending order
        similarities.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        
        // Return top k results
        similarities.truncate(k);
        Ok(similarities)
    }
    
    async fn normalize_vectors(&self, vectors: &mut [Array1<f32>]) -> Result<()> {
        use rayon::prelude::*;
        
        vectors.par_iter_mut().for_each(|vector| {
            let norm = vector.dot(vector).sqrt();
            if norm > 0.0 {
                *vector = vector.mapv(|x| x / norm);
            }
        });
        
        Ok(())
    }
    
    async fn cleanup(&mut self) -> Result<()> {
        // No cleanup needed for CPU
        Ok(())
    }
}

/// Factory for creating accelerator instances
pub struct AcceleratorFactory;

impl AcceleratorFactory {
    /// Create the best available accelerator
    pub async fn create_best_available() -> Result<Box<dyn VectorAccelerator + Send + Sync>> {
        #[cfg(feature = "metal-acceleration")]
        {
            match metal::MetalAccelerator::new().await {
                Ok(mut accelerator) => {
                    if accelerator.initialize().await.is_ok() && accelerator.is_available() {
                        tracing::info!("Using Metal GPU acceleration: {}", accelerator.device_info());
                        return Ok(Box::new(accelerator));
                    }
                }
                Err(e) => {
                    tracing::warn!("Failed to initialize Metal acceleration: {}", e);
                }
            }
        }
        
        // Fallback to CPU
        let mut cpu_accelerator = CPUAccelerator::new();
        cpu_accelerator.initialize().await?;
        tracing::info!("Using CPU acceleration: {}", cpu_accelerator.device_info());
        Ok(Box::new(cpu_accelerator))
    }
    
    /// Create CPU-only accelerator
    pub async fn create_cpu() -> Result<Box<dyn VectorAccelerator + Send + Sync>> {
        let mut accelerator = CPUAccelerator::new();
        accelerator.initialize().await?;
        Ok(Box::new(accelerator))
    }
    
    #[cfg(feature = "metal-acceleration")]
    /// Create Metal accelerator if available
    pub async fn create_metal() -> Result<Box<dyn VectorAccelerator + Send + Sync>> {
        let mut accelerator = metal::MetalAccelerator::new().await?;
        accelerator.initialize().await?;
        Ok(Box::new(accelerator))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ndarray::Array1;
    
    #[tokio::test]
    async fn test_cpu_accelerator_similarity() {
        let accelerator = CPUAccelerator::new();
        
        let vec1 = Array1::from(vec![1.0, 0.0, 0.0]);
        let vec2 = Array1::from(vec![0.0, 1.0, 0.0]);
        let vec3 = Array1::from(vec![1.0, 0.0, 0.0]);
        
        let candidates = vec![vec2.clone(), vec3.clone()];
        let similarities = accelerator
            .compute_similarities(&vec1, &candidates, "cosine")
            .await
            .unwrap();
        
        assert_eq!(similarities.len(), 2);
        assert!((similarities[0] - 0.0).abs() < 1e-6); // vec1 and vec2 are orthogonal
        assert!((similarities[1] - 1.0).abs() < 1e-6); // vec1 and vec3 are identical
    }
    
    #[tokio::test]
    async fn test_cpu_accelerator_knn() {
        let accelerator = CPUAccelerator::new();
        
        let query = Array1::from(vec![1.0, 0.0]);
        let vectors = vec![
            Array1::from(vec![1.0, 0.1]),  // Similar to query
            Array1::from(vec![0.0, 1.0]),  // Orthogonal to query
            Array1::from(vec![1.0, 0.0]),  // Identical to query
            Array1::from(vec![-1.0, 0.0]), // Opposite to query
        ];
        
        let results = accelerator
            .knn_search(&query, &vectors, 2, "cosine")
            .await
            .unwrap();
        
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].0, 2); // Identical vector should be first
        assert_eq!(results[1].0, 0); // Similar vector should be second
    }
    
    #[tokio::test]
    async fn test_cpu_accelerator_normalization() {
        let mut accelerator = CPUAccelerator::new();
        accelerator.initialize().await.unwrap();
        
        let mut vectors = vec![
            Array1::from(vec![3.0, 4.0]),  // Length 5
            Array1::from(vec![1.0, 1.0]),  // Length sqrt(2)
        ];
        
        accelerator.normalize_vectors(&mut vectors).await.unwrap();
        
        // Check that vectors are normalized (length = 1)
        for vector in &vectors {
            let length = vector.dot(vector).sqrt();
            assert!((length - 1.0).abs() < 1e-6);
        }
    }
}