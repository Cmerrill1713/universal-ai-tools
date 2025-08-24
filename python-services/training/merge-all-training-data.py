#!/usr/bin/env python3
"""
Merge and deduplicate all training data sources for comprehensive MLX training
"""

import json
import hashlib
import logging
from pathlib import Path
from collections import defaultdict

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def load_jsonl(file_path):
    """Load examples from JSONL file"""
    examples = []
    try:
        with open(file_path, 'r') as f:
            for line in f:
                if line.strip():
                    examples.append(json.loads(line))
    except Exception as e:
        logger.warning(f"Error loading {file_path}: {e}")
    return examples

def create_example_hash(example):
    """Create hash for deduplication"""
    # Use instruction and first 100 chars of output for uniqueness
    key = f"{example.get('instruction', '')}:{example.get('output', '')[:100]}"
    return hashlib.md5(key.encode()).hexdigest()

def categorize_example(example):
    """Categorize example based on content"""
    instruction = example.get('instruction', '').lower()
    output = example.get('output', '').lower()
    
    if any(word in instruction for word in ['swift', 'swiftui', 'macos', 'ios', '@observable']):
        return 'swift'
    elif any(word in instruction for word in ['rust', 'cargo', 'tokio', 'async fn']):
        return 'rust'
    elif any(word in instruction for word in ['go', 'golang', 'goroutine']):
        return 'go'
    elif any(word in instruction for word in ['mlx', 'lora', 'fine-tun', 'adapter']):
        return 'mlx'
    elif any(word in instruction for word in ['debug', 'fix', 'error', 'issue', 'problem']):
        return 'debugging'
    elif any(word in instruction for word in ['performance', 'optimi', 'speed', 'memory']):
        return 'performance'
    elif any(word in instruction for word in ['architecture', 'design', 'pattern', 'structure']):
        return 'architecture'
    elif any(word in instruction for word in ['api', 'endpoint', 'route', 'http']):
        return 'api'
    elif any(word in instruction for word in ['database', 'supabase', 'postgres', 'redis']):
        return 'database'
    elif any(word in instruction for word in ['auth', 'jwt', 'security', 'permission']):
        return 'security'
    else:
        return 'general'

def main():
    logger.info("🔄 Merging all training data sources")
    
    # Define all data sources
    data_sources = [
        "mlx-training-data/unified_training_dataset.jsonl",  # Original training data
        "mlx-training-data/supabase_extracted_examples.jsonl",  # From Supabase
        "mlx-training-data/documentation_extracted_examples.jsonl",  # From docs
        "mlx-training-data/git_history_extracted_examples.jsonl",  # From git
        "mlx-training-data/code_patterns_extracted_examples.jsonl",  # From code
        "enhanced_training_dataset.jsonl",  # DEAP enhanced
        "mlx-training-data/comprehensive_training_dataset.jsonl",  # Previous comprehensive
    ]
    
    # Load all examples
    all_examples = []
    seen_hashes = set()
    duplicates_removed = 0
    
    for source_file in data_sources:
        if Path(source_file).exists():
            examples = load_jsonl(source_file)
            logger.info(f"  📁 Loaded {len(examples)} from {Path(source_file).name}")
            
            # Deduplicate
            for example in examples:
                example_hash = create_example_hash(example)
                if example_hash not in seen_hashes:
                    seen_hashes.add(example_hash)
                    all_examples.append(example)
                else:
                    duplicates_removed += 1
    
    logger.info(f"\n📊 Deduplication: Removed {duplicates_removed} duplicate examples")
    
    # Categorize examples
    categories = defaultdict(list)
    for example in all_examples:
        category = categorize_example(example)
        categories[category].append(example)
    
    # Show category distribution
    logger.info("\n📈 Category Distribution:")
    for category, examples in sorted(categories.items(), key=lambda x: len(x[1]), reverse=True):
        logger.info(f"  {category}: {len(examples)} examples ({len(examples)*100//len(all_examples)}%)")
    
    # Balance dataset (ensure diverse coverage)
    balanced_examples = []
    
    # Take up to N examples from each category
    max_per_category = 100
    for category, examples in categories.items():
        # Take all if less than max, otherwise sample
        if len(examples) <= max_per_category:
            balanced_examples.extend(examples)
        else:
            # Take first max_per_category (they're already somewhat random from different sources)
            balanced_examples.extend(examples[:max_per_category])
    
    # Save comprehensive dataset
    output_file = "mlx-training-data/comprehensive_merged_dataset.jsonl"
    with open(output_file, 'w') as f:
        for example in balanced_examples:
            f.write(json.dumps(example) + '\n')
    
    logger.info(f"\n✅ Final comprehensive dataset:")
    logger.info(f"  📊 Total examples: {len(balanced_examples)}")
    logger.info(f"  📁 Saved to: {output_file}")
    
    # Create metadata
    metadata = {
        'total_examples': len(balanced_examples),
        'sources': {
            'supabase': True,
            'documentation': True,
            'git_history': True,
            'code_patterns': True,
            'deap_enhanced': True
        },
        'categories': {cat: len(exs) for cat, exs in categories.items()},
        'duplicates_removed': duplicates_removed,
        'timestamp': str(Path(output_file).stat().st_mtime)
    }
    
    metadata_file = "mlx-training-data/comprehensive_merged_metadata.json"
    with open(metadata_file, 'w') as f:
        json.dump(metadata, f, indent=2)
    
    logger.info(f"  📋 Metadata saved to: {metadata_file}")
    
    # Show sample from each category
    logger.info("\n📋 Sample examples by category:")
    for category in ['swift', 'debugging', 'architecture', 'mlx']:
        if category in categories and categories[category]:
            ex = categories[category][0]
            logger.info(f"\n{category.upper()}:")
            logger.info(f"  Q: {ex['instruction'][:100]}...")
            logger.info(f"  A: {ex['output'][:100]}...")

if __name__ == "__main__":
    main()