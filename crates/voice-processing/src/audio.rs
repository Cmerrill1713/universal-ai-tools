use anyhow::{Result, Context};
use dasp::signal;
use hound::{WavReader, WavWriter, WavSpec};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::io::Cursor;
use std::sync::Arc;
use std::time::{Duration, Instant};

#[derive(Debug, Clone)]
pub struct AudioConfig {
    pub sample_rate: u32,
    pub channels: u32,
    pub chunk_size: u32,
    pub enable_noise_reduction: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub total_chunks_processed: u64,
    pub average_processing_time_ms: f64,
    pub peak_processing_time_ms: u64,
    pub total_audio_duration_seconds: f64,
    pub real_time_factor: f64, // How much faster than real-time we're processing
}

#[derive(Debug, Clone, Copy)]
pub enum AudioFormat {
    Wav,
    Mp3,
    Flac,
    Ogg,
}

pub struct AudioProcessor {
    config: AudioConfig,
    buffer: VecDeque<f32>,
    noise_gate_threshold: f32,
    metrics: Arc<Mutex<PerformanceMetrics>>,
    last_processing_times: VecDeque<Duration>,
}

impl AudioProcessor {
    pub fn new(config: AudioConfig) -> Result<Self> {
        Ok(Self {
            config,
            buffer: VecDeque::new(),
            noise_gate_threshold: -40.0, // -40 dB
            metrics: Arc::new(Mutex::new(PerformanceMetrics {
                total_chunks_processed: 0,
                average_processing_time_ms: 0.0,
                peak_processing_time_ms: 0,
                total_audio_duration_seconds: 0.0,
                real_time_factor: 0.0,
            })),
            last_processing_times: VecDeque::with_capacity(100),
        })
    }

    pub fn process_chunk(&mut self, data: &[u8], sample_rate: u32, channels: u32) -> Result<Vec<f32>> {
        let start_time = Instant::now();

        // Convert bytes to f32 samples
        let mut samples = self.bytes_to_samples(data, channels)?;

        // Resample if necessary
        if sample_rate != 16000 {
            samples = self.resample_audio(samples, sample_rate, 16000)?;
        }

        // Convert to mono if stereo
        if channels > 1 {
            samples = self.stereo_to_mono(samples);
        }

        // Apply noise reduction if enabled
        if self.config.enable_noise_reduction {
            samples = self.apply_noise_reduction(samples);
        }

        // Apply noise gate
        samples = self.apply_noise_gate(samples);

        // Add to buffer for streaming processing
        self.buffer.extend(samples.iter());

        // Keep buffer size manageable
        while self.buffer.len() > self.config.chunk_size as usize * 10 {
            self.buffer.pop_front();
        }

        // Update metrics
        let processing_time = start_time.elapsed();
        self.update_metrics(processing_time, samples.len());

        Ok(samples)
    }

    pub fn process_file(&mut self, file_path: &str) -> Result<Vec<f32>> {
        let mut reader = WavReader::open(file_path)
            .context("Failed to open audio file")?;

        let spec = reader.spec();
        let samples: Result<Vec<f32>, _> = reader.samples::<i16>()
            .map(|s| s.map(|sample| sample as f32 / i16::MAX as f32))
            .collect();

        let samples = samples.context("Failed to read audio samples")?;
        
        self.process_samples(samples, spec.sample_rate, spec.channels as u32)
    }

    pub fn process_buffer(&mut self, buffer: &[u8], format: AudioFormat) -> Result<Vec<f32>> {
        match format {
            AudioFormat::Wav => self.process_wav_buffer(buffer),
            _ => Err(anyhow::anyhow!("Unsupported audio format for buffer processing")),
        }
    }

    fn process_wav_buffer(&mut self, buffer: &[u8]) -> Result<Vec<f32>> {
        let cursor = Cursor::new(buffer);
        let mut reader = WavReader::new(cursor)
            .context("Failed to create WAV reader from buffer")?;

        let spec = reader.spec();
        let samples: Result<Vec<f32>, _> = reader.samples::<i16>()
            .map(|s| s.map(|sample| sample as f32 / i16::MAX as f32))
            .collect();

        let samples = samples.context("Failed to read audio samples from buffer")?;
        
        self.process_samples(samples, spec.sample_rate, spec.channels as u32)
    }

    fn process_samples(&mut self, mut samples: Vec<f32>, sample_rate: u32, channels: u32) -> Result<Vec<f32>> {
        // Resample if necessary
        if sample_rate != 16000 {
            samples = self.resample_audio(samples, sample_rate, 16000)?;
        }

        // Convert to mono if stereo
        if channels > 1 {
            samples = self.stereo_to_mono(samples);
        }

        // Apply noise reduction if enabled
        if self.config.enable_noise_reduction {
            samples = self.apply_noise_reduction(samples);
        }

        // Apply noise gate
        samples = self.apply_noise_gate(samples);

        Ok(samples)
    }

    fn bytes_to_samples(&self, data: &[u8], _channels: u32) -> Result<Vec<f32>> {
        // Assume 16-bit PCM for now
        if data.len() % 2 != 0 {
            return Err(anyhow::anyhow!("Invalid audio data length"));
        }

        let samples: Vec<f32> = data.chunks_exact(2)
            .map(|chunk| {
                let sample = i16::from_le_bytes([chunk[0], chunk[1]]);
                sample as f32 / i16::MAX as f32
            })
            .collect();

        Ok(samples)
    }

    fn resample_audio(&mut self, samples: Vec<f32>, from_rate: u32, to_rate: u32) -> Result<Vec<f32>> {
        if from_rate == to_rate {
            return Ok(samples);
        }

        let ratio = to_rate as f64 / from_rate as f64;
        let output_len = (samples.len() as f64 * ratio) as usize;
        
        // Simple linear interpolation resampling for now
        // In production, you'd use a proper resampling library
        let mut resampled = Vec::with_capacity(output_len);
        
        for i in 0..output_len {
            let pos = i as f64 / ratio;
            let idx = pos as usize;
            
            if idx + 1 < samples.len() {
                let frac = pos - idx as f64;
                let sample = samples[idx] * (1.0 - frac as f32) + samples[idx + 1] * frac as f32;
                resampled.push(sample);
            } else if idx < samples.len() {
                resampled.push(samples[idx]);
            }
        }

        Ok(resampled)
    }

    fn stereo_to_mono(&self, samples: Vec<f32>) -> Vec<f32> {
        samples.chunks_exact(2)
            .map(|chunk| (chunk[0] + chunk[1]) / 2.0)
            .collect()
    }

    fn apply_noise_reduction(&self, mut samples: Vec<f32>) -> Vec<f32> {
        // Simple noise reduction using spectral subtraction
        // In production, you'd implement proper noise reduction algorithms
        
        // Calculate RMS for noise estimation
        let rms: f32 = samples.iter()
            .map(|&x| x * x)
            .sum::<f32>()
            .sqrt() / samples.len() as f32;

        let noise_floor = rms * 0.1; // Assume 10% of RMS is noise
        
        // Apply simple noise gate
        for sample in &mut samples {
            if sample.abs() < noise_floor {
                *sample *= 0.1; // Reduce noise by 90%
            }
        }

        samples
    }

    fn apply_noise_gate(&self, mut samples: Vec<f32>) -> Vec<f32> {
        let threshold = 10f32.powf(self.noise_gate_threshold / 20.0);
        
        for sample in &mut samples {
            if sample.abs() < threshold {
                *sample = 0.0;
            }
        }

        samples
    }

    fn update_metrics(&mut self, processing_time: Duration, samples_processed: usize) {
        let mut metrics = self.metrics.lock();
        
        metrics.total_chunks_processed += 1;
        
        let processing_time_ms = processing_time.as_millis() as u64;
        if processing_time_ms > metrics.peak_processing_time_ms {
            metrics.peak_processing_time_ms = processing_time_ms;
        }

        self.last_processing_times.push_back(processing_time);
        if self.last_processing_times.len() > 100 {
            self.last_processing_times.pop_front();
        }

        let avg_time: Duration = self.last_processing_times.iter().sum::<Duration>()
            / self.last_processing_times.len() as u32;
        metrics.average_processing_time_ms = avg_time.as_millis() as f64;

        // Calculate audio duration (assuming 16kHz sample rate)
        let audio_duration = samples_processed as f64 / 16000.0;
        metrics.total_audio_duration_seconds += audio_duration;

        // Calculate real-time factor
        if processing_time.as_secs_f64() > 0.0 {
            metrics.real_time_factor = audio_duration / processing_time.as_secs_f64();
        }
    }

    pub fn get_performance_metrics(&self) -> PerformanceMetrics {
        self.metrics.lock().clone()
    }

    pub fn save_buffer_to_wav(&self, samples: &[f32], output_path: &str) -> Result<()> {
        let spec = WavSpec {
            channels: 1,
            sample_rate: 16000,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };

        let mut writer = WavWriter::create(output_path, spec)
            .context("Failed to create WAV writer")?;

        for &sample in samples {
            let sample_i16 = (sample * i16::MAX as f32) as i16;
            writer.write_sample(sample_i16)
                .context("Failed to write sample")?;
        }

        writer.finalize()
            .context("Failed to finalize WAV file")?;

        Ok(())
    }

    pub fn get_buffer_snapshot(&self, max_samples: Option<usize>) -> Vec<f32> {
        let max = max_samples.unwrap_or(self.buffer.len());
        self.buffer.iter()
            .take(max)
            .copied()
            .collect()
    }

    pub fn clear_buffer(&mut self) {
        self.buffer.clear();
    }

    pub fn get_buffer_duration_seconds(&self) -> f64 {
        self.buffer.len() as f64 / 16000.0
    }
}