#!/usr/bin/env python3
"""
Quick Model Testing - Tests selected models without timeout
"""

import asyncio
import sys
import time

sys.path.append("src/services/dspy-orchestrator")

try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.table import Table
except ImportError:
    print("Installing rich...")
    import subprocess

    subprocess.check_call([sys.executable, "-m", "pip", "install", "rich"])
    from rich.console import Console
    from rich.panel import Panel
    from rich.table import Table

import dspy
from llm_discovery import LLMDiscovery
from model_selector import ModelSelector

console = Console()

# Test only a few models to avoid timeout
SELECTED_MODELS = [
    ("Ollama", "gemma:2b"),  # Fast, small
    ("Ollama", "qwen2.5:7b"),  # Good for coding
    ("LM Studio Remote", "deepseek/deepseek-r1-0528-qwen3-8b"),  # Your LM Studio model
]

TEST_TASKS = {
    "simple": "What is 2+2?",
    "moderate": "Explain photosynthesis in one sentence",
    "coding": "Write a Python hello world function",
}


async def test_model(provider: str, model_name: str, task: str) -> dict:
    """Test a specific model"""
    start_time = time.time()

    try:
        # Configure model
        if provider.startswith("Ollama"):
            base_url = "http://localhost:11434" if provider == "Ollama" else "http://localhost:8080"
            lm = dspy.LM(f"ollama_chat/{model_name}", api_base=base_url, api_key="")
        else:  # LM Studio
            base_url = "http://192.168.1.179:5901/v1"
            lm = dspy.LM(f"openai/{model_name}", api_base=base_url, api_key="lm-studio")

        # Test the model
        response = lm(task)
        response_time = (time.time() - start_time) * 1000  # ms

        return {
            "success": True,
            "response": response[0] if isinstance(response, list) else str(response),
            "response_time_ms": response_time,
            "error": None,
        }

    except Exception as e:
        return {
            "success": False,
            "response": None,
            "response_time_ms": (time.time() - start_time) * 1000,
            "error": str(e),
        }


async def test_intelligent_selection():
    """Test the intelligent model selection"""
    console.print("\n[bold cyan]🧠 Testing Intelligent Model Selection[/bold cyan]")

    selector = ModelSelector()

    # Test different scenarios
    scenarios = [
        ("Fast response needed", "What time is it?", {"prefer_fast": True}),
        ("Coding task", "Write a sorting algorithm", {"complexity": "complex"}),
        ("General query", "Explain quantum physics", {"complexity": "moderate"}),
    ]

    table = Table(title="Model Selection Results", show_lines=True)
    table.add_column("Scenario", style="cyan")
    table.add_column("Selected Model", style="green")
    table.add_column("Reason", style="yellow")

    for scenario, task, context in scenarios:
        result = selector.select_model_for_task(task, context)
        if result:
            _, profile = result
            reason = f"Speed: {profile.speed_score:.1f}, Quality: {profile.quality_score:.1f}"
            table.add_row(scenario, profile.name, reason)
        else:
            table.add_row(scenario, "None available", "No suitable models")

    console.print(table)


async def main():
    """Run quick tests"""
    console.print(
        Panel.fit(
            "[bold cyan]Universal AI Tools - Quick Model Test[/bold cyan]\n"
            "Testing selected models and intelligent selection",
            border_style="cyan",
        )
    )

    # Test selected models
    console.print("\n[bold cyan]🧪 Testing Selected Models[/bold cyan]")

    table = Table(title="Model Test Results", show_lines=True)
    table.add_column("Model", style="cyan")
    table.add_column("Provider", style="magenta")
    table.add_column("Task", style="blue")
    table.add_column("Response Time", justify="right", style="yellow")
    table.add_column("Status", justify="center")

    for provider, model_name in SELECTED_MODELS:
        console.print(f"\nTesting {model_name}...")

        for task_type, task in TEST_TASKS.items():
            result = await test_model(provider, model_name, task)

            status = "[green]✅[/green]" if result["success"] else "[red]❌[/red]"
            time_str = f"{result['response_time_ms']:.0f}ms" if result["success"] else "N/A"

            table.add_row(model_name, provider, task_type, time_str, status)

            if result["success"] and result["response"]:
                # Show a snippet of the response
                response_preview = (
                    result["response"][:50] + "..."
                    if len(result["response"]) > 50
                    else result["response"]
                )
                console.print(f"   → {response_preview}", style="dim")
            elif result["error"]:
                console.print(f"   → Error: {result['error']}", style="red dim")

    console.print(table)

    # Test intelligent selection
    await test_intelligent_selection()

    # Show model discovery summary
    console.print("\n[bold cyan]📊 Model Discovery Summary[/bold cyan]")
    discovery = LLMDiscovery()
    all_models = discovery.get_all_available_models()

    summary_table = Table(show_lines=True)
    summary_table.add_column("Provider", style="cyan")
    summary_table.add_column("Models Available", justify="center", style="green")

    total = 0
    for provider, models in all_models.items():
        summary_table.add_row(provider, str(len(models)))
        total += len(models)

    console.print(summary_table)
    console.print(f"\n[bold green]Total models discovered: {total}[/bold green]")

    console.print("\n[bold green]✅ Quick test completed![/bold green]")
    console.print("\nTo test all models, run: python test-all-models.py")


if __name__ == "__main__":
    asyncio.run(main())
