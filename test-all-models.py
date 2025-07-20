#!/usr/bin/env python3
"""
Comprehensive Model Testing Suite
Tests all available models with various tasks
"""

import asyncio
import time
import json
import sys
import os
from datetime import datetime
from typing import Dict, List, Any, Tuple

sys.path.append('src/services/dspy-orchestrator')

try:
    from rich.console import Console
    from rich.table import Table
    from rich.progress import Progress, SpinnerColumn, TextColumn, TimeElapsedColumn
    from rich.panel import Panel
    from rich import print as rprint
except ImportError:
    print("Installing rich for better output...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "rich"])
    from rich.console import Console
    from rich.table import Table
    from rich.progress import Progress, SpinnerColumn, TextColumn, TimeElapsedColumn
    from rich.panel import Panel
    from rich import print as rprint

import httpx
import dspy
from llm_discovery import LLMDiscovery
from model_selector import ModelSelector, TaskComplexity
from model_manager import model_manager

console = Console()

# Test tasks for different complexities
TEST_TASKS = {
    "simple": [
        "What is 2+2?",
        "Hello, how are you?",
        "List three colors"
    ],
    "moderate": [
        "Explain photosynthesis in simple terms",
        "What are the benefits of exercise?",
        "Describe the water cycle"
    ],
    "complex": [
        "Write a Python function to calculate factorial",
        "Design a REST API for a todo application",
        "Explain quantum computing principles"
    ],
    "coding": [
        "Write a Python quicksort implementation",
        "Create a JavaScript async/await example",
        "Debug this code: for i in range(10) print(i)"
    ]
}

class ModelTester:
    """Comprehensive model testing"""
    
    def __init__(self):
        self.results = {}
        self.discovery = LLMDiscovery()
        self.selector = ModelSelector()
        
    async def get_all_models(self) -> List[Tuple[str, str]]:
        """Get all available models"""
        models = []
        all_discovered = self.discovery.get_all_available_models()
        
        for provider, model_list in all_discovered.items():
            for model in model_list:
                models.append((provider, model))
                
        return models
    
    async def test_model(self, provider: str, model_name: str, task: str) -> Dict[str, Any]:
        """Test a specific model with a task"""
        start_time = time.time()
        
        try:
            # Configure model
            if provider == "Ollama" or provider == "Ollama Proxy":
                base_url = "http://localhost:11434" if provider == "Ollama" else "http://localhost:8080"
                lm = dspy.LM(f"ollama_chat/{model_name}", 
                           api_base=base_url, 
                           api_key="")
            else:  # LM Studio
                base_url = "http://192.168.1.179:5901/v1"
                lm = dspy.LM(f"openai/{model_name}", 
                           api_base=base_url,
                           api_key="lm-studio")
            
            # Test the model
            response = lm(task)
            response_time = (time.time() - start_time) * 1000  # ms
            
            return {
                "success": True,
                "response": response[0] if isinstance(response, list) else str(response),
                "response_time_ms": response_time,
                "error": None
            }
            
        except Exception as e:
            return {
                "success": False,
                "response": None,
                "response_time_ms": (time.time() - start_time) * 1000,
                "error": str(e)
            }
    
    async def test_all_models(self):
        """Test all available models"""
        console.print("\n[bold cyan]🧪 Comprehensive Model Testing Suite[/bold cyan]")
        console.print("=" * 60)
        
        # Get all models
        models = await self.get_all_models()
        console.print(f"\n📋 Found {len(models)} models to test")
        
        # Test each model with different tasks
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            TimeElapsedColumn(),
            console=console
        ) as progress:
            
            for provider, model_name in models:
                task_id = progress.add_task(f"Testing {model_name}...", total=len(TEST_TASKS))
                
                model_results = {
                    "provider": provider,
                    "model": model_name,
                    "tests": {}
                }
                
                # Test with each task category
                for category, tasks in TEST_TASKS.items():
                    category_results = []
                    
                    for task in tasks[:1]:  # Test first task in each category
                        result = await self.test_model(provider, model_name, task)
                        result["task"] = task
                        category_results.append(result)
                    
                    model_results["tests"][category] = category_results
                    progress.advance(task_id)
                
                self.results[f"{provider}:{model_name}"] = model_results
                
        # Display results
        self.display_results()
    
    def display_results(self):
        """Display test results in a nice format"""
        console.print("\n[bold green]📊 Test Results[/bold green]")
        console.print("=" * 60)
        
        # Create summary table
        table = Table(title="Model Performance Summary", show_lines=True)
        table.add_column("Model", style="cyan")
        table.add_column("Provider", style="magenta")
        table.add_column("Success Rate", justify="center", style="green")
        table.add_column("Avg Response Time", justify="right", style="yellow")
        table.add_column("Best For", style="blue")
        
        for key, result in self.results.items():
            provider = result["provider"]
            model = result["model"]
            
            # Calculate metrics
            total_tests = 0
            successful_tests = 0
            total_time = 0
            
            for category, tests in result["tests"].items():
                for test in tests:
                    total_tests += 1
                    if test["success"]:
                        successful_tests += 1
                        total_time += test["response_time_ms"]
            
            success_rate = (successful_tests / total_tests * 100) if total_tests > 0 else 0
            avg_time = (total_time / successful_tests) if successful_tests > 0 else 0
            
            # Determine best use case
            if avg_time < 500:
                best_for = "Fast responses"
            elif "coder" in model.lower() or "code" in model.lower():
                best_for = "Coding tasks"
            elif "7b" in model or "13b" in model:
                best_for = "Balanced tasks"
            else:
                best_for = "General use"
            
            table.add_row(
                model,
                provider,
                f"{success_rate:.0f}%",
                f"{avg_time:.0f}ms" if avg_time > 0 else "N/A",
                best_for
            )
        
        console.print(table)
        
        # Save detailed results
        self.save_results()
    
    def save_results(self):
        """Save detailed results to file"""
        filename = f"model_test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        with open(filename, 'w') as f:
            json.dump(self.results, f, indent=2)
        
        console.print(f"\n💾 Detailed results saved to: {filename}")

class APITester:
    """Test the Universal AI Tools API endpoints"""
    
    def __init__(self, base_url: str = "http://localhost:9999"):
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=30.0)
        
    async def test_endpoints(self):
        """Test all API endpoints"""
        console.print("\n[bold cyan]🔌 Testing API Endpoints[/bold cyan]")
        console.print("=" * 60)
        
        endpoints = [
            ("GET", "/health", None, None),
            ("GET", "/api/health", None, None),
            ("GET", "/api/v1/status", None, {"X-API-Key": "test-key-12345"}),
            ("GET", "/api/v1/memory", None, {"X-API-Key": "test-key-12345"}),
            ("POST", "/api/v1/memory", {"content": "Test memory", "tags": ["test"]}, {"X-API-Key": "test-key-12345"}),
            ("POST", "/api/v1/orchestrate", {"userRequest": "Hello, test"}, {"X-API-Key": "test-key-12345"}),
            ("GET", "/api/v1/tools", None, {"X-API-Key": "test-key-12345"}),
        ]
        
        table = Table(title="API Endpoint Tests", show_lines=True)
        table.add_column("Method", style="cyan")
        table.add_column("Endpoint", style="green")
        table.add_column("Status", justify="center")
        table.add_column("Response Time", justify="right", style="yellow")
        
        for method, endpoint, data, headers in endpoints:
            try:
                start = time.time()
                
                if method == "GET":
                    response = await self.client.get(f"{self.base_url}{endpoint}", headers=headers)
                else:
                    response = await self.client.post(f"{self.base_url}{endpoint}", json=data, headers=headers)
                
                elapsed = (time.time() - start) * 1000
                
                if response.status_code < 400:
                    status = f"[green]✅ {response.status_code}[/green]"
                else:
                    status = f"[red]❌ {response.status_code}[/red]"
                
                table.add_row(method, endpoint, status, f"{elapsed:.0f}ms")
                
            except Exception as e:
                table.add_row(method, endpoint, f"[red]❌ Error[/red]", "N/A")
                console.print(f"Error testing {endpoint}: {e}")
        
        console.print(table)

class DSPyTester:
    """Test DSPy integration with different models"""
    
    async def test_dspy_features(self):
        """Test DSPy features"""
        console.print("\n[bold cyan]🧠 Testing DSPy Features[/bold cyan]")
        console.print("=" * 60)
        
        # Test model selection
        selector = ModelSelector()
        
        test_scenarios = [
            ("Simple task", "What is the weather today?", {"prefer_fast": True}),
            ("Coding task", "Write a Python function", {"complexity": "complex"}),
            ("Critical task", "Design a security system", {"complexity": "critical"}),
        ]
        
        table = Table(title="DSPy Model Selection Tests", show_lines=True)
        table.add_column("Scenario", style="cyan")
        table.add_column("Selected Model", style="green")
        table.add_column("Reason", style="yellow")
        
        for scenario, task, context in test_scenarios:
            result = selector.select_model_for_task(task, context)
            if result:
                _, profile = result
                reason = f"Speed: {profile.speed_score:.1f}, Quality: {profile.quality_score:.1f}"
                table.add_row(scenario, profile.name, reason)
            else:
                table.add_row(scenario, "None available", "No suitable models")
        
        console.print(table)

async def main():
    """Run all tests"""
    console.print(Panel.fit(
        "[bold cyan]Universal AI Tools - Comprehensive Test Suite[/bold cyan]\n"
        "Testing all models, APIs, and DSPy integration",
        border_style="cyan"
    ))
    
    # Check if server is running
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get("http://localhost:9999/health", timeout=2.0)
            server_running = response.status_code == 200
    except:
        server_running = False
    
    if not server_running:
        console.print("\n[yellow]⚠️  Server not running. Start it with:[/yellow]")
        console.print("   NODE_ENV=development npx tsx src/server-startup-fix.ts")
        console.print("\n[cyan]Continuing with model tests only...[/cyan]")
    
    # Test models
    tester = ModelTester()
    await tester.test_all_models()
    
    # Test APIs if server is running
    if server_running:
        api_tester = APITester()
        await api_tester.test_endpoints()
    
    # Test DSPy features
    dspy_tester = DSPyTester()
    await dspy_tester.test_dspy_features()
    
    console.print("\n[bold green]✅ All tests completed![/bold green]")

if __name__ == "__main__":
    asyncio.run(main())