//! Persistent storage for vector database
//!
//! This module provides persistent storage capabilities for the vector database,
//! including snapshots, persistence, and recovery mechanisms.

use crate::{Collection, Vector};
use anyhow::Result;
use chrono::{DateTime, Utc};
use rocksdb::{DB, Options};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn, error};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotMetadata {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub collections_count: usize,
    pub total_vectors: usize,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistenceConfig {
    pub data_dir: String,
    pub enable_snapshots: bool,
    pub snapshot_interval_minutes: u64,
    pub max_snapshots: usize,
    pub compression_enabled: bool,
}

impl Default for PersistenceConfig {
    fn default() -> Self {
        Self {
            data_dir: "./data/vector-db".to_string(),
            enable_snapshots: true,
            snapshot_interval_minutes: 60,
            max_snapshots: 10,
            compression_enabled: true,
        }
    }
}

pub struct VectorStorage {
    db: Arc<DB>,
    config: PersistenceConfig,
    snapshots: Arc<RwLock<Vec<SnapshotMetadata>>>,
}

impl VectorStorage {
    pub fn new(config: PersistenceConfig) -> Result<Self> {
        // Ensure data directory exists
        std::fs::create_dir_all(&config.data_dir)?;

        let db_path = Path::new(&config.data_dir).join("vectors.db");

        let mut db_options = Options::default();
        db_options.create_if_missing(true);
        db_options.set_compression_type(rocksdb::DBCompressionType::Lz4);
        db_options.set_max_background_jobs(4);
        db_options.set_write_buffer_size(64 * 1024 * 1024); // 64MB

        let db = Arc::new(DB::open(&db_options, &db_path)?);

        info!("Vector storage initialized at: {}", db_path.display());

        Ok(Self {
            db,
            config,
            snapshots: Arc::new(RwLock::new(Vec::new())),
        })
    }

    #[allow(dead_code)]
    pub async fn save_collection(&self, collection: &Collection) -> Result<()> {
        let key = format!("collection:{}", collection.id);
        let value = bincode::serialize(collection)?;

        self.db.put(key.as_bytes(), &value)?;
        info!("Saved collection: {}", collection.id);
        Ok(())
    }

    #[allow(dead_code)]
    pub async fn load_collection(&self, collection_id: &str) -> Result<Option<Collection>> {
        let key = format!("collection:{}", collection_id);

        match self.db.get(key.as_bytes())? {
            Some(data) => {
                let collection: Collection = bincode::deserialize(&data)?;
                Ok(Some(collection))
            }
            None => Ok(None),
        }
    }

    #[allow(dead_code)]
    pub async fn save_vector(&self, collection_id: &str, vector: &Vector) -> Result<()> {
        let key = format!("vector:{}:{}", collection_id, vector.id);
        let value = bincode::serialize(vector)?;

        self.db.put(key.as_bytes(), &value)?;
        Ok(())
    }

    #[allow(dead_code)]
    pub async fn load_vectors(&self, collection_id: &str) -> Result<Vec<Vector>> {
        let prefix = format!("vector:{}:", collection_id);
        let mut vectors = Vec::new();

        let iter = self.db.prefix_iterator(prefix.as_bytes());
        for item in iter {
            let (_, value) = item?;
            let vector: Vector = bincode::deserialize(&value)?;
            vectors.push(vector);
        }

        Ok(vectors)
    }

    #[allow(dead_code)]
    pub async fn delete_vector(&self, collection_id: &str, vector_id: &str) -> Result<()> {
        let key = format!("vector:{}:{}", collection_id, vector_id);
        self.db.delete(key.as_bytes())?;
        Ok(())
    }

    pub async fn create_snapshot(&self) -> Result<SnapshotMetadata> {
        let snapshot_id = uuid::Uuid::new_v4().to_string();
        let timestamp = Utc::now();

        // Create snapshot directory
        let snapshot_dir = Path::new(&self.config.data_dir)
            .join("snapshots")
            .join(&snapshot_id);
        std::fs::create_dir_all(&snapshot_dir)?;

        // Count collections and vectors
        let mut collections_count = 0;
        let mut total_vectors = 0;

        let iter = self.db.iterator(rocksdb::IteratorMode::Start);
        for item in iter {
            let (key, _) = item?;
            let key_str = String::from_utf8_lossy(&key);

            if key_str.starts_with("collection:") {
                collections_count += 1;
            } else if key_str.starts_with("vector:") {
                total_vectors += 1;
            }
        }

        // Create snapshot metadata
        let metadata = SnapshotMetadata {
            id: snapshot_id.clone(),
            timestamp,
            collections_count,
            total_vectors,
            version: "1.0.0".to_string(),
        };

        // Save snapshot metadata
        let metadata_key = format!("snapshot:{}", snapshot_id);
        let metadata_value = bincode::serialize(&metadata)?;
        self.db.put(metadata_key.as_bytes(), &metadata_value)?;

        // Update snapshots list
        {
            let mut snapshots = self.snapshots.write().await;
            snapshots.push(metadata.clone());

            // Keep only the most recent snapshots
            if snapshots.len() > self.config.max_snapshots {
                let to_remove = snapshots.len() - self.config.max_snapshots;
                snapshots.drain(0..to_remove);
            }
        }

        info!("Created snapshot: {} with {} collections and {} vectors",
              snapshot_id, collections_count, total_vectors);

        Ok(metadata)
    }

    pub async fn list_snapshots(&self) -> Result<Vec<SnapshotMetadata>> {
        let mut snapshots = Vec::new();

        let iter = self.db.prefix_iterator("snapshot:".as_bytes());
        for item in iter {
            let (_, value) = item?;
            let metadata: SnapshotMetadata = bincode::deserialize(&value)?;
            snapshots.push(metadata);
        }

        // Sort by timestamp (newest first)
        snapshots.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

        Ok(snapshots)
    }

    #[allow(dead_code)]
    pub async fn restore_snapshot(&self, snapshot_id: &str) -> Result<()> {
        // This is a simplified restore - in a real implementation,
        // you'd want to restore from a specific snapshot
        warn!("Snapshot restore not fully implemented for snapshot: {}", snapshot_id);
        Ok(())
    }

    pub async fn cleanup_old_snapshots(&self) -> Result<()> {
        let snapshots = self.list_snapshots().await?;

        if snapshots.len() <= self.config.max_snapshots {
            return Ok(());
        }

        let to_remove = snapshots.len() - self.config.max_snapshots;
        for snapshot in snapshots.iter().take(to_remove) {
            let metadata_key = format!("snapshot:{}", snapshot.id);
            self.db.delete(metadata_key.as_bytes())?;

            // Remove snapshot directory
            let snapshot_dir = Path::new(&self.config.data_dir)
                .join("snapshots")
                .join(&snapshot.id);
            if snapshot_dir.exists() {
                std::fs::remove_dir_all(&snapshot_dir)?;
            }
        }

        info!("Cleaned up {} old snapshots", to_remove);
        Ok(())
    }

    pub async fn get_storage_stats(&self) -> Result<StorageStats> {
        let mut collections_count = 0;
        let mut total_vectors = 0;
        let mut total_size_bytes = 0;

        let iter = self.db.iterator(rocksdb::IteratorMode::Start);
        for item in iter {
            let (key, value) = item?;
            let key_str = String::from_utf8_lossy(&key);

            if key_str.starts_with("collection:") {
                collections_count += 1;
            } else if key_str.starts_with("vector:") {
                total_vectors += 1;
            }

            total_size_bytes += key.len() + value.len();
        }

        Ok(StorageStats {
            collections_count,
            total_vectors,
            total_size_bytes,
            db_size_bytes: 0, // Simplified for now
        })
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StorageStats {
    pub collections_count: usize,
    pub total_vectors: usize,
    pub total_size_bytes: usize,
    pub db_size_bytes: u64,
}

impl VectorStorage {
    pub async fn start_snapshot_scheduler(&self) -> Result<()> {
        if !self.config.enable_snapshots {
            return Ok(());
        }

        let storage = self.clone();
        let interval = self.config.snapshot_interval_minutes;

        tokio::spawn(async move {
            let mut interval_timer = tokio::time::interval(
                std::time::Duration::from_secs(interval * 60)
            );

            loop {
                interval_timer.tick().await;

                match storage.create_snapshot().await {
                    Ok(metadata) => {
                        info!("Scheduled snapshot created: {}", metadata.id);
                    }
                    Err(e) => {
                        error!("Failed to create scheduled snapshot: {}", e);
                    }
                }

                // Cleanup old snapshots
                if let Err(e) = storage.cleanup_old_snapshots().await {
                    error!("Failed to cleanup old snapshots: {}", e);
                }
            }
        });

        Ok(())
    }
}

impl Clone for VectorStorage {
    fn clone(&self) -> Self {
        Self {
            db: Arc::clone(&self.db),
            config: self.config.clone(),
            snapshots: Arc::clone(&self.snapshots),
        }
    }
}
