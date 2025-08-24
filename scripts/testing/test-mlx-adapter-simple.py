#!/usr/bin/env python3
"""Simple test of the fine-tuned MLX adapter"""

from mlx_lm import load, generate

print("Loading model with adapter...")
model, tokenizer = load(
    "mlx-community/Llama-3.1-8B-Instruct-4bit",
    adapter_path="./mlx-adapters/comprehensive-production"
)

# Test questions
questions = [
    "What languages are used in Universal AI Tools?",
    "How does the Go API Gateway handle authentication?",
    "What Swift patterns does Universal AI Tools use?",
    "How much memory reduction did the hybrid architecture achieve?",
    "What port does the Rust LLM Router use?"
]

print("\nTesting domain-specific questions:\n")

for i, question in enumerate(questions, 1):
    print(f"{i}. Q: {question}")
    
    # Generate response (using minimal parameters)
    response = generate(model, tokenizer, prompt=question, max_tokens=100)
    
    print(f"   A: {response[:200]}...")
    
    # Check for domain keywords
    keywords = ['rust', 'go', 'swift', 'port', '8082', 'hybrid', 'memory', 'jwt']
    if any(k.lower() in response.lower() for k in keywords):
        print("   ✅ Domain-specific response!")
    else:
        print("   ⚠️  Generic response")
    print()

print("Test complete!")
