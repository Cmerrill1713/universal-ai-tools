//! Quality assessment for the Intelligent Librarian

use crate::models::*;
use anyhow::Result;

/// Quality assessor for content evaluation
pub struct QualityAssessor {
    // Quality assessment parameters
    clarity_weight: f64,
    accuracy_weight: f64,
    relevance_weight: f64,
    completeness_weight: f64,
}

impl QualityAssessor {
    pub async fn new() -> Result<Self> {
        Ok(Self {
            clarity_weight: 0.3,
            accuracy_weight: 0.3,
            relevance_weight: 0.2,
            completeness_weight: 0.2,
        })
    }

    /// Assess the quality of a document
    pub async fn assess(&self, document: &Document, analysis: &ContentAnalysis) -> Result<f64> {
        let clarity_score = self.assess_clarity(document, analysis).await?;
        let accuracy_score = self.assess_accuracy(document, analysis).await?;
        let relevance_score = self.assess_relevance(document, analysis).await?;
        let completeness_score = self.assess_completeness(document, analysis).await?;

        let overall_score =
            clarity_score * self.clarity_weight +
            accuracy_score * self.accuracy_weight +
            relevance_score * self.relevance_weight +
            completeness_score * self.completeness_weight;

        Ok(overall_score.min(1.0).max(0.0))
    }

    async fn assess_clarity(&self, _document: &Document, analysis: &ContentAnalysis) -> Result<f64> {
        // Assess clarity based on readability and complexity
        let readability_score = analysis.readability_score;
        let complexity_score = 1.0 - analysis.complexity_score; // Lower complexity = higher clarity

        Ok((readability_score + complexity_score) / 2.0)
    }

    async fn assess_accuracy(&self, _document: &Document, analysis: &ContentAnalysis) -> Result<f64> {
        // Assess accuracy based on technical level and entity confidence
        let technical_level_score = match analysis.technical_level {
            TechnicalLevel::Expert => 1.0,
            TechnicalLevel::Advanced => 0.8,
            TechnicalLevel::Intermediate => 0.6,
            TechnicalLevel::Beginner => 0.4,
        };

        let entity_confidence = if analysis.entities.is_empty() {
            0.5
        } else {
            analysis.entities.iter().map(|e| e.confidence).sum::<f64>() / analysis.entities.len() as f64
        };

        Ok((technical_level_score + entity_confidence) / 2.0)
    }

    async fn assess_relevance(&self, _document: &Document, analysis: &ContentAnalysis) -> Result<f64> {
        // Assess relevance based on topic coverage and keyword density
        let topic_score = if analysis.topics.is_empty() {
            0.5
        } else {
            (analysis.topics.len() as f64 / 10.0).min(1.0)
        };

        let keyword_score = if analysis.keywords.is_empty() {
            0.5
        } else {
            (analysis.keywords.len() as f64 / 20.0).min(1.0)
        };

        Ok((topic_score + keyword_score) / 2.0)
    }

    async fn assess_completeness(&self, document: &Document, analysis: &ContentAnalysis) -> Result<f64> {
        // Assess completeness based on content length and analysis depth
        let content_length_score = (document.content.len() as f64 / 1000.0).min(1.0);

        let analysis_depth_score = if analysis.summary.is_some() && !analysis.entities.is_empty() {
            1.0
        } else if analysis.summary.is_some() || !analysis.entities.is_empty() {
            0.7
        } else {
            0.3
        };

        Ok((content_length_score + analysis_depth_score) / 2.0)
    }
}
