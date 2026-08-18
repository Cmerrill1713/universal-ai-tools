use crate::error::{MLXError, Result};
use crate::service::MLXService;
use crate::config::Config;
use std::sync::Arc;
use tonic::{Request, Response, Status};
use tracing::{info, error, instrument};

// Include the generated proto code
pub mod mlx_service {
    tonic::include_proto!("mlx_service");
}

use mlx_service::{
    mlx_service_server::{MlxService, MlxServiceServer},
    *,
};

pub struct MLXGrpcService {
    service: Arc<MLXService>,
    config: Config,
}

impl MLXGrpcService {
    pub fn new(service: Arc<MLXService>, config: Config) -> Self {
        Self { service, config }
    }

    pub fn into_server(self) -> MlxServiceServer<Self> {
        MlxServiceServer::new(self)
    }
}

#[tonic::async_trait]
impl MlxService for MLXGrpcService {
    #[instrument(skip(self))]
    async fn process_vision(
        &self,
        request: Request<VisionRequest>,
    ) -> Result<Response<VisionResponse>, Status> {
        let req = request.into_inner();
        info!("Processing vision request: {}", req.prompt);

        let vision_req = crate::service::VisionRequest {
            prompt: req.prompt,
            image_data: req.image_data,
            image_url: req.image_url,
            max_tokens: req.max_tokens.map(|t| t as usize),
            temperature: req.temperature,
        };

        match self.service.process_vision(vision_req).await {
            Ok(response) => {
                let grpc_response = VisionResponse {
                    response: response.response,
                    model: response.model,
                    tokens_used: response.tokens_used as i32,
                    processing_time: response.processing_time,
                    metadata: response.metadata,
                };
                Ok(Response::new(grpc_response))
            }
            Err(e) => {
                error!("Vision processing failed: {}", e);
                Err(Status::internal(e.to_string()))
            }
        }
    }

    #[instrument(skip(self))]
    async fn create_fine_tuning_job(
        &self,
        request: Request<FineTuningRequest>,
    ) -> Result<Response<FineTuningJob>, Status> {
        let req = request.into_inner();
        info!("Creating fine-tuning job: {}", req.name);

        let fine_tuning_req = crate::service::FineTuningRequest {
            name: req.name,
            description: req.description,
            base_model: req.base_model,
            training_data: req.training_data,
            config: crate::service::FineTuningConfig {
                epochs: req.config.epochs as u32,
                learning_rate: req.config.learning_rate,
                batch_size: req.config.batch_size as usize,
                validation_split: req.config.validation_split as f64,
                optimization: req.config.optimization,
                max_length: req.config.max_length as usize,
                warmup_steps: req.config.warmup_steps as u32,
                weight_decay: req.config.weight_decay as f64,
                gradient_accumulation_steps: req.config.gradient_accumulation_steps as u32,
                save_steps: req.config.save_steps as u32,
                eval_steps: req.config.eval_steps as u32,
                logging_steps: req.config.logging_steps as u32,
            },
            user_id: req.user_id,
        };

        match self.service.create_fine_tuning_job(fine_tuning_req).await {
            Ok(job) => {
                let grpc_job = FineTuningJob {
                    id: job.id,
                    name: job.name,
                    description: job.description,
                    base_model: job.base_model,
                    status: job.status,
                    progress: job.progress,
                    created_at: job.created_at.timestamp(),
                    updated_at: job.updated_at.timestamp(),
                    config: FineTuningConfig {
                        epochs: job.config.epochs as i32,
                        learning_rate: job.config.learning_rate,
                        batch_size: job.config.batch_size as i32,
                        validation_split: job.config.validation_split as f64,
                        optimization: job.config.optimization,
                        max_length: job.config.max_length as i32,
                        warmup_steps: job.config.warmup_steps as i32,
                        weight_decay: job.config.weight_decay as f64,
                        gradient_accumulation_steps: job.config.gradient_accumulation_steps as i32,
                        save_steps: job.config.save_steps as i32,
                        eval_steps: job.config.eval_steps as i32,
                        logging_steps: job.config.logging_steps as i32,
                    },
                    user_id: job.user_id,
                };
                Ok(Response::new(grpc_job))
            }
            Err(e) => {
                error!("Fine-tuning job creation failed: {}", e);
                Err(Status::internal(e.to_string()))
            }
        }
    }

    #[instrument(skip(self))]
    async fn get_job(
        &self,
        request: Request<GetJobRequest>,
    ) -> Result<Response<FineTuningJob>, Status> {
        let req = request.into_inner();
        info!("Getting job: {}", req.job_id);

        match self.service.get_job(&req.job_id).await {
            Some(job) => {
                let grpc_job = FineTuningJob {
                    id: job.id,
                    name: job.name,
                    description: job.description,
                    base_model: job.base_model,
                    status: job.status,
                    progress: job.progress,
                    created_at: job.created_at.timestamp(),
                    updated_at: job.updated_at.timestamp(),
                    config: FineTuningConfig {
                        epochs: job.config.epochs as i32,
                        learning_rate: job.config.learning_rate,
                        batch_size: job.config.batch_size as i32,
                        validation_split: job.config.validation_split as f64,
                        optimization: job.config.optimization,
                        max_length: job.config.max_length as i32,
                        warmup_steps: job.config.warmup_steps as i32,
                        weight_decay: job.config.weight_decay as f64,
                        gradient_accumulation_steps: job.config.gradient_accumulation_steps as i32,
                        save_steps: job.config.save_steps as i32,
                        eval_steps: job.config.eval_steps as i32,
                        logging_steps: job.config.logging_steps as i32,
                    },
                    user_id: job.user_id,
                };
                Ok(Response::new(grpc_job))
            }
            None => Err(Status::not_found("Job not found")),
        }
    }

    #[instrument(skip(self))]
    async fn list_jobs(
        &self,
        request: Request<ListJobsRequest>,
    ) -> Result<Response<ListJobsResponse>, Status> {
        let req = request.into_inner();
        info!("Listing jobs for user: {:?}", req.user_id);

        let jobs = self.service.list_jobs(req.user_id.as_deref()).await;
        let grpc_jobs: Vec<FineTuningJob> = jobs
            .into_iter()
            .map(|job| FineTuningJob {
                id: job.id,
                name: job.name,
                description: job.description,
                base_model: job.base_model,
                status: job.status,
                progress: job.progress,
                created_at: job.created_at.timestamp(),
                updated_at: job.updated_at.timestamp(),
                config: FineTuningConfig {
                    epochs: job.config.epochs as i32,
                    learning_rate: job.config.learning_rate,
                    batch_size: job.config.batch_size as i32,
                    validation_split: job.config.validation_split as f64,
                    optimization: job.config.optimization,
                    max_length: job.config.max_length as i32,
                    warmup_steps: job.config.warmup_steps as i32,
                    weight_decay: job.config.weight_decay as f64,
                    gradient_accumulation_steps: job.config.gradient_accumulation_steps as i32,
                    save_steps: job.config.save_steps as i32,
                    eval_steps: job.config.eval_steps as i32,
                    logging_steps: job.config.logging_steps as i32,
                },
                user_id: job.user_id,
            })
            .collect();

        Ok(Response::new(ListJobsResponse { jobs: grpc_jobs }))
    }

    #[instrument(skip(self))]
    async fn cancel_job(
        &self,
        request: Request<CancelJobRequest>,
    ) -> Result<Response<CancelJobResponse>, Status> {
        let req = request.into_inner();
        info!("Cancelling job: {}", req.job_id);

        let success = self.service.cancel_job(&req.job_id).await;
        Ok(Response::new(CancelJobResponse { success }))
    }

    #[instrument(skip(self))]
    async fn delete_job(
        &self,
        request: Request<DeleteJobRequest>,
    ) -> Result<Response<DeleteJobResponse>, Status> {
        let req = request.into_inner();
        info!("Deleting job: {}", req.job_id);

        let success = self.service.delete_job(&req.job_id).await;
        Ok(Response::new(DeleteJobResponse { success }))
    }

    #[instrument(skip(self))]
    async fn process_tts(
        &self,
        request: Request<TTSRequest>,
    ) -> Result<Response<TTSResponse>, Status> {
        let req = request.into_inner();
        info!("Processing TTS request");

        let tts_req = crate::service::TTSRequest {
            text: req.text,
            voice: req.voice,
            speed: req.speed,
            pitch: req.pitch,
        };

        match self.service.process_tts(tts_req).await {
            Ok(response) => {
                let grpc_response = TTSResponse {
                    audio_data: response.audio_data,
                    duration: response.duration,
                    sample_rate: response.sample_rate,
                    format: response.format,
                };
                Ok(Response::new(grpc_response))
            }
            Err(e) => {
                error!("TTS processing failed: {}", e);
                Err(Status::internal(e.to_string()))
            }
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