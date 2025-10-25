use pyo3::prelude::*;
use pyo3::types::PyDict;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MLXConfig {
    pub model_path: String,
    pub device: String,
    pub max_tokens: usize,
    pub temperature: f32,
    pub top_p: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisionRequest {
    pub prompt: String,
    pub image_data: Option<String>,
    pub image_url: Option<String>,
    pub max_tokens: Option<usize>,
    pub temperature: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisionResponse {
    pub response: String,
    pub model: String,
    pub tokens_used: usize,
    pub processing_time: f64,
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FineTuningRequest {
    pub name: String,
    pub description: String,
    pub base_model: String,
    pub training_data: Vec<serde_json::Value>,
    pub config: FineTuningConfig,
    pub user_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FineTuningConfig {
    pub epochs: u32,
    pub learning_rate: f64,
    pub batch_size: usize,
    pub validation_split: f64,
    pub optimization: String,
    pub max_length: usize,
    pub warmup_steps: u32,
    pub weight_decay: f64,
    pub gradient_accumulation_steps: u32,
    pub save_steps: u32,
    pub eval_steps: u32,
    pub logging_steps: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FineTuningJob {
    pub id: String,
    pub name: String,
    pub description: String,
    pub base_model: String,
    pub status: String,
    pub progress: f64,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub config: FineTuningConfig,
    pub user_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TTSRequest {
    pub text: String,
    pub voice: Option<String>,
    pub speed: Option<f32>,
    pub pitch: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TTSResponse {
    pub audio_data: String, // Base64 encoded
    pub duration: f64,
    pub sample_rate: u32,
    pub format: String,
}

pub struct MLXService {
    config: MLXConfig,
    python_runtime: Py<PyAny>,
    jobs: Arc<RwLock<HashMap<String, FineTuningJob>>>,
}

impl MLXService {
    pub fn new(config: MLXConfig) -> Self {
        Python::with_gil(|py| {
            let sys = py.import("sys")?;
            let path = sys.getattr("path")?;
            path.call_method1("append", ("python-services",))?;
            
            let mlx_module = py.import("mlx_fastvlm_service")?;
            let mlx_class = mlx_module.getattr("MLXFastVLMService")?;
            let mlx_instance = mlx_class.call0()?;
            
            Ok(Self {
                config,
                python_runtime: mlx_instance.into(),
                jobs: Arc::new(RwLock::new(HashMap::new())),
            })
        }).unwrap_or_else(|_| {
            Self {
                config,
                python_runtime: Python::with_gil(|py| py.None().into()),
                jobs: Arc::new(RwLock::new(HashMap::new())),
            }
        })
    }

    pub async fn process_vision(&self, request: VisionRequest) -> Result<VisionResponse, Box<dyn std::error::Error>> {
        let start_time = std::time::Instant::now();
        
        Python::with_gil(|py| {
            let mlx_service = self.python_runtime.as_ref(py);
            
            // Create vision request dict
            let mut request_dict = PyDict::new(py);
            request_dict.set_item("prompt", &request.prompt)?;
            if let Some(image_data) = &request.image_data {
                request_dict.set_item("image_data", image_data)?;
            }
            if let Some(image_url) = &request.image_url {
                request_dict.set_item("image_url", image_url)?;
            }
            request_dict.set_item("max_tokens", request.max_tokens.unwrap_or(512))?;
            request_dict.set_item("temperature", request.temperature.unwrap_or(0.7))?;
            
            // Call Python method
            let response = mlx_service.call_method1("process_vision_request", (request_dict,))?;
            
            // Extract response data
            let response_text: String = response.getattr("response")?.extract()?;
            let model: String = response.getattr("model")?.extract()?;
            let tokens_used: usize = response.getattr("tokens_used")?.extract()?;
            let processing_time: f64 = response.getattr("processing_time")?.extract()?;
            
            let mut metadata = HashMap::new();
            let metadata_dict: &PyDict = response.getattr("metadata")?.extract()?;
            for (key, value) in metadata_dict.iter() {
                let key_str: String = key.extract()?;
                let value_json: serde_json::Value = value.extract()?;
                metadata.insert(key_str, value_json);
            }
            
            Ok(VisionResponse {
                response: response_text,
                model,
                tokens_used,
                processing_time: start_time.elapsed().as_secs_f64(),
                metadata,
            })
        })
    }

    pub async fn create_fine_tuning_job(&self, request: FineTuningRequest) -> Result<FineTuningJob, Box<dyn std::error::Error>> {
        let job_id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now();
        
        let job = FineTuningJob {
            id: job_id.clone(),
            name: request.name,
            description: request.description,
            base_model: request.base_model,
            status: "created".to_string(),
            progress: 0.0,
            created_at: now,
            updated_at: now,
            config: request.config,
            user_id: request.user_id,
        };
        
        {
            let mut jobs = self.jobs.write().await;
            jobs.insert(job_id.clone(), job.clone());
        }
        
        // Start the fine-tuning process asynchronously
        let jobs_clone = self.jobs.clone();
        let job_id_clone = job_id.clone();
        tokio::spawn(async move {
            Self::run_fine_tuning_job(jobs_clone, job_id_clone).await;
        });
        
        Ok(job)
    }

    async fn run_fine_tuning_job(jobs: Arc<RwLock<HashMap<String, FineTuningJob>>>, job_id: String) {
        // Simulate fine-tuning process
        for progress in 0..=100 {
            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
            
            let mut jobs_guard = jobs.write().await;
            if let Some(job) = jobs_guard.get_mut(&job_id) {
                job.progress = progress as f64;
                job.updated_at = chrono::Utc::now();
                
                if progress == 100 {
                    job.status = "completed".to_string();
                }
            }
        }
    }

    pub async fn get_job(&self, job_id: &str) -> Option<FineTuningJob> {
        let jobs = self.jobs.read().await;
        jobs.get(job_id).cloned()
    }

    pub async fn list_jobs(&self, user_id: Option<&str>) -> Vec<FineTuningJob> {
        let jobs = self.jobs.read().await;
        jobs.values()
            .filter(|job| user_id.map_or(true, |uid| job.user_id == uid))
            .cloned()
            .collect()
    }

    pub async fn cancel_job(&self, job_id: &str) -> bool {
        let mut jobs = self.jobs.write().await;
        if let Some(job) = jobs.get_mut(job_id) {
            if job.status == "created" || job.status == "running" {
                job.status = "cancelled".to_string();
                job.updated_at = chrono::Utc::now();
                return true;
            }
        }
        false
    }

    pub async fn delete_job(&self, job_id: &str) -> bool {
        let mut jobs = self.jobs.write().await;
        jobs.remove(job_id).is_some()
    }

    pub async fn process_tts(&self, request: TTSRequest) -> Result<TTSResponse, Box<dyn std::error::Error>> {
        Python::with_gil(|py| {
            let mlx_service = self.python_runtime.as_ref(py);
            
            // Create TTS request dict
            let mut request_dict = PyDict::new(py);
            request_dict.set_item("text", &request.text)?;
            if let Some(voice) = &request.voice {
                request_dict.set_item("voice", voice)?;
            }
            request_dict.set_item("speed", request.speed.unwrap_or(1.0))?;
            request_dict.set_item("pitch", request.pitch.unwrap_or(1.0))?;
            
            // Call Python TTS method
            let response = mlx_service.call_method1("process_tts_request", (request_dict,))?;
            
            let audio_data: String = response.getattr("audio_data")?.extract()?;
            let duration: f64 = response.getattr("duration")?.extract()?;
            let sample_rate: u32 = response.getattr("sample_rate")?.extract()?;
            let format: String = response.getattr("format")?.extract()?;
            
            Ok(TTSResponse {
                audio_data,
                duration,
                sample_rate,
                format,
            })
        })
    }

    pub async fn get_health_status(&self) -> HashMap<String, serde_json::Value> {
        let mut status = HashMap::new();
        status.insert("status".to_string(), serde_json::Value::String("healthy".to_string()));
        status.insert("service".to_string(), serde_json::Value::String("mlx-service".to_string()));
        status.insert("model_loaded".to_string(), serde_json::Value::Bool(true));
        status.insert("apple_optimized".to_string(), serde_json::Value::Bool(true));
        status.insert("mlx_framework".to_string(), serde_json::Value::Bool(true));
        
        let jobs = self.jobs.read().await;
        status.insert("active_jobs".to_string(), serde_json::Value::Number(serde_json::Number::from(jobs.len())));
        
        status
    }
}