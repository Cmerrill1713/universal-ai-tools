#!/usr/bin/env python3

"""
MLX Fine-tuning Dataset Creator
Creates training dataset from existing system knowledge for Sakana AI fine-tuning
"""

import json
import datetime
import os
from pathlib import Path

def create_system_training_data():
    """Create comprehensive training dataset from our system knowledge"""
    
    training_data = []
    
    # System Architecture Knowledge
    system_architecture_data = [
        {
            "instruction": "Describe the Universal AI Tools system architecture",
            "input": "",
            "output": "Universal AI Tools uses a hybrid architecture with Rust for performance-critical services (LLM router, ML inference), Go for network services (WebSocket, API gateway), Swift for macOS/iOS clients, and TypeScript for legacy compatibility. The system includes 5 core services: Go API Gateway (port 8080), Rust LLM Router (8082), Rust AI Core (8003), and supports MLX service (8004) for Apple Silicon optimization."
        },
        {
            "instruction": "What are the key performance improvements achieved in the hybrid architecture?",
            "input": "",
            "output": "The hybrid architecture achieved significant performance improvements: 60% memory usage reduction (2.5GB to <1GB), 61% faster response times (223ms to 87ms), 10x improvement in concurrent connections (1,000 to 10,000+), and 5x throughput improvement (500 to 2,500+ req/sec). The migration consolidated 68 routers into 3 core services (95% consolidation)."
        },
        {
            "instruction": "How does the auto-healing system work?",
            "input": "",
            "output": "The evolutionary auto-healing system monitors services every 30 seconds, detects failures through port checks and health endpoints, automatically restarts failed services, escalates to human assistance when auto-healing fails, and learns from patterns to prevent future issues. It includes circuit breaker patterns, intelligent problem surfacing, and structured training data generation for continuous improvement."
        }
    ]
    
    # Swift/macOS Development Knowledge
    swift_development_data = [
        {
            "instruction": "What are the modern SwiftUI architecture patterns for macOS 15?",
            "input": "",
            "output": "Modern SwiftUI for macOS 15 uses @Observable macro instead of ObservableObject, eliminates ViewModels in favor of @Observable business logic classes, uses @Environment for dependency injection, employs NavigationSplitView for native macOS navigation, and applies @MainActor isolation for thread safety. The pattern separates UI from business logic while maintaining reactivity."
        },
        {
            "instruction": "How is secure storage implemented in the Swift macOS app?",
            "input": "",
            "output": "The app migrated completely from UserDefaults to Keychain storage using KeychainService.swift for all sensitive data including API keys, user credentials, and tokens. It includes hardware-based authentication via Bluetooth with RSSI proximity detection, family device management with roles, and automatic token expiry management."
        }
    ]
    
    # MLX and Apple Silicon Optimization
    mlx_optimization_data = [
        {
            "instruction": "What are the benefits of MLX for AI inference on Apple Silicon?",
            "input": "",
            "output": "MLX provides native Apple Silicon optimization with GPU acceleration, memory-efficient inference, fast model loading and switching, seamless integration with macOS applications, and support for fine-tuning on device. It achieves significant performance improvements over CPU-only inference and enables local-first AI capabilities."
        },
        {
            "instruction": "How should MLX models be integrated into the existing service architecture?",
            "input": "",
            "output": "MLX services should run on port 8004, maintain API compatibility with existing chat completion endpoints, include proper health checks and metrics, support circuit breaker patterns, and provide monitoring integration. The service should handle model loading, inference requests, and maintain performance metrics for production monitoring."
        }
    ]
    
    # Error Handling and Debugging
    error_handling_data = [
        {
            "instruction": "What are common Swift concurrency errors and their solutions?",
            "input": "",
            "output": "Common Swift 6.0 concurrency errors include 'Sending actor-isolated non-sendable' (solution: mark types as Sendable or use @MainActor), 'Data race accessing from different actor' (solution: proper actor isolation), 'Cannot convert sendable requirement' (solution: Sendable protocol conformance), and 'async function not supported' (solution: mark function as async or use Task blocks)."
        },
        {
            "instruction": "How do you debug production issues in the hybrid architecture?",
            "input": "",
            "output": "Debug production issues by checking service health endpoints (/health on each port), reviewing logs in /tmp/ directories, using circuit breaker status endpoints, monitoring Prometheus metrics on port 9090, checking auto-healing logs in /tmp/uat-autoheal/, and using distributed tracing with OpenTelemetry for request flow analysis."
        }
    ]
    
    # Fine-tuning and AI Optimization
    fine_tuning_data = [
        {
            "instruction": "What safety measures should be implemented for MLX fine-tuning?",
            "input": "",
            "output": "MLX fine-tuning safety includes regression testing against baseline models, confidence thresholds for automated actions, anti-hallucination measures through validation datasets, performance benchmarking before deployment, gradual rollout with rollback capabilities, and automated quality checks. Fine-tuning frequency should be limited to prevent overfitting and maintain stability."
        },
        {
            "instruction": "How do you validate model performance after fine-tuning?",
            "input": "",
            "output": "Validate fine-tuned models through comprehensive test suites including functional regression tests, performance benchmarks comparing response times and accuracy, API compatibility validation, integration testing with existing services, and real-world scenario testing. Use automated scripts to ensure all functionality migrates correctly and performance meets or exceeds baseline metrics."
        }
    ]
    
    # Combine all training data
    all_training_data = (
        system_architecture_data + 
        swift_development_data + 
        mlx_optimization_data + 
        error_handling_data + 
        fine_tuning_data
    )
    
    # Format for MLX fine-tuning (Alpaca format)
    formatted_data = []
    for item in all_training_data:
        formatted_item = {
            "instruction": item["instruction"],
            "input": item["input"],
            "output": item["output"]
        }
        formatted_data.append(formatted_item)
    
    return formatted_data

def save_training_dataset():
    """Save the training dataset in the required format"""
    
    # Create training data directory
    training_dir = Path("/Users/christianmerrill/Desktop/universal-ai-tools/mlx-training-data")
    training_dir.mkdir(exist_ok=True)
    
    # Generate training data
    training_data = create_system_training_data()
    
    # Save as JSONL for MLX fine-tuning
    jsonl_file = training_dir / "universal_ai_tools_training.jsonl"
    with open(jsonl_file, 'w') as f:
        for item in training_data:
            f.write(json.dumps(item) + '\n')
    
    # Save as JSON for inspection
    json_file = training_dir / "universal_ai_tools_training.json"
    with open(json_file, 'w') as f:
        json.dump(training_data, f, indent=2)
    
    # Create metadata file
    metadata = {
        "created_at": datetime.datetime.now().isoformat(),
        "total_examples": len(training_data),
        "categories": [
            "system_architecture",
            "swift_macos_development", 
            "mlx_optimization",
            "error_handling_debugging",
            "fine_tuning_ai_optimization"
        ],
        "description": "Training dataset for Universal AI Tools fine-tuning with system knowledge",
        "format": "Alpaca instruction-input-output format",
        "use_case": "MLX fine-tuning on Apple Silicon for domain-specific AI assistance"
    }
    
    metadata_file = training_dir / "dataset_metadata.json"
    with open(metadata_file, 'w') as f:
        json.dump(metadata, f, indent=2)
    
    print(f"✅ Training dataset created with {len(training_data)} examples")
    print(f"📁 Files saved to: {training_dir}")
    print(f"📄 JSONL file: {jsonl_file}")
    print(f"📄 JSON file: {json_file}")
    print(f"📄 Metadata: {metadata_file}")
    
    return training_dir, len(training_data)

if __name__ == "__main__":
    save_training_dataset()