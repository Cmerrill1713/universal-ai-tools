use crate::error::{DSPyError, Result};
use crate::service::DSPyOrchestrator;
use crate::config::Config;
use std::sync::Arc;
use tonic::{Request, Response, Status};
use tracing::{info, error, instrument};

// Include the generated proto code
pub mod dspy_service {
    tonic::include_proto!("dspy_service");
}

use dspy_service::{
    dspy_service_server::{DspyService, DspyServiceServer},
    *,
};

pub struct DSPyGrpcService {
    service: Arc<DSPyOrchestrator>,
    config: Config,
}

impl DSPyGrpcService {
    pub fn new(service: Arc<DSPyOrchestrator>, config: Config) -> Self {
        Self { service, config }
    }

    pub fn into_server(self) -> DspyServiceServer<Self> {
        DspyServiceServer::new(self)
    }
}

#[tonic::async_trait]
impl DspyService for DSPyGrpcService {
    #[instrument(skip(self))]
    async fn orchestrate(
        &self,
        request: Request<OrchestrationRequest>,
    ) -> Result<Response<OrchestrationResponse>, Status> {
        let req = request.into_inner();
        info!("Processing orchestration request: {}", req.task);

        let orchestration_req = crate::service::OrchestrationRequest {
            task: req.task,
            context: req.context,
            user_id: req.user_id,
            priority: req.priority,
            metadata: req.metadata,
        };

        match self.service.orchestrate(orchestration_req).await {
            Ok(response) => {
                let grpc_response = OrchestrationResponse {
                    id: response.id,
                    status: response.status,
                    result: response.result,
                    reasoning: response.reasoning,
                    confidence: response.confidence,
                    agents_used: response.agents_used,
                    processing_time: response.processing_time,
                    created_at: response.created_at.timestamp(),
                    metadata: response.metadata,
                };
                Ok(Response::new(grpc_response))
            }
            Err(e) => {
                error!("Orchestration failed: {}", e);
                Err(Status::internal(e.to_string()))
            }
        }
    }

    #[instrument(skip(self))]
    async fn get_agents(
        &self,
        _request: Request<GetAgentsRequest>,
    ) -> Result<Response<GetAgentsResponse>, Status> {
        match self.service.get_agents().await {
            Ok(agents) => {
                let grpc_agents: Vec<AgentInfo> = agents
                    .into_iter()
                    .map(|agent| AgentInfo {
                        id: agent.id,
                        name: agent.name,
                        description: agent.description,
                        capabilities: agent.capabilities,
                        status: agent.status,
                        last_used: agent.last_used.map(|t| t.timestamp()),
                    })
                    .collect();

                Ok(Response::new(GetAgentsResponse { agents: grpc_agents }))
            }
            Err(e) => {
                error!("Failed to get agents: {}", e);
                Err(Status::internal(e.to_string()))
            }
        }
    }

    #[instrument(skip(self))]
    async fn extract_knowledge(
        &self,
        request: Request<KnowledgeRequest>,
    ) -> Result<Response<KnowledgeResponse>, Status> {
        let req = request.into_inner();
        info!("Extracting knowledge for query: {}", req.query);

        let knowledge_req = crate::service::KnowledgeRequest {
            query: req.query,
            context: req.context,
            user_id: req.user_id,
            knowledge_type: req.knowledge_type,
        };

        match self.service.extract_knowledge(knowledge_req).await {
            Ok(response) => {
                let grpc_response = KnowledgeResponse {
                    knowledge: response.knowledge
                        .into_iter()
                        .map(|k| k.to_string())
                        .collect(),
                    sources: response.sources,
                    confidence: response.confidence,
                    processing_time: response.processing_time,
                };
                Ok(Response::new(grpc_response))
            }
            Err(e) => {
                error!("Knowledge extraction failed: {}", e);
                Err(Status::internal(e.to_string()))
            }
        }
    }

    #[instrument(skip(self))]
    async fn create_development_pipeline(
        &self,
        request: Request<DevelopmentPipelineRequest>,
    ) -> Result<Response<DevelopmentPipelineResponse>, Status> {
        let req = request.into_inner();
        info!("Creating development pipeline for task: {}", req.task);

        let pipeline_req = crate::service::DevelopmentPipelineRequest {
            task: req.task,
            requirements: req.requirements,
            user_id: req.user_id,
            priority: req.priority,
        };

        match self.service.create_development_pipeline(pipeline_req).await {
            Ok(response) => {
                let grpc_steps: Vec<PipelineStep> = response.steps
                    .into_iter()
                    .map(|step| PipelineStep {
                        id: step.id,
                        name: step.name,
                        description: step.description,
                        status: step.status,
                        dependencies: step.dependencies,
                        estimated_duration: step.estimated_duration,
                    })
                    .collect();

                let grpc_response = DevelopmentPipelineResponse {
                    pipeline_id: response.pipeline_id,
                    steps: grpc_steps,
                    estimated_duration: response.estimated_duration,
                    status: response.status,
                    created_at: response.created_at.timestamp(),
                };
                Ok(Response::new(grpc_response))
            }
            Err(e) => {
                error!("Pipeline creation failed: {}", e);
                Err(Status::internal(e.to_string()))
            }
        }
    }

    #[instrument(skip(self))]
    async fn perform_cognitive_reasoning(
        &self,
        request: Request<CognitiveReasoningRequest>,
    ) -> Result<Response<CognitiveReasoningResponse>, Status> {
        let req = request.into_inner();
        info!("Performing cognitive reasoning for problem: {}", req.problem);

        let reasoning_req = crate::service::CognitiveReasoningRequest {
            problem: req.problem,
            context: req.context,
            reasoning_type: req.reasoning_type,
            user_id: req.user_id,
        };

        match self.service.perform_cognitive_reasoning(reasoning_req).await {
            Ok(response) => {
                let grpc_steps: Vec<ReasoningStep> = response.steps
                    .into_iter()
                    .map(|step| ReasoningStep {
                        step: step.step as i32,
                        description: step.description,
                        result: step.result,
                        confidence: step.confidence,
                    })
                    .collect();

                let grpc_response = CognitiveReasoningResponse {
                    reasoning: response.reasoning,
                    conclusion: response.conclusion,
                    confidence: response.confidence,
                    steps: grpc_steps,
                    processing_time: response.processing_time,
                };
                Ok(Response::new(grpc_response))
            }
            Err(e) => {
                error!("Cognitive reasoning failed: {}", e);
                Err(Status::internal(e.to_string()))
            }
        }
    }

    #[instrument(skip(self))]
    async fn get_orchestration(
        &self,
        request: Request<GetOrchestrationRequest>,
    ) -> Result<Response<OrchestrationResponse>, Status> {
        let req = request.into_inner();
        info!("Getting orchestration: {}", req.orchestration_id);

        match self.service.get_orchestration(&req.orchestration_id).await {
            Some(response) => {
                let grpc_response = OrchestrationResponse {
                    id: response.id,
                    status: response.status,
                    result: response.result,
                    reasoning: response.reasoning,
                    confidence: response.confidence,
                    agents_used: response.agents_used,
                    processing_time: response.processing_time,
                    created_at: response.created_at.timestamp(),
                    metadata: response.metadata,
                };
                Ok(Response::new(grpc_response))
            }
            None => Err(Status::not_found("Orchestration not found")),
        }
    }

    #[instrument(skip(self))]
    async fn get_health(
        &self,
        _request: Request<HealthRequest>,
    ) -> Result<Response<HealthResponse>, Status> {
        let health_status = self.service.get_health_status().await;
        let status = health_status
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();

        let details: std::collections::HashMap<String, String> = health_status
            .into_iter()
            .map(|(k, v)| (k, v.to_string()))
            .collect();

        Ok(Response::new(HealthResponse { status, details }))
    }
}