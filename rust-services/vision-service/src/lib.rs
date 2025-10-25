use pyo3::prelude::*;
use pyo3::types::PyDict;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisionRequest {
    pub image_data: Option<String>,
    pub image_url: Option<String>,
    pub operation: String,
    pub parameters: Option<HashMap<String, serde_json::Value>>,
    pub user_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisionResponse {
    pub success: bool,
    pub result: Option<serde_json::Value>,
    pub metadata: HashMap<String, serde_json::Value>,
    pub processing_time: f64,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OCRRequest {
    pub image_data: Option<String>,
    pub image_url: Option<String>,
    pub language: Option<String>,
    pub user_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OCRResponse {
    pub text: String,
    pub confidence: f64,
    pub bounding_boxes: Vec<BoundingBox>,
    pub processing_time: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoundingBox {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub text: String,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageAnalysisRequest {
    pub image_data: Option<String>,
    pub image_url: Option<String>,
    pub analysis_type: String,
    pub user_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageAnalysisResponse {
    pub analysis: serde_json::Value,
    pub confidence: f64,
    pub processing_time: f64,
}

pub struct VisionService {
    python_runtime: Py<PyAny>,
    processing_jobs: Arc<RwLock<HashMap<String, VisionResponse>>>,
}

impl VisionService {
    pub fn new() -> Self {
        Python::with_gil(|py| {
            let sys = py.import("sys")?;
            let path = sys.getattr("path")?;
            path.call_method1("append", ("python-services",))?;
            
            let vision_module = py.import("vision_service")?;
            let vision_class = vision_module.getattr("VisionService")?;
            let vision_instance = vision_class.call0()?;
            
            Ok(Self {
                python_runtime: vision_instance.into(),
                processing_jobs: Arc::new(RwLock::new(HashMap::new())),
            })
        }).unwrap_or_else(|_| {
            Self {
                python_runtime: Python::with_gil(|py| py.None().into()),
                processing_jobs: Arc::new(RwLock::new(HashMap::new())),
            }
        })
    }

    pub async fn process_image(&self, request: VisionRequest) -> Result<VisionResponse, Box<dyn std::error::Error>> {
        let start_time = std::time::Instant::now();
        let job_id = uuid::Uuid::new_v4().to_string();
        
        Python::with_gil(|py| {
            let vision_service = self.python_runtime.as_ref(py);
            
            // Create vision request dict
            let mut request_dict = PyDict::new(py);
            if let Some(image_data) = &request.image_data {
                request_dict.set_item("image_data", image_data)?;
            }
            if let Some(image_url) = &request.image_url {
                request_dict.set_item("image_url", image_url)?;
            }
            request_dict.set_item("operation", &request.operation)?;
            request_dict.set_item("user_id", &request.user_id)?;
            
            if let Some(parameters) = &request.parameters {
                let mut params_dict = PyDict::new(py);
                for (key, value) in parameters {
                    let py_value = serde_json::to_value(value)?;
                    params_dict.set_item(key, py_value)?;
                }
                request_dict.set_item("parameters", params_dict)?;
            }
            
            // Call Python vision processing method
            let response = vision_service.call_method1("process_image", (request_dict,))?;
            
            // Extract response data
            let success: bool = response.getattr("success")?.extract()?;
            let result: Option<serde_json::Value> = response.getattr("result")?.extract().ok();
            let error: Option<String> = response.getattr("error")?.extract().ok();
            
            let mut metadata = HashMap::new();
            let metadata_dict: &PyDict = response.getattr("metadata")?.extract()?;
            for (key, value) in metadata_dict.iter() {
                let key_str: String = key.extract()?;
                let value_json: serde_json::Value = value.extract()?;
                metadata.insert(key_str, value_json);
            }
            
            let vision_response = VisionResponse {
                success,
                result,
                metadata,
                processing_time: start_time.elapsed().as_secs_f64(),
                error,
            };
            
            // Store the processing job
            let jobs = self.processing_jobs.clone();
            let response_clone = vision_response.clone();
            tokio::spawn(async move {
                let mut jobs_guard = jobs.write().await;
                jobs_guard.insert(job_id, response_clone);
            });
            
            Ok(vision_response)
        })
    }

    pub async fn perform_ocr(&self, request: OCRRequest) -> Result<OCRResponse, Box<dyn std::error::Error>> {
        let start_time = std::time::Instant::now();
        
        Python::with_gil(|py| {
            let vision_service = self.python_runtime.as_ref(py);
            
            // Create OCR request dict
            let mut request_dict = PyDict::new(py);
            if let Some(image_data) = &request.image_data {
                request_dict.set_item("image_data", image_data)?;
            }
            if let Some(image_url) = &request.image_url {
                request_dict.set_item("image_url", image_url)?;
            }
            if let Some(language) = &request.language {
                request_dict.set_item("language", language)?;
            }
            request_dict.set_item("user_id", &request.user_id)?;
            
            // Call Python OCR method
            let response = vision_service.call_method1("perform_ocr", (request_dict,))?;
            
            // Extract response data
            let text: String = response.getattr("text")?.extract()?;
            let confidence: f64 = response.getattr("confidence")?.extract()?;
            
            let bounding_boxes_list: Vec<PyObject> = response.getattr("bounding_boxes")?.extract()?;
            let mut bounding_boxes = Vec::new();
            
            for bbox_obj in bounding_boxes_list {
                let bbox_dict: &PyDict = bbox_obj.extract(py)?;
                
                let bbox = BoundingBox {
                    x: bbox_dict.get_item("x")?.extract()?,
                    y: bbox_dict.get_item("y")?.extract()?,
                    width: bbox_dict.get_item("width")?.extract()?,
                    height: bbox_dict.get_item("height")?.extract()?,
                    text: bbox_dict.get_item("text")?.extract()?,
                    confidence: bbox_dict.get_item("confidence")?.extract()?,
                };
                
                bounding_boxes.push(bbox);
            }
            
            Ok(OCRResponse {
                text,
                confidence,
                bounding_boxes,
                processing_time: start_time.elapsed().as_secs_f64(),
            })
        })
    }

    pub async fn analyze_image(&self, request: ImageAnalysisRequest) -> Result<ImageAnalysisResponse, Box<dyn std::error::Error>> {
        let start_time = std::time::Instant::now();
        
        Python::with_gil(|py| {
            let vision_service = self.python_runtime.as_ref(py);
            
            // Create analysis request dict
            let mut request_dict = PyDict::new(py);
            if let Some(image_data) = &request.image_data {
                request_dict.set_item("image_data", image_data)?;
            }
            if let Some(image_url) = &request.image_url {
                request_dict.set_item("image_url", image_url)?;
            }
            request_dict.set_item("analysis_type", &request.analysis_type)?;
            request_dict.set_item("user_id", &request.user_id)?;
            
            // Call Python analysis method
            let response = vision_service.call_method1("analyze_image", (request_dict,))?;
            
            // Extract response data
            let analysis: serde_json::Value = response.getattr("analysis")?.extract()?;
            let confidence: f64 = response.getattr("confidence")?.extract()?;
            
            Ok(ImageAnalysisResponse {
                analysis,
                confidence,
                processing_time: start_time.elapsed().as_secs_f64(),
            })
        })
    }

    pub async fn get_processing_job(&self, job_id: &str) -> Option<VisionResponse> {
        let jobs = self.processing_jobs.read().await;
        jobs.get(job_id).cloned()
    }

    pub async fn get_health_status(&self) -> HashMap<String, serde_json::Value> {
        let mut status = HashMap::new();
        status.insert("status".to_string(), serde_json::Value::String("healthy".to_string()));
        status.insert("service".to_string(), serde_json::Value::String("vision-service".to_string()));
        status.insert("python_bridge".to_string(), serde_json::Value::Bool(true));
        
        let jobs = self.processing_jobs.read().await;
        status.insert("active_jobs".to_string(), serde_json::Value::Number(serde_json::Number::from(jobs.len())));
        
        status
    }
}