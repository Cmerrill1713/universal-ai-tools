use crate::RedisServiceError;

pub struct CompressionManager {
    lz4_enabled: bool,
    zstd_enabled: bool,
    min_size_threshold: usize,
}

impl CompressionManager {
    pub fn new(min_size_threshold: usize) -> Self {
        Self {
            lz4_enabled: true,
            zstd_enabled: true,
            min_size_threshold,
        }
    }

    pub fn should_compress(&self, data: &[u8]) -> bool {
        data.len() >= self.min_size_threshold
    }

    pub fn compress(&self, data: &[u8], algorithm: CompressionAlgorithm) -> Result<Vec<u8>, RedisServiceError> {
        match algorithm {
            CompressionAlgorithm::LZ4 => self.compress_lz4(data),
            CompressionAlgorithm::Zstd => self.compress_zstd(data),
            CompressionAlgorithm::None => Ok(data.to_vec()),
        }
    }

    pub fn decompress(&self, data: &[u8], algorithm: CompressionAlgorithm) -> Result<Vec<u8>, RedisServiceError> {
        match algorithm {
            CompressionAlgorithm::LZ4 => self.decompress_lz4(data),
            CompressionAlgorithm::Zstd => self.decompress_zstd(data),
            CompressionAlgorithm::None => Ok(data.to_vec()),
        }
    }

    fn compress_lz4(&self, data: &[u8]) -> Result<Vec<u8>, RedisServiceError> {
        lz4::block::compress(data, None, true)
            .map_err(|e| RedisServiceError::CompressionError {
                error: format!("LZ4 compression failed: {}", e),
            })
    }

    fn decompress_lz4(&self, data: &[u8]) -> Result<Vec<u8>, RedisServiceError> {
        lz4::block::decompress(data, None)
            .map_err(|e| RedisServiceError::CompressionError {
                error: format!("LZ4 decompression failed: {}", e),
            })
    }

    fn compress_zstd(&self, data: &[u8]) -> Result<Vec<u8>, RedisServiceError> {
        zstd::encode_all(data, 3) // Compression level 3 for balance
            .map_err(|e| RedisServiceError::CompressionError {
                error: format!("Zstd compression failed: {}", e),
            })
    }

    fn decompress_zstd(&self, data: &[u8]) -> Result<Vec<u8>, RedisServiceError> {
        zstd::decode_all(data)
            .map_err(|e| RedisServiceError::CompressionError {
                error: format!("Zstd decompression failed: {}", e),
            })
    }

    pub fn compression_ratio(&self, original: &[u8], compressed: &[u8]) -> f64 {
        if original.is_empty() {
            return 0.0;
        }
        compressed.len() as f64 / original.len() as f64
    }

    pub fn best_algorithm(&self, data: &[u8]) -> CompressionAlgorithm {
        if !self.should_compress(data) {
            return CompressionAlgorithm::None;
        }

        // Try both algorithms and choose the best
        let lz4_result = self.compress_lz4(data);
        let zstd_result = self.compress_zstd(data);

        match (lz4_result, zstd_result) {
            (Ok(lz4_compressed), Ok(zstd_compressed)) => {
                if lz4_compressed.len() <= zstd_compressed.len() {
                    CompressionAlgorithm::LZ4
                } else {
                    CompressionAlgorithm::Zstd
                }
            }
            (Ok(_), Err(_)) => CompressionAlgorithm::LZ4,
            (Err(_), Ok(_)) => CompressionAlgorithm::Zstd,
            _ => CompressionAlgorithm::None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CompressionAlgorithm {
    LZ4,
    Zstd,
    None,
}

impl CompressionAlgorithm {
    pub fn to_byte(&self) -> u8 {
        match self {
            CompressionAlgorithm::LZ4 => 1,
            CompressionAlgorithm::Zstd => 2,
            CompressionAlgorithm::None => 0,
        }
    }

    pub fn from_byte(byte: u8) -> Self {
        match byte {
            1 => CompressionAlgorithm::LZ4,
            2 => CompressionAlgorithm::Zstd,
            _ => CompressionAlgorithm::None,
        }
    }
}