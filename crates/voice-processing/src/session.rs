use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH, Instant};
use uuid::Uuid;

use crate::speech::{RecognitionResult, RecognitionSegment};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceSession {
    pub session_id: String,
    pub user_id: String,
    pub started_at: u64,
    pub last_activity: u64,
    pub total_interactions: u32,
    pub total_audio_duration: f64,
    pub total_synthesis_duration: f64,
    pub recognition_results: Vec<SessionRecognitionResult>,
    pub synthesis_requests: Vec<SessionSynthesisRequest>,
    pub language_detections: HashMap<String, u32>,
    pub average_confidence: f64,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionRecognitionResult {
    pub timestamp: u64,
    pub text: String,
    pub confidence: f64,
    pub language: Option<String>,
    pub duration: f64,
    pub processing_time_ms: u64,
    pub segments: Vec<RecognitionSegment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionSynthesisRequest {
    pub timestamp: u64,
    pub text: String,
    pub voice: Option<String>,
    pub duration: f64,
    pub processing_time_ms: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionStatistics {
    pub session_id: String,
    pub user_id: String,
    pub duration_seconds: u64,
    pub total_interactions: u32,
    pub total_audio_processed: f64,
    pub total_audio_synthesized: f64,
    pub average_confidence: f64,
    pub language_breakdown: HashMap<String, u32>,
    pub recognition_performance: PerformanceStats,
    pub synthesis_performance: PerformanceStats,
    pub activity_timeline: Vec<ActivityEvent>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PerformanceStats {
    pub average_processing_time_ms: f64,
    pub min_processing_time_ms: u64,
    pub max_processing_time_ms: u64,
    pub total_requests: u32,
    pub success_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityEvent {
    pub timestamp: u64,
    pub event_type: ActivityEventType,
    pub duration_ms: Option<u64>,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ActivityEventType {
    SessionStart,
    SpeechRecognition,
    SpeechSynthesis,
    SessionEnd,
    Error,
}

impl VoiceSession {
    pub fn new(session_id: String, user_id: String) -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        Self {
            session_id,
            user_id,
            started_at: now,
            last_activity: now,
            total_interactions: 0,
            total_audio_duration: 0.0,
            total_synthesis_duration: 0.0,
            recognition_results: Vec::new(),
            synthesis_requests: Vec::new(),
            language_detections: HashMap::new(),
            average_confidence: 0.0,
            is_active: true,
        }
    }

    pub fn add_recognition_result(&mut self, result: &RecognitionResult) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        self.last_activity = now;
        self.total_interactions += 1;

        // Calculate audio duration from segments
        let duration = if !result.segments.is_empty() {
            result.segments.iter()
                .map(|s| s.end - s.start)
                .sum::<f64>()
        } else {
            0.0
        };

        self.total_audio_duration += duration;

        // Update language detections
        if let Some(ref language) = result.language {
            *self.language_detections.entry(language.clone()).or_insert(0) += 1;
        }

        // Update average confidence
        let total_confidence = self.average_confidence * (self.recognition_results.len() as f64)
            + result.confidence;
        self.average_confidence = total_confidence / ((self.recognition_results.len() + 1) as f64);

        // Store the result
        self.recognition_results.push(SessionRecognitionResult {
            timestamp: now,
            text: result.text.clone(),
            confidence: result.confidence,
            language: result.language.clone(),
            duration,
            processing_time_ms: result.processing_time_ms,
            segments: result.segments.clone(),
        });

        // Keep only the last 100 results to prevent memory issues
        if self.recognition_results.len() > 100 {
            self.recognition_results.remove(0);
        }
    }

    pub fn add_synthesis_result(&mut self, text: &str, duration: f64) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        self.last_activity = now;
        self.total_synthesis_duration += duration;

        self.synthesis_requests.push(SessionSynthesisRequest {
            timestamp: now,
            text: text.to_string(),
            voice: None,
            duration,
            processing_time_ms: 0, // This would be passed from the synthesis result
        });

        // Keep only the last 100 requests
        if self.synthesis_requests.len() > 100 {
            self.synthesis_requests.remove(0);
        }
    }

    pub fn get_statistics(&self) -> SessionStatistics {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let duration_seconds = now - self.started_at;

        // Calculate recognition performance stats
        let recognition_performance = if !self.recognition_results.is_empty() {
            let processing_times: Vec<u64> = self.recognition_results.iter()
                .map(|r| r.processing_time_ms)
                .collect();

            PerformanceStats {
                average_processing_time_ms: processing_times.iter().sum::<u64>() as f64 
                    / processing_times.len() as f64,
                min_processing_time_ms: *processing_times.iter().min().unwrap_or(&0),
                max_processing_time_ms: *processing_times.iter().max().unwrap_or(&0),
                total_requests: self.recognition_results.len() as u32,
                success_rate: 100.0, // Assuming all stored results are successful
            }
        } else {
            PerformanceStats {
                average_processing_time_ms: 0.0,
                min_processing_time_ms: 0,
                max_processing_time_ms: 0,
                total_requests: 0,
                success_rate: 0.0,
            }
        };

        // Calculate synthesis performance stats
        let synthesis_performance = if !self.synthesis_requests.is_empty() {
            let processing_times: Vec<u64> = self.synthesis_requests.iter()
                .map(|r| r.processing_time_ms)
                .collect();

            PerformanceStats {
                average_processing_time_ms: processing_times.iter().sum::<u64>() as f64 
                    / processing_times.len() as f64,
                min_processing_time_ms: *processing_times.iter().min().unwrap_or(&0),
                max_processing_time_ms: *processing_times.iter().max().unwrap_or(&0),
                total_requests: self.synthesis_requests.len() as u32,
                success_rate: 100.0,
            }
        } else {
            PerformanceStats {
                average_processing_time_ms: 0.0,
                min_processing_time_ms: 0,
                max_processing_time_ms: 0,
                total_requests: 0,
                success_rate: 0.0,
            }
        };

        // Create activity timeline
        let mut activity_timeline = Vec::new();
        
        // Add session start
        activity_timeline.push(ActivityEvent {
            timestamp: self.started_at,
            event_type: ActivityEventType::SessionStart,
            duration_ms: None,
            metadata: HashMap::new(),
        });

        // Add recognition events
        for result in &self.recognition_results {
            let mut metadata = HashMap::new();
            metadata.insert("confidence".to_string(), result.confidence.to_string());
            if let Some(ref lang) = result.language {
                metadata.insert("language".to_string(), lang.clone());
            }

            activity_timeline.push(ActivityEvent {
                timestamp: result.timestamp,
                event_type: ActivityEventType::SpeechRecognition,
                duration_ms: Some(result.processing_time_ms),
                metadata,
            });
        }

        // Add synthesis events
        for request in &self.synthesis_requests {
            let mut metadata = HashMap::new();
            metadata.insert("text_length".to_string(), request.text.len().to_string());
            metadata.insert("duration".to_string(), request.duration.to_string());

            activity_timeline.push(ActivityEvent {
                timestamp: request.timestamp,
                event_type: ActivityEventType::SpeechSynthesis,
                duration_ms: Some(request.processing_time_ms),
                metadata,
            });
        }

        // Sort by timestamp
        activity_timeline.sort_by_key(|e| e.timestamp);

        SessionStatistics {
            session_id: self.session_id.clone(),
            user_id: self.user_id.clone(),
            duration_seconds,
            total_interactions: self.total_interactions,
            total_audio_processed: self.total_audio_duration,
            total_audio_synthesized: self.total_synthesis_duration,
            average_confidence: self.average_confidence,
            language_breakdown: self.language_detections.clone(),
            recognition_performance,
            synthesis_performance,
            activity_timeline,
        }
    }

    pub fn is_expired(&self, timeout_seconds: u64) -> bool {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        now - self.last_activity > timeout_seconds
    }

    pub fn end_session(&mut self) {
        self.is_active = false;
        self.last_activity = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
    }

    pub fn get_recent_transcripts(&self, limit: usize) -> Vec<&SessionRecognitionResult> {
        let start = if self.recognition_results.len() > limit {
            self.recognition_results.len() - limit
        } else {
            0
        };

        self.recognition_results[start..].iter().collect()
    }

    pub fn get_conversation_context(&self, max_chars: usize) -> String {
        let recent_transcripts = self.get_recent_transcripts(10);
        
        let mut context = String::new();
        let mut chars_used = 0;

        for result in recent_transcripts.iter().rev() {
            let text_to_add = format!("[{}] {}\n", 
                self.format_timestamp(result.timestamp), 
                result.text
            );
            
            if chars_used + text_to_add.len() > max_chars {
                break;
            }
            
            chars_used += text_to_add.len();
            context = text_to_add + &context;
        }

        context.trim().to_string()
    }

    fn format_timestamp(&self, timestamp: u64) -> String {
        let duration = timestamp - self.started_at;
        let minutes = duration / 60;
        let seconds = duration % 60;
        format!("{:02}:{:02}", minutes, seconds)
    }
}

pub struct SessionManager {
    sessions: HashMap<String, VoiceSession>,
    cleanup_interval: u64,
    session_timeout: u64,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
            cleanup_interval: 300, // 5 minutes
            session_timeout: 1800, // 30 minutes
        }
    }

    pub fn create_session(&mut self, session_id: String, session: VoiceSession) {
        self.sessions.insert(session_id, session);
    }

    pub fn get_session(&self, session_id: &str) -> Option<&VoiceSession> {
        self.sessions.get(session_id)
    }

    pub fn get_session_mut(&mut self, session_id: &str) -> Option<&mut VoiceSession> {
        self.sessions.get_mut(session_id)
    }

    pub fn cleanup_session(&mut self, session_id: &str) {
        if let Some(mut session) = self.sessions.remove(session_id) {
            session.end_session();
        }
    }

    pub fn cleanup_expired_sessions(&mut self) -> Vec<String> {
        let expired_sessions: Vec<String> = self.sessions
            .iter()
            .filter(|(_, session)| session.is_expired(self.session_timeout))
            .map(|(id, _)| id.clone())
            .collect();

        for session_id in &expired_sessions {
            if let Some(mut session) = self.sessions.remove(session_id) {
                session.end_session();
            }
        }

        expired_sessions
    }

    pub fn get_active_sessions(&self) -> Vec<&VoiceSession> {
        self.sessions
            .values()
            .filter(|session| session.is_active)
            .collect()
    }

    pub fn get_session_count(&self) -> usize {
        self.sessions.len()
    }

    pub fn get_active_session_count(&self) -> usize {
        self.sessions
            .values()
            .filter(|session| session.is_active)
            .count()
    }

    pub fn get_user_sessions(&self, user_id: &str) -> Vec<&VoiceSession> {
        self.sessions
            .values()
            .filter(|session| session.user_id == user_id)
            .collect()
    }

    pub fn get_total_statistics(&self) -> HashMap<String, serde_json::Value> {
        let mut stats = HashMap::new();

        let total_sessions = self.sessions.len() as u64;
        let active_sessions = self.get_active_session_count() as u64;
        
        let total_interactions: u32 = self.sessions.values()
            .map(|s| s.total_interactions)
            .sum();

        let total_audio_duration: f64 = self.sessions.values()
            .map(|s| s.total_audio_duration)
            .sum();

        let average_confidence: f64 = if total_sessions > 0 {
            self.sessions.values()
                .map(|s| s.average_confidence)
                .sum::<f64>() / total_sessions as f64
        } else {
            0.0
        };

        // Aggregate language detections
        let mut language_totals = HashMap::new();
        for session in self.sessions.values() {
            for (lang, count) in &session.language_detections {
                *language_totals.entry(lang.clone()).or_insert(0u32) += count;
            }
        }

        stats.insert("total_sessions".to_string(), 
            serde_json::Value::Number(serde_json::Number::from(total_sessions)));
        stats.insert("active_sessions".to_string(), 
            serde_json::Value::Number(serde_json::Number::from(active_sessions)));
        stats.insert("total_interactions".to_string(), 
            serde_json::Value::Number(serde_json::Number::from(total_interactions)));
        stats.insert("total_audio_duration_seconds".to_string(), 
            serde_json::Value::Number(serde_json::Number::from_f64(total_audio_duration).unwrap_or_default()));
        stats.insert("average_confidence".to_string(), 
            serde_json::Value::Number(serde_json::Number::from_f64(average_confidence).unwrap_or_default()));
        stats.insert("language_breakdown".to_string(), 
            serde_json::to_value(&language_totals).unwrap_or_default());

        stats
    }
}