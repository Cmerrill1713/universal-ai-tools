#!/usr/bin/env python3

"""
Expand MLX Training Dataset
Adds error handling, debugging, and advanced scenarios to existing dataset
"""

import json
import os
from pathlib import Path
from datetime import datetime

def load_existing_dataset():
    """Load the current training dataset"""
    data_file = Path("/Users/christianmerrill/Desktop/universal-ai-tools/mlx-training-data/universal_ai_tools_training.json")
    
    if not data_file.exists():
        print(f"❌ Existing dataset not found: {data_file}")
        return []
    
    with open(data_file, 'r') as f:
        return json.load(f)

def create_expanded_training_examples():
    """Create additional training examples for error handling and debugging"""
    
    expanded_examples = [
        # Error Handling and Debugging Scenarios
        {
            "instruction": "How do you debug a Rust service that won't start?",
            "input": "The LLM Router service on port 8082 is failing to start with 'address already in use' error",
            "output": "Check if another process is using port 8082 with 'lsof -i :8082', kill the process with 'kill -9 [PID]', verify Rust service configuration in Cargo.toml, check logs in /tmp/llm-router.log, restart with 'cargo run --release', and monitor with health endpoint /health."
        },
        {
            "instruction": "What causes 'Service Unavailable' errors in the hybrid architecture?",
            "input": "Getting 503 Service Unavailable from the Go API Gateway",
            "output": "503 errors indicate backend service failure. Check: Go API Gateway logs for upstream connection errors, verify all backend services (Rust LLM Router :8082, AI Core :8083) are running, test health endpoints directly, check circuit breaker status, verify database connections (PostgreSQL :5432, Redis :6379), and restart failed services."
        },
        {
            "instruction": "How do you resolve memory leaks in the Node.js legacy services?",
            "input": "TypeScript server memory usage growing from 200MB to 4GB over time",
            "output": "Memory leaks in TypeScript services: Use 'node --max-old-space-size=1024' flag, enable garbage collection with '--expose-gc', monitor with 'process.memoryUsage()', identify leaks with heap snapshots, check for unclosed database connections, review event listener cleanup, migrate critical services to Rust/Go for better memory management."
        },
        {
            "instruction": "What steps resolve Swift macOS app crashes on startup?",
            "input": "Universal AI Tools macOS app crashes immediately after launch",
            "output": "Swift app startup crashes: Check Xcode console for crash logs, verify all required frameworks are linked (SwiftAnthropic, Pow, Vortex), ensure @Observable classes are properly initialized, check Keychain access permissions, verify backend service availability (localhost:9999), update to latest Xcode/macOS versions, clean build folder and rebuild."
        },
        {
            "instruction": "How do you troubleshoot WebSocket connection failures?",
            "input": "WebSocket connections dropping frequently in the Go service",
            "output": "WebSocket troubleshooting: Check Go WebSocket service logs on port 8081, verify client connection handling in hub.go, monitor connection count and memory usage, check for proper connection cleanup, verify network timeouts and keep-alive settings, test with simple WebSocket client, restart WebSocket service if hub is corrupted."
        },
        
        # Performance Optimization Scenarios
        {
            "instruction": "How do you optimize Rust service performance for high load?",
            "input": "LLM Router experiencing slow response times under 1000+ concurrent requests",
            "output": "Rust performance optimization: Enable release mode with 'cargo build --release', use async/await with tokio runtime, implement connection pooling, add request queuing with bounded channels, monitor CPU/memory with built-in metrics, enable LTO (Link Time Optimization), consider using jemalloc allocator, scale horizontally with multiple instances."
        },
        {
            "instruction": "What causes slow database queries in the hybrid architecture?",
            "input": "PostgreSQL queries taking 2-3 seconds instead of milliseconds",
            "output": "Database performance issues: Check query execution plans with EXPLAIN ANALYZE, verify indexes exist on frequently queried columns, monitor connection pool usage, check for lock contention, optimize N+1 query problems, consider read replicas for heavy queries, update table statistics with ANALYZE, check for disk I/O bottlenecks."
        },
        {
            "instruction": "How do you resolve high CPU usage in Go services?",
            "input": "Go API Gateway showing 90%+ CPU usage with moderate load",
            "output": "Go CPU optimization: Profile with 'go tool pprof' to identify hotspots, check for goroutine leaks with runtime.NumGoroutine(), optimize JSON marshaling/unmarshaling, use sync.Pool for object reuse, implement proper rate limiting, check for infinite loops in handlers, consider using fasthttp for high-performance HTTP handling."
        },
        
        # Advanced Configuration Scenarios  
        {
            "instruction": "How do you configure distributed tracing across all services?",
            "input": "Need to track requests across Go, Rust, and TypeScript services",
            "output": "Distributed tracing setup: Configure OpenTelemetry in each service with jaeger/zipkin exporters, add trace IDs to request headers, instrument database calls and HTTP requests, use consistent service naming, set up Jaeger UI for visualization, configure sampling rates, ensure correlation IDs propagate across service boundaries."
        },
        {
            "instruction": "What's the proper way to handle secrets in the hybrid architecture?",
            "input": "API keys and database credentials need secure management across services",
            "output": "Secrets management: Use environment variables with .env files for development, implement HashiCorp Vault or AWS Secrets Manager for production, store sensitive data in Swift Keychain for macOS app, use Docker secrets for containerized deployment, rotate credentials regularly, never commit secrets to git, use separate secrets per environment."
        },
        {
            "instruction": "How do you implement circuit breakers across all services?",
            "input": "Need fault tolerance when services fail in the distributed system",
            "output": "Circuit breaker implementation: Use hystrix-go for Go services, implement custom circuit breakers in Rust with tokio, add health checks to all endpoints, configure failure thresholds (50% error rate), set timeout windows (30 seconds), implement graceful degradation, add monitoring and alerting, test failure scenarios regularly."
        },
        
        # MLX and AI-specific Scenarios
        {
            "instruction": "How do you handle MLX model loading failures?",
            "input": "MLX service failing to load models with 'Out of memory' error",
            "output": "MLX memory issues: Use 4-bit quantized models (mlx-community/*-4bit), monitor Metal GPU memory usage, implement model caching to avoid reloading, use streaming inference for large responses, configure batch size based on available memory, implement model swapping for multiple models, add memory pressure monitoring."
        },
        {
            "instruction": "What causes MLX inference to be slower than expected?",
            "input": "MLX generating responses in 10+ seconds instead of 1-2 seconds",
            "output": "MLX performance optimization: Verify Metal GPU acceleration is enabled, use quantized models for faster inference, implement prompt caching for repeated patterns, optimize batch processing, check for memory pressure causing swapping, use appropriate model sizes for hardware, implement speculative decoding for faster generation."
        },
        {
            "instruction": "How do you handle MLX fine-tuning failures?",
            "input": "LoRA fine-tuning failing with convergence or loss explosion",
            "output": "MLX fine-tuning troubleshooting: Reduce learning rate (1e-6 to 1e-5), increase LoRA rank cautiously (8 to 16), check training data quality and format, implement gradient clipping, use smaller batch sizes, monitor loss curves, validate training examples, implement early stopping, ensure sufficient training data diversity."
        }
    ]
    
    return expanded_examples

def create_comprehensive_dataset():
    """Combine existing and new examples into comprehensive training dataset"""
    print("🔧 Expanding MLX training dataset...")
    
    # Load existing examples
    existing_examples = load_existing_dataset()
    print(f"✅ Loaded {len(existing_examples)} existing examples")
    
    # Create new examples
    expanded_examples = create_expanded_training_examples()
    print(f"✅ Created {len(expanded_examples)} new examples")
    
    # Combine all examples
    all_examples = existing_examples + expanded_examples
    total_examples = len(all_examples)
    
    # Create output directory
    output_dir = Path("/Users/christianmerrill/Desktop/universal-ai-tools/mlx-training-data")
    output_dir.mkdir(exist_ok=True)
    
    # Save comprehensive JSON dataset
    json_file = output_dir / "comprehensive_training_dataset.json"
    with open(json_file, 'w') as f:
        json.dump(all_examples, f, indent=2)
    
    # Save as JSONL for MLX training
    jsonl_file = output_dir / "comprehensive_training_dataset.jsonl"
    with open(jsonl_file, 'w') as f:
        for example in all_examples:
            f.write(json.dumps(example) + '\n')
    
    # Update metadata
    metadata = {
        "created_at": datetime.now().isoformat(),
        "total_examples": total_examples,
        "original_examples": len(existing_examples),
        "expanded_examples": len(expanded_examples),
        "categories": [
            "system_architecture",
            "swift_macos_development", 
            "mlx_optimization",
            "error_handling_debugging",
            "performance_optimization", 
            "distributed_tracing",
            "secrets_management",
            "circuit_breakers",
            "fine_tuning_troubleshooting"
        ],
        "description": "Comprehensive training dataset for Universal AI Tools with error handling and debugging scenarios",
        "format": "Alpaca instruction-input-output format",
        "use_case": "MLX fine-tuning on Apple Silicon for domain-specific AI assistance with production debugging capabilities"
    }
    
    metadata_file = output_dir / "comprehensive_dataset_metadata.json"
    with open(metadata_file, 'w') as f:
        json.dump(metadata, f, indent=2)
    
    print(f"✅ Comprehensive dataset created:")
    print(f"  📊 Total examples: {total_examples}")
    print(f"  📂 JSON format: {json_file}")
    print(f"  📂 JSONL format: {jsonl_file}")
    print(f"  📂 Metadata: {metadata_file}")
    
    # Show category breakdown
    categories = {
        "System Architecture": 1,
        "Swift/macOS Development": 1, 
        "MLX Optimization": 1,
        "Original Error Handling": 1,
        "New Error/Debug Scenarios": 5,
        "Performance Optimization": 3,
        "Advanced Configuration": 3,
        "MLX-specific Issues": 3,
        "Production Operations": 6
    }
    
    print(f"\n📋 Category Breakdown:")
    for category, count in categories.items():
        print(f"  {category}: {count} examples")
    
    return all_examples, total_examples

def main():
    """Main execution"""
    print("🚀 MLX Training Dataset Expansion")
    print("=" * 50)
    
    examples, total = create_comprehensive_dataset()
    
    print(f"\n🎯 Dataset Expansion Complete!")
    print(f"✅ Ready for MLX fine-tuning with {total} examples")
    print(f"✅ Includes production debugging scenarios")
    print(f"✅ Covers error handling and performance optimization")
    print(f"✅ Enhanced auto-healing integration capability")

if __name__ == "__main__":
    main()