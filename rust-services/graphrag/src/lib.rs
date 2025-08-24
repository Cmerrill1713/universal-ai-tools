//! GraphRAG Service Library
//! 
//! High-performance Rust implementation of Graph-based Retrieval Augmented Generation
//! with advanced caching, connection pooling, and load testing capabilities.

pub mod database_pool;
pub mod embeddings;
pub mod graph;
pub mod redis_cache;
pub mod supabase;

// Load testing module for performance validation
pub mod load_test;