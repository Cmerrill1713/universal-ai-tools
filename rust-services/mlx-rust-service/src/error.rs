use thiserror::Error;

#[derive(Error, Debug)]
pub enum MLXError {
    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Python FFI error: {0}")]
    PythonFFI(String),

    #[error("Vision processing error: {0}")]
    VisionProcessing(String),

    #[error("Fine-tuning error: {0}")]
    FineTuning(String),

    #[error("TTS processing error: {0}")]
    TTSProcessing(String),

    #[error("Job not found: {job_id}")]
    JobNotFound { job_id: String },

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

    #[error("Image processing error: {0}")]
    ImageProcessing(String),
}

impl From<MLXError> for tonic::Status {
    fn from(err: MLXError) -> Self {
        match err {
            MLXError::JobNotFound { .. } => tonic::Status::not_found(err.to_string()),
            MLXError::InvalidRequest(_) => tonic::Status::invalid_argument(err.to_string()),
            MLXError::Config(_) | MLXError::Internal(_) => {
                tonic::Status::internal(err.to_string())
            }
            _ => tonic::Status::unknown(err.to_string()),
        }
    }
}

pub type Result<T> = std::result::Result<T, MLXError>;