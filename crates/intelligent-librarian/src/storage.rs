//! Knowledge storage for the Intelligent Librarian

use crate::models::*;
use anyhow::Result;
use std::collections::HashMap;

/// Knowledge storage system
pub struct KnowledgeStorage {
    // In a real implementation, this would connect to Supabase
    // For now, we'll use in-memory storage for testing
    documents: HashMap<DocumentId, Document>,
    categories: HashMap<String, usize>,
}

impl KnowledgeStorage {
    pub async fn new() -> Result<Self> {
        Ok(Self {
            documents: HashMap::new(),
            categories: HashMap::new(),
        })
    }

    /// Store a document
    pub async fn store_document(
        &mut self,
        document: Document,
        classification: &ClassificationResult,
        _quality_score: f64,
    ) -> Result<DocumentId> {
        let document_id = document.id;

        // Update category count
        let category_count = self.categories.entry(classification.category.clone()).or_insert(0);
        *category_count += 1;

        // Store document
        self.documents.insert(document_id, document);

        Ok(document_id)
    }

    /// Update document metadata
    pub async fn update_document(&mut self, document_id: DocumentId, updates: &DocumentUpdates) -> Result<()> {
        if let Some(document) = self.documents.get_mut(&document_id) {
            // Apply updates
            if let Some(metadata_updates) = &updates.metadata_updates {
                document.metadata = metadata_updates.clone();
            }

            // Add tags
            for tag in &updates.tags_add {
                if !document.metadata.tags.contains(tag) {
                    document.metadata.tags.push(tag.clone());
                }
            }

            // Remove tags
            document.metadata.tags.retain(|tag| !updates.tags_remove.contains(tag));
        }

        Ok(())
    }

    /// Get storage statistics
    pub async fn get_statistics(&self) -> Result<StorageStatistics> {
        let total_documents = self.documents.len();
        let total_categories = self.categories.len();

        let quality_scores: Vec<f64> = self.documents.values()
            .filter_map(|doc| doc.quality_score)
            .collect();

        let average_quality_score = if quality_scores.is_empty() {
            0.0
        } else {
            quality_scores.iter().sum::<f64>() / quality_scores.len() as f64
        };

        Ok(StorageStatistics {
            total_documents,
            total_categories,
            average_quality_score,
        })
    }
}

/// Classification result for document storage
#[derive(Debug, Clone)]
pub struct ClassificationResult {
    pub document_id: DocumentId,
    pub category: String,
    pub confidence: f64,
    pub labels: Vec<String>,
}

/// Storage statistics
#[derive(Debug, Clone)]
pub struct StorageStatistics {
    pub total_documents: usize,
    pub total_categories: usize,
    pub average_quality_score: f64,
}
