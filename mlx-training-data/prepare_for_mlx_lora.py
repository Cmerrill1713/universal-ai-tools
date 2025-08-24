#!/usr/bin/env python3
"""
Prepare training data for MLX LoRA fine-tuning
Converts our Alpaca format to MLX's expected format
"""

import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def convert_to_mlx_format():
    """Convert Alpaca format to MLX chat format"""
    
    input_file = "mlx-training-data/comprehensive_merged_dataset.jsonl"
    train_file = "mlx-training-data/mlx_train.jsonl"
    valid_file = "mlx-training-data/mlx_valid.jsonl"
    
    all_examples = []
    
    # Load all examples
    with open(input_file, 'r') as f:
        for line in f:
            if line.strip():
                example = json.loads(line)
                
                # Convert to MLX chat format with system/user/assistant roles
                chat_format = {
                    "messages": [
                        {"role": "system", "content": "You are a helpful AI assistant specializing in Universal AI Tools, a hybrid Rust/Go/Swift architecture system."},
                        {"role": "user", "content": example.get('instruction', '')},
                        {"role": "assistant", "content": example.get('output', '')}
                    ]
                }
                
                all_examples.append(chat_format)
    
    # Split into train (90%) and validation (10%)
    split_idx = int(len(all_examples) * 0.9)
    train_examples = all_examples[:split_idx]
    valid_examples = all_examples[split_idx:]
    
    # Save training set
    with open(train_file, 'w') as f:
        for ex in train_examples:
            f.write(json.dumps(ex) + '\n')
    
    # Save validation set
    with open(valid_file, 'w') as f:
        for ex in valid_examples:
            f.write(json.dumps(ex) + '\n')
    
    logger.info(f"✅ Prepared {len(train_examples)} training examples")
    logger.info(f"✅ Prepared {len(valid_examples)} validation examples")
    logger.info(f"📁 Training data: {train_file}")
    logger.info(f"📁 Validation data: {valid_file}")
    
    return len(train_examples), len(valid_examples)

if __name__ == "__main__":
    convert_to_mlx_format()
