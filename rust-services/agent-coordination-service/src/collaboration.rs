use crate::types::*;
use std::collections::HashMap;
use uuid::Uuid;
use chrono::Utc;
use tracing::{info, warn, debug};

/// Collaboration mesh for managing agent-to-agent communication
pub struct CollaborationMesh {
    /// Active collaboration sessions
    sessions: HashMap<Uuid, CollaborationSession>,

    /// Message routing for agent communication
    message_routes: HashMap<String, Vec<String>>, // agent_name -> connected agents
}

/// Internal collaboration session data
#[derive(Debug, Clone)]
struct CollaborationSession {
    id: Uuid,
    task: String,
    assigned_agents: Vec<String>,
    status: CollaborationSessionStatus,
    priority: CollaborationPriority,
    messages: Vec<CollaborationMessage>,
    progress: f32,
    created_at: chrono::DateTime<Utc>,
    updated_at: chrono::DateTime<Utc>,
    timeout_at: Option<chrono::DateTime<Utc>>,
    result: Option<serde_json::Value>,
}

impl CollaborationMesh {
    /// Create a new collaboration mesh
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
            message_routes: HashMap::new(),
        }
    }

    /// Helper function to add agent to selection if not already present
    fn add_agent_if_not_present(selected_agents: &mut Vec<String>, agent: &str) {
        if !selected_agents.contains(&agent.to_string()) {
            selected_agents.push(agent.to_string());
        }
    }

    /// Request a new collaboration session
    pub async fn request_collaboration(&mut self, request: CollaborationRequest) -> AgentResult<CollaborationResponse> {
        let session_id = Uuid::new_v4();

        // Find suitable agents for the collaboration
        let assigned_agents = self.select_agents_for_collaboration(&request).await?;

        if assigned_agents.is_empty() {
            return Err(AgentError::CollaborationFailed {
                reason: "No suitable agents found for the required capabilities".to_string(),
            });
        }

        // Calculate timeout
        let timeout_at = request.timeout_seconds.map(|timeout| {
            Utc::now() + chrono::Duration::seconds(timeout as i64)
        });

        // Create collaboration session
        let session = CollaborationSession {
            id: session_id,
            task: request.task.clone(),
            assigned_agents: assigned_agents.clone(),
            status: CollaborationSessionStatus::Requested,
            priority: request.priority.clone(),
            messages: Vec::new(),
            progress: 0.0,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            timeout_at,
            result: None,
        };

        self.sessions.insert(session_id, session);

        // Establish communication routes between agents
        self.setup_agent_routes(&assigned_agents).await?;

        info!("Collaboration session {} created with agents: {:?}",
              session_id, assigned_agents);

        Ok(CollaborationResponse {
            session_id,
            status: "requested".to_string(),
            assigned_agents,
            estimated_duration: request.timeout_seconds,
            created_at: Utc::now(),
        })
    }

    /// Get collaboration session status
    pub async fn get_collaboration_status(&self, session_id: Uuid) -> AgentResult<Option<CollaborationStatus>> {
        let session = match self.sessions.get(&session_id) {
            Some(session) => session,
            None => return Ok(None),
        };

        Ok(Some(CollaborationStatus {
            session_id: session.id,
            status: session.status.clone(),
            assigned_agents: session.assigned_agents.clone(),
            progress: session.progress,
            messages: session.messages.clone(),
            created_at: session.created_at,
            updated_at: session.updated_at,
        }))
    }

    /// Complete a collaboration session
    pub async fn complete_collaboration(&mut self, session_id: Uuid, result: serde_json::Value) -> AgentResult<()> {
        // Get agents to cleanup before modifying session
        let agents_to_cleanup = {
            let session = self.sessions.get(&session_id)
                .ok_or_else(|| AgentError::CollaborationFailed {
                    reason: format!("Collaboration session {} not found", session_id),
                })?;
            session.assigned_agents.clone()
        };

        // Update session
        let session = self.sessions.get_mut(&session_id).unwrap();
        session.status = CollaborationSessionStatus::Completed;
        session.progress = 1.0;
        session.result = Some(result);
        session.updated_at = Utc::now();

        // Clean up communication routes
        self.cleanup_agent_routes(&agents_to_cleanup).await?;

        info!("Collaboration session {} completed", session_id);
        Ok(())
    }

    /// Send a message within a collaboration session
    pub async fn send_message(&mut self,
        session_id: Uuid,
        from_agent: String,
        to_agent: Option<String>,
        message_type: MessageType,
        content: serde_json::Value,
    ) -> AgentResult<Uuid> {
        let session = self.sessions.get_mut(&session_id)
            .ok_or_else(|| AgentError::CollaborationFailed {
                reason: format!("Collaboration session {} not found", session_id),
            })?;

        let message_id = Uuid::new_v4();
        let message = CollaborationMessage {
            id: message_id,
            from_agent,
            to_agent,
            message_type,
            content,
            timestamp: Utc::now(),
        };

        session.messages.push(message);
        session.updated_at = Utc::now();

        debug!("Message {} added to collaboration session {}", message_id, session_id);
        Ok(message_id)
    }

    /// Update collaboration progress
    pub async fn update_progress(&mut self, session_id: Uuid, progress: f32) -> AgentResult<()> {
        let session = self.sessions.get_mut(&session_id)
            .ok_or_else(|| AgentError::CollaborationFailed {
                reason: format!("Collaboration session {} not found", session_id),
            })?;

        session.progress = progress.clamp(0.0, 1.0);
        session.updated_at = Utc::now();

        // Update status based on progress
        if session.progress >= 1.0 && session.status == CollaborationSessionStatus::Active {
            session.status = CollaborationSessionStatus::Completed;
        } else if session.progress > 0.0 && session.status == CollaborationSessionStatus::Requested {
            session.status = CollaborationSessionStatus::Active;
        }

        debug!("Progress updated for collaboration session {}: {:.1}%",
               session_id, progress * 100.0);
        Ok(())
    }

    /// Cancel a collaboration session
    pub async fn cancel_collaboration(&mut self, session_id: Uuid, reason: String) -> AgentResult<()> {
        // Get agents to cleanup before modifying session
        let agents_to_cleanup = {
            let session = self.sessions.get(&session_id)
                .ok_or_else(|| AgentError::CollaborationFailed {
                    reason: format!("Collaboration session {} not found", session_id),
                })?;
            session.assigned_agents.clone()
        };

        // Update session
        let session = self.sessions.get_mut(&session_id).unwrap();
        session.status = CollaborationSessionStatus::Cancelled;
        session.updated_at = Utc::now();

        // Clean up communication routes
        self.cleanup_agent_routes(&agents_to_cleanup).await?;

        warn!("Collaboration session {} cancelled: {}", session_id, reason);
        Ok(())
    }

    /// Get active collaboration sessions
    pub async fn get_active_sessions(&self) -> AgentResult<Vec<Uuid>> {
        let active_sessions: Vec<Uuid> = self.sessions.iter()
            .filter(|(_, session)| {
                matches!(session.status, CollaborationSessionStatus::Active | CollaborationSessionStatus::Requested)
            })
            .map(|(id, _)| *id)
            .collect();

        Ok(active_sessions)
    }

    /// Clean up expired sessions
    pub async fn cleanup_expired_sessions(&mut self) -> AgentResult<usize> {
        let now = Utc::now();
        let mut expired_sessions = Vec::new();

        for (session_id, session) in &self.sessions {
            if let Some(timeout_at) = session.timeout_at {
                if now > timeout_at && session.status == CollaborationSessionStatus::Active {
                    expired_sessions.push(*session_id);
                }
            }
        }

        let count = expired_sessions.len();
        for session_id in expired_sessions {
            self.cancel_collaboration(session_id, "Session timeout".to_string()).await?;
        }

        if count > 0 {
            info!("Cleaned up {} expired collaboration sessions", count);
        }

        Ok(count)
    }

    // Private helper methods

    /// Select suitable agents for collaboration based on requirements
    async fn select_agents_for_collaboration(&self, request: &CollaborationRequest) -> AgentResult<Vec<String>> {
        // This is a simplified agent selection algorithm
        // In a real implementation, this would consider:
        // - Agent capabilities matching
        // - Agent availability and load
        // - Performance history
        // - Geographic/network proximity

        let mut selected_agents = Vec::new();
        let team_size = request.team_size.unwrap_or(3).min(5); // Cap at 5 agents

        // For now, we'll select agents based on a simple capability matching
        let available_agents = vec![
            "enhanced-planner-agent".to_string(),
            "enhanced-retriever-agent".to_string(),
            "enhanced-synthesizer-agent".to_string(),
            "enhanced-personal-assistant-agent".to_string(),
            "enhanced-code-assistant-agent".to_string(),
        ];

        // Select agents based on required capabilities
        for capability in &request.required_capabilities {
            for agent in &available_agents {
                if (agent.contains("planner") && capability.contains("plan")) ||
                   (agent.contains("retriever") && capability.contains("research")) ||
                   (agent.contains("synthesizer") && capability.contains("analysis")) ||
                   (agent.contains("code") && capability.contains("code")) {
                    Self::add_agent_if_not_present(&mut selected_agents, agent);
                }
            }
        }

        // Fill remaining slots with general-purpose agents if needed
        while selected_agents.len() < team_size && selected_agents.len() < available_agents.len() {
            for agent in &available_agents {
                if !selected_agents.contains(agent) {
                    selected_agents.push(agent.clone());
                    break;
                }
            }
        }

        selected_agents.truncate(team_size);
        Ok(selected_agents)
    }

    /// Setup communication routes between agents
    async fn setup_agent_routes(&mut self, agents: &[String]) -> AgentResult<()> {
        // Create bidirectional communication routes between all agents in the collaboration
        for agent in agents {
            let other_agents: Vec<String> = agents.iter()
                .filter(|&other| other != agent)
                .cloned()
                .collect();

            self.message_routes.insert(agent.clone(), other_agents);
        }

        debug!("Communication routes established for {} agents", agents.len());
        Ok(())
    }

    /// Cleanup communication routes for agents
    async fn cleanup_agent_routes(&mut self, agents: &[String]) -> AgentResult<()> {
        for agent in agents {
            self.message_routes.remove(agent);
        }

        debug!("Communication routes cleaned up for {} agents", agents.len());
        Ok(())
    }
}
