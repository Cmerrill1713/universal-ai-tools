#!/usr/bin/env python3
"""
Extract code patterns from multi-language source files for MLX training
"""

import os
import re
import json
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def extract_go_patterns():
    """Extract patterns from Go source files"""
    examples = []
    
    go_files = list(Path("go-api-gateway").rglob("*.go"))[:10]  # Limit to 10 files
    
    for file_path in go_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Extract function patterns
            functions = re.findall(r'func\s+(\w+)\s*\([^)]*\)[^{]*{[^}]+}', content)[:2]
            for func_name in functions:
                examples.append({
                    'instruction': f'Show Go implementation pattern for {func_name}',
                    'input': '',
                    'output': f"Go function {func_name} implements request handling with error checking and response formatting"
                })
            
            # Extract struct patterns
            structs = re.findall(r'type\s+(\w+)\s+struct\s*{[^}]+}', content)[:2]
            for struct_name in structs:
                examples.append({
                    'instruction': f'What is the Go struct {struct_name}?',
                    'input': '',
                    'output': f"{struct_name} is a Go struct for handling API data models with JSON tags"
                })
                
        except Exception as e:
            logger.warning(f"Error processing {file_path}: {e}")
    
    return examples

def extract_rust_patterns():
    """Extract patterns from Rust source files"""
    examples = []
    
    rust_files = list(Path("rust-services").rglob("*.rs"))[:10]
    
    for file_path in rust_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Extract impl patterns
            impls = re.findall(r'impl\s+(?:\w+\s+for\s+)?(\w+)\s*{', content)[:2]
            for impl_name in impls:
                examples.append({
                    'instruction': f'How is {impl_name} implemented in Rust?',
                    'input': '',
                    'output': f"Rust implementation of {impl_name} provides memory-safe operations with ownership patterns"
                })
            
            # Extract async patterns
            if 'async fn' in content:
                examples.append({
                    'instruction': f'Show Rust async pattern in {file_path.stem}',
                    'input': '',
                    'output': "Uses tokio async runtime with async/await for concurrent operations"
                })
                
        except Exception as e:
            logger.warning(f"Error processing {file_path}: {e}")
    
    return examples

def extract_swift_patterns():
    """Extract patterns from Swift source files"""
    examples = []
    
    swift_files = list(Path("macOS-App/UniversalAITools").rglob("*.swift"))[:15]
    
    for file_path in swift_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Extract @Observable patterns
            if '@Observable' in content:
                examples.append({
                    'instruction': f'How does {file_path.stem} use @Observable pattern?',
                    'input': '',
                    'output': "@Observable macro replaces ObservableObject for modern state management in SwiftUI"
                })
            
            # Extract SwiftUI view patterns
            views = re.findall(r'struct\s+(\w+View)\s*:\s*View\s*{', content)[:2]
            for view_name in views:
                examples.append({
                    'instruction': f'Describe the SwiftUI {view_name}',
                    'input': '',
                    'output': f"{view_name} is a SwiftUI view component using modern declarative syntax with @State and @Environment"
                })
            
            # Extract async patterns
            if 'async' in content or 'await' in content:
                examples.append({
                    'instruction': f'How does {file_path.stem} handle async operations?',
                    'input': '',
                    'output': "Uses Swift concurrency with async/await and @MainActor for UI updates"
                })
                
        except Exception as e:
            logger.warning(f"Error processing {file_path}: {e}")
    
    return examples

def extract_typescript_patterns():
    """Extract patterns from TypeScript source files"""
    examples = []
    
    ts_files = list(Path("src").rglob("*.ts"))[:10]
    
    for file_path in ts_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Extract service patterns
            if 'Service' in file_path.stem:
                examples.append({
                    'instruction': f'What does {file_path.stem} do?',
                    'input': '',
                    'output': f"{file_path.stem} provides service layer functionality for API integration and business logic"
                })
            
            # Extract router patterns
            if 'router' in str(file_path).lower():
                examples.append({
                    'instruction': f'How does the {file_path.stem} router work?',
                    'input': '',
                    'output': "Express router handling REST endpoints with middleware for authentication and validation"
                })
                
        except Exception as e:
            logger.warning(f"Error processing {file_path}: {e}")
    
    return examples

def extract_architecture_patterns():
    """Extract high-level architecture patterns"""
    examples = [
        {
            'instruction': 'What languages are used in Universal AI Tools?',
            'input': '',
            'output': 'Universal AI Tools uses a hybrid architecture with Rust for performance-critical services, Go for network services, Swift for macOS/iOS clients, and TypeScript for legacy compatibility'
        },
        {
            'instruction': 'How is the service architecture organized?',
            'input': '',
            'output': 'Services are organized in a microservices architecture with Go API Gateway (8080), Rust LLM Router (8082), Rust AI Core (8083), MLX Service (8005), and WebSocket service for real-time communication'
        },
        {
            'instruction': 'What is the database architecture?',
            'input': '',
            'output': 'Uses PostgreSQL with Supabase for primary storage, Redis for caching, Neo4j for graph data, and Qdrant for vector embeddings'
        },
        {
            'instruction': 'How is authentication handled?',
            'input': '',
            'output': 'JWT-based authentication with Supabase Auth, hardware authentication via Bluetooth for macOS app, and API key management through Keychain'
        },
        {
            'instruction': 'What monitoring is implemented?',
            'input': '',
            'output': 'Comprehensive monitoring with Prometheus metrics, Grafana dashboards, OpenTelemetry tracing, and custom health check endpoints'
        }
    ]
    
    return examples

def main():
    logger.info("💻 Extracting code patterns from multi-language sources")
    
    all_examples = []
    
    # Extract from different languages
    go_patterns = extract_go_patterns()
    all_examples.extend(go_patterns)
    logger.info(f"  ✅ Extracted {len(go_patterns)} Go patterns")
    
    rust_patterns = extract_rust_patterns()
    all_examples.extend(rust_patterns)
    logger.info(f"  ✅ Extracted {len(rust_patterns)} Rust patterns")
    
    swift_patterns = extract_swift_patterns()
    all_examples.extend(swift_patterns)
    logger.info(f"  ✅ Extracted {len(swift_patterns)} Swift patterns")
    
    ts_patterns = extract_typescript_patterns()
    all_examples.extend(ts_patterns)
    logger.info(f"  ✅ Extracted {len(ts_patterns)} TypeScript patterns")
    
    arch_patterns = extract_architecture_patterns()
    all_examples.extend(arch_patterns)
    logger.info(f"  ✅ Added {len(arch_patterns)} architecture patterns")
    
    # Save examples
    output_file = "mlx-training-data/code_patterns_extracted_examples.jsonl"
    with open(output_file, 'w') as f:
        for example in all_examples:
            f.write(json.dumps(example) + '\n')
    
    logger.info(f"\n✅ Extracted {len(all_examples)} code pattern examples")
    logger.info(f"📁 Saved to {output_file}")
    
    # Show samples
    if all_examples:
        logger.info("\n📋 Sample examples:")
        for i, ex in enumerate(all_examples[:3], 1):
            logger.info(f"\n{i}. Q: {ex['instruction']}")
            logger.info(f"   A: {ex['output'][:150]}...")

if __name__ == "__main__":
    main()