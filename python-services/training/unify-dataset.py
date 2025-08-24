#!/usr/bin/env python3
"""Unify training datasets into consistent Alpaca format"""

import json
import re

def convert_to_alpaca(entry):
    """Convert various formats to Alpaca format"""
    
    # Already in Alpaca format
    if 'instruction' in entry and 'output' in entry:
        return entry
    
    # prompt/completion format
    if 'prompt' in entry and 'completion' in entry:
        # Extract instruction from prompt
        match = re.search(r'Instruction:\s*(.+?)(?:\n|Response:|$)', entry['prompt'], re.DOTALL)
        if match:
            instruction = match.group(1).strip()
        else:
            instruction = entry['prompt'].replace('Response:', '').strip()
        
        return {
            'instruction': instruction,
            'input': '',
            'output': entry['completion']
        }
    
    # question/answer format
    if 'question' in entry and 'answer' in entry:
        return {
            'instruction': entry['question'],
            'input': '',
            'output': entry['answer']
        }
    
    # text format (skip for training)
    if 'text' in entry:
        return None
    
    return None

def main():
    unified_examples = []
    
    # Read and convert dataset
    with open('mlx-training-data/final_comprehensive_dataset.jsonl', 'r') as f:
        for line_num, line in enumerate(f, 1):
            try:
                entry = json.loads(line.strip())
                converted = convert_to_alpaca(entry)
                if converted:
                    unified_examples.append(converted)
                else:
                    print(f"Skipped line {line_num}: unrecognized format")
            except Exception as e:
                print(f"Error on line {line_num}: {e}")
    
    # Save unified dataset
    output_file = 'mlx-training-data/unified_training_dataset.jsonl'
    with open(output_file, 'w') as f:
        for example in unified_examples:
            f.write(json.dumps(example) + '\n')
    
    print(f"✅ Unified {len(unified_examples)} examples")
    print(f"📂 Saved to: {output_file}")
    
    # Show sample
    if unified_examples:
        print("\n📋 Sample entry:")
        print(json.dumps(unified_examples[0], indent=2))

if __name__ == '__main__':
    main()