use anyhow::{Context, Result};
use reqwest::Client;
use serde_json::json;
use std::time::Duration;
use tokio::time::timeout;
use tracing::{debug, info, warn, error};

use crate::types::*;
use crate::config::PythonConfig;

/// Bridge to Python vision services for complex operations
/// Provides fallback when pure Rust implementation is insufficient
#[derive(Clone)]
pub struct PythonBridge {
    client: Client,
    config: PythonConfig,
    python_available: bool,
}

impl PythonBridge {
    /// Initialize Python bridge with configuration
    pub async fn new(config: &PythonConfig) -> Result<Self> {
        info!("🐍 Initializing Python bridge");
        
        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_seconds))
            .build()
            .context("Failed to create HTTP client")?;

        let mut bridge = Self {
            client,
            config: config.clone(),
            python_available: false,
        };

        // Test Python service availability
        bridge.test_connectivity().await;

        Ok(bridge)
    }

    /// Test if Python vision service is available
    async fn test_connectivity(&mut self) {
        if !self.config.enabled {
            info!("Python bridge disabled in configuration");
            return;
        }

        info!("🔍 Testing Python service connectivity at {}", self.config.endpoint);
        
        match timeout(
            Duration::from_secs(5),
            self.client.get(&format!("{}/health", self.config.endpoint)).send()
        ).await {
            Ok(Ok(response)) if response.status().is_success() => {
                self.python_available = true;
                info!("✅ Python vision service is available");
            }
            Ok(Ok(response)) => {
                warn!("⚠️ Python service responded with status: {}", response.status());
                self.python_available = false;
            }
            Ok(Err(e)) => {
                warn!("⚠️ Python service connection failed: {}", e);
                self.python_available = false;
            }
            Err(_) => {
                warn!("⚠️ Python service connection timed out");
                self.python_available = false;
            }
        }
    }

    /// Check if Python bridge is ready
    pub async fn is_ready(&self) -> bool {
        self.config.enabled && self.python_available
    }

    /// Generate image using Python Stable Diffusion service
    pub async fn generate_image(
        &self,
        prompt: &str,
        parameters: &GenerationParameters,
    ) -> Result<GeneratedImage> {
        if !self.python_available {
            return self.generate_fallback_image(prompt, parameters).await;
        }

        debug!("🎨 Generating image via Python service: {}", prompt);

        let request_body = json!({
            "prompt": prompt,
            "width": parameters.width.unwrap_or(512),
            "height": parameters.height.unwrap_or(512),
            "steps": parameters.steps.unwrap_or(20),
            "guidance_scale": parameters.guidance_scale.unwrap_or(7.5),
            "seed": parameters.seed,
            "negative_prompt": parameters.negative_prompt
        });

        let response = timeout(
            Duration::from_secs(self.config.timeout_seconds),
            self.client
                .post(&format!("{}/generate", self.config.endpoint))
                .header("Content-Type", "application/json")
                .json(&request_body)
                .send()
        ).await
        .context("Python service request timed out")?
        .context("Failed to send request to Python service")?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!("Python service error: {}", error_text));
        }

        let response_json: serde_json::Value = response.json().await
            .context("Failed to parse Python service response")?;

        // Parse the response into our GeneratedImage struct
        Ok(GeneratedImage {
            id: uuid::Uuid::new_v4().to_string(),
            base64: response_json["image_base64"]
                .as_str()
                .unwrap_or("")
                .to_string(),
            prompt: prompt.to_string(),
            model: response_json["model"]
                .as_str()
                .unwrap_or("sd3b")
                .to_string(),
            parameters: parameters.clone(),
            quality: ImageQuality {
                clip_score: response_json["quality"]["clip_score"]
                    .as_f64()
                    .unwrap_or(0.5) as f32,
                aesthetic_score: response_json["quality"]["aesthetic_score"]
                    .as_f64()
                    .unwrap_or(0.5) as f32,
                safety_score: response_json["quality"]["safety_score"]
                    .as_f64()
                    .unwrap_or(0.9) as f32,
                prompt_alignment: response_json["quality"]["prompt_alignment"]
                    .as_f64()
                    .unwrap_or(0.7) as f32,
            },
            timestamp: chrono::Utc::now(),
        })
    }

    /// Refine image using Python SDXL service
    pub async fn refine_image(
        &self,
        image_data: &[u8],
        parameters: &RefinementParameters,
    ) -> Result<RefinedImage> {
        if !self.python_available {
            return self.generate_fallback_refined_image(image_data, parameters).await;
        }

        debug!("✨ Refining image via Python service");

        let base64_image = base64::encode(image_data);
        
        let request_body = json!({
            "image_base64": base64_image,
            "strength": parameters.strength.unwrap_or(0.8),
            "steps": parameters.steps.unwrap_or(20),
            "guidance": parameters.guidance.unwrap_or(7.5),
            "backend": parameters.backend.as_ref().unwrap_or(&"mlx".to_string())
        });

        let response = timeout(
            Duration::from_secs(self.config.timeout_seconds),
            self.client
                .post(&format!("{}/refine", self.config.endpoint))
                .header("Content-Type", "application/json")
                .json(&request_body)
                .send()
        ).await
        .context("Python service request timed out")?
        .context("Failed to send request to Python service")?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!("Python refinement error: {}", error_text));
        }

        let response_json: serde_json::Value = response.json().await
            .context("Failed to parse Python service response")?;

        Ok(RefinedImage {
            id: uuid::Uuid::new_v4().to_string(),
            base64: response_json["refined_base64"]
                .as_str()
                .unwrap_or("")
                .to_string(),
            original_prompt: "refinement".to_string(),
            model: response_json["model"]
                .as_str()
                .unwrap_or("sdxl-refiner")
                .to_string(),
            parameters: parameters.clone(),
            improvement_score: response_json["improvement_score"]
                .as_f64()
                .unwrap_or(0.5) as f32,
            timestamp: chrono::Utc::now(),
        })
    }

    /// Visual reasoning using Python LLaVA service
    pub async fn reason_about_image(
        &self,
        image_data: &[u8],
        question: &str,
        analysis: &VisionAnalysis,
    ) -> Result<ReasoningResult> {
        if !self.python_available {
            return self.generate_fallback_reasoning(question, analysis).await;
        }

        debug!("🧠 Reasoning about image via Python service");

        let base64_image = base64::encode(image_data);
        
        let request_body = json!({
            "image_base64": base64_image,
            "question": question,
            "context": {
                "objects": analysis.objects,
                "scene": analysis.scene,
                "confidence": analysis.confidence
            }
        });

        let response = timeout(
            Duration::from_secs(self.config.timeout_seconds),
            self.client
                .post(&format!("{}/reason", self.config.endpoint))
                .header("Content-Type", "application/json")
                .json(&request_body)
                .send()
        ).await
        .context("Python service request timed out")?
        .context("Failed to send request to Python service")?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!("Python reasoning error: {}", error_text));
        }

        let response_json: serde_json::Value = response.json().await
            .context("Failed to parse Python service response")?;

        Ok(ReasoningResult {
            answer: response_json["answer"]
                .as_str()
                .unwrap_or("Unable to analyze")
                .to_string(),
            confidence: response_json["confidence"]
                .as_f64()
                .unwrap_or(0.5) as f32,
            reasoning: response_json["reasoning"]
                .as_str()
                .unwrap_or("Analysis based on image content")
                .to_string(),
        })
    }

    /// Generate fallback image when Python service is unavailable
    async fn generate_fallback_image(
        &self,
        prompt: &str,
        parameters: &GenerationParameters,
    ) -> Result<GeneratedImage> {
        warn!("🔄 Python service unavailable, generating fallback image");

        // Create a simple placeholder image
        let width = parameters.width.unwrap_or(512);
        let height = parameters.height.unwrap_or(512);
        
        // Generate a simple pattern based on the prompt hash
        let prompt_hash = prompt.chars().map(|c| c as u32).sum::<u32>();
        let color_r = ((prompt_hash % 255) as u8).saturating_add(50);
        let color_g = (((prompt_hash / 255) % 255) as u8).saturating_add(50);
        let color_b = (((prompt_hash / 65025) % 255) as u8).saturating_add(50);

        let img = image::RgbImage::from_fn(width, height, |x, y| {
            let pattern = ((x + y) % 50) as f32 / 50.0;
            image::Rgb([
                (color_r as f32 * pattern) as u8,
                (color_g as f32 * pattern) as u8,
                (color_b as f32 * pattern) as u8,
            ])
        });

        // Convert to base64
        let mut buffer = Vec::new();
        let mut cursor = std::io::Cursor::new(&mut buffer);
        img.write_to(&mut cursor, image::ImageFormat::Png)
            .context("Failed to encode fallback image")?;
        
        let base64_image = base64::encode(&buffer);

        Ok(GeneratedImage {
            id: uuid::Uuid::new_v4().to_string(),
            base64: base64_image,
            prompt: format!("Fallback for: {}", prompt),
            model: "fallback-generator".to_string(),
            parameters: parameters.clone(),
            quality: ImageQuality {
                clip_score: 0.3,
                aesthetic_score: 0.4,
                safety_score: 1.0,
                prompt_alignment: 0.2,
            },
            timestamp: chrono::Utc::now(),
        })
    }

    /// Generate fallback refined image
    async fn generate_fallback_refined_image(
        &self,
        image_data: &[u8],
        parameters: &RefinementParameters,
    ) -> Result<RefinedImage> {
        warn!("🔄 Python service unavailable, applying basic image enhancement");

        // Load the original image
        let img = image::load_from_memory(image_data)
            .context("Failed to decode image for refinement")?
            .to_rgb8();

        // Apply basic enhancement (brightness/contrast adjustment)
        let enhanced = image::RgbImage::from_fn(img.width(), img.height(), |x, y| {
            let pixel = img.get_pixel(x, y);
            let strength = parameters.strength.unwrap_or(0.5);
            
            // Simple brightness/contrast enhancement
            let enhance_factor = 1.0 + (strength * 0.2);
            image::Rgb([
                (pixel[0] as f32 * enhance_factor).min(255.0) as u8,
                (pixel[1] as f32 * enhance_factor).min(255.0) as u8,
                (pixel[2] as f32 * enhance_factor).min(255.0) as u8,
            ])
        });

        // Convert to base64
        let mut buffer = Vec::new();
        let mut cursor = std::io::Cursor::new(&mut buffer);
        enhanced.write_to(&mut cursor, image::ImageFormat::Png)
            .context("Failed to encode enhanced image")?;
        
        let base64_image = base64::encode(&buffer);

        Ok(RefinedImage {
            id: uuid::Uuid::new_v4().to_string(),
            base64: base64_image,
            original_prompt: "fallback-refinement".to_string(),
            model: "fallback-enhancer".to_string(),
            parameters: parameters.clone(),
            improvement_score: 0.3, // Conservative estimate
            timestamp: chrono::Utc::now(),
        })
    }

    /// Generate fallback reasoning response
    async fn generate_fallback_reasoning(
        &self,
        question: &str,
        analysis: &VisionAnalysis,
    ) -> Result<ReasoningResult> {
        warn!("🔄 Python service unavailable, generating rule-based reasoning");

        // Simple rule-based reasoning based on detected objects and scene
        let mut answer = String::new();
        let mut reasoning = String::new();

        if !analysis.objects.is_empty() {
            let object_names: Vec<&str> = analysis.objects.iter()
                .map(|obj| obj.class.as_str())
                .collect();
            
            answer = format!("I can see {} in this image", object_names.join(", "));
            reasoning = format!("Based on object detection, I identified {} objects with an average confidence of {:.2}", 
                              analysis.objects.len(), 
                              analysis.confidence);
        } else {
            answer = format!("This appears to be {} with {} characteristics", 
                           analysis.scene.description,
                           analysis.scene.mood);
            reasoning = "Analysis based on scene characteristics and visual features".to_string();
        }

        // Try to incorporate the question
        if question.to_lowercase().contains("how many") {
            answer = format!("I can identify {} objects in this image", analysis.objects.len());
        } else if question.to_lowercase().contains("what color") {
            answer = format!("The image has {} tones", analysis.scene.mood);
        }

        Ok(ReasoningResult {
            answer,
            confidence: analysis.confidence * 0.7, // Lower confidence for fallback
            reasoning,
        })
    }

    /// Periodically refresh Python service availability
    pub async fn refresh_availability(&mut self) {
        self.test_connectivity().await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_python_bridge_creation() {
        let config = PythonConfig {
            enabled: false,
            endpoint: "http://localhost:8000".to_string(),
            timeout_seconds: 30,
        };
        
        let bridge = PythonBridge::new(&config).await;
        assert!(bridge.is_ok());
    }

    #[tokio::test]
    async fn test_fallback_image_generation() {
        let config = PythonConfig {
            enabled: false,
            endpoint: "http://localhost:8000".to_string(),
            timeout_seconds: 30,
        };
        
        let bridge = PythonBridge::new(&config).await.unwrap();
        let parameters = GenerationParameters::default();
        
        let result = bridge.generate_fallback_image("test prompt", &parameters).await;
        assert!(result.is_ok());
        
        let image = result.unwrap();
        assert!(!image.base64.is_empty());
        assert_eq!(image.model, "fallback-generator");
    }
}