#!/usr/bin/env python3
"""
Debug MLX service responses to understand prompt format issues
"""

import requests
import json
from pathlib import Path

def test_mlx_service():
    """Test MLX service with different prompt formats"""
    base_url = "http://localhost:8005"
    
    # Test questions from training data
    test_questions = [
        "What is Universal AI Tools?",
        "How do you start the development server?",
        "What programming languages does Universal AI Tools use?",
        "How does the memory optimization work?",
        "What is the architecture of Universal AI Tools?"
    ]
    
    # Different prompt formats to test
    prompt_formats = [
        {
            "name": "Current Format",
            "template": "Instruction: {question}\nResponse:"
        },
        {
            "name": "Simple Format", 
            "template": "{question}"
        },
        {
            "name": "System Context Format",
            "template": "You are Universal AI Tools assistant. {question}"
        },
        {
            "name": "Chat Format",
            "template": "User: {question}\nAssistant:"
        },
        {
            "name": "Q&A Format",
            "template": "Question: {question}\nAnswer:"
        }
    ]
    
    print("🔍 Testing MLX Service Response Patterns")
    print("=" * 60)
    
    for i, question in enumerate(test_questions[:2]):  # Test first 2 questions
        print(f"\n📝 Test Question {i+1}: {question}")
        print("-" * 50)
        
        for fmt in prompt_formats:
            prompt = fmt["template"].format(question=question)
            
            try:
                response = requests.post(
                    f"{base_url}/v1/chat/completions",
                    json={
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 100,
                        "stream": False
                    },
                    timeout=15
                )
                
                if response.status_code == 200:
                    result = response.json()
                    answer = result.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                    
                    print(f"\n{fmt['name']}:")
                    print(f"  Prompt: {repr(prompt[:80])}")
                    print(f"  Response: {repr(answer[:120])}")
                    
                    # Check if response contains domain-specific terms
                    domain_terms = ['universal ai tools', 'rust', 'go', 'swift', 'api', 'service', 'mlx']
                    has_domain_knowledge = any(term in answer.lower() for term in domain_terms)
                    print(f"  Domain Knowledge: {'✅' if has_domain_knowledge else '❌'}")
                else:
                    print(f"\n{fmt['name']}: ❌ HTTP {response.status_code}")
                    
            except Exception as e:
                print(f"\n{fmt['name']}: ❌ Error: {e}")
        
        print("\n" + "=" * 60)

def load_training_data_sample():
    """Load and display sample training data"""
    train_file = Path("mlx-lora-training/train.jsonl")
    print("\n📚 Training Data Analysis")
    print("=" * 60)
    
    if train_file.exists():
        with open(train_file, 'r') as f:
            lines = f.readlines()[:3]  # First 3 examples
            
        for i, line in enumerate(lines):
            data = json.loads(line.strip())
            prompt = data.get("prompt", "")
            completion = data.get("completion", "")
            
            print(f"\nTraining Example {i+1}:")
            print(f"  Prompt: {repr(prompt)}")
            print(f"  Completion: {repr(completion[:100])}")
    else:
        print("❌ Training file not found")

if __name__ == "__main__":
    load_training_data_sample()
    test_mlx_service()