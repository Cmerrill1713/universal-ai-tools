use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioMetrics {
    pub rms: f32,
    pub peak: f32,
    pub zero_crossings: u32,
    pub spectral_centroid: f32,
    pub energy: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceActivityDetection {
    pub is_speech: bool,
    pub confidence: f32,
    pub energy_ratio: f32,
    pub spectral_features: Vec<f32>,
}

pub struct AudioAnalyzer;

impl AudioAnalyzer {
    pub fn analyze_audio(samples: &[f32], sample_rate: u32) -> AudioMetrics {
        let rms = Self::calculate_rms(samples);
        let peak = Self::calculate_peak(samples);
        let zero_crossings = Self::count_zero_crossings(samples);
        let spectral_centroid = Self::calculate_spectral_centroid(samples, sample_rate);
        let energy = Self::calculate_energy(samples);

        AudioMetrics {
            rms,
            peak,
            zero_crossings,
            spectral_centroid,
            energy,
        }
    }

    pub fn detect_voice_activity(samples: &[f32], sample_rate: u32) -> VoiceActivityDetection {
        let metrics = Self::analyze_audio(samples, sample_rate);
        
        // Simple VAD based on energy and spectral features
        let energy_threshold = 0.01;
        let spectral_threshold = 1000.0;
        
        let has_energy = metrics.energy > energy_threshold;
        let has_spectral_content = metrics.spectral_centroid > spectral_threshold;
        let has_variation = metrics.zero_crossings > (samples.len() as u32 / 100);
        
        let is_speech = has_energy && has_spectral_content && has_variation;
        
        let confidence = if is_speech {
            let energy_score = (metrics.energy / energy_threshold).min(1.0);
            let spectral_score = (metrics.spectral_centroid / spectral_threshold).min(1.0);
            let variation_score = (metrics.zero_crossings as f32 / (samples.len() as f32 / 50.0)).min(1.0);
            
            (energy_score + spectral_score + variation_score) / 3.0
        } else {
            0.0
        };

        VoiceActivityDetection {
            is_speech,
            confidence,
            energy_ratio: metrics.energy,
            spectral_features: vec![metrics.spectral_centroid, metrics.rms, metrics.peak],
        }
    }

    fn calculate_rms(samples: &[f32]) -> f32 {
        if samples.is_empty() {
            return 0.0;
        }

        let sum_squares: f32 = samples.iter().map(|&x| x * x).sum();
        (sum_squares / samples.len() as f32).sqrt()
    }

    fn calculate_peak(samples: &[f32]) -> f32 {
        samples.iter().fold(0.0, |acc, &x| acc.max(x.abs()))
    }

    fn count_zero_crossings(samples: &[f32]) -> u32 {
        if samples.len() < 2 {
            return 0;
        }

        let mut crossings = 0;
        for i in 1..samples.len() {
            if (samples[i] >= 0.0 && samples[i-1] < 0.0) || 
               (samples[i] < 0.0 && samples[i-1] >= 0.0) {
                crossings += 1;
            }
        }
        crossings
    }

    fn calculate_spectral_centroid(samples: &[f32], sample_rate: u32) -> f32 {
        // Simple approximation of spectral centroid
        // In a full implementation, you'd use FFT
        
        if samples.is_empty() {
            return 0.0;
        }

        // Calculate high frequency content using differences
        let mut high_freq_energy = 0.0;
        let mut total_energy = 0.0;

        for i in 1..samples.len() {
            let diff = samples[i] - samples[i-1];
            high_freq_energy += diff * diff;
            total_energy += samples[i] * samples[i];
        }

        if total_energy > 0.0 {
            (high_freq_energy / total_energy) * (sample_rate as f32 / 4.0)
        } else {
            0.0
        }
    }

    fn calculate_energy(samples: &[f32]) -> f32 {
        samples.iter().map(|&x| x * x).sum()
    }
}

pub struct AudioFormat;

impl AudioFormat {
    pub fn detect_format(data: &[u8]) -> Result<crate::audio::AudioFormat> {
        if data.len() < 12 {
            return Err(anyhow::anyhow!("Insufficient data to detect format"));
        }

        // WAV format detection
        if data[0..4] == [0x52, 0x49, 0x46, 0x46] && // "RIFF"
           data[8..12] == [0x57, 0x41, 0x56, 0x45] { // "WAVE"
            return Ok(crate::audio::AudioFormat::Wav);
        }

        // MP3 format detection
        if data.len() >= 3 && 
           ((data[0] == 0xFF && (data[1] & 0xF0) == 0xF0) || // MP3 frame header
            (data[0..3] == [0x49, 0x44, 0x33])) { // ID3 tag
            return Ok(crate::audio::AudioFormat::Mp3);
        }

        // FLAC format detection
        if data.len() >= 4 && data[0..4] == [0x66, 0x4C, 0x61, 0x43] { // "fLaC"
            return Ok(crate::audio::AudioFormat::Flac);
        }

        // OGG format detection
        if data.len() >= 4 && data[0..4] == [0x4F, 0x67, 0x67, 0x53] { // "OggS"
            return Ok(crate::audio::AudioFormat::Ogg);
        }

        // Default to WAV if unknown
        Ok(crate::audio::AudioFormat::Wav)
    }

    pub fn validate_wav_header(data: &[u8]) -> Result<(u32, u16, u16)> {
        if data.len() < 44 {
            return Err(anyhow::anyhow!("WAV header too short"));
        }

        // Check RIFF header
        if &data[0..4] != b"RIFF" || &data[8..12] != b"WAVE" {
            return Err(anyhow::anyhow!("Invalid WAV header"));
        }

        // Extract format information
        let sample_rate = u32::from_le_bytes([data[24], data[25], data[26], data[27]]);
        let channels = u16::from_le_bytes([data[22], data[23]]);
        let bits_per_sample = u16::from_le_bytes([data[34], data[35]]);

        Ok((sample_rate, channels, bits_per_sample))
    }
}

pub struct TimeUtils;

impl TimeUtils {
    pub fn current_timestamp() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    }

    pub fn current_timestamp_ms() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64
    }

    pub fn format_duration(seconds: f64) -> String {
        if seconds < 60.0 {
            format!("{:.1}s", seconds)
        } else if seconds < 3600.0 {
            let minutes = seconds / 60.0;
            format!("{:.1}m", minutes)
        } else {
            let hours = seconds / 3600.0;
            format!("{:.1}h", hours)
        }
    }

    pub fn format_timestamp(timestamp: u64) -> String {
        // Simple UTC timestamp formatting
        // In production, you'd use a proper datetime library
        let datetime = SystemTime::UNIX_EPOCH + std::time::Duration::from_secs(timestamp);
        format!("{:?}", datetime) // Placeholder formatting
    }
}

pub struct BufferUtils;

impl BufferUtils {
    pub fn f32_to_bytes(samples: &[f32]) -> Vec<u8> {
        samples.iter()
            .flat_map(|&sample| {
                let sample_i16 = (sample.clamp(-1.0, 1.0) * i16::MAX as f32) as i16;
                sample_i16.to_le_bytes()
            })
            .collect()
    }

    pub fn bytes_to_f32(bytes: &[u8]) -> Result<Vec<f32>> {
        if bytes.len() % 2 != 0 {
            return Err(anyhow::anyhow!("Invalid byte length for 16-bit audio"));
        }

        let samples = bytes
            .chunks_exact(2)
            .map(|chunk| {
                let sample_i16 = i16::from_le_bytes([chunk[0], chunk[1]]);
                sample_i16 as f32 / i16::MAX as f32
            })
            .collect();

        Ok(samples)
    }

    pub fn interleave_channels(left: &[f32], right: &[f32]) -> Vec<f32> {
        let mut interleaved = Vec::with_capacity(left.len() + right.len());
        
        for (l, r) in left.iter().zip(right.iter()) {
            interleaved.push(*l);
            interleaved.push(*r);
        }

        interleaved
    }

    pub fn deinterleave_channels(interleaved: &[f32]) -> (Vec<f32>, Vec<f32>) {
        let mut left = Vec::with_capacity(interleaved.len() / 2);
        let mut right = Vec::with_capacity(interleaved.len() / 2);

        for chunk in interleaved.chunks_exact(2) {
            left.push(chunk[0]);
            right.push(chunk[1]);
        }

        (left, right)
    }

    pub fn apply_fade_in(samples: &mut [f32], fade_samples: usize) {
        let fade_samples = fade_samples.min(samples.len());
        
        for (i, sample) in samples.iter_mut().take(fade_samples).enumerate() {
            let fade_factor = i as f32 / fade_samples as f32;
            *sample *= fade_factor;
        }
    }

    pub fn apply_fade_out(samples: &mut [f32], fade_samples: usize) {
        let fade_samples = fade_samples.min(samples.len());
        let start_idx = samples.len().saturating_sub(fade_samples);
        
        for (i, sample) in samples.iter_mut().skip(start_idx).enumerate() {
            let fade_factor = 1.0 - (i as f32 / fade_samples as f32);
            *sample *= fade_factor;
        }
    }

    pub fn normalize_audio(samples: &mut [f32], target_level: f32) {
        let peak = samples.iter().fold(0.0f32, |acc, &x| acc.max(x.abs()));
        
        if peak > 0.0 && peak != target_level {
            let gain = target_level / peak;
            for sample in samples.iter_mut() {
                *sample *= gain;
            }
        }
    }

    pub fn calculate_loudness_lufs(samples: &[f32], _sample_rate: u32) -> f32 {
        // Simplified loudness calculation
        // Real LUFS calculation is much more complex
        if samples.is_empty() {
            return -100.0;
        }

        let rms = samples.iter().map(|&x| x * x).sum::<f32>() / samples.len() as f32;
        let rms = rms.sqrt();
        
        if rms > 0.0 {
            20.0 * rms.log10() - 23.0 // Rough LUFS approximation
        } else {
            -100.0
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_audio_metrics() {
        let samples = vec![0.1, -0.2, 0.3, -0.4, 0.5];
        let metrics = AudioAnalyzer::analyze_audio(&samples, 16000);
        
        assert!(metrics.rms > 0.0);
        assert!(metrics.peak > 0.0);
        assert!(metrics.energy > 0.0);
    }

    #[test]
    fn test_voice_activity_detection() {
        let silent_samples = vec![0.0; 1000];
        let vad = AudioAnalyzer::detect_voice_activity(&silent_samples, 16000);
        assert!(!vad.is_speech);

        let noisy_samples: Vec<f32> = (0..1000)
            .map(|i| (i as f32 * 0.01).sin() * 0.5)
            .collect();
        let vad = AudioAnalyzer::detect_voice_activity(&noisy_samples, 16000);
        assert!(vad.confidence > 0.0);
    }

    #[test]
    fn test_buffer_conversion() {
        let samples = vec![0.5, -0.3, 0.1, -0.8];
        let bytes = BufferUtils::f32_to_bytes(&samples);
        let recovered = BufferUtils::bytes_to_f32(&bytes).unwrap();
        
        assert_eq!(samples.len(), recovered.len());
        for (orig, rec) in samples.iter().zip(recovered.iter()) {
            assert!((orig - rec).abs() < 0.001); // Allow small floating point differences
        }
    }
}