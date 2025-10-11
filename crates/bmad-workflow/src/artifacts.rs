//! BMAD Artifact Generators - Specialized generators for different project artifacts
//! 
//! This module provides specialized generators for creating various project artifacts
//! like PRDs, architecture diagrams, UX briefs, etc.

use crate::{UserInput, ProjectArtifact, ArtifactType};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// PRD Generator for Product Requirements Documents
#[derive(Debug)]
pub struct PRDGenerator {
    pub template: PRDTemplate,
    pub sections: Vec<PRDSection>,
    pub quality_standards: QualityStandards,
}

/// PRD Template structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PRDTemplate {
    pub title: String,
    pub sections: Vec<String>,
    pub required_fields: Vec<String>,
    pub optional_fields: Vec<String>,
}

/// PRD Section
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PRDSection {
    pub name: String,
    pub content: String,
    pub is_required: bool,
    pub order: u32,
}

/// Quality standards for artifacts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityStandards {
    pub min_word_count: u32,
    pub required_sections: Vec<String>,
    pub quality_metrics: QualityMetrics,
}

/// Quality metrics for artifacts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityMetrics {
    pub completeness_score: f32,
    pub clarity_score: f32,
    pub technical_accuracy: f32,
    pub user_focus_score: f32,
}

/// Architecture Generator for technical architecture documents
#[derive(Debug)]
pub struct ArchitectureGenerator {
    pub diagram_types: Vec<DiagramType>,
    pub architecture_patterns: Vec<ArchitecturePattern>,
    pub technology_stack: TechnologyStack,
}

/// Types of architecture diagrams
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DiagramType {
    SystemOverview,
    ComponentDiagram,
    DataFlowDiagram,
    DeploymentDiagram,
    SequenceDiagram,
    ClassDiagram,
}

/// Architecture patterns
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ArchitecturePattern {
    Monolithic,
    Microservices,
    Serverless,
    EventDriven,
    Layered,
    Hexagonal,
    CQRS,
    EventSourcing,
}

/// Technology stack information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TechnologyStack {
    pub frontend: Vec<String>,
    pub backend: Vec<String>,
    pub database: Vec<String>,
    pub infrastructure: Vec<String>,
    pub tools: Vec<String>,
}

/// UX Brief Generator for user experience documents
#[derive(Debug)]
pub struct UXBriefGenerator {
    pub user_personas: Vec<UserPersona>,
    pub user_journeys: Vec<UserJourney>,
    pub design_principles: Vec<DesignPrinciple>,
    pub accessibility_requirements: Vec<AccessibilityRequirement>,
}

/// User persona
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPersona {
    pub name: String,
    pub age_range: String,
    pub occupation: String,
    pub goals: Vec<String>,
    pub pain_points: Vec<String>,
    pub technical_comfort: TechnicalComfort,
}

/// Technical comfort levels
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TechnicalComfort {
    Beginner,
    Intermediate,
    Advanced,
    Expert,
}

/// User journey
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserJourney {
    pub stage: JourneyStage,
    pub actions: Vec<String>,
    pub emotions: Vec<String>,
    pub pain_points: Vec<String>,
    pub opportunities: Vec<String>,
}

/// Journey stages
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum JourneyStage {
    Discovery,
    Consideration,
    Purchase,
    Onboarding,
    Usage,
    Support,
    Retention,
}

/// Design principle
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesignPrinciple {
    pub name: String,
    pub description: String,
    pub examples: Vec<String>,
    pub importance: Importance,
}

/// Importance levels
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Importance {
    Low,
    Medium,
    High,
    Critical,
}

/// Accessibility requirement
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessibilityRequirement {
    pub standard: AccessibilityStandard,
    pub requirement: String,
    pub implementation: String,
    pub testing_method: String,
}

/// Accessibility standards
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AccessibilityStandard {
    WCAG_2_1_AA,
    WCAG_2_1_AAA,
    Section_508,
    ADA,
}

impl PRDGenerator {
    /// Create a new PRD generator
    pub fn new() -> Self {
        Self {
            template: PRDTemplate {
                title: "Product Requirements Document".to_string(),
                sections: vec![
                    "Executive Summary".to_string(),
                    "Product Overview".to_string(),
                    "Target Users".to_string(),
                    "User Stories".to_string(),
                    "Functional Requirements".to_string(),
                    "Non-Functional Requirements".to_string(),
                    "Success Metrics".to_string(),
                    "Constraints".to_string(),
                    "Timeline".to_string(),
                    "Budget".to_string(),
                ],
                required_fields: vec![
                    "product_name".to_string(),
                    "product_description".to_string(),
                    "target_users".to_string(),
                    "key_features".to_string(),
                ],
                optional_fields: vec![
                    "competitive_analysis".to_string(),
                    "market_research".to_string(),
                    "risk_assessment".to_string(),
                ],
            },
            sections: Vec::new(),
            quality_standards: QualityStandards {
                min_word_count: 1000,
                required_sections: vec![
                    "Product Overview".to_string(),
                    "Target Users".to_string(),
                    "Key Features".to_string(),
                ],
                quality_metrics: QualityMetrics {
                    completeness_score: 0.8,
                    clarity_score: 0.8,
                    technical_accuracy: 0.7,
                    user_focus_score: 0.9,
                },
            },
        }
    }
    
    /// Generate PRD from user input
    pub async fn generate_prd(&self, user_input: &UserInput) -> Result<ProjectArtifact, Box<dyn std::error::Error>> {
        let content = self.create_prd_content(user_input).await?;
        let quality_score = self.assess_prd_quality(&content).await?;
        
        Ok(ProjectArtifact {
            id: Uuid::new_v4(),
            artifact_type: ArtifactType::PRD,
            title: format!("PRD: {}", user_input.project_name),
            content,
            metadata: crate::planning::ArtifactMetadata {
                complexity_score: self.calculate_complexity_score(user_input),
                completeness_score: quality_score.completeness_score,
                quality_score: quality_score.clarity_score,
                tags: vec!["PRD".to_string(), "requirements".to_string()],
                review_status: crate::planning::ReviewStatus::Draft,
                approval_status: crate::planning::ApprovalStatus::Pending,
            },
            created_by: "PRD Generator".to_string(),
            created_at: Utc::now().to_rfc3339(),
            version: 1,
            dependencies: vec![],
        })
    }
    
    /// Create PRD content
    async fn create_prd_content(&self, user_input: &UserInput) -> Result<String, Box<dyn std::error::Error>> {
        let mut content = String::new();
        
        // Executive Summary
        content.push_str(&format!("# Product Requirements Document: {}\n\n", user_input.project_name));
        content.push_str("## Executive Summary\n\n");
        content.push_str(&format!("{}\n\n", user_input.project_description));
        
        // Product Overview
        content.push_str("## Product Overview\n\n");
        content.push_str(&format!("**Project Name:** {}\n", user_input.project_name));
        content.push_str(&format!("**Description:** {}\n", user_input.project_description));
        content.push_str(&format!("**Timeline:** {}\n", user_input.timeline.as_deref().unwrap_or("TBD")));
        content.push_str(&format!("**Budget:** {}\n\n", user_input.budget.as_deref().unwrap_or("TBD")));
        
        // Target Users
        content.push_str("## Target Users\n\n");
        for (i, user) in user_input.target_users.iter().enumerate() {
            content.push_str(&format!("{}. {}\n", i + 1, user));
        }
        content.push_str("\n");
        
        // User Stories
        content.push_str("## User Stories\n\n");
        for (i, feature) in user_input.key_features.iter().enumerate() {
            content.push_str(&format!("**Story {}:** As a user, I want {} so that I can achieve my goals.\n\n", i + 1, feature));
        }
        
        // Functional Requirements
        content.push_str("## Functional Requirements\n\n");
        for (i, feature) in user_input.key_features.iter().enumerate() {
            content.push_str(&format!("**FR{}:** {}\n", i + 1, feature));
            content.push_str("  - The system shall provide this functionality\n");
            content.push_str("  - The system shall be user-friendly\n");
            content.push_str("  - The system shall be reliable\n\n");
        }
        
        // Non-Functional Requirements
        content.push_str("## Non-Functional Requirements\n\n");
        content.push_str("**Performance:**\n");
        content.push_str("- Response time < 2 seconds\n");
        content.push_str("- Support 1000 concurrent users\n\n");
        
        content.push_str("**Security:**\n");
        content.push_str("- Data encryption in transit and at rest\n");
        content.push_str("- User authentication and authorization\n\n");
        
        content.push_str("**Usability:**\n");
        content.push_str("- Intuitive user interface\n");
        content.push_str("- Mobile-responsive design\n\n");
        
        // Success Metrics
        content.push_str("## Success Metrics\n\n");
        for (i, metric) in user_input.success_metrics.iter().enumerate() {
            content.push_str(&format!("{}. {}\n", i + 1, metric));
        }
        content.push_str("\n");
        
        // Constraints
        content.push_str("## Constraints\n\n");
        for (i, constraint) in user_input.constraints.iter().enumerate() {
            content.push_str(&format!("{}. {}\n", i + 1, constraint));
        }
        content.push_str("\n");
        
        // Technical Preferences
        if !user_input.technical_preferences.is_empty() {
            content.push_str("## Technical Preferences\n\n");
            for (i, pref) in user_input.technical_preferences.iter().enumerate() {
                content.push_str(&format!("{}. {}\n", i + 1, pref));
            }
            content.push_str("\n");
        }
        
        Ok(content)
    }
    
    /// Assess PRD quality
    async fn assess_prd_quality(&self, content: &str) -> Result<QualityMetrics, Box<dyn std::error::Error>> {
        let word_count = content.split_whitespace().count() as u32;
        let completeness_score = if word_count >= self.quality_standards.min_word_count { 0.9 } else { 0.6 };
        
        let clarity_score = self.assess_clarity(content);
        let technical_accuracy = 0.8; // Would be assessed by technical review
        let user_focus_score = self.assess_user_focus(content);
        
        Ok(QualityMetrics {
            completeness_score,
            clarity_score,
            technical_accuracy,
            user_focus_score,
        })
    }
    
    /// Assess content clarity
    fn assess_clarity(&self, content: &str) -> f32 {
        // Simple heuristic for clarity assessment
        let sentences = content.split('.').count();
        let words = content.split_whitespace().count();
        let avg_words_per_sentence = words as f32 / sentences as f32;
        
        // Optimal range is 15-20 words per sentence
        if avg_words_per_sentence >= 15.0 && avg_words_per_sentence <= 20.0 {
            0.9
        } else if avg_words_per_sentence >= 10.0 && avg_words_per_sentence <= 25.0 {
            0.7
        } else {
            0.5
        }
    }
    
    /// Assess user focus
    fn assess_user_focus(&self, content: &str) -> f32 {
        let user_mentions = content.to_lowercase().matches("user").count();
        let total_words = content.split_whitespace().count();
        let user_focus_ratio = user_mentions as f32 / total_words as f32;
        
        if user_focus_ratio > 0.02 {
            0.9
        } else if user_focus_ratio > 0.01 {
            0.7
        } else {
            0.5
        }
    }
    
    /// Calculate complexity score
    fn calculate_complexity_score(&self, user_input: &UserInput) -> f32 {
        let mut score = 0.5;
        
        // Adjust based on number of features
        score += (user_input.key_features.len() as f32 * 0.1).min(0.3);
        
        // Adjust based on constraints
        score += (user_input.constraints.len() as f32 * 0.05).min(0.2);
        
        score.min(1.0)
    }
}

impl ArchitectureGenerator {
    /// Create a new architecture generator
    pub fn new() -> Self {
        Self {
            diagram_types: vec![
                DiagramType::SystemOverview,
                DiagramType::ComponentDiagram,
                DiagramType::DataFlowDiagram,
                DiagramType::DeploymentDiagram,
            ],
            architecture_patterns: vec![
                ArchitecturePattern::Microservices,
                ArchitecturePattern::Layered,
                ArchitecturePattern::EventDriven,
            ],
            technology_stack: TechnologyStack {
                frontend: vec!["React".to_string(), "TypeScript".to_string(), "Tailwind CSS".to_string()],
                backend: vec!["Node.js".to_string(), "Express".to_string(), "TypeScript".to_string()],
                database: vec!["PostgreSQL".to_string(), "Redis".to_string()],
                infrastructure: vec!["Docker".to_string(), "Kubernetes".to_string(), "AWS".to_string()],
                tools: vec!["Git".to_string(), "Jest".to_string(), "ESLint".to_string()],
            },
        }
    }
    
    /// Generate architecture document
    pub async fn generate_architecture(&self, user_input: &UserInput) -> Result<ProjectArtifact, Box<dyn std::error::Error>> {
        let content = self.create_architecture_content(user_input).await?;
        
        Ok(ProjectArtifact {
            id: Uuid::new_v4(),
            artifact_type: ArtifactType::TechnicalArchitecture,
            title: format!("Technical Architecture: {}", user_input.project_name),
            content,
            metadata: crate::planning::ArtifactMetadata {
                complexity_score: self.calculate_complexity_score(user_input),
                completeness_score: 0.8,
                quality_score: 0.8,
                tags: vec!["architecture".to_string(), "technical".to_string()],
                review_status: crate::planning::ReviewStatus::Draft,
                approval_status: crate::planning::ApprovalStatus::Pending,
            },
            created_by: "Architecture Generator".to_string(),
            created_at: Utc::now().to_rfc3339(),
            version: 1,
            dependencies: vec![],
        })
    }
    
    /// Create architecture content
    async fn create_architecture_content(&self, user_input: &UserInput) -> Result<String, Box<dyn std::error::Error>> {
        let mut content = String::new();
        
        content.push_str(&format!("# Technical Architecture: {}\n\n", user_input.project_name));
        
        // System Overview
        content.push_str("## System Overview\n\n");
        content.push_str(&format!("{}\n\n", user_input.project_description));
        
        // Architecture Pattern
        content.push_str("## Architecture Pattern\n\n");
        content.push_str("**Microservices Architecture**\n");
        content.push_str("- Scalable and maintainable\n");
        content.push_str("- Independent deployment\n");
        content.push_str("- Technology diversity\n\n");
        
        // Technology Stack
        content.push_str("## Technology Stack\n\n");
        content.push_str("### Frontend\n");
        for tech in &self.technology_stack.frontend {
            content.push_str(&format!("- {}\n", tech));
        }
        content.push_str("\n");
        
        content.push_str("### Backend\n");
        for tech in &self.technology_stack.backend {
            content.push_str(&format!("- {}\n", tech));
        }
        content.push_str("\n");
        
        content.push_str("### Database\n");
        for tech in &self.technology_stack.database {
            content.push_str(&format!("- {}\n", tech));
        }
        content.push_str("\n");
        
        content.push_str("### Infrastructure\n");
        for tech in &self.technology_stack.infrastructure {
            content.push_str(&format!("- {}\n", tech));
        }
        content.push_str("\n");
        
        // System Components
        content.push_str("## System Components\n\n");
        content.push_str("### API Gateway\n");
        content.push_str("- Request routing\n");
        content.push_str("- Authentication\n");
        content.push_str("- Rate limiting\n\n");
        
        content.push_str("### Core Services\n");
        for (i, feature) in user_input.key_features.iter().enumerate() {
            content.push_str(&format!("- Service {}: {}\n", i + 1, feature));
        }
        content.push_str("\n");
        
        content.push_str("### Data Layer\n");
        content.push_str("- Primary database (PostgreSQL)\n");
        content.push_str("- Cache layer (Redis)\n");
        content.push_str("- Data access layer\n\n");
        
        // Deployment Architecture
        content.push_str("## Deployment Architecture\n\n");
        content.push_str("### Containerization\n");
        content.push_str("- Docker containers for all services\n");
        content.push_str("- Kubernetes orchestration\n");
        content.push_str("- Container registry\n\n");
        
        content.push_str("### Infrastructure\n");
        content.push_str("- Cloud provider: AWS\n");
        content.push_str("- Load balancing\n");
        content.push_str("- Auto-scaling\n");
        content.push_str("- Monitoring and logging\n\n");
        
        // Security Architecture
        content.push_str("## Security Architecture\n\n");
        content.push_str("### Authentication\n");
        content.push_str("- JWT tokens\n");
        content.push_str("- OAuth 2.0 integration\n");
        content.push_str("- Multi-factor authentication\n\n");
        
        content.push_str("### Authorization\n");
        content.push_str("- Role-based access control\n");
        content.push_str("- API key management\n");
        content.push_str("- Resource-level permissions\n\n");
        
        content.push_str("### Data Security\n");
        content.push_str("- Encryption in transit (TLS)\n");
        content.push_str("- Encryption at rest\n");
        content.push_str("- Secure key management\n\n");
        
        // Performance Considerations
        content.push_str("## Performance Considerations\n\n");
        content.push_str("### Caching Strategy\n");
        content.push_str("- Redis for session data\n");
        content.push_str("- CDN for static assets\n");
        content.push_str("- Database query optimization\n\n");
        
        content.push_str("### Scalability\n");
        content.push_str("- Horizontal scaling\n");
        content.push_str("- Load balancing\n");
        content.push_str("- Database sharding (if needed)\n\n");
        
        Ok(content)
    }
    
    /// Calculate complexity score
    fn calculate_complexity_score(&self, user_input: &UserInput) -> f32 {
        let mut score = 0.6; // Architecture is inherently complex
        
        // Adjust based on number of features
        score += (user_input.key_features.len() as f32 * 0.05).min(0.2);
        
        // Adjust based on technical preferences
        score += (user_input.technical_preferences.len() as f32 * 0.02).min(0.1);
        
        score.min(1.0)
    }
}

impl UXBriefGenerator {
    /// Create a new UX brief generator
    pub fn new() -> Self {
        Self {
            user_personas: Vec::new(),
            user_journeys: Vec::new(),
            design_principles: vec![
                DesignPrinciple {
                    name: "User-Centered Design".to_string(),
                    description: "Design with the user's needs and goals in mind".to_string(),
                    examples: vec!["User research".to_string(), "Usability testing".to_string()],
                    importance: Importance::Critical,
                },
                DesignPrinciple {
                    name: "Accessibility".to_string(),
                    description: "Ensure the product is accessible to all users".to_string(),
                    examples: vec!["WCAG compliance".to_string(), "Screen reader support".to_string()],
                    importance: Importance::High,
                },
                DesignPrinciple {
                    name: "Responsive Design".to_string(),
                    description: "Design for multiple screen sizes and devices".to_string(),
                    examples: vec!["Mobile-first approach".to_string(), "Flexible layouts".to_string()],
                    importance: Importance::High,
                },
            ],
            accessibility_requirements: vec![
                AccessibilityRequirement {
                    standard: AccessibilityStandard::WCAG_2_1_AA,
                    requirement: "Color contrast ratio of at least 4.5:1".to_string(),
                    implementation: "Use accessible color palettes".to_string(),
                    testing_method: "Automated color contrast testing".to_string(),
                },
                AccessibilityRequirement {
                    standard: AccessibilityStandard::WCAG_2_1_AA,
                    requirement: "Keyboard navigation support".to_string(),
                    implementation: "Implement focus management and keyboard shortcuts".to_string(),
                    testing_method: "Manual keyboard testing".to_string(),
                },
            ],
        }
    }
    
    /// Generate UX brief
    pub async fn generate_ux_brief(&self, user_input: &UserInput) -> Result<ProjectArtifact, Box<dyn std::error::Error>> {
        let content = self.create_ux_brief_content(user_input).await?;
        
        Ok(ProjectArtifact {
            id: Uuid::new_v4(),
            artifact_type: ArtifactType::UXBrief,
            title: format!("UX Brief: {}", user_input.project_name),
            content,
            metadata: crate::planning::ArtifactMetadata {
                complexity_score: self.calculate_complexity_score(user_input),
                completeness_score: 0.8,
                quality_score: 0.8,
                tags: vec!["UX".to_string(), "design".to_string()],
                review_status: crate::planning::ReviewStatus::Draft,
                approval_status: crate::planning::ApprovalStatus::Pending,
            },
            created_by: "UX Brief Generator".to_string(),
            created_at: Utc::now().to_rfc3339(),
            version: 1,
            dependencies: vec![],
        })
    }
    
    /// Create UX brief content
    async fn create_ux_brief_content(&self, user_input: &UserInput) -> Result<String, Box<dyn std::error::Error>> {
        let mut content = String::new();
        
        content.push_str(&format!("# UX Brief: {}\n\n", user_input.project_name));
        
        // Project Overview
        content.push_str("## Project Overview\n\n");
        content.push_str(&format!("{}\n\n", user_input.project_description));
        
        // User Personas
        content.push_str("## User Personas\n\n");
        for (i, user_type) in user_input.target_users.iter().enumerate() {
            content.push_str(&format!("### Persona {}: {}\n", i + 1, user_type));
            content.push_str("**Demographics:**\n");
            content.push_str("- Age: 25-45\n");
            content.push_str("- Occupation: Professional\n");
            content.push_str("- Technical comfort: Intermediate\n\n");
            
            content.push_str("**Goals:**\n");
            content.push_str("- Efficient task completion\n");
            content.push_str("- Easy-to-use interface\n");
            content.push_str("- Reliable functionality\n\n");
            
            content.push_str("**Pain Points:**\n");
            content.push_str("- Complex interfaces\n");
            content.push_str("- Slow loading times\n");
            content.push_str("- Poor mobile experience\n\n");
        }
        
        // User Journey
        content.push_str("## User Journey\n\n");
        content.push_str("### Discovery Phase\n");
        content.push_str("- **Actions:** User discovers the product\n");
        content.push_str("- **Emotions:** Curiosity, interest\n");
        content.push_str("- **Pain Points:** Information overload\n");
        content.push_str("- **Opportunities:** Clear value proposition\n\n");
        
        content.push_str("### Onboarding Phase\n");
        content.push_str("- **Actions:** User signs up and learns the system\n");
        content.push_str("- **Emotions:** Excitement, confusion\n");
        content.push_str("- **Pain Points:** Complex setup process\n");
        content.push_str("- **Opportunities:** Guided onboarding\n\n");
        
        content.push_str("### Usage Phase\n");
        content.push_str("- **Actions:** User performs core tasks\n");
        content.push_str("- **Emotions:** Satisfaction, frustration\n");
        content.push_str("- **Pain Points:** Inefficient workflows\n");
        content.push_str("- **Opportunities:** Streamlined processes\n\n");
        
        // Design Principles
        content.push_str("## Design Principles\n\n");
        for principle in &self.design_principles {
            content.push_str(&format!("### {}\n", principle.name));
            content.push_str(&format!("**Description:** {}\n", principle.description));
            content.push_str("**Examples:**\n");
            for example in &principle.examples {
                content.push_str(&format!("- {}\n", example));
            }
            content.push_str(&format!("**Importance:** {:?}\n\n", principle.importance));
        }
        
        // Key Features UX
        content.push_str("## Key Features UX\n\n");
        for (i, feature) in user_input.key_features.iter().enumerate() {
            content.push_str(&format!("### Feature {}: {}\n", i + 1, feature));
            content.push_str("**User Experience Goals:**\n");
            content.push_str("- Intuitive interaction\n");
            content.push_str("- Clear feedback\n");
            content.push_str("- Error prevention\n\n");
            
            content.push_str("**Design Considerations:**\n");
            content.push_str("- Mobile-first design\n");
            content.push_str("- Accessibility compliance\n");
            content.push_str("- Performance optimization\n\n");
        }
        
        // Accessibility Requirements
        content.push_str("## Accessibility Requirements\n\n");
        for requirement in &self.accessibility_requirements {
            content.push_str(&format!("### {:?}\n", requirement.standard));
            content.push_str(&format!("**Requirement:** {}\n", requirement.requirement));
            content.push_str(&format!("**Implementation:** {}\n", requirement.implementation));
            content.push_str(&format!("**Testing:** {}\n\n", requirement.testing_method));
        }
        
        // Success Metrics
        content.push_str("## UX Success Metrics\n\n");
        content.push_str("### User Engagement\n");
        content.push_str("- Time spent in application\n");
        content.push_str("- Feature adoption rate\n");
        content.push_str("- User retention rate\n\n");
        
        content.push_str("### Usability\n");
        content.push_str("- Task completion rate\n");
        content.push_str("- Error rate\n");
        content.push_str("- User satisfaction score\n\n");
        
        content.push_str("### Accessibility\n");
        content.push_str("- WCAG compliance score\n");
        content.push_str("- Screen reader compatibility\n");
        content.push_str("- Keyboard navigation success rate\n\n");
        
        Ok(content)
    }
    
    /// Calculate complexity score
    fn calculate_complexity_score(&self, user_input: &UserInput) -> f32 {
        let mut score = 0.4; // UX is moderately complex
        
        // Adjust based on number of target users
        score += (user_input.target_users.len() as f32 * 0.1).min(0.3);
        
        // Adjust based on number of features
        score += (user_input.key_features.len() as f32 * 0.05).min(0.2);
        
        score.min(1.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_prd_generator_creation() {
        let generator = PRDGenerator::new();
        assert_eq!(generator.template.title, "Product Requirements Document");
        assert!(!generator.template.sections.is_empty());
    }
    
    #[test]
    fn test_architecture_generator_creation() {
        let generator = ArchitectureGenerator::new();
        assert!(!generator.diagram_types.is_empty());
        assert!(!generator.architecture_patterns.is_empty());
    }
    
    #[test]
    fn test_ux_brief_generator_creation() {
        let generator = UXBriefGenerator::new();
        assert!(!generator.design_principles.is_empty());
        assert!(!generator.accessibility_requirements.is_empty());
    }
    
    #[tokio::test]
    async fn test_prd_generation() {
        let generator = PRDGenerator::new();
        let user_input = UserInput {
            project_name: "Test Project".to_string(),
            project_description: "Test description".to_string(),
            target_users: vec!["developers".to_string()],
            key_features: vec!["feature1".to_string()],
            constraints: vec!["constraint1".to_string()],
            success_metrics: vec!["metric1".to_string()],
            timeline: Some("1 month".to_string()),
            budget: Some("$10k".to_string()),
            technical_preferences: vec!["TypeScript".to_string()],
        };
        
        let artifact = generator.generate_prd(&user_input).await.unwrap();
        assert_eq!(artifact.artifact_type, ArtifactType::PRD);
        assert!(artifact.content.contains("Test Project"));
    }
}
