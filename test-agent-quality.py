#!/usr/bin/env python3
"""
Test Agent Response Quality with Different Models
Evaluates actual agent capabilities and response quality
"""

import asyncio
import time
import json
import sys
import os
from typing import Dict, List, Any, Tuple
from datetime import datetime

sys.path.append('src/services/dspy-orchestrator')

try:
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel
    from rich.markdown import Markdown
    from rich import print as rprint
except ImportError:
    print("Installing rich...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "rich"])
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel
    from rich.markdown import Markdown
    from rich import print as rprint

import dspy
from llm_discovery import LLMDiscovery
from model_selector import ModelSelector, TaskComplexity

console = Console()

# Quality evaluation prompts
QUALITY_TESTS = {
    "reasoning": {
        "prompt": """You have 3 boxes. Box A contains 2 red balls and 3 blue balls. 
Box B contains 4 red balls and 1 blue ball. Box C contains 1 red ball and 4 blue balls.
You randomly pick a box and then randomly pick a ball from that box. The ball is red.
What is the probability that you picked from Box B? Show your reasoning step by step.""",
        "eval_criteria": ["uses Bayes theorem", "shows calculations", "correct answer (~0.57)", "clear reasoning"]
    },
    
    "coding": {
        "prompt": """Write an efficient Python function to find the longest palindromic substring in a given string.
Include time/space complexity analysis and handle edge cases.""",
        "eval_criteria": ["working code", "handles edge cases", "complexity analysis", "optimized solution"]
    },
    
    "creative": {
        "prompt": """Design a new type of sustainable transportation system for a densely populated city in 2050.
Consider environmental impact, efficiency, cost, and social factors. Be specific and innovative.""",
        "eval_criteria": ["innovative ideas", "considers multiple factors", "specific details", "feasibility"]
    },
    
    "analysis": {
        "prompt": """Analyze the potential impacts of widespread AI adoption on employment in the next 10 years.
Consider both positive and negative effects across different industries and skill levels.""",
        "eval_criteria": ["balanced perspective", "industry examples", "nuanced analysis", "evidence-based"]
    },
    
    "instruction_following": {
        "prompt": """Write exactly 3 sentences about quantum computing. 
The first sentence should define it, the second should give an example application, 
and the third should mention a current limitation. Each sentence must be between 15-25 words.""",
        "eval_criteria": ["follows format exactly", "word count correct", "accurate content", "clear structure"]
    }
}

# Advanced agent tests
AGENT_TESTS = {
    "multi_step_planning": {
        "prompt": """I want to build a full-stack web application for a local bookstore. 
It needs: inventory management, customer accounts, online ordering, and payment processing.
Create a detailed implementation plan with specific technologies, timeline, and potential challenges.""",
        "eval_criteria": ["comprehensive plan", "realistic timeline", "technology choices justified", "identifies risks"]
    },
    
    "error_handling": {
        "prompt": """Here's a broken Python function. Identify all issues and provide a corrected version:
```python
def process_data(items):
    total = 0
    for i in range(len(items)):
        if items[i] > 0
            total += items[i]
        else:
            total += item[i] * -1
    average = total / len(items)
    return average
```""",
        "eval_criteria": ["identifies all errors", "provides working fix", "explains issues", "suggests improvements"]
    },
    
    "knowledge_synthesis": {
        "prompt": """Combine knowledge from physics, biology, and computer science to propose 
a novel approach to solving traffic congestion in cities. Your solution should be 
technically feasible and draw specific concepts from each field.""",
        "eval_criteria": ["integrates all fields", "specific concepts used", "novel approach", "technical feasibility"]
    }
}

class QualityEvaluator:
    """Evaluates response quality across multiple dimensions"""
    
    def __init__(self):
        self.results = {}
        
    def evaluate_response(self, response: str, criteria: List[str]) -> Dict[str, Any]:
        """Evaluate response against criteria"""
        scores = {}
        
        # Length and detail
        word_count = len(response.split())
        scores['length'] = min(word_count / 100, 1.0)  # Normalize to 0-1
        
        # Check for criteria keywords (simple heuristic)
        criteria_met = 0
        for criterion in criteria:
            # Simple keyword matching - in production, use better NLP
            if any(keyword in response.lower() for keyword in criterion.lower().split()):
                criteria_met += 1
        
        scores['criteria_score'] = criteria_met / len(criteria) if criteria else 0
        
        # Structure (paragraphs, lists, code blocks)
        scores['structure'] = (
            (1 if '```' in response else 0) +  # Code blocks
            (1 if '\n\n' in response else 0) +  # Paragraphs  
            (1 if any(marker in response for marker in ['1.', '•', '-', '*']) else 0)  # Lists
        ) / 3
        
        # Overall quality score
        scores['overall'] = (
            scores['length'] * 0.3 +
            scores['criteria_score'] * 0.5 +
            scores['structure'] * 0.2
        )
        
        return scores

async def test_model_quality(provider: str, model_name: str, test_name: str, test_data: Dict) -> Dict[str, Any]:
    """Test a model with quality evaluation"""
    start_time = time.time()
    
    try:
        # Configure model
        if provider.startswith("Ollama"):
            base_url = "http://localhost:11434" if provider == "Ollama" else "http://localhost:8080"
            lm = dspy.LM(f"ollama_chat/{model_name}", 
                       api_base=base_url, 
                       api_key="",
                       temperature=0.7,
                       max_tokens=500)
        else:  # LM Studio
            base_url = "http://192.168.1.179:5901/v1"
            lm = dspy.LM(f"openai/{model_name}", 
                       api_base=base_url,
                       api_key="lm-studio",
                       temperature=0.7,
                       max_tokens=500)
        
        # Get response
        response = lm(test_data['prompt'])
        response_text = response[0] if isinstance(response, list) else str(response)
        response_time = time.time() - start_time
        
        # Evaluate quality
        evaluator = QualityEvaluator()
        quality_scores = evaluator.evaluate_response(response_text, test_data['eval_criteria'])
        
        return {
            "success": True,
            "response": response_text,
            "response_time": response_time,
            "quality_scores": quality_scores,
            "word_count": len(response_text.split()),
            "error": None
        }
        
    except Exception as e:
        return {
            "success": False,
            "response": None,
            "response_time": time.time() - start_time,
            "quality_scores": None,
            "error": str(e)
        }

async def test_agent_orchestration(test_name: str, test_data: Dict) -> Dict[str, Any]:
    """Test the full agent orchestration with quality evaluation"""
    import websockets
    
    uri = "ws://localhost:8766"
    
    try:
        async with websockets.connect(uri) as websocket:
            request = {
                "requestId": f"quality-test-{test_name}",
                "method": "orchestrate",
                "params": {
                    "userRequest": test_data['prompt'],
                    "context": {
                        "test_type": test_name,
                        "require_quality": True,
                        "prefer_quality": True
                    }
                }
            }
            
            # Send request
            await websocket.send(json.dumps(request))
            
            # Get response
            response = await websocket.recv()
            result = json.loads(response)
            
            if result.get('success'):
                return {
                    "success": True,
                    "data": result.get('data', {}),
                    "model_used": result.get('data', {}).get('model_used', {}),
                    "error": None
                }
            else:
                return {
                    "success": False,
                    "error": result.get('error', 'Unknown error')
                }
                
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

async def compare_models_quality():
    """Compare response quality across different models"""
    console.print(Panel.fit(
        "[bold cyan]Model Quality Comparison Test[/bold cyan]\n"
        "Testing response quality across different models and tasks",
        border_style="cyan"
    ))
    
    # Select diverse models for comparison
    test_models = [
        ("Ollama", "phi:2.7b-chat-v2-q4_0"),      # Fast, small
        ("Ollama", "gemma:2b"),                    # Google's small model
        ("Ollama", "qwen2.5:7b"),                  # Good for coding
        ("Ollama", "deepseek-r1:14b"),            # Advanced reasoning
        ("LM Studio Remote", "deepseek/deepseek-r1-0528-qwen3-8b"),  # Your model
    ]
    
    all_results = {}
    
    for test_name, test_data in QUALITY_TESTS.items():
        console.print(f"\n[bold cyan]Testing: {test_name}[/bold cyan]")
        console.print(f"Prompt: {test_data['prompt'][:100]}...")
        
        results_table = Table(title=f"{test_name.title()} Test Results", show_lines=True)
        results_table.add_column("Model", style="cyan", width=30)
        results_table.add_column("Time", justify="right", style="yellow")
        results_table.add_column("Words", justify="right", style="green")
        results_table.add_column("Quality", justify="center", style="magenta")
        results_table.add_column("Response Preview", style="white", width=50)
        
        test_results = []
        
        for provider, model_name in test_models:
            # Skip if model not available
            discovery = LLMDiscovery()
            available = discovery.get_all_available_models()
            
            model_available = False
            for p, models in available.items():
                if provider in p and any(model_name in m for m in models):
                    model_available = True
                    break
            
            if not model_available:
                continue
                
            result = await test_model_quality(provider, model_name, test_name, test_data)
            
            if result['success']:
                quality = result['quality_scores']['overall']
                preview = result['response'][:100].replace('\n', ' ') + "..."
                
                results_table.add_row(
                    model_name,
                    f"{result['response_time']:.1f}s",
                    str(result['word_count']),
                    f"{quality:.0%}",
                    preview
                )
                
                test_results.append({
                    "model": model_name,
                    "quality": quality,
                    "response": result['response'],
                    "time": result['response_time']
                })
            else:
                results_table.add_row(
                    model_name,
                    "N/A",
                    "0",
                    "0%",
                    f"Error: {result['error'][:50]}..."
                )
        
        console.print(results_table)
        
        # Show best response
        if test_results:
            best = max(test_results, key=lambda x: x['quality'])
            console.print(f"\n[bold green]Best response from {best['model']}:[/bold green]")
            console.print(Panel(Markdown(best['response'][:500] + "..." if len(best['response']) > 500 else best['response']), 
                               title=f"Quality Score: {best['quality']:.0%}"))
        
        all_results[test_name] = test_results
    
    return all_results

async def test_agent_capabilities():
    """Test advanced agent capabilities"""
    console.print("\n[bold cyan]Testing Advanced Agent Capabilities[/bold cyan]")
    console.print("=" * 60)
    
    for test_name, test_data in AGENT_TESTS.items():
        console.print(f"\n[bold]Testing: {test_name.replace('_', ' ').title()}[/bold]")
        
        # Test via orchestration
        result = await test_agent_orchestration(test_name, test_data)
        
        if result['success']:
            data = result['data']
            console.print(f"✅ Model used: {data.get('model_used', {}).get('name', 'Unknown')}")
            console.print(f"   Complexity: {data.get('complexity', 'Unknown')}")
            console.print(f"   Confidence: {data.get('confidence', 0):.0%}")
            console.print(f"   Selected agents: {data.get('selected_agents', 'None')}")
        else:
            console.print(f"❌ Failed: {result['error']}")

async def main():
    """Run comprehensive quality tests"""
    # Test model quality comparison
    quality_results = await compare_models_quality()
    
    # Test agent capabilities
    await test_agent_capabilities()
    
    # Summary
    console.print("\n[bold cyan]📊 Quality Test Summary[/bold cyan]")
    console.print("=" * 60)
    
    # Calculate average quality per model
    model_scores = {}
    for test_name, results in quality_results.items():
        for result in results:
            model = result['model']
            if model not in model_scores:
                model_scores[model] = []
            model_scores[model].append(result['quality'])
    
    summary_table = Table(title="Overall Model Quality Ranking", show_lines=True)
    summary_table.add_column("Rank", justify="center", style="cyan")
    summary_table.add_column("Model", style="green")
    summary_table.add_column("Avg Quality", justify="center", style="magenta")
    summary_table.add_column("Best For", style="yellow")
    
    # Sort by average quality
    ranked_models = []
    for model, scores in model_scores.items():
        avg_score = sum(scores) / len(scores)
        ranked_models.append((model, avg_score))
    
    ranked_models.sort(key=lambda x: x[1], reverse=True)
    
    for rank, (model, avg_score) in enumerate(ranked_models, 1):
        # Determine what model is best for
        if "coder" in model.lower() or "qwen" in model.lower():
            best_for = "Coding tasks"
        elif "deepseek" in model.lower():
            best_for = "Complex reasoning"
        elif avg_score > 0.7:
            best_for = "General high-quality responses"
        elif "phi" in model.lower() or "gemma:2b" in model.lower():
            best_for = "Fast responses"
        else:
            best_for = "Balanced tasks"
            
        summary_table.add_row(
            str(rank),
            model,
            f"{avg_score:.0%}",
            best_for
        )
    
    console.print(summary_table)
    
    console.print("\n[bold green]✅ Quality testing complete![/bold green]")
    console.print("\n💡 Recommendations:")
    console.print("• For best quality: Use deepseek-r1:14b or qwen2.5:7b")
    console.print("• For fast responses: Use phi:2.7b or gemma:2b")
    console.print("• For coding: Use qwen2.5:7b or models with 'coder' in name")
    console.print("• The agent automatically selects based on task requirements")

if __name__ == "__main__":
    asyncio.run(main())