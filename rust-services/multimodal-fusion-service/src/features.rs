//! Feature extraction for multimodal data

use crate::error::{FusionError, Result};
use crate::types::*;
use std::collections::HashMap;
use nalgebra::{DVector, DMatrix};

/// Feature extractor for multimodal inputs
pub struct FeatureExtractor {
    feature_configs: HashMap<Modality, FeatureConfig>,
}

/// Configuration for feature extraction
#[derive(Clone, Debug)]
pub struct FeatureConfig {
    pub extract_statistical: bool,
    pub extract_spectral: bool,
    pub extract_temporal: bool,
    pub extract_spatial: bool,
    pub max_features: usize,
}

impl Default for FeatureConfig {
    fn default() -> Self {
        Self {
            extract_statistical: true,
            extract_spectral: false,
            extract_temporal: true,
            extract_spatial: false,
            max_features: 100,
        }
    }
}

impl FeatureExtractor {
    /// Create a new feature extractor
    pub fn new() -> Self {
        let mut feature_configs = HashMap::new();
        
        // Configure features for each modality
        feature_configs.insert(Modality::Text, FeatureConfig {
            extract_statistical: true,
            extract_spectral: false,
            extract_temporal: false,
            extract_spatial: false,
            max_features: 50,
        });
        
        feature_configs.insert(Modality::Audio, FeatureConfig {
            extract_statistical: true,
            extract_spectral: true,
            extract_temporal: true,
            extract_spatial: false,
            max_features: 100,
        });
        
        feature_configs.insert(Modality::Vision, FeatureConfig {
            extract_statistical: true,
            extract_spectral: false,
            extract_temporal: false,
            extract_spatial: true,
            max_features: 150,
        });
        
        feature_configs.insert(Modality::Video, FeatureConfig {
            extract_statistical: true,
            extract_spectral: false,
            extract_temporal: true,
            extract_spatial: true,
            max_features: 200,
        });
        
        Self { feature_configs }
    }
    
    /// Extract features from modality input
    pub fn extract(&self, input: &ModalityInput) -> Result<HashMap<String, Feature>> {
        let default_config = FeatureConfig::default();
        let config = self.feature_configs
            .get(&input.modality)
            .unwrap_or(&default_config);
        
        let mut features = HashMap::new();
        
        // Extract features based on content type
        match &input.content {
            ModalityContent::Text(text) => {
                self.extract_text_features(text, config, &mut features)?;
            }
            ModalityContent::Audio(audio) => {
                self.extract_audio_features(audio, config, &mut features)?;
            }
            ModalityContent::Image(image) => {
                self.extract_image_features(image, config, &mut features)?;
            }
            ModalityContent::Video(video) => {
                self.extract_video_features(video, config, &mut features)?;
            }
            ModalityContent::Embedding(emb) => {
                self.extract_embedding_features(emb, config, &mut features)?;
            }
            ModalityContent::Raw(data) => {
                self.extract_raw_features(data, config, &mut features)?;
            }
        }
        
        Ok(features)
    }
    
    /// Extract text-specific features
    fn extract_text_features(
        &self,
        text: &str,
        config: &FeatureConfig,
        features: &mut HashMap<String, Feature>,
    ) -> Result<()> {
        if config.extract_statistical {
            // Character count statistics
            let char_count = text.chars().count() as f32;
            let word_count = text.split_whitespace().count() as f32;
            let avg_word_length = if word_count > 0.0 {
                char_count / word_count
            } else {
                0.0
            };
            
            features.insert("text_statistics".to_string(), Feature {
                name: "text_statistics".to_string(),
                values: vec![char_count, word_count, avg_word_length],
                dimensions: vec![3],
                metadata: HashMap::new(),
            });
            
            // Character frequency distribution
            let mut char_freq = HashMap::new();
            for ch in text.chars() {
                *char_freq.entry(ch).or_insert(0) += 1;
            }
            
            let freq_values: Vec<f32> = char_freq.values()
                .take(config.max_features)
                .map(|&v| v as f32 / char_count)
                .collect();
            
            features.insert("char_frequency".to_string(), Feature {
                name: "char_frequency".to_string(),
                values: freq_values,
                dimensions: vec![char_freq.len().min(config.max_features)],
                metadata: HashMap::new(),
            });
        }
        
        Ok(())
    }
    
    /// Extract audio-specific features
    fn extract_audio_features(
        &self,
        audio: &AudioData,
        config: &FeatureConfig,
        features: &mut HashMap<String, Feature>,
    ) -> Result<()> {
        if config.extract_statistical {
            // Basic statistics
            let mean = audio.samples.iter().sum::<f32>() / audio.samples.len() as f32;
            let variance = audio.samples.iter()
                .map(|x| (x - mean).powi(2))
                .sum::<f32>() / audio.samples.len() as f32;
            let std_dev = variance.sqrt();
            
            features.insert("audio_statistics".to_string(), Feature {
                name: "audio_statistics".to_string(),
                values: vec![mean, std_dev, audio.sample_rate as f32, audio.duration_ms as f32],
                dimensions: vec![4],
                metadata: HashMap::new(),
            });
        }
        
        if config.extract_spectral {
            // Simple spectral features (energy in frequency bands)
            let band_count = 10.min(config.max_features);
            let samples_per_band = audio.samples.len() / band_count;
            let mut band_energies = Vec::with_capacity(band_count);
            
            for i in 0..band_count {
                let start = i * samples_per_band;
                let end = ((i + 1) * samples_per_band).min(audio.samples.len());
                let band_energy: f32 = audio.samples[start..end]
                    .iter()
                    .map(|x| x * x)
                    .sum();
                band_energies.push(band_energy.sqrt());
            }
            
            features.insert("spectral_bands".to_string(), Feature {
                name: "spectral_bands".to_string(),
                values: band_energies,
                dimensions: vec![band_count],
                metadata: HashMap::new(),
            });
        }
        
        if config.extract_temporal {
            // Temporal features (zero crossing rate, energy envelope)
            let mut zero_crossings = 0;
            for i in 1..audio.samples.len() {
                if audio.samples[i-1] * audio.samples[i] < 0.0 {
                    zero_crossings += 1;
                }
            }
            let zcr = zero_crossings as f32 / audio.samples.len() as f32;
            
            features.insert("temporal_features".to_string(), Feature {
                name: "temporal_features".to_string(),
                values: vec![zcr, audio.duration_ms as f32 / 1000.0],
                dimensions: vec![2],
                metadata: HashMap::new(),
            });
        }
        
        Ok(())
    }
    
    /// Extract image-specific features
    fn extract_image_features(
        &self,
        image: &ImageData,
        config: &FeatureConfig,
        features: &mut HashMap<String, Feature>,
    ) -> Result<()> {
        if config.extract_statistical {
            // Color statistics
            let pixel_count = (image.width * image.height) as f32;
            let channels = image.channels as usize;
            let mut channel_means = vec![0.0f32; channels];
            
            for (i, byte) in image.data.iter().enumerate() {
                channel_means[i % channels] += *byte as f32 / 255.0;
            }
            
            for mean in &mut channel_means {
                *mean /= pixel_count;
            }
            
            features.insert("color_statistics".to_string(), Feature {
                name: "color_statistics".to_string(),
                values: channel_means,
                dimensions: vec![channels],
                metadata: HashMap::new(),
            });
        }
        
        if config.extract_spatial {
            // Spatial features (simple edge detection)
            let mut edge_strength = 0.0f32;
            let width = image.width as usize;
            let height = image.height as usize;
            
            for y in 1..height-1 {
                for x in 1..width-1 {
                    let idx = (y * width + x) * image.channels as usize;
                    if idx + image.channels as usize <= image.data.len() {
                        // Simple gradient magnitude
                        let center = image.data[idx] as f32;
                        let right = if idx + (image.channels as usize) < image.data.len() {
                            image.data[idx + (image.channels as usize)] as f32
                        } else {
                            center
                        };
                        let bottom = if idx + width * (image.channels as usize) < image.data.len() {
                            image.data[idx + width * (image.channels as usize)] as f32
                        } else {
                            center
                        };
                        
                        let dx = (right - center).abs();
                        let dy = (bottom - center).abs();
                        edge_strength += (dx * dx + dy * dy).sqrt();
                    }
                }
            }
            
            edge_strength /= (image.width * image.height) as f32;
            
            features.insert("spatial_features".to_string(), Feature {
                name: "spatial_features".to_string(),
                values: vec![edge_strength, image.width as f32, image.height as f32],
                dimensions: vec![3],
                metadata: HashMap::new(),
            });
        }
        
        Ok(())
    }
    
    /// Extract video-specific features
    fn extract_video_features(
        &self,
        video: &VideoData,
        config: &FeatureConfig,
        features: &mut HashMap<String, Feature>,
    ) -> Result<()> {
        if config.extract_statistical {
            features.insert("video_metadata".to_string(), Feature {
                name: "video_metadata".to_string(),
                values: vec![
                    video.width as f32,
                    video.height as f32,
                    video.fps,
                    video.duration_ms as f32,
                    video.frames.len() as f32,
                ],
                dimensions: vec![5],
                metadata: HashMap::new(),
            });
        }
        
        if config.extract_temporal && !video.frames.is_empty() {
            // Motion features (frame differences)
            let mut motion_scores = Vec::new();
            
            for i in 1..video.frames.len().min(10) {
                let frame1 = &video.frames[i-1];
                let frame2 = &video.frames[i];
                
                let mut diff_sum = 0.0f32;
                let min_len = frame1.data.len().min(frame2.data.len());
                
                for j in 0..min_len {
                    diff_sum += (frame1.data[j] as f32 - frame2.data[j] as f32).abs();
                }
                
                motion_scores.push(diff_sum / min_len as f32);
            }
            
            features.insert("motion_features".to_string(), Feature {
                name: "motion_features".to_string(),
                values: motion_scores,
                dimensions: vec![video.frames.len().min(9)],
                metadata: HashMap::new(),
            });
        }
        
        Ok(())
    }
    
    /// Extract features from embeddings
    fn extract_embedding_features(
        &self,
        embeddings: &[f32],
        config: &FeatureConfig,
        features: &mut HashMap<String, Feature>,
    ) -> Result<()> {
        if config.extract_statistical && !embeddings.is_empty() {
            let mean = embeddings.iter().sum::<f32>() / embeddings.len() as f32;
            let variance = embeddings.iter()
                .map(|x| (x - mean).powi(2))
                .sum::<f32>() / embeddings.len() as f32;
            let std_dev = variance.sqrt();
            let max_val = embeddings.iter().fold(f32::MIN, |a, &b| a.max(b));
            let min_val = embeddings.iter().fold(f32::MAX, |a, &b| a.min(b));
            
            features.insert("embedding_statistics".to_string(), Feature {
                name: "embedding_statistics".to_string(),
                values: vec![mean, std_dev, min_val, max_val],
                dimensions: vec![4],
                metadata: HashMap::new(),
            });
        }
        
        Ok(())
    }
    
    /// Extract features from raw data
    fn extract_raw_features(
        &self,
        data: &[u8],
        config: &FeatureConfig,
        features: &mut HashMap<String, Feature>,
    ) -> Result<()> {
        if config.extract_statistical && !data.is_empty() {
            // Byte statistics
            let mean = data.iter().map(|&x| x as f32).sum::<f32>() / data.len() as f32;
            let entropy = self.calculate_entropy(data);
            
            features.insert("raw_statistics".to_string(), Feature {
                name: "raw_statistics".to_string(),
                values: vec![mean / 255.0, entropy, data.len() as f32],
                dimensions: vec![3],
                metadata: HashMap::new(),
            });
        }
        
        Ok(())
    }
    
    /// Calculate Shannon entropy of byte data
    fn calculate_entropy(&self, data: &[u8]) -> f32 {
        let mut freq = [0u32; 256];
        for &byte in data {
            freq[byte as usize] += 1;
        }
        
        let total = data.len() as f32;
        let mut entropy = 0.0f32;
        
        for &count in &freq {
            if count > 0 {
                let p = count as f32 / total;
                entropy -= p * p.log2();
            }
        }
        
        entropy
    }
}