use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::process::Command;
use std::time::Instant;
use tokio::fs;
use tokio::process::Command as TokioCommand;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct RecognitionConfig {
    pub model: String,
    pub language: Option<String>,
    pub enable_vad: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RecognitionResult {
    pub text: String,
    pub confidence: f64,
    pub language: Option<String>,
    pub segments: Vec<RecognitionSegment>,
    pub processing_time_ms: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RecognitionSegment {
    pub text: String,
    pub start: f64,
    pub end: f64,
    pub confidence: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SynthesisResult {
    pub audio_data: Vec<u8>,
    pub duration: f64,
    pub sample_rate: u32,
    pub processing_time_ms: u64,
}

pub struct SpeechRecognizer {
    config: RecognitionConfig,
    model_path: Option<String>,
    temp_dir: String,
}

impl SpeechRecognizer {
    pub async fn new(config: RecognitionConfig) -> Result<Self> {
        let temp_dir = format!("/tmp/voice_processing_{}", Uuid::new_v4());
        fs::create_dir_all(&temp_dir).await
            .context("Failed to create temporary directory")?;

        // Check if Whisper is available
        let whisper_available = Self::check_whisper_availability().await;
        if !whisper_available {
            return Err(anyhow::anyhow!("Whisper is not available on this system"));
        }

        Ok(Self {
            config,
            model_path: None,
            temp_dir,
        })
    }

    async fn check_whisper_availability() -> bool {
        // Check if whisper command is available
        if let Ok(output) = TokioCommand::new("whisper").arg("--help").output().await {
            return output.status.success();
        }

        // Check if whisper-cpp is available
        if let Ok(output) = TokioCommand::new("./whisper.cpp").arg("-h").output().await {
            return output.status.success();
        }

        // Check if Python whisper is available
        if let Ok(output) = TokioCommand::new("python3")
            .arg("-c")
            .arg("import whisper; print('available')")
            .output().await 
        {
            return output.status.success();
        }

        false
    }

    pub async fn recognize(&self, audio_samples: &[f32], sample_rate: u32) -> Result<RecognitionResult> {
        let start_time = Instant::now();

        // Save audio to temporary WAV file
        let temp_file = format!("{}/audio_{}.wav", self.temp_dir, Uuid::new_v4());
        self.save_samples_to_wav(audio_samples, sample_rate, &temp_file).await?;

        let result = self.recognize_file(&temp_file).await?;

        // Clean up temporary file
        let _ = fs::remove_file(temp_file).await;

        let mut result = result;
        result.processing_time_ms = start_time.elapsed().as_millis() as u64;

        Ok(result)
    }

    pub async fn recognize_file(&self, file_path: &str) -> Result<RecognitionResult> {
        let start_time = Instant::now();

        // Try different Whisper implementations in order of preference
        let result = if let Ok(result) = self.recognize_with_python_whisper(file_path).await {
            result
        } else if let Ok(result) = self.recognize_with_whisper_cpp(file_path).await {
            result
        } else {
            self.recognize_with_whisper_cli(file_path).await?
        };

        let processing_time = start_time.elapsed().as_millis() as u64;

        Ok(RecognitionResult {
            text: result.text,
            confidence: result.confidence,
            language: result.language,
            segments: result.segments,
            processing_time_ms: processing_time,
        })
    }

    async fn recognize_with_python_whisper(&self, file_path: &str) -> Result<RecognitionResult> {
        let python_script = format!(
            r#"
import whisper
import json
import sys

try:
    model = whisper.load_model("{}")
    result = model.transcribe("{}")
    
    segments = []
    for segment in result.get("segments", []):
        segments.append({{
            "text": segment.get("text", "").strip(),
            "start": segment.get("start", 0.0),
            "end": segment.get("end", 0.0),
            "confidence": segment.get("confidence", 0.5)
        }})
    
    output = {{
        "text": result.get("text", "").strip(),
        "language": result.get("language", "en"),
        "segments": segments,
        "confidence": sum(s.get("confidence", 0.5) for s in segments) / max(len(segments), 1)
    }}
    
    print(json.dumps(output))
    
except Exception as e:
    print(f"Error: {{e}}", file=sys.stderr)
    sys.exit(1)
"#,
            self.config.model, file_path
        );

        let temp_script = format!("{}/whisper_script_{}.py", self.temp_dir, Uuid::new_v4());
        fs::write(&temp_script, python_script).await
            .context("Failed to write Python script")?;

        let output = TokioCommand::new("python3")
            .arg(&temp_script)
            .output()
            .await
            .context("Failed to execute Python Whisper")?;

        // Clean up script
        let _ = fs::remove_file(temp_script).await;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow::anyhow!("Python Whisper failed: {}", error));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let json_result: serde_json::Value = serde_json::from_str(&stdout)
            .context("Failed to parse Python Whisper output")?;

        self.parse_whisper_json(json_result)
    }

    async fn recognize_with_whisper_cpp(&self, file_path: &str) -> Result<RecognitionResult> {
        // This would interface with whisper.cpp if available
        // For now, return an error to fall back to other methods
        Err(anyhow::anyhow!("whisper.cpp not implemented yet"))
    }

    async fn recognize_with_whisper_cli(&self, file_path: &str) -> Result<RecognitionResult> {
        let mut cmd = TokioCommand::new("whisper");
        cmd.arg(file_path)
           .arg("--model").arg(&self.config.model)
           .arg("--output_format").arg("json")
           .arg("--output_dir").arg(&self.temp_dir);

        if let Some(ref language) = self.config.language {
            cmd.arg("--language").arg(language);
        }

        let output = cmd.output().await
            .context("Failed to execute Whisper CLI")?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow::anyhow!("Whisper CLI failed: {}", error));
        }

        // Read the JSON output file
        let base_name = Path::new(file_path).file_stem()
            .ok_or_else(|| anyhow::anyhow!("Invalid file path"))?
            .to_string_lossy();
        
        let json_file = format!("{}/{}.json", self.temp_dir, base_name);
        let json_content = fs::read_to_string(json_file).await
            .context("Failed to read Whisper output JSON")?;

        let json_result: serde_json::Value = serde_json::from_str(&json_content)
            .context("Failed to parse Whisper JSON output")?;

        self.parse_whisper_json(json_result)
    }

    fn parse_whisper_json(&self, json: serde_json::Value) -> Result<RecognitionResult> {
        let text = json["text"].as_str()
            .unwrap_or("")
            .trim()
            .to_string();

        let language = json["language"].as_str().map(|s| s.to_string());

        let segments: Vec<RecognitionSegment> = if let Some(segments_array) = json["segments"].as_array() {
            segments_array.iter()
                .filter_map(|segment| {
                    Some(RecognitionSegment {
                        text: segment["text"].as_str()?.trim().to_string(),
                        start: segment["start"].as_f64().unwrap_or(0.0),
                        end: segment["end"].as_f64().unwrap_or(0.0),
                        confidence: segment.get("confidence")
                            .and_then(|c| c.as_f64())
                            .unwrap_or(0.5),
                    })
                })
                .collect()
        } else {
            vec![]
        };

        let confidence = if let Some(conf) = json["confidence"].as_f64() {
            conf
        } else {
            // Calculate average confidence from segments
            if !segments.is_empty() {
                segments.iter().map(|s| s.confidence).sum::<f64>() / segments.len() as f64
            } else {
                0.5
            }
        };

        Ok(RecognitionResult {
            text,
            confidence,
            language,
            segments,
            processing_time_ms: 0, // Will be set by caller
        })
    }

    async fn save_samples_to_wav(&self, samples: &[f32], sample_rate: u32, output_path: &str) -> Result<()> {
        use hound::{WavWriter, WavSpec};

        let spec = WavSpec {
            channels: 1,
            sample_rate,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };

        let mut writer = WavWriter::create(output_path, spec)
            .context("Failed to create WAV writer")?;

        for &sample in samples {
            let sample_i16 = (sample.clamp(-1.0, 1.0) * i16::MAX as f32) as i16;
            writer.write_sample(sample_i16)
                .context("Failed to write sample")?;
        }

        writer.finalize()
            .context("Failed to finalize WAV file")?;

        Ok(())
    }
}

impl Drop for SpeechRecognizer {
    fn drop(&mut self) {
        // Clean up temporary directory
        let _ = std::fs::remove_dir_all(&self.temp_dir);
    }
}

pub struct SpeechSynthesizer {
    model: String,
    temp_dir: String,
    python_server_port: Option<u16>,
}

impl SpeechSynthesizer {
    pub async fn new(model: String) -> Result<Self> {
        let temp_dir = format!("/tmp/voice_synthesis_{}", Uuid::new_v4());
        fs::create_dir_all(&temp_dir).await
            .context("Failed to create temporary directory")?;

        Ok(Self {
            model,
            temp_dir,
            python_server_port: None,
        })
    }

    pub async fn synthesize(&self, text: &str, voice: Option<String>) -> Result<SynthesisResult> {
        let start_time = Instant::now();

        // Use Nari Dia TTS service (assuming it's running)
        let result = self.synthesize_with_nari_dia(text, voice).await?;

        let processing_time = start_time.elapsed().as_millis() as u64;

        Ok(SynthesisResult {
            audio_data: result.audio_data,
            duration: result.duration,
            sample_rate: result.sample_rate,
            processing_time_ms: processing_time,
        })
    }

    pub async fn synthesize_to_file(&self, text: &str, output_path: &str, voice: Option<String>) -> Result<()> {
        let result = self.synthesize(text, voice).await?;
        
        fs::write(output_path, &result.audio_data).await
            .context("Failed to write audio file")?;

        Ok(())
    }

    async fn synthesize_with_nari_dia(&self, text: &str, voice: Option<String>) -> Result<SynthesisResult> {
        use reqwest;

        // Try to connect to the local Nari Dia service
        let client = reqwest::Client::new();
        let url = "http://localhost:8765/synthesize";

        let mut request_body = HashMap::new();
        request_body.insert("text", text);
        if let Some(voice) = voice {
            request_body.insert("voice", &voice);
        }

        let response = client
            .post(url)
            .json(&request_body)
            .send()
            .await
            .context("Failed to connect to Nari Dia service")?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!(
                "Nari Dia service returned error: {}",
                response.status()
            ));
        }

        let audio_data = response.bytes().await
            .context("Failed to read audio response")?
            .to_vec();

        // Estimate duration based on audio data size (rough approximation)
        // For 16kHz mono 16-bit audio: duration = samples / sample_rate
        let estimated_samples = audio_data.len() / 2; // 16-bit = 2 bytes per sample
        let duration = estimated_samples as f64 / 16000.0;

        Ok(SynthesisResult {
            audio_data,
            duration,
            sample_rate: 16000,
            processing_time_ms: 0, // Will be set by caller
        })
    }
}

impl Drop for SpeechSynthesizer {
    fn drop(&mut self) {
        // Clean up temporary directory
        let _ = std::fs::remove_dir_all(&self.temp_dir);
    }
}