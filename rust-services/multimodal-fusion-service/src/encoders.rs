//! Modality-specific encoders for multimodal fusion

use crate::error::{FusionError, Result};
use crate::types::*;
use nalgebra::DVector;
use std::collections::HashMap;
use async_trait::async_trait;

/// Trait for modality-specific encoders
#[async_trait]
pub trait ModalityEncoder: Send + Sync {
    /// Encode modality input into embeddings
    async fn encode(&self, input: &ModalityInput) -> Result<Vec<f32>>;
    
    /// Get the output dimension of this encoder
    fn output_dimension(&self) -> usize;
    
    /// Check if this encoder supports the given modality
    fn supports_modality(&self, modality: &Modality) -> bool;
}

/// Manager for multiple modality encoders
pub struct EncoderManager {
    encoders: HashMap<Modality, Box<dyn ModalityEncoder>>,
    default_dimension: usize,
}

impl EncoderManager {
    /// Create a new encoder manager with default encoders
    pub fn new(embedding_dim: usize) -> Self {
        let mut encoders: HashMap<Modality, Box<dyn ModalityEncoder>> = HashMap::new();
        
        // Initialize default encoders for each modality
        encoders.insert(Modality::Text, Box::new(TextEncoder::new(embedding_dim)));
        encoders.insert(Modality::Audio, Box::new(AudioEncoder::new(embedding_dim)));
        encoders.insert(Modality::Vision, Box::new(VisionEncoder::new(embedding_dim)));
        encoders.insert(Modality::Speech, Box::new(SpeechEncoder::new(embedding_dim)));
        encoders.insert(Modality::Code, Box::new(CodeEncoder::new(embedding_dim)));
        encoders.insert(Modality::Video, Box::new(VideoEncoder::new(embedding_dim)));
        encoders.insert(Modality::Sensor, Box::new(SensorEncoder::new(embedding_dim)));
        
        Self {
            encoders,
            default_dimension: embedding_dim,
        }
    }
    
    /// Register a custom encoder for a modality
    pub fn register_encoder(&mut self, modality: Modality, encoder: Box<dyn ModalityEncoder>) {
        self.encoders.insert(modality, encoder);
    }
    
    /// Encode input using the appropriate modality encoder
    pub async fn encode(&self, input: &ModalityInput) -> Result<Vec<f32>> {
        let encoder = self.encoders
            .get(&input.modality)
            .ok_or_else(|| FusionError::unsupported_modality(format!("{:?}", input.modality)))?;
        
        encoder.encode(input).await
    }
    
    /// Batch encode multiple inputs
    pub async fn batch_encode(&self, inputs: &[ModalityInput]) -> Result<Vec<Vec<f32>>> {
        let mut results = Vec::with_capacity(inputs.len());
        
        for input in inputs {
            results.push(self.encode(input).await?);
        }
        
        Ok(results)
    }
    
    /// Get active encoders status
    pub fn get_active_encoders(&self) -> HashMap<Modality, bool> {
        self.encoders.keys().map(|m| (m.clone(), true)).collect()
    }
}

/// Text encoder implementation
struct TextEncoder {
    embedding_dim: usize,
}

impl TextEncoder {
    fn new(embedding_dim: usize) -> Self {
        Self { embedding_dim }
    }
    
    fn encode_text(&self, text: &str) -> Vec<f32> {
        // Simple character-based encoding for demonstration
        // In production, this would use a proper text embedding model
        let mut embeddings = vec![0.0f32; self.embedding_dim];
        
        let chars: Vec<char> = text.chars().take(self.embedding_dim).collect();
        for (i, ch) in chars.iter().enumerate() {
            // Simple hash-based encoding
            embeddings[i] = (*ch as u32 as f32 / 128.0).sin().abs();
        }
        
        // Apply normalization
        let norm: f32 = embeddings.iter().map(|x| x * x).sum::<f32>().sqrt();
        if norm > 0.0 {
            for emb in &mut embeddings {
                *emb /= norm;
            }
        }
        
        embeddings
    }
}

#[async_trait]
impl ModalityEncoder for TextEncoder {
    async fn encode(&self, input: &ModalityInput) -> Result<Vec<f32>> {
        match &input.content {
            ModalityContent::Text(text) => Ok(self.encode_text(text)),
            ModalityContent::Embedding(emb) => Ok(emb.clone()),
            _ => Err(FusionError::encoder("Text", "Invalid content type for text encoder")),
        }
    }
    
    fn output_dimension(&self) -> usize {
        self.embedding_dim
    }
    
    fn supports_modality(&self, modality: &Modality) -> bool {
        matches!(modality, Modality::Text)
    }
}

/// Audio encoder implementation
struct AudioEncoder {
    embedding_dim: usize,
}

impl AudioEncoder {
    fn new(embedding_dim: usize) -> Self {
        Self { embedding_dim }
    }
    
    fn encode_audio(&self, audio: &AudioData) -> Vec<f32> {
        let mut embeddings = vec![0.0f32; self.embedding_dim];
        
        // Simple FFT-inspired encoding
        let samples_per_bin = audio.samples.len() / self.embedding_dim.min(audio.samples.len()).max(1);
        
        for (i, emb) in embeddings.iter_mut().enumerate() {
            let start = i * samples_per_bin;
            let end = ((i + 1) * samples_per_bin).min(audio.samples.len());
            
            if start < audio.samples.len() {
                let bin_samples = &audio.samples[start..end];
                *emb = bin_samples.iter().map(|x| x.abs()).sum::<f32>() / bin_samples.len() as f32;
            }
        }
        
        // Normalize
        let max_val = embeddings.iter().fold(0.0f32, |a, &b| a.max(b.abs()));
        if max_val > 0.0 {
            for emb in &mut embeddings {
                *emb /= max_val;
            }
        }
        
        embeddings
    }
}

#[async_trait]
impl ModalityEncoder for AudioEncoder {
    async fn encode(&self, input: &ModalityInput) -> Result<Vec<f32>> {
        match &input.content {
            ModalityContent::Audio(audio) => Ok(self.encode_audio(audio)),
            ModalityContent::Embedding(emb) => Ok(emb.clone()),
            _ => Err(FusionError::encoder("Audio", "Invalid content type for audio encoder")),
        }
    }
    
    fn output_dimension(&self) -> usize {
        self.embedding_dim
    }
    
    fn supports_modality(&self, modality: &Modality) -> bool {
        matches!(modality, Modality::Audio)
    }
}

/// Vision encoder implementation
struct VisionEncoder {
    embedding_dim: usize,
}

impl VisionEncoder {
    fn new(embedding_dim: usize) -> Self {
        Self { embedding_dim }
    }
    
    fn encode_image(&self, image: &ImageData) -> Vec<f32> {
        let mut embeddings = vec![0.0f32; self.embedding_dim];
        
        // Simple spatial pooling encoding
        let pixels_per_region = (image.width * image.height) as usize / self.embedding_dim.max(1);
        let bytes_per_pixel = image.channels as usize;
        
        for (i, emb) in embeddings.iter_mut().enumerate() {
            let start_pixel = i * pixels_per_region;
            let end_pixel = ((i + 1) * pixels_per_region).min((image.width * image.height) as usize);
            
            let start_byte = start_pixel * bytes_per_pixel;
            let end_byte = end_pixel * bytes_per_pixel;
            
            if start_byte < image.data.len() && end_byte <= image.data.len() {
                let region_data = &image.data[start_byte..end_byte];
                *emb = region_data.iter().map(|&x| x as f32 / 255.0).sum::<f32>() 
                    / region_data.len() as f32;
            }
        }
        
        embeddings
    }
}

#[async_trait]
impl ModalityEncoder for VisionEncoder {
    async fn encode(&self, input: &ModalityInput) -> Result<Vec<f32>> {
        match &input.content {
            ModalityContent::Image(image) => Ok(self.encode_image(image)),
            ModalityContent::Embedding(emb) => Ok(emb.clone()),
            _ => Err(FusionError::encoder("Vision", "Invalid content type for vision encoder")),
        }
    }
    
    fn output_dimension(&self) -> usize {
        self.embedding_dim
    }
    
    fn supports_modality(&self, modality: &Modality) -> bool {
        matches!(modality, Modality::Vision)
    }
}

/// Speech encoder (extends audio with speech-specific features)
struct SpeechEncoder {
    audio_encoder: AudioEncoder,
    embedding_dim: usize,
}

impl SpeechEncoder {
    fn new(embedding_dim: usize) -> Self {
        Self {
            audio_encoder: AudioEncoder::new(embedding_dim),
            embedding_dim,
        }
    }
}

#[async_trait]
impl ModalityEncoder for SpeechEncoder {
    async fn encode(&self, input: &ModalityInput) -> Result<Vec<f32>> {
        // Use audio encoder as base, could add speech-specific features
        self.audio_encoder.encode(input).await
    }
    
    fn output_dimension(&self) -> usize {
        self.embedding_dim
    }
    
    fn supports_modality(&self, modality: &Modality) -> bool {
        matches!(modality, Modality::Speech)
    }
}

/// Code encoder implementation
struct CodeEncoder {
    text_encoder: TextEncoder,
    embedding_dim: usize,
}

impl CodeEncoder {
    fn new(embedding_dim: usize) -> Self {
        Self {
            text_encoder: TextEncoder::new(embedding_dim),
            embedding_dim,
        }
    }
}

#[async_trait]
impl ModalityEncoder for CodeEncoder {
    async fn encode(&self, input: &ModalityInput) -> Result<Vec<f32>> {
        // Use text encoder as base, could add code-specific features
        self.text_encoder.encode(input).await
    }
    
    fn output_dimension(&self) -> usize {
        self.embedding_dim
    }
    
    fn supports_modality(&self, modality: &Modality) -> bool {
        matches!(modality, Modality::Code)
    }
}

/// Video encoder implementation
struct VideoEncoder {
    vision_encoder: VisionEncoder,
    embedding_dim: usize,
}

impl VideoEncoder {
    fn new(embedding_dim: usize) -> Self {
        Self {
            vision_encoder: VisionEncoder::new(embedding_dim),
            embedding_dim,
        }
    }
    
    async fn encode_video(&self, video: &VideoData) -> Vec<f32> {
        let mut embeddings = vec![0.0f32; self.embedding_dim];
        
        if !video.frames.is_empty() {
            // Average embeddings across key frames
            let frame_step = video.frames.len() / 5.min(video.frames.len()).max(1);
            let mut frame_count = 0;
            
            for i in (0..video.frames.len()).step_by(frame_step) {
                let frame_emb = self.vision_encoder.encode_image(&video.frames[i]);
                for (j, &val) in frame_emb.iter().enumerate() {
                    if j < embeddings.len() {
                        embeddings[j] += val;
                    }
                }
                frame_count += 1;
            }
            
            // Average
            if frame_count > 0 {
                for emb in &mut embeddings {
                    *emb /= frame_count as f32;
                }
            }
        }
        
        embeddings
    }
}

#[async_trait]
impl ModalityEncoder for VideoEncoder {
    async fn encode(&self, input: &ModalityInput) -> Result<Vec<f32>> {
        match &input.content {
            ModalityContent::Video(video) => Ok(self.encode_video(video).await),
            ModalityContent::Embedding(emb) => Ok(emb.clone()),
            _ => Err(FusionError::encoder("Video", "Invalid content type for video encoder")),
        }
    }
    
    fn output_dimension(&self) -> usize {
        self.embedding_dim
    }
    
    fn supports_modality(&self, modality: &Modality) -> bool {
        matches!(modality, Modality::Video)
    }
}

/// Sensor data encoder
struct SensorEncoder {
    embedding_dim: usize,
}

impl SensorEncoder {
    fn new(embedding_dim: usize) -> Self {
        Self { embedding_dim }
    }
    
    fn encode_raw(&self, data: &[u8]) -> Vec<f32> {
        let mut embeddings = vec![0.0f32; self.embedding_dim];
        
        // Simple byte-level encoding
        let bytes_per_dim = data.len() / self.embedding_dim.max(1);
        
        for (i, emb) in embeddings.iter_mut().enumerate() {
            let start = i * bytes_per_dim;
            let end = ((i + 1) * bytes_per_dim).min(data.len());
            
            if start < data.len() {
                let slice = &data[start..end];
                *emb = slice.iter().map(|&x| x as f32 / 255.0).sum::<f32>() / slice.len() as f32;
            }
        }
        
        embeddings
    }
}

#[async_trait]
impl ModalityEncoder for SensorEncoder {
    async fn encode(&self, input: &ModalityInput) -> Result<Vec<f32>> {
        match &input.content {
            ModalityContent::Raw(data) => Ok(self.encode_raw(data)),
            ModalityContent::Embedding(emb) => Ok(emb.clone()),
            _ => Err(FusionError::encoder("Sensor", "Invalid content type for sensor encoder")),
        }
    }
    
    fn output_dimension(&self) -> usize {
        self.embedding_dim
    }
    
    fn supports_modality(&self, modality: &Modality) -> bool {
        matches!(modality, Modality::Sensor)
    }
}