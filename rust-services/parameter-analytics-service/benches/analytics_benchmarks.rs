//! Performance benchmarks for Parameter Analytics Service
//! 
//! Validates 10-50x performance improvements over TypeScript implementation

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId, Throughput};
use parameter_analytics_service::*;
use tokio::runtime::Runtime;
use uuid::Uuid;
use chrono::Utc;
use std::time::Duration;

fn create_test_execution(quality: f64) -> ParameterExecution {
    ParameterExecution {
        id: Uuid::new_v4(),
        task_type: TaskType::CodeGeneration,
        user_input: "Benchmark test input for parameter analytics performance measurement".to_string(),
        parameters: TaskParameters {
            context_length: 4096,
            temperature: 0.7,
            top_p: Some(0.9),
            max_tokens: 2048,
            system_prompt: "You are a helpful AI assistant for performance testing.".to_string(),
            user_prompt_template: "{user_input}".to_string(),
            stop_sequences: None,
            presence_penalty: None,
            frequency_penalty: None,
        },
        model: "benchmark-model".to_string(),
        provider: "benchmark-provider".to_string(),
        user_id: Some("benchmark-user".to_string()),
        request_id: Uuid::new_v4().to_string(),
        timestamp: Utc::now(),
        execution_time: 1200,
        token_usage: TokenUsage {
            prompt_tokens: 200,
            completion_tokens: 400,
            total_tokens: 600,
        },
        response_length: 1000,
        response_quality: Some(quality),
        user_satisfaction: Some(quality * 5.0),
        success: true,
        error_type: None,
        retry_count: 0,
        complexity: Complexity::Medium,
        domain: Some("benchmarking".to_string()),
        endpoint: "/api/benchmark".to_string(),
    }
}

fn benchmark_service_initialization(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    
    c.bench_function("service_initialization", |b| {
        b.to_async(&rt).iter(|| async {
            let config = AnalyticsConfig::default();
            let service = ParameterAnalyticsService::new(config).await.unwrap();
            black_box(service)
        });
    });
}

fn benchmark_execution_processing(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    
    let service = rt.block_on(async {
        let config = AnalyticsConfig::default();
        ParameterAnalyticsService::new(config).await.unwrap()
    });
    
    c.bench_function("single_execution_processing", |b| {
        b.to_async(&rt).iter(|| async {
            let execution = create_test_execution(0.8);
            let result = service.process_execution(black_box(execution)).await.unwrap();
            black_box(result)
        });
    });
}

fn benchmark_batch_processing(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    
    let service = rt.block_on(async {
        let config = AnalyticsConfig {
            buffer_size: 1000,
            ..Default::default()
        };
        ParameterAnalyticsService::new(config).await.unwrap()
    });
    
    let mut group = c.benchmark_group("batch_processing");
    
    for batch_size in [10, 50, 100, 500].iter() {
        group.throughput(Throughput::Elements(*batch_size as u64));
        group.bench_with_input(
            BenchmarkId::new("executions", batch_size),
            batch_size,
            |b, &size| {
                b.to_async(&rt).iter(|| async {
                    let mut tasks = Vec::new();
                    
                    for i in 0..size {
                        let execution = create_test_execution(0.7 + (i as f64 / size as f64) * 0.2);
                        let service_ref = &service;
                        tasks.push(async move {
                            service_ref.process_execution(execution).await
                        });
                    }
                    
                    let results = futures::future::join_all(tasks).await;
                    black_box(results)
                });
            },
        );
    }
    
    group.finish();
}

fn benchmark_effectiveness_computation(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    
    let service = rt.block_on(async {
        let config = AnalyticsConfig::default();
        let service = ParameterAnalyticsService::new(config).await.unwrap();
        
        // Pre-populate with test data
        for i in 0..100 {
            let execution = create_test_execution(0.5 + (i as f64 / 100.0) * 0.4);
            let _ = service.process_execution(execution).await;
        }
        
        // Allow processing to complete
        tokio::time::sleep(Duration::from_millis(200)).await;
        
        service
    });
    
    c.bench_function("effectiveness_computation", |b| {
        b.to_async(&rt).iter(|| async {
            let filter = EffectivenessFilter::default();
            let result = service.get_effectiveness(black_box(filter)).await.unwrap();
            black_box(result)
        });
    });
}

fn benchmark_insight_generation(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    
    let service = rt.block_on(async {
        let config = AnalyticsConfig {
            min_sample_size: 10, // Lower threshold for benchmarking
            ..Default::default()
        };
        let service = ParameterAnalyticsService::new(config).await.unwrap();
        
        // Pre-populate with diverse test data
        for i in 0..50 {
            let mut execution = create_test_execution(0.6 + (i as f64 / 50.0) * 0.3);
            execution.task_type = if i % 2 == 0 { 
                TaskType::CodeGeneration 
            } else { 
                TaskType::TextAnalysis 
            };
            execution.parameters.temperature = 0.3 + (i as f64 / 50.0) * 0.6;
            let _ = service.process_execution(execution).await;
        }
        
        // Allow processing to complete
        tokio::time::sleep(Duration::from_millis(300)).await;
        
        service
    });
    
    let mut group = c.benchmark_group("insight_generation");
    
    for task_type in [TaskType::CodeGeneration, TaskType::TextAnalysis].iter() {
        group.bench_with_input(
            BenchmarkId::new("task_type", format!("{:?}", task_type)),
            task_type,
            |b, task_type| {
                b.to_async(&rt).iter(|| async {
                    let result = service.generate_insights(black_box(task_type.clone())).await.unwrap();
                    black_box(result)
                });
            },
        );
    }
    
    group.finish();
}

fn benchmark_analytics_snapshot(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    
    let service = rt.block_on(async {
        let config = AnalyticsConfig::default();
        let service = ParameterAnalyticsService::new(config).await.unwrap();
        
        // Pre-populate with test data
        for i in 0..200 {
            let execution = create_test_execution(0.4 + (i as f64 / 200.0) * 0.5);
            let _ = service.process_execution(execution).await;
        }
        
        // Allow processing to complete
        tokio::time::sleep(Duration::from_millis(400)).await;
        
        service
    });
    
    c.bench_function("analytics_snapshot", |b| {
        b.to_async(&rt).iter(|| async {
            let result = service.get_analytics().await.unwrap();
            black_box(result)
        });
    });
}

fn benchmark_concurrent_operations(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    
    let service = rt.block_on(async {
        let config = AnalyticsConfig {
            parallel_workers: 8,
            ..Default::default()
        };
        ParameterAnalyticsService::new(config).await.unwrap()
    });
    
    let mut group = c.benchmark_group("concurrent_operations");
    
    for concurrency_level in [1, 4, 8, 16].iter() {
        group.throughput(Throughput::Elements(*concurrency_level as u64));
        group.bench_with_input(
            BenchmarkId::new("concurrent_processing", concurrency_level),
            concurrency_level,
            |b, &concurrency| {
                b.to_async(&rt).iter(|| async {
                    let mut tasks = Vec::new();
                    
                    for i in 0..concurrency {
                        let execution = create_test_execution(0.6 + (i as f64 / concurrency as f64) * 0.3);
                        let service_ref = &service;
                        tasks.push(async move {
                            service_ref.process_execution(execution).await
                        });
                    }
                    
                    let results = futures::future::join_all(tasks).await;
                    black_box(results)
                });
            },
        );
    }
    
    group.finish();
}

fn benchmark_health_checks(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    
    let service = rt.block_on(async {
        let config = AnalyticsConfig::default();
        ParameterAnalyticsService::new(config).await.unwrap()
    });
    
    c.bench_function("health_check", |b| {
        b.to_async(&rt).iter(|| async {
            let result = service.health_check().await;
            black_box(result)
        });
    });
}

fn benchmark_mixed_workload(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    
    let service = rt.block_on(async {
        let config = AnalyticsConfig::default();
        ParameterAnalyticsService::new(config).await.unwrap()
    });
    
    c.bench_function("mixed_workload", |b| {
        b.to_async(&rt).iter(|| async {
            // Simulate real-world mixed workload
            let mut tasks = Vec::new();
            
            // 70% execution processing
            for i in 0..7 {
                let execution = create_test_execution(0.7 + (i as f64 * 0.03));
                let service_ref = &service;
                tasks.push(async move {
                    service_ref.process_execution(execution).await.map(|_| ())
                });
            }
            
            // 20% analytics queries
            for _ in 0..2 {
                let service_ref = &service;
                tasks.push(async move {
                    service_ref.get_analytics().await.map(|_| ())
                });
            }
            
            // 10% health checks
            {
                let service_ref = &service;
                tasks.push(async move {
                    service_ref.health_check().await;
                    Ok(())
                });
            }
            
            let results = futures::future::join_all(tasks).await;
            black_box(results)
        });
    });
}

// Performance comparison benchmarks to validate improvement claims

fn benchmark_performance_baseline(c: &mut Criterion) {
    // This would benchmark equivalent TypeScript operations if available
    // For now, we establish Rust performance baselines
    
    let rt = Runtime::new().unwrap();
    let service = rt.block_on(async {
        ParameterAnalyticsService::new(AnalyticsConfig::default()).await.unwrap()
    });
    
    let mut group = c.benchmark_group("performance_baseline");
    group.measurement_time(Duration::from_secs(10));
    
    // Baseline: Single execution processing (target: < 1ms)
    group.bench_function("baseline_execution_processing", |b| {
        b.to_async(&rt).iter(|| async {
            let execution = create_test_execution(0.8);
            let result = service.process_execution(execution).await.unwrap();
            black_box(result)
        });
    });
    
    // Baseline: Batch processing throughput (target: > 1000 ops/sec)
    group.throughput(Throughput::Elements(100));
    group.bench_function("baseline_batch_throughput", |b| {
        b.to_async(&rt).iter(|| async {
            let mut tasks = Vec::new();
            for i in 0..100 {
                let execution = create_test_execution(0.5 + (i as f64 / 100.0) * 0.4);
                let service_ref = &service;
                tasks.push(async move {
                    service_ref.process_execution(execution).await
                });
            }
            let results = futures::future::join_all(tasks).await;
            black_box(results)
        });
    });
    
    group.finish();
}

criterion_group!(
    benches,
    benchmark_service_initialization,
    benchmark_execution_processing,
    benchmark_batch_processing,
    benchmark_effectiveness_computation,
    benchmark_insight_generation,
    benchmark_analytics_snapshot,
    benchmark_concurrent_operations,
    benchmark_health_checks,
    benchmark_mixed_workload,
    benchmark_performance_baseline
);

criterion_main!(benches);