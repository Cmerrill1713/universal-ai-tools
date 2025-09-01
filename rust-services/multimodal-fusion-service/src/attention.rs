//! Cross-modal attention mechanism for Q-Former architecture

use crate::error::{FusionError, Result};
use nalgebra::{DMatrix, DVector};
use rayon::prelude::*;
use std::f64::consts::SQRT_2;

/// Cross-modal attention module implementing scaled dot-product attention
pub struct CrossModalAttention {
    embedding_dim: usize,
    num_heads: usize,
    hidden_dim: usize,
    head_dim: usize,
    scale_factor: f64,
}

impl CrossModalAttention {
    /// Create a new cross-modal attention module
    pub fn new(embedding_dim: usize, num_heads: usize, hidden_dim: usize) -> Self {
        let head_dim = embedding_dim / num_heads;
        let scale_factor = 1.0 / (head_dim as f64).sqrt();
        
        Self {
            embedding_dim,
            num_heads,
            hidden_dim,
            head_dim,
            scale_factor,
        }
    }
    
    /// Compute multi-head attention between modality windows
    pub fn compute_attention(&self, embeddings: &DMatrix<f64>) -> Result<Vec<Vec<f32>>> {
        let (embedding_dim, num_windows) = embeddings.shape();
        
        if embedding_dim != self.embedding_dim {
            return Err(FusionError::attention(format!(
                "Embedding dimension mismatch: expected {}, got {}",
                self.embedding_dim, embedding_dim
            )));
        }
        
        // Initialize attention weights for all heads
        let mut all_attention_weights = Vec::new();
        
        // Process each attention head in parallel
        let head_results: Vec<_> = (0..self.num_heads)
            .into_par_iter()
            .map(|head_idx| {
                self.compute_head_attention(embeddings, head_idx)
            })
            .collect();
        
        // Aggregate results from all heads
        for head_result in head_results {
            match head_result {
                Ok(weights) => all_attention_weights.push(weights),
                Err(e) => return Err(e),
            }
        }
        
        // Average attention weights across heads
        let averaged_weights = self.average_attention_weights(&all_attention_weights, num_windows);
        
        Ok(averaged_weights)
    }
    
    /// Compute attention for a single head
    fn compute_head_attention(
        &self,
        embeddings: &DMatrix<f64>,
        head_idx: usize,
    ) -> Result<Vec<f32>> {
        let (_, num_windows) = embeddings.shape();
        
        // Extract head-specific embeddings
        let start_idx = head_idx * self.head_dim;
        let end_idx = start_idx + self.head_dim;
        
        if end_idx > self.embedding_dim {
            return Err(FusionError::attention("Head dimension out of bounds"));
        }
        
        // Create Q, K, V projections for this head
        let head_embeddings = embeddings.rows(start_idx, self.head_dim);
        
        // Compute scaled dot-product attention
        // Q @ K^T / sqrt(d_k)
        let attention_scores = &head_embeddings.transpose() * &head_embeddings * self.scale_factor;
        
        // Apply softmax to get attention weights
        let attention_weights = self.softmax_matrix(&attention_scores);
        
        // Convert to f32 for output
        let weights_f32: Vec<f32> = attention_weights.iter()
            .map(|&w| w as f32)
            .collect();
        
        Ok(weights_f32)
    }
    
    /// Apply softmax to matrix rows
    fn softmax_matrix(&self, scores: &DMatrix<f64>) -> Vec<f64> {
        let (rows, cols) = scores.shape();
        let mut weights = Vec::with_capacity(rows * cols);
        
        for i in 0..rows {
            let row = scores.row(i);
            let max_score = row.max();
            
            // Compute exp(score - max) for numerical stability
            let exp_scores: Vec<f64> = row.iter()
                .map(|&score| (score - max_score).exp())
                .collect();
            
            let sum_exp: f64 = exp_scores.iter().sum();
            
            // Normalize to get probabilities
            for exp_score in exp_scores {
                weights.push(exp_score / sum_exp);
            }
        }
        
        weights
    }
    
    /// Average attention weights across all heads
    fn average_attention_weights(
        &self,
        all_weights: &[Vec<f32>],
        num_windows: usize,
    ) -> Vec<Vec<f32>> {
        let mut averaged = vec![vec![0.0f32; num_windows]; num_windows];
        
        for head_weights in all_weights {
            for i in 0..num_windows {
                for j in 0..num_windows {
                    let idx = i * num_windows + j;
                    if idx < head_weights.len() {
                        averaged[i][j] += head_weights[idx] / self.num_heads as f32;
                    }
                }
            }
        }
        
        averaged
    }
    
    /// Compute position-aware attention (for temporal/spatial relationships)
    pub fn compute_positional_attention(
        &self,
        embeddings: &DMatrix<f64>,
        positions: &[f64],
    ) -> Result<Vec<Vec<f32>>> {
        let (_, num_windows) = embeddings.shape();
        
        if positions.len() != num_windows {
            return Err(FusionError::attention("Position vector length mismatch"));
        }
        
        // Add positional encoding to embeddings
        let mut position_aware_embeddings = embeddings.clone();
        
        for (window_idx, &position) in positions.iter().enumerate() {
            let positional_encoding = self.generate_positional_encoding(position);
            
            for (dim_idx, encoding) in positional_encoding.iter().enumerate() {
                if dim_idx < self.embedding_dim {
                    position_aware_embeddings[(dim_idx, window_idx)] += encoding;
                }
            }
        }
        
        // Compute attention with position-aware embeddings
        self.compute_attention(&position_aware_embeddings)
    }
    
    /// Generate sinusoidal positional encoding
    fn generate_positional_encoding(&self, position: f64) -> Vec<f64> {
        let mut encoding = Vec::with_capacity(self.embedding_dim);
        
        for i in 0..self.embedding_dim {
            let angle = if i % 2 == 0 {
                position / 10000_f64.powf(i as f64 / self.embedding_dim as f64)
            } else {
                position / 10000_f64.powf((i - 1) as f64 / self.embedding_dim as f64)
            };
            
            let value = if i % 2 == 0 {
                angle.sin()
            } else {
                angle.cos()
            };
            
            encoding.push(value * 0.1); // Scale down positional encoding
        }
        
        encoding
    }
    
    /// Apply attention mask for specific modality pairs
    pub fn apply_modality_mask(
        &self,
        attention_weights: &mut Vec<Vec<f32>>,
        modality_mask: &[Vec<bool>],
    ) -> Result<()> {
        let num_windows = attention_weights.len();
        
        if modality_mask.len() != num_windows {
            return Err(FusionError::attention("Modality mask dimension mismatch"));
        }
        
        for i in 0..num_windows {
            if modality_mask[i].len() != num_windows {
                return Err(FusionError::attention("Modality mask is not square"));
            }
            
            for j in 0..num_windows {
                if !modality_mask[i][j] {
                    attention_weights[i][j] = 0.0;
                }
            }
            
            // Re-normalize after masking
            let row_sum: f32 = attention_weights[i].iter().sum();
            if row_sum > 0.0 {
                for j in 0..num_windows {
                    attention_weights[i][j] /= row_sum;
                }
            }
        }
        
        Ok(())
    }
}