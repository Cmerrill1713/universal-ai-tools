#!/usr/bin/env python3
"""
Create training and validation splits from enhanced dataset
"""

import json
import random

def split_dataset():
    """Split enhanced dataset into train/validation"""
    
    # Load enhanced dataset
    with open('enhanced_training_dataset.jsonl', 'r') as f:
        examples = [json.loads(line.strip()) for line in f]
    
    # Shuffle for random split
    random.shuffle(examples)
    
    # 80/20 split
    split_idx = int(len(examples) * 0.8)
    train_examples = examples[:split_idx]
    valid_examples = examples[split_idx:]
    
    print(f"Total examples: {len(examples)}")
    print(f"Training: {len(train_examples)}")
    print(f"Validation: {len(valid_examples)}")
    
    # Save training set
    with open('mlx-lora-training/enhanced_train.jsonl', 'w') as f:
        for example in train_examples:
            f.write(json.dumps(example) + '\n')
    
    # Save validation set
    with open('mlx-lora-training/enhanced_valid.jsonl', 'w') as f:
        for example in valid_examples:
            f.write(json.dumps(example) + '\n')
    
    print("✅ Dataset split complete")
    print("  - mlx-lora-training/enhanced_train.jsonl")
    print("  - mlx-lora-training/enhanced_valid.jsonl")

if __name__ == "__main__":
    split_dataset()