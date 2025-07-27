#!/usr/bin/env python3
"""
Demonstrate DSPy Improvements in Agent Responses
Shows before/after comparisons with different DSPy techniques
"""

import sys

sys.path.append("src/services/dspy-orchestrator")

import dspy
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()

# Configure DSPy
from llm_discovery import LLMDiscovery

lm_result = LLMDiscovery.discover_and_configure()
if lm_result:
    console.print(f"✅ Using {lm_result[1]} - {lm_result[2]}")

# Test Case 1: Basic vs Chain of Thought
console.print("\n[bold cyan]1️⃣ Basic Response vs Chain of Thought[/bold cyan]")
console.print("=" * 60)

problem = "If a train travels 120 miles in 2 hours, then slows to half speed for another 90 miles, what's the total travel time?"


# Basic approach
class BasicAnswer(dspy.Signature):
    """Answer a question directly"""

    question = dspy.InputField()
    answer = dspy.OutputField()


basic_module = dspy.Predict(BasicAnswer)
basic_result = basic_module(question=problem)

console.print("\n[red]Basic Response:[/red]")
console.print(Panel(basic_result.answer, title="Direct Answer"))


# Chain of Thought approach
class ReasoningAnswer(dspy.Signature):
    """Answer with step-by-step reasoning"""

    question = dspy.InputField()
    reasoning = dspy.OutputField(desc="Step-by-step reasoning")
    answer = dspy.OutputField(desc="Final answer")


cot_module = dspy.ChainOfThought(ReasoningAnswer)
cot_result = cot_module(question=problem)

console.print("\n[green]Chain of Thought Response:[/green]")
console.print(
    Panel(
        f"[yellow]Reasoning:[/yellow]\n{cot_result.reasoning}\n\n"
        f"[yellow]Answer:[/yellow]\n{cot_result.answer}",
        title="Reasoning + Answer",
    )
)

# Test Case 2: Simple Coding vs Program of Thought
console.print("\n[bold cyan]2️⃣ Basic Coding vs Program of Thought[/bold cyan]")
console.print("=" * 60)

coding_task = "Write a function to check if a string is a palindrome"

# Basic code generation
basic_code = basic_module(question=coding_task)
console.print("\n[red]Basic Code Generation:[/red]")
console.print(Panel(basic_code.answer, title="Simple Response"))


# Program of Thought approach
class CodeGeneration(dspy.Signature):
    """Generate code with analysis"""

    task = dspy.InputField()
    approach = dspy.OutputField(desc="Algorithm approach")
    code = dspy.OutputField(desc="Implementation")
    complexity = dspy.OutputField(desc="Time and space complexity")


# Use ChainOfThought as ProgramOfThought isn't available
pot_module = dspy.ChainOfThought(CodeGeneration)
pot_result = pot_module(task=coding_task)

console.print("\n[green]Program of Thought Response:[/green]")
console.print(
    Panel(
        f"[yellow]Approach:[/yellow]\n{pot_result.approach}\n\n"
        f"[yellow]Code:[/yellow]\n{pot_result.code}\n\n"
        f"[yellow]Complexity:[/yellow]\n{pot_result.complexity}",
        title="Structured Code Generation",
    )
)

# Test Case 3: Agent Coordination Example
console.print("\n[bold cyan]3️⃣ Single Agent vs Multi-Agent Coordination[/bold cyan]")
console.print("=" * 60)

complex_task = "Design a caching strategy for a social media feed"

# Single agent approach
single_result = basic_module(question=complex_task)
console.print("\n[red]Single Agent Response:[/red]")
console.print(Panel(single_result.answer, title="Basic Design"))

# Multi-agent simulation (showing what would happen)
console.print("\n[green]Multi-Agent Coordination (Simulated):[/green]")

agents_table = Table(show_lines=True)
agents_table.add_column("Agent", style="cyan")
agents_table.add_column("Contribution", style="yellow")

agents_table.add_row("System Architect", "Design cache layers: Browser → CDN → Redis → Database")
agents_table.add_row("Performance Engineer", "Implement LRU eviction, 5-minute TTL for feed items")
agents_table.add_row("Data Analyst", "Cache hit ratio target: 85%, monitor cache stampede")
agents_table.add_row("Security Expert", "Ensure user-specific cache keys, prevent data leakage")

console.print(agents_table)

# Summary of improvements
console.print("\n[bold cyan]📊 Summary of DSPy Improvements[/bold cyan]")
console.print("=" * 60)

improvements_table = Table(title="DSPy Technique Benefits", show_lines=True)
improvements_table.add_column("Technique", style="cyan")
improvements_table.add_column("Benefit", style="green")
improvements_table.add_column("Use Case", style="yellow")

improvements_table.add_row(
    "Chain of Thought", "Step-by-step reasoning", "Math problems, logic puzzles"
)
improvements_table.add_row(
    "Program of Thought", "Structured code generation", "Programming tasks, algorithms"
)
improvements_table.add_row("ReAct", "Tool use and interaction", "Calculations, API calls")
improvements_table.add_row("MIPROv2", "Learns from examples", "Consistent formatting, domain tasks")
improvements_table.add_row("Multi-Agent", "Specialized expertise", "Complex system design")

console.print(improvements_table)

# Key Insights
console.print("\n[bold green]✅ Key Insights:[/bold green]")
console.print("• DSPy modules add structure to LLM outputs")
console.print("• Chain of Thought dramatically improves reasoning clarity")
console.print("• Multi-agent coordination brings specialized perspectives")
console.print("• MIPROv2 optimization learns patterns from examples")
console.print("• Each technique targets specific types of improvements")

console.print("\n[bold cyan]🚀 The Result:[/bold cyan]")
console.print("Instead of raw LLM outputs, DSPy provides:")
console.print("1. Structured, step-by-step reasoning")
console.print("2. Consistent output formats")
console.print("3. Multi-perspective analysis")
console.print("4. Continuous improvement through learning")
console.print("5. Task-appropriate response strategies")
