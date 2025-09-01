//! Core type definitions for multimodal fusion service

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use uuid::Uuid;

/// Represents different modalities that can be processed
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum Modality {
    Text,
    Speech,
    Audio,
    Vision,
    Code,
    Video,
    Sensor,
}

/// Input data for a specific modality
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ModalityInput {
    pub id: Uuid,
    pub modality: Modality,
    pub content: ModalityContent,
    pub metadata: HashMap<String, serde_json::Value>,
    pub timestamp: DateTime<Utc>,
}

/// Content types for different modalities
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ModalityContent {
    Text(String),
    Audio(AudioData),
    Image(ImageData),
    Video(VideoData),
    Embedding(Vec<f32>),
    Raw(Vec<u8>),
}

/// Audio data representation
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AudioData {
    pub samples: Vec<f32>,
    pub sample_rate: u32,
    pub channels: u16,
    pub duration_ms: u64,
}

/// Image data representation
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ImageData {
    pub width: u32,
    pub height: u32,
    pub channels: u8,
    pub data: Vec<u8>,
    pub format: ImageFormat,
}

/// Video data representation
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct VideoData {
    pub width: u32,
    pub height: u32,
    pub fps: f32,
    pub duration_ms: u64,
    pub frames: Vec<ImageData>,
}

/// Image format types
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ImageFormat {
    Rgb,
    Rgba,
    Grayscale,
    Jpeg,
    Png,
}

/// Represents a processing window for multimodal data
#[derive(Clone, Debug)]
pub struct ModalityWindow {
    pub id: Uuid,
    pub modality: Modality,
    pub content: ModalityContent,
    pub embeddings: Vec<f32>,
    pub features: HashMap<String, Feature>,
    pub timestamp: DateTime<Utc>,
    pub confidence: f32,
}

/// Feature representation for extracted modality features
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Feature {
    pub name: String,
    pub values: Vec<f32>,
    pub dimensions: Vec<usize>,
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Result of multimodal fusion
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FusionResult {
    pub id: Uuid,
    pub unified_representation: UnifiedRepresentation,
    pub cross_modal_connections: Vec<CrossModalConnection>,
    pub emergent_patterns: Vec<Pattern>,
    pub confidence: f32,
    pub reasoning: Vec<String>,
    pub processing_time_ms: u64,
}

/// Unified representation after fusion
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct UnifiedRepresentation {
    pub embeddings: Vec<f32>,
    pub attention_weights: Vec<Vec<f32>>,
    pub modality_contributions: HashMap<Modality, f32>,
    pub semantic_features: HashMap<String, Vec<f32>>,
}

/// Cross-modal connection discovered during fusion
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CrossModalConnection {
    pub source_modality: Modality,
    pub target_modality: Modality,
    pub connection_type: ConnectionType,
    pub strength: f32,
    pub features: Vec<String>,
}

/// Types of cross-modal connections
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum ConnectionType {
    Semantic,
    Temporal,
    Spatial,
    Causal,
    Complementary,
    Contradictory,
}

/// Emergent pattern from fusion
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Pattern {
    pub id: String,
    pub pattern_type: PatternType,
    pub modalities: Vec<Modality>,
    pub confidence: f32,
    pub description: String,
}

/// Types of emergent patterns
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum PatternType {
    Synchronization,
    Correlation,
    Sequence,
    Hierarchy,
    Cluster,
    Anomaly,
}

/// Cross-modal query
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CrossModalQuery {
    pub query_type: QueryType,
    pub source_modality: Modality,
    pub target_modality: Option<Modality>,
    pub content: ModalityContent,
    pub context: HashMap<String, serde_json::Value>,
}

/// Query types for cross-modal operations
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum QueryType {
    Alignment,
    Translation,
    Synthesis,
    Reasoning,
    Search,
    Generation,
}

/// Result of cross-modal query
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct QueryResult {
    pub query_id: Uuid,
    pub results: Vec<ModalityOutput>,
    pub confidence: f32,
    pub explanations: Vec<String>,
}

/// Output for a specific modality
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ModalityOutput {
    pub modality: Modality,
    pub content: ModalityContent,
    pub confidence: f32,
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Analytics for fusion operations
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FusionAnalytics {
    pub total_windows_processed: u64,
    pub active_windows: usize,
    pub fusion_operations: u64,
    pub average_fusion_time_ms: f64,
    pub modality_distribution: HashMap<Modality, u64>,
    pub pattern_frequencies: HashMap<PatternType, u64>,
    pub connection_statistics: ConnectionStatistics,
}

/// Statistics for cross-modal connections
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ConnectionStatistics {
    pub total_connections: u64,
    pub average_strength: f32,
    pub strongest_pair: Option<(Modality, Modality)>,
    pub connection_type_distribution: HashMap<ConnectionType, u64>,
}

/// Health status of the service
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HealthStatus {
    pub healthy: bool,
    pub status: String,
    pub active_encoders: HashMap<Modality, bool>,
    pub memory_usage_mb: u64,
    pub processing_queue_size: usize,
}