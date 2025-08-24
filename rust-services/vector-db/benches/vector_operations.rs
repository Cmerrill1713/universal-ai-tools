// Comprehensive benchmarking suite for vector database operations
// Measures performance across different scenarios and configurations

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId, Throughput};
use std::sync::Arc;
use tempfile::tempdir;
use tokio::runtime::Runtime;

use vector_db::{
    config::{Config, StorageBackend as StorageBackendConfig},
    simple_engine::SimpleVectorEngine,
    types::*,
    metrics::MetricsService,
};

/// Benchmark configuration
struct BenchConfig {
    dimensions: usize,
    vector_count: usize,
    search_count: usize,
    storage_backend: StorageBackendConfig,
}

impl BenchConfig {
    fn new(dimensions: usize, vector_count: usize) -> Self {
        Self {
            dimensions,
            vector_count,
            search_count: 100,
            storage_backend: StorageBackendConfig::Memory,
        }
    }
    
    fn with_storage(mut self, backend: StorageBackendConfig) -> Self {
        self.storage_backend = backend;
        self
    }
}

/// Benchmark fixture for setting up test environments
struct BenchFixture {
    engine: SimpleVectorEngine,
    test_vectors: Vec<VectorDocument>,
    query_vectors: Vec<Vec<f32>>,
    _temp_dir: Option<tempfile::TempDir>,
}

impl BenchFixture {
    async fn new(config: BenchConfig) -> anyhow::Result<Self> {
        let temp_dir = tempdir().ok();
        let mut engine_config = Config::default();
        engine_config.storage.backend = config.storage_backend;
        if let Some(ref dir) = temp_dir {
            engine_config.storage.local_path = Some(dir.path().to_str().unwrap().to_string());
        }
        engine_config.vector.dimensions = config.dimensions;
        engine_config.vector.cache_size = 10000;
        
        let metrics = Arc::new(MetricsService::new()?);
        let engine = SimpleVectorEngine::new(engine_config, metrics).await?;
        
        // Generate test data
        let test_vectors = generate_test_vectors(config.vector_count, config.dimensions);
        let query_vectors = generate_query_vectors(config.search_count, config.dimensions);
        
        Ok(Self {
            engine,
            test_vectors,
            query_vectors,
            _temp_dir: temp_dir,
        })
    }
    
    async fn setup_data(&self) -> anyhow::Result<()> {
        self.engine.batch_insert_documents(self.test_vectors.clone()).await?;
        Ok(())
    }
}

/// Generate diverse test vectors for benchmarking
fn generate_test_vectors(count: usize, dimensions: usize) -> Vec<VectorDocument> {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let mut vectors = Vec::with_capacity(count);
    
    for i in 0..count {
        let mut embedding = vec![0.0; dimensions];
        
        // Create different distribution patterns
        match i % 5 {
            0 => {
                // Random normal distribution
                for j in 0..dimensions {
                    embedding[j] = rng.gen_range(-1.0..1.0);
                }
            }
            1 => {
                // Sparse vectors (mostly zeros)
                let sparse_count = dimensions / 10;
                for _ in 0..sparse_count {
                    let idx = rng.gen_range(0..dimensions);
                    embedding[idx] = rng.gen_range(-1.0..1.0);
                }
            }
            2 => {
                // Dense vectors (all non-zero)
                for j in 0..dimensions {
                    embedding[j] = rng.gen_range(0.1..1.0);
                }
            }
            3 => {
                // Clustered vectors (similar to first few dimensions)
                for j in 0..(dimensions.min(10)) {
                    embedding[j] = 0.8 + rng.gen_range(-0.2..0.2);
                }
            }
            4 => {
                // Unit vectors (normalized)
                for j in 0..dimensions {
                    embedding[j] = rng.gen_range(-1.0..1.0);
                }
                let norm = embedding.iter().map(|x| x * x).sum::<f32>().sqrt();
                if norm > 0.0 {
                    for j in 0..dimensions {
                        embedding[j] /= norm;
                    }
                }
            }
            _ => unreachable!(),
        }
        
        let content = format!("Benchmark document {} type {}", i, i % 5);
        let metadata = serde_json::json!({
            "id": i,
            "type": i % 5,
            "benchmark": true
        });
        
        vectors.push(VectorDocument::new(content, embedding, Some(metadata)));
    }
    
    vectors
}

/// Generate query vectors for search benchmarks
fn generate_query_vectors(count: usize, dimensions: usize) -> Vec<Vec<f32>> {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let mut queries = Vec::with_capacity(count);
    
    for i in 0..count {
        let mut query = vec![0.0; dimensions];
        
        // Different query patterns
        match i % 3 {
            0 => {
                // Random queries
                for j in 0..dimensions {
                    query[j] = rng.gen_range(-1.0..1.0);
                }
            }
            1 => {
                // Sparse queries
                let sparse_count = dimensions / 20;
                for _ in 0..sparse_count {
                    let idx = rng.gen_range(0..dimensions);
                    query[idx] = rng.gen_range(-1.0..1.0);
                }
            }
            2 => {
                // Focused queries (only first few dimensions)
                for j in 0..(dimensions.min(5)) {
                    query[j] = rng.gen_range(-1.0..1.0);
                }
            }
            _ => unreachable!(),
        }
        
        queries.push(query);
    }
    
    queries
}

/// Benchmark insertion operations
fn bench_insert_operations(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    
    let mut group = c.benchmark_group("insert_operations");
    
    for dimensions in [64, 128, 256, 512, 1024] {
        for batch_size in [1, 10, 100, 1000] {
            let config = BenchConfig::new(dimensions, batch_size);
            
            group.throughput(Throughput::Elements(batch_size as u64));
            group.bench_with_input(
                BenchmarkId::new("batch_insert", format!("{}d_{}docs", dimensions, batch_size)),
                &config,
                |b, config| {
                    b.to_async(&rt).iter(|| async {
                        let fixture = BenchFixture::new(config.clone()).await.unwrap();
                        let vectors = &fixture.test_vectors;
                        
                        black_box(
                            fixture.engine.batch_insert_documents(vectors.clone()).await.unwrap()
                        );
                    });
                },
            );
        }
    }
    
    group.finish();
}

/// Benchmark search operations
fn bench_search_operations(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    
    let mut group = c.benchmark_group("search_operations");
    group.sample_size(50); // Fewer samples for longer operations
    
    for dimensions in [64, 128, 256, 512] {
        for vector_count in [1000, 5000, 10000] {
            let config = BenchConfig::new(dimensions, vector_count);
            
            group.throughput(Throughput::Elements(1));
            group.bench_with_input(
                BenchmarkId::new("search", format!("{}d_{}vectors", dimensions, vector_count)),
                &config,
                |b, config| {
                    b.to_async(&rt).iter_with_setup(
                        || {
                            rt.block_on(async {
                                let fixture = BenchFixture::new(config.clone()).await.unwrap();
                                fixture.setup_data().await.unwrap();
                                fixture
                            })
                        },
                        |fixture| async move {
                            let query = SearchQuery {
                                query_vector: fixture.query_vectors[0].clone(),
                                limit: Some(10),
                                threshold: Some(0.0),
                                filter: None,
                                include_metadata: Some(true),
                            };
                            
                            black_box(fixture.engine.search(&query).await.unwrap());
                        },
                    );
                },
            );
        }
    }
    
    group.finish();
}

/// Benchmark different similarity metrics
fn bench_similarity_metrics(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    
    let mut group = c.benchmark_group("similarity_metrics");
    
    let dimensions = 256;
    let vector_count = 5000;
    let config = BenchConfig::new(dimensions, vector_count);
    
    // Note: This benchmark would require implementing different similarity metrics
    // in the search query. For now, we benchmark the default cosine similarity.
    
    group.throughput(Throughput::Elements(1));
    group.bench_with_input(
        BenchmarkId::new("cosine_similarity", format!("{}d_{}vectors", dimensions, vector_count)),
        &config,
        |b, config| {
            b.to_async(&rt).iter_with_setup(
                || {
                    rt.block_on(async {
                        let fixture = BenchFixture::new(config.clone()).await.unwrap();
                        fixture.setup_data().await.unwrap();
                        fixture
                    })
                },
                |fixture| async move {
                    let query = SearchQuery {
                        query_vector: fixture.query_vectors[0].clone(),
                        limit: Some(10),
                        threshold: Some(0.0),
                        filter: None,
                        include_metadata: Some(true),
                    };
                    
                    black_box(fixture.engine.search(&query).await.unwrap());
                },
            );
        },
    );
    
    group.finish();
}

/// Benchmark storage backends
fn bench_storage_backends(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    
    let mut group = c.benchmark_group("storage_backends");
    group.sample_size(30);
    
    let dimensions = 128;
    let vector_count = 1000;
    
    for backend in [StorageBackendConfig::Memory, StorageBackendConfig::Local, StorageBackendConfig::Hybrid] {
        let config = BenchConfig::new(dimensions, vector_count).with_storage(backend.clone());
        let backend_name = match backend {
            StorageBackendConfig::Memory => "memory",
            StorageBackendConfig::Local => "local",
            StorageBackendConfig::Hybrid => "hybrid",
            _ => "other",
        };
        
        group.throughput(Throughput::Elements(vector_count as u64));
        group.bench_with_input(
            BenchmarkId::new("insert_and_search", backend_name),
            &config,
            |b, config| {
                b.to_async(&rt).iter(|| async {
                    let fixture = BenchFixture::new(config.clone()).await.unwrap();
                    
                    // Insert data
                    fixture.engine.batch_insert_documents(fixture.test_vectors.clone()).await.unwrap();
                    
                    // Perform searches
                    for query_vector in &fixture.query_vectors[..10] {
                        let query = SearchQuery {
                            query_vector: query_vector.clone(),
                            limit: Some(5),
                            threshold: Some(0.0),
                            filter: None,
                            include_metadata: Some(true),
                        };
                        
                        black_box(fixture.engine.search(&query).await.unwrap());
                    }
                });
            },
        );
    }
    
    group.finish();
}

/// Benchmark concurrent operations
fn bench_concurrent_operations(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    
    let mut group = c.benchmark_group("concurrent_operations");
    group.sample_size(20);
    
    let dimensions = 128;
    let vector_count = 2000;
    let config = BenchConfig::new(dimensions, vector_count);
    
    for concurrency in [1, 2, 4, 8, 16] {
        group.throughput(Throughput::Elements(concurrency as u64));
        group.bench_with_input(
            BenchmarkId::new("concurrent_search", format!("{}_threads", concurrency)),
            &config,
            |b, config| {
                b.to_async(&rt).iter_with_setup(
                    || {
                        rt.block_on(async {
                            let fixture = BenchFixture::new(config.clone()).await.unwrap();
                            fixture.setup_data().await.unwrap();
                            Arc::new(fixture)
                        })
                    },
                    |fixture| async move {
                        let mut handles = Vec::new();
                        
                        for i in 0..concurrency {
                            let fixture_clone = fixture.clone();
                            let handle = tokio::spawn(async move {
                                let query = SearchQuery {
                                    query_vector: fixture_clone.query_vectors[i % fixture_clone.query_vectors.len()].clone(),
                                    limit: Some(10),
                                    threshold: Some(0.0),
                                    filter: None,
                                    include_metadata: Some(true),
                                };
                                
                                fixture_clone.engine.search(&query).await.unwrap()
                            });
                            handles.push(handle);
                        }
                        
                        for handle in handles {
                            black_box(handle.await.unwrap());
                        }
                    },
                );
            },
        );
    }
    
    group.finish();
}

/// Benchmark memory efficiency
fn bench_memory_efficiency(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    
    let mut group = c.benchmark_group("memory_efficiency");
    group.sample_size(10);
    
    for dimensions in [64, 128, 256, 512] {
        let vector_count = 10000; // Large dataset
        let config = BenchConfig::new(dimensions, vector_count);
        
        group.throughput(Throughput::Bytes((vector_count * dimensions * 4) as u64)); // 4 bytes per f32
        group.bench_with_input(
            BenchmarkId::new("large_dataset", format!("{}d_{}k_vectors", dimensions, vector_count / 1000)),
            &config,
            |b, config| {
                b.to_async(&rt).iter(|| async {
                    let fixture = BenchFixture::new(config.clone()).await.unwrap();
                    
                    // Insert large dataset
                    fixture.engine.batch_insert_documents(fixture.test_vectors.clone()).await.unwrap();
                    
                    // Verify we can still search efficiently
                    let query = SearchQuery {
                        query_vector: fixture.query_vectors[0].clone(),
                        limit: Some(10),
                        threshold: Some(0.0),
                        filter: None,
                        include_metadata: Some(true),
                    };
                    
                    black_box(fixture.engine.search(&query).await.unwrap());
                });
            },
        );
    }
    
    group.finish();
}

// Helper trait to make BenchConfig cloneable
impl Clone for BenchConfig {
    fn clone(&self) -> Self {
        Self {
            dimensions: self.dimensions,
            vector_count: self.vector_count,
            search_count: self.search_count,
            storage_backend: self.storage_backend.clone(),
        }
    }
}

criterion_group!(
    benches,
    bench_insert_operations,
    bench_search_operations,
    bench_similarity_metrics,
    bench_storage_backends,
    bench_concurrent_operations,
    bench_memory_efficiency
);

criterion_main!(benches);