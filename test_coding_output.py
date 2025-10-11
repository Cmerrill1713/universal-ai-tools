#!/usr/bin/env python3
"""
Test coding output quality across all models
"""

import requests
import json

def test_coding_output():
    """Test coding output quality"""
    print("🔍 CODING OUTPUT QUALITY ANALYSIS")
    print("=================================")
    
    # Test request
    request = "Create a Python class for a REST API client with authentication, error handling, and retry logic"
    
    models = [
        ("mlx-qwen2.5-0.5b", "Instant Model (0.5B)"),
        ("mlx-llama-3.1-8b", "Balanced Model (8B)"),
        ("qwen3-coder-30b", "Quality Model (30B)")
    ]
    
    for model_id, model_name in models:
        print(f"\n🧪 {model_name}")
        print("=" * 50)
        
        try:
            response = requests.post(
                "http://localhost:8001/v1/chat/completions",
                json={
                    "model": model_id,
                    "messages": [{"role": "user", "content": request}],
                    "max_tokens": 400
                },
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                content = data['choices'][0]['message']['content']
                
                print("📝 OUTPUT:")
                print("-" * 30)
                print(content)
                print("-" * 30)
                
                # Analyze quality
                print(f"\n📊 QUALITY ANALYSIS:")
                print(f"  - Characters: {len(content)}")
                print(f"  - Words: {len(content.split())}")
                print(f"  - Lines: {len(content.split(chr(10)))}")
                print(f"  - Code blocks: {content.count('```') // 2}")
                print(f"  - Functions: {content.count('def ')}")
                print(f"  - Classes: {content.count('class ')}")
                docstring_count = content.count('"""') + content.count("'''")
                print(f"  - Docstrings: {docstring_count}")
                print(f"  - Comments: {content.count('#')}")
                print(f"  - Error handling: {content.count('try:') + content.count('except')}")
                print(f"  - Type hints: {content.count(':') + content.count('->')}")
                
                # Quality score
                quality_score = 0
                if content.count('def ') > 0: quality_score += 1
                if content.count('class ') > 0: quality_score += 1
                if docstring_count > 0: quality_score += 1
                if content.count('#') > 0: quality_score += 1
                if content.count('try:') > 0 or content.count('except') > 0: quality_score += 1
                if content.count(':') > 0 or content.count('->') > 0: quality_score += 1
                
                print(f"  - Quality Score: {quality_score}/6")
                
            else:
                print(f"❌ Error: {response.status_code}")
                
        except Exception as e:
            print(f"❌ Exception: {e}")

if __name__ == "__main__":
    test_coding_output()
