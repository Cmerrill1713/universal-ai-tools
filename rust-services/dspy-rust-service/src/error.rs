use thiserror::Error;

#[derive(Error, Debug)]
pub enum DSPyError {
    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Python FFI error: {0}")]
    PythonFFI(String),

    #[error("Orchestration error: {0}")]
    Orchestration(String),

    #[error("Agent error: {0}")]
    Agent(String),

    #[error("Knowledge extraction error: {0}")]
    KnowledgeExtraction(String),

    #[error("Pipeline error: {0}")]
    Pipeline(String),

    #[error("Reasoning error: {0}")]
    Reasoning(String),

    #[error("Orchestration not found: {orchestration_id}")]
    OrchestrationNotFound { orchestration_id: String },

    #[error("Invalid request: {0}")]
    InvalidRequest(String),

    #[error("Internal server error: {0}")]
    Internal(String),

    #[error("gRPC error: {0}")]
    Grpc(#[from] tonic::Status),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
}

impl From<DSPyError> for tonic::Status {
    fn from(err: DSPyError) -> Self {
        match err {
            DSPyError::OrchestrationNotFound { .. } => tonic::Status::not_found(err.to_string()),
            DSPyError::InvalidRequest(_) => tonic::Status::invalid_argument(err.to_string()),
            DSPyError::Config(_) | DSPyError::Internal(_) => {
                tonic::Status::internal(err.to_string())
            }
            _ => tonic::Status::unknown(err.to_string()),
        }
    }
}

pub type Result<T> = std::result::Result<T, DSPyError>;