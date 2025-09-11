//! Window management for multimodal processing

use crate::error::{FusionError, Result};
use crate::types::*;
use nalgebra::DMatrix;
use std::collections::VecDeque;
use uuid::Uuid;
use chrono::Utc;

/// Manages sliding windows for multimodal data streams
pub struct WindowManager {
    window_size: usize,
    overlap_ratio: f32,
    max_active_windows: usize,
    active_windows: VecDeque<ModalityWindow>,
    window_embeddings: Vec<DMatrix<f64>>,
}

impl WindowManager {
    /// Get all active windows
    pub fn get_active_windows(&self) -> &VecDeque<ModalityWindow> {
        &self.active_windows
    }
    
    /// Create a new window manager
    pub fn new(window_size: usize, overlap_ratio: f32, max_active_windows: usize) -> Self {
        Self {
            window_size,
            overlap_ratio,
            max_active_windows,
            active_windows: VecDeque::new(),
            window_embeddings: Vec::new(),
        }
    }
    
    /// Add a new modality window
    pub fn add_window(&mut self, window: ModalityWindow) -> Result<()> {
        // Check capacity
        if self.active_windows.len() >= self.max_active_windows {
            // Remove oldest window
            self.active_windows.pop_front();
            if !self.window_embeddings.is_empty() {
                self.window_embeddings.remove(0);
            }
        }
        
        // Convert embeddings to matrix
        let embedding_matrix = self.create_embedding_matrix(&window.embeddings)?;
        
        self.active_windows.push_back(window);
        self.window_embeddings.push(embedding_matrix);
        
        Ok(())
    }
    
    /// Get windows that overlap with a given timestamp
    pub fn get_overlapping_windows(&self, timestamp: chrono::DateTime<Utc>) -> Vec<&ModalityWindow> {
        self.active_windows
            .iter()
            .filter(|w| {
                let window_duration = chrono::Duration::milliseconds(self.window_size as i64 * 100);
                let window_end = w.timestamp + window_duration;
                w.timestamp <= timestamp && timestamp <= window_end
            })
            .collect()
    }
    
    /// Get windows by modality
    pub fn get_windows_by_modality(&self, modality: &Modality) -> Vec<&ModalityWindow> {
        self.active_windows
            .iter()
            .filter(|w| &w.modality == modality)
            .collect()
    }
    
    /// Create sliding windows from continuous data
    pub fn create_sliding_windows(
        &self,
        data: &[f32],
        modality: Modality,
    ) -> Result<Vec<ModalityWindow>> {
        if data.is_empty() {
            return Ok(vec![]);
        }
        
        let step_size = ((self.window_size as f32) * (1.0 - self.overlap_ratio)) as usize;
        if step_size == 0 {
            return Err(FusionError::window("Invalid step size for sliding windows"));
        }
        
        let mut windows = Vec::new();
        let mut start = 0;
        
        while start + self.window_size <= data.len() {
            let window_data = data[start..start + self.window_size].to_vec();
            
            let window = ModalityWindow {
                id: Uuid::new_v4(),
                modality: modality.clone(),
                content: ModalityContent::Embedding(window_data.clone()),
                embeddings: window_data,
                features: Default::default(),
                timestamp: Utc::now(),
                confidence: 1.0,
            };
            
            windows.push(window);
            start += step_size;
        }
        
        // Handle remaining data if any
        if start < data.len() && data.len() - start > self.window_size / 2 {
            let window_data = data[start..].to_vec();
            let mut padded_data = window_data.clone();
            padded_data.resize(self.window_size, 0.0);
            
            let window = ModalityWindow {
                id: Uuid::new_v4(),
                modality: modality.clone(),
                content: ModalityContent::Embedding(padded_data.clone()),
                embeddings: padded_data,
                features: Default::default(),
                timestamp: Utc::now(),
                confidence: 0.8, // Lower confidence for padded window
            };
            
            windows.push(window);
        }
        
        Ok(windows)
    }
    
    /// Merge overlapping windows
    pub fn merge_windows(&self, windows: &[ModalityWindow]) -> Result<ModalityWindow> {
        if windows.is_empty() {
            return Err(FusionError::window("No windows to merge"));
        }
        
        if windows.len() == 1 {
            return Ok(windows[0].clone());
        }
        
        // Calculate weighted average of embeddings
        let embedding_dim = windows[0].embeddings.len();
        let mut merged_embeddings = vec![0.0f32; embedding_dim];
        let mut total_confidence = 0.0f32;
        
        for window in windows {
            if window.embeddings.len() != embedding_dim {
                return Err(FusionError::window("Embedding dimension mismatch in merge"));
            }
            
            for (i, &value) in window.embeddings.iter().enumerate() {
                merged_embeddings[i] += value * window.confidence;
            }
            total_confidence += window.confidence;
        }
        
        // Normalize by total confidence
        if total_confidence > 0.0 {
            for value in &mut merged_embeddings {
                *value /= total_confidence;
            }
        }
        
        // Merge features
        let mut merged_features = std::collections::HashMap::new();
        for window in windows {
            for (key, feature) in &window.features {
                merged_features.entry(key.clone())
                    .or_insert_with(|| feature.clone());
            }
        }
        
        Ok(ModalityWindow {
            id: Uuid::new_v4(),
            modality: windows[0].modality.clone(),
            content: ModalityContent::Embedding(merged_embeddings.clone()),
            embeddings: merged_embeddings,
            features: merged_features,
            timestamp: windows[0].timestamp,
            confidence: total_confidence / windows.len() as f32,
        })
    }
    
    /// Get all active windows as a combined embedding matrix
    pub fn get_combined_embeddings(&self) -> Result<DMatrix<f64>> {
        if self.window_embeddings.is_empty() {
            return Err(FusionError::window("No active windows"));
        }
        
        let rows = self.window_embeddings[0].nrows();
        let total_cols: usize = self.window_embeddings.iter().map(|m| m.ncols()).sum();
        
        let mut combined = DMatrix::zeros(rows, total_cols);
        let mut col_offset = 0;
        
        for matrix in &self.window_embeddings {
            let cols = matrix.ncols();
            for i in 0..rows {
                for j in 0..cols {
                    combined[(i, col_offset + j)] = matrix[(i, j)];
                }
            }
            col_offset += cols;
        }
        
        Ok(combined)
    }
    
    /// Create embedding matrix from flat embeddings
    fn create_embedding_matrix(&self, embeddings: &[f32]) -> Result<DMatrix<f64>> {
        if embeddings.is_empty() {
            return Err(FusionError::window("Empty embeddings"));
        }
        
        // Convert f32 to f64 for matrix operations
        let embeddings_f64: Vec<f64> = embeddings.iter().map(|&x| x as f64).collect();
        
        // Create column vector (embeddings x 1)
        Ok(DMatrix::from_column_slice(embeddings.len(), 1, &embeddings_f64))
    }
    
    /// Prune old windows based on timestamp
    pub fn prune_old_windows(&mut self, max_age_seconds: u64) {
        let cutoff = Utc::now() - chrono::Duration::seconds(max_age_seconds as i64);
        
        while let Some(window) = self.active_windows.front() {
            if window.timestamp < cutoff {
                self.active_windows.pop_front();
                if !self.window_embeddings.is_empty() {
                    self.window_embeddings.remove(0);
                }
            } else {
                break;
            }
        }
    }
    
    /// Get window statistics
    pub fn get_statistics(&self) -> WindowStatistics {
        let modality_counts = self.active_windows
            .iter()
            .fold(std::collections::HashMap::new(), |mut acc, w| {
                *acc.entry(w.modality.clone()).or_insert(0) += 1;
                acc
            });
        
        let avg_confidence = if !self.active_windows.is_empty() {
            self.active_windows.iter().map(|w| w.confidence).sum::<f32>() 
                / self.active_windows.len() as f32
        } else {
            0.0
        };
        
        WindowStatistics {
            total_windows: self.active_windows.len(),
            windows_by_modality: modality_counts,
            average_confidence: avg_confidence,
            memory_usage_mb: self.estimate_memory_usage(),
        }
    }
    
    /// Estimate memory usage in MB
    fn estimate_memory_usage(&self) -> f64 {
        let window_size = std::mem::size_of::<ModalityWindow>() * self.active_windows.len();
        let embedding_size: usize = self.window_embeddings.iter()
            .map(|m| m.len() * std::mem::size_of::<f64>())
            .sum();
        
        (window_size + embedding_size) as f64 / (1024.0 * 1024.0)
    }
}

/// Statistics about window manager state
#[derive(Debug, Clone)]
pub struct WindowStatistics {
    pub total_windows: usize,
    pub windows_by_modality: std::collections::HashMap<Modality, usize>,
    pub average_confidence: f32,
    pub memory_usage_mb: f64,
}