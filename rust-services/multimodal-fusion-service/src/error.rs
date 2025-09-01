//! Error handling for multimodal fusion service

use thiserror::Error;

pub type Result<T> = std::result::Result<T, FusionError>;

#[derive(Error, Debug)]
pub enum FusionError {
    #[error("Modality not supported: {0}")]
    UnsupportedModality(String),
    
    #[error("Feature extraction failed: {0}")]
    FeatureExtractionError(String),
    
    #[error("Fusion operation failed: {0}")]
    FusionError(String),
    
    #[error("Attention computation failed: {0}")]
    AttentionError(String),
    
    #[error("Window processing error: {0}")]
    WindowError(String),
    
    #[error("Encoder error for modality {modality}: {message}")]
    EncoderError {
        modality: String,
        message: String,
    },
    
    #[error("Invalid input: {0}")]
    InvalidInput(String),
    
    #[error("Resource exhausted: {0}")]
    ResourceExhausted(String),
    
    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),
    
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    
    #[error("Internal error: {0}")]
    InternalError(String),
}

impl FusionError {
    pub fn unsupported_modality(modality: impl Into<String>) -> Self {
        Self::UnsupportedModality(modality.into())
    }
    
    pub fn feature_extraction(msg: impl Into<String>) -> Self {
        Self::FeatureExtractionError(msg.into())
    }
    
    pub fn fusion(msg: impl Into<String>) -> Self {
        Self::FusionError(msg.into())
    }
    
    pub fn attention(msg: impl Into<String>) -> Self {
        Self::AttentionError(msg.into())
    }
    
    pub fn window(msg: impl Into<String>) -> Self {
        Self::WindowError(msg.into())
    }
    
    pub fn encoder(modality: impl Into<String>, message: impl Into<String>) -> Self {
        Self::EncoderError {
            modality: modality.into(),
            message: message.into(),
        }
    }
    
    pub fn invalid_input(msg: impl Into<String>) -> Self {
        Self::InvalidInput(msg.into())
    }
    
    pub fn resource_exhausted(msg: impl Into<String>) -> Self {
        Self::ResourceExhausted(msg.into())
    }
    
    pub fn internal(msg: impl Into<String>) -> Self {
        Self::InternalError(msg.into())
    }
}