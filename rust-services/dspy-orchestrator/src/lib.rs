use pyo3::prelude::*;
use pyo3::types::PyDict;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrchestrationRequest {
    pub task: String,
    pub context: Option<String>,
    pub user_id: String,
    pub priority: Option<String>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrchestrationResponse {
    pub id: String,
    pub status: String,
    pub result: Option<serde_json::Value>,
    pub reasoning: Option<String>,
    pub confidence: f64,
    pub agents_used: Vec<String>,
    pub processing_time: f64,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub capabilities: Vec<String>,
    pub status: String,
    pub last_used: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeRequest {
    pub query: String,
    pub context: Option<String>,
    pub user_id: String,
    pub knowledge_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeResponse {
    pub knowledge: Vec<serde_json::Value>,
    pub sources: Vec<String>,
    pub confidence: f64,
    pub processing_time: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DevelopmentPipelineRequest {
    pub task: String,
    pub requirements: Vec<String>,
    pub user_id: String,
    pub priority: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DevelopmentPipelineResponse {
    pub pipeline_id: String,
    pub steps: Vec<PipelineStep>,
    pub estimated_duration: f64,
    pub status: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineStep {
    pub id: String,
    pub name: String,
    pub description: String,
    pub status: String,
    pub dependencies: Vec<String>,
    pub estimated_duration: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CognitiveReasoningRequest {
    pub problem: String,
    pub context: Option<String>,
    pub reasoning_type: Option<String>,
    pub user_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CognitiveReasoningResponse {
    pub reasoning: String,
    pub conclusion: String,
    pub confidence: f64,
    pub steps: Vec<ReasoningStep>,
    pub processing_time: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReasoningStep {
    pub step: u32,
    pub description: String,
    pub result: String,
    pub confidence: f64,
}

pub struct DSPyOrchestrator {
    python_runtime: Py<PyAny>,
    orchestrations: Arc<RwLock<HashMap<String, OrchestrationResponse>>>,
    agents: Arc<RwLock<HashMap<String, AgentInfo>>>,
}

impl DSPyOrchestrator {
    pub fn new() -> Self {
        Python::with_gil(|py| {
            let sys = py.import("sys")?;
            let path = sys.getattr("path")?;
            path.call_method1("append", ("python-services",))?;
            
            let dspy_module = py.import("dspy_orchestrator")?;
            let dspy_class = dspy_module.getattr("DSPyOrchestrator")?;
            let dspy_instance = dspy_class.call0()?;
            
            Ok(Self {
                python_runtime: dspy_instance.into(),
                orchestrations: Arc::new(RwLock::new(HashMap::new())),
                agents: Arc::new(RwLock::new(HashMap::new())),
            })
        }).unwrap_or_else(|_| {
            Self {
                python_runtime: Python::with_gil(|py| py.None().into()),
                orchestrations: Arc::new(RwLock::new(HashMap::new())),
                agents: Arc::new(RwLock::new(HashMap::new())),
            }
        })
    }

    pub async fn orchestrate(&self, request: OrchestrationRequest) -> Result<OrchestrationResponse, Box<dyn std::error::Error>> {
        let start_time = std::time::Instant::now();
        let orchestration_id = uuid::Uuid::new_v4().to_string();
        
        Python::with_gil(|py| {
            let dspy_service = self.python_runtime.as_ref(py);
            
            // Create orchestration request dict
            let mut request_dict = PyDict::new(py);
            request_dict.set_item("task", &request.task)?;
            if let Some(context) = &request.context {
                request_dict.set_item("context", context)?;
            }
            request_dict.set_item("user_id", &request.user_id)?;
            if let Some(priority) = &request.priority {
                request_dict.set_item("priority", priority)?;
            }
            
            // Call Python orchestration method
            let response = dspy_service.call_method1("orchestrate", (request_dict,))?;
            
            // Extract response data
            let status: String = response.getattr("status")?.extract()?;
            let result: Option<serde_json::Value> = response.getattr("result")?.extract().ok();
            let reasoning: Option<String> = response.getattr("reasoning")?.extract().ok();
            let confidence: f64 = response.getattr("confidence")?.extract()?;
            let agents_used: Vec<String> = response.getattr("agents_used")?.extract()?;
            
            let mut metadata = HashMap::new();
            let metadata_dict: &PyDict = response.getattr("metadata")?.extract()?;
            for (key, value) in metadata_dict.iter() {
                let key_str: String = key.extract()?;
                let value_json: serde_json::Value = value.extract()?;
                metadata.insert(key_str, value_json);
            }
            
            let orchestration_response = OrchestrationResponse {
                id: orchestration_id.clone(),
                status,
                result,
                reasoning,
                confidence,
                agents_used,
                processing_time: start_time.elapsed().as_secs_f64(),
                created_at: chrono::Utc::now(),
                metadata,
            };
            
            // Store the orchestration
            let orchestrations = self.orchestrations.clone();
            let response_clone = orchestration_response.clone();
            tokio::spawn(async move {
                let mut orchestrations_guard = orchestrations.write().await;
                orchestrations_guard.insert(orchestration_id, response_clone);
            });
            
            Ok(orchestration_response)
        })
    }

    pub async fn get_agents(&self) -> Result<Vec<AgentInfo>, Box<dyn std::error::Error>> {
        Python::with_gil(|py| {
            let dspy_service = self.python_runtime.as_ref(py);
            let agents_response = dspy_service.call_method0("get_agents")?;
            
            let agents_list: Vec<PyObject> = agents_response.extract()?;
            let mut agents = Vec::new();
            
            for agent_obj in agents_list {
                let agent_dict: &PyDict = agent_obj.extract(py)?;
                
                let agent = AgentInfo {
                    id: agent_dict.get_item("id")?.extract()?,
                    name: agent_dict.get_item("name")?.extract()?,
                    description: agent_dict.get_item("description")?.extract()?,
                    capabilities: agent_dict.get_item("capabilities")?.extract()?,
                    status: agent_dict.get_item("status")?.extract()?,
                    last_used: agent_dict.get_item("last_used")?.extract().ok(),
                };
                
                agents.push(agent);
            }
            
            Ok(agents)
        })
    }

    pub async fn extract_knowledge(&self, request: KnowledgeRequest) -> Result<KnowledgeResponse, Box<dyn std::error::Error>> {
        let start_time = std::time::Instant::now();
        
        Python::with_gil(|py| {
            let dspy_service = self.python_runtime.as_ref(py);
            
            // Create knowledge request dict
            let mut request_dict = PyDict::new(py);
            request_dict.set_item("query", &request.query)?;
            if let Some(context) = &request.context {
                request_dict.set_item("context", context)?;
            }
            request_dict.set_item("user_id", &request.user_id)?;
            if let Some(knowledge_type) = &request.knowledge_type {
                request_dict.set_item("knowledge_type", knowledge_type)?;
            }
            
            // Call Python knowledge extraction method
            let response = dspy_service.call_method1("extract_knowledge", (request_dict,))?;
            
            let knowledge: Vec<serde_json::Value> = response.getattr("knowledge")?.extract()?;
            let sources: Vec<String> = response.getattr("sources")?.extract()?;
            let confidence: f64 = response.getattr("confidence")?.extract()?;
            
            Ok(KnowledgeResponse {
                knowledge,
                sources,
                confidence,
                processing_time: start_time.elapsed().as_secs_f64(),
            })
        })
    }

    pub async fn create_development_pipeline(&self, request: DevelopmentPipelineRequest) -> Result<DevelopmentPipelineResponse, Box<dyn std::error::Error>> {
        let pipeline_id = uuid::Uuid::new_v4().to_string();
        
        Python::with_gil(|py| {
            let dspy_service = self.python_runtime.as_ref(py);
            
            // Create pipeline request dict
            let mut request_dict = PyDict::new(py);
            request_dict.set_item("task", &request.task)?;
            request_dict.set_item("requirements", &request.requirements)?;
            request_dict.set_item("user_id", &request.user_id)?;
            if let Some(priority) = &request.priority {
                request_dict.set_item("priority", priority)?;
            }
            
            // Call Python pipeline creation method
            let response = dspy_service.call_method1("create_development_pipeline", (request_dict,))?;
            
            let steps_list: Vec<PyObject> = response.getattr("steps")?.extract()?;
            let mut steps = Vec::new();
            
            for (i, step_obj) in steps_list.iter().enumerate() {
                let step_dict: &PyDict = step_obj.extract(py)?;
                
                let step = PipelineStep {
                    id: format!("step_{}", i + 1),
                    name: step_dict.get_item("name")?.extract()?,
                    description: step_dict.get_item("description")?.extract()?,
                    status: "pending".to_string(),
                    dependencies: step_dict.get_item("dependencies")?.extract().unwrap_or_default(),
                    estimated_duration: step_dict.get_item("estimated_duration")?.extract()?,
                };
                
                steps.push(step);
            }
            
            let estimated_duration: f64 = response.getattr("estimated_duration")?.extract()?;
            let status: String = response.getattr("status")?.extract()?;
            
            Ok(DevelopmentPipelineResponse {
                pipeline_id,
                steps,
                estimated_duration,
                status,
                created_at: chrono::Utc::now(),
            })
        })
    }

    pub async fn perform_cognitive_reasoning(&self, request: CognitiveReasoningRequest) -> Result<CognitiveReasoningResponse, Box<dyn std::error::Error>> {
        let start_time = std::time::Instant::now();
        
        Python::with_gil(|py| {
            let dspy_service = self.python_runtime.as_ref(py);
            
            // Create reasoning request dict
            let mut request_dict = PyDict::new(py);
            request_dict.set_item("problem", &request.problem)?;
            if let Some(context) = &request.context {
                request_dict.set_item("context", context)?;
            }
            if let Some(reasoning_type) = &request.reasoning_type {
                request_dict.set_item("reasoning_type", reasoning_type)?;
            }
            request_dict.set_item("user_id", &request.user_id)?;
            
            // Call Python cognitive reasoning method
            let response = dspy_service.call_method1("perform_cognitive_reasoning", (request_dict,))?;
            
            let reasoning: String = response.getattr("reasoning")?.extract()?;
            let conclusion: String = response.getattr("conclusion")?.extract()?;
            let confidence: f64 = response.getattr("confidence")?.extract()?;
            
            let steps_list: Vec<PyObject> = response.getattr("steps")?.extract()?;
            let mut steps = Vec::new();
            
            for (i, step_obj) in steps_list.iter().enumerate() {
                let step_dict: &PyDict = step_obj.extract(py)?;
                
                let step = ReasoningStep {
                    step: (i + 1) as u32,
                    description: step_dict.get_item("description")?.extract()?,
                    result: step_dict.get_item("result")?.extract()?,
                    confidence: step_dict.get_item("confidence")?.extract()?,
                };
                
                steps.push(step);
            }
            
            Ok(CognitiveReasoningResponse {
                reasoning,
                conclusion,
                confidence,
                steps,
                processing_time: start_time.elapsed().as_secs_f64(),
            })
        })
    }

    pub async fn get_orchestration(&self, orchestration_id: &str) -> Option<OrchestrationResponse> {
        let orchestrations = self.orchestrations.read().await;
        orchestrations.get(orchestration_id).cloned()
    }

    pub async fn get_health_status(&self) -> HashMap<String, serde_json::Value> {
        let mut status = HashMap::new();
        status.insert("status".to_string(), serde_json::Value::String("healthy".to_string()));
        status.insert("service".to_string(), serde_json::Value::String("dspy-orchestrator".to_string()));
        status.insert("python_bridge".to_string(), serde_json::Value::Bool(true));
        
        let orchestrations = self.orchestrations.read().await;
        status.insert("active_orchestrations".to_string(), serde_json::Value::Number(serde_json::Number::from(orchestrations.len())));
        
        status
    }
}