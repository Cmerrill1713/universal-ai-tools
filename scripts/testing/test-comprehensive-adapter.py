#!/usr/bin/env python3
"""
Test the comprehensively trained MLX adapter
"""

import time
import logging
from pathlib import Path
from mlx_lm import load, generate

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_adapter():
    """Test the fine-tuned model with domain-specific questions"""
    
    # Load model with adapter
    logger.info("Loading model with comprehensive adapter...")
    adapter_path = "./mlx-adapters/comprehensive-production"
    
    if not Path(adapter_path).exists():
        logger.warning(f"Adapter not found at {adapter_path}")
        return
    
    model, tokenizer = load(
        "mlx-community/Llama-3.1-8B-Instruct-4bit",
        adapter_path=adapter_path
    )
    
    # Test questions covering all categories from our training data
    test_questions = [
        # Swift questions
        "What Swift patterns does Universal AI Tools use for state management?",
        "How do you implement @Observable pattern in SwiftUI?",
        
        # Debugging questions
        "How do you debug a Rust service that won't start?",
        "What causes 'Service Unavailable' errors in the hybrid architecture?",
        
        # Go questions
        "How does the Go API Gateway handle authentication?",
        "What port does the Go WebSocket service use?",
        
        # Performance questions
        "How much memory reduction did the hybrid architecture achieve?",
        "What are the performance improvements in response time?",
        
        # MLX questions
        "What LoRA parameters are used for MLX fine-tuning?",
        "How do you handle MLX model loading failures?",
        
        # Architecture questions
        "Describe the Universal AI Tools system architecture",
        "What languages are used in the hybrid architecture?",
        
        # Database questions
        "What databases does Universal AI Tools use?",
        "How is Supabase integrated in the system?",
        
        # Security questions
        "How is authentication handled in Universal AI Tools?",
        "What security measures are implemented?"
    ]
    
    logger.info(f"Testing {len(test_questions)} domain-specific questions...")
    
    correct_responses = 0
    total_time = 0
    
    for i, question in enumerate(test_questions, 1):
        logger.info(f"\n{i}. Question: {question}")
        
        # Generate response
        start_time = time.time()
        
        response = generate(
            model,
            tokenizer,
            prompt=question,
            max_tokens=150,
            temp=0.7,
            top_p=0.9
        )
        
        inference_time = time.time() - start_time
        total_time += inference_time
        
        logger.info(f"   Response: {response[:200]}...")
        logger.info(f"   Inference time: {inference_time:.2f}s")
        
        # Check if response contains domain-specific knowledge
        domain_keywords = [
            'rust', 'go', 'swift', 'mlx', 'lora', 'supabase', 'hybrid',
            'port', 'service', '@observable', 'authentication', 'memory'
        ]
        
        if any(keyword.lower() in response.lower() for keyword in domain_keywords):
            correct_responses += 1
            logger.info("   ✅ Domain-specific response detected!")
        else:
            logger.info("   ⚠️  Generic response")
    
    # Calculate metrics
    accuracy = (correct_responses / len(test_questions)) * 100
    avg_time = total_time / len(test_questions)
    
    logger.info(f"\n📊 Performance Summary:")
    logger.info(f"  Domain accuracy: {accuracy:.1f}%")
    logger.info(f"  Correct responses: {correct_responses}/{len(test_questions)}")
    logger.info(f"  Average inference time: {avg_time:.2f}s")
    
    if accuracy >= 70:
        logger.info("✅ Fine-tuning SUCCESSFUL! High domain knowledge demonstrated.")
    elif accuracy >= 50:
        logger.info("⚠️  Moderate success. Consider more training iterations.")
    else:
        logger.info("❌ Low domain knowledge. May need more data or epochs.")
    
    return accuracy

if __name__ == "__main__":
    test_adapter()