#!/usr/bin/env python3
"""
Interactive Model Manager for Universal AI Tools
Manage Ollama models including Liquid/LFM models
"""

import asyncio
import sys
import os
sys.path.append('src/services/dspy-orchestrator')

from model_manager import model_manager, ModelType
import httpx
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, DownloadColumn
from rich.prompt import Prompt, Confirm
from rich import print as rprint

console = Console()


class InteractiveModelManager:
    """Interactive CLI for model management"""
    
    LIQUID_MODELS = [
        ("lfm:latest", "Liquid Foundation Model - Latest", 7.0),
        ("lfm:7b", "Liquid Foundation Model 7B", 7.0),
        ("lfm:13b", "Liquid Foundation Model 13B", 13.0),
        ("lfm:40b", "Liquid Foundation Model 40B (Large)", 40.0),
        ("liquid:latest", "Liquid AI Model - Latest", 3.0),
        ("liquid:3b", "Liquid AI Model 3B - Fast", 3.0),
    ]
    
    def __init__(self):
        self.manager = model_manager
        
    async def list_models(self):
        """List all models in a nice table"""
        console.print("\n[bold cyan]📋 Model Library[/bold cyan]\n")
        
        # Get all models
        all_models = await self.manager.list_all_models()
        
        # Create table
        table = Table(title="Available Models", show_lines=True)
        table.add_column("Status", style="cyan", width=8)
        table.add_column("Model Name", style="green")
        table.add_column("Size", justify="right", style="yellow")
        table.add_column("Type", style="magenta")
        table.add_column("Description", style="white")
        
        # Add Ollama models
        for model in all_models.get("ollama", []):
            status = "✅" if model.is_downloaded else "⬇️"
            size = f"{model.size_gb:.1f}GB" if model.size_gb else "?"
            table.add_row(
                status,
                model.name,
                size,
                "Ollama",
                model.description or ""
            )
        
        # Add Liquid/LFM models specifically
        console.print("\n[bold magenta]🌊 Liquid Foundation Models (LFM)[/bold magenta]")
        
        liquid_table = Table(show_lines=True)
        liquid_table.add_column("Status", style="cyan", width=8)
        liquid_table.add_column("Model Name", style="blue")
        liquid_table.add_column("Size", justify="right", style="yellow")
        liquid_table.add_column("Description", style="white")
        
        # Check which Liquid models are available
        for model_name, description, size in self.LIQUID_MODELS:
            # Check if downloaded
            is_downloaded = await self._check_model_exists(model_name)
            status = "✅" if is_downloaded else "⬇️"
            liquid_table.add_row(
                status,
                model_name,
                f"{size:.0f}GB",
                description
            )
        
        console.print(table)
        console.print(liquid_table)
        
    async def _check_model_exists(self, model_name: str) -> bool:
        """Check if a model exists locally"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "http://localhost:11434/api/show",
                    json={"name": model_name},
                    timeout=5.0
                )
                return response.status_code == 200
        except:
            return False
    
    async def download_model_interactive(self):
        """Interactive model download"""
        console.print("\n[bold cyan]📥 Download Model[/bold cyan]\n")
        
        # Show available models for download
        console.print("Popular models to download:")
        console.print("1. [blue]lfm:latest[/blue] - Liquid Foundation Model (7GB)")
        console.print("2. [blue]lfm:7b[/blue] - LFM 7B specific version")
        console.print("3. [blue]liquid:3b[/blue] - Liquid 3B - Fast & efficient")
        console.print("4. [green]llama3.3:latest[/green] - Latest Llama 3.3")
        console.print("5. [green]qwen2.5:14b[/green] - Qwen 2.5 14B - Great for coding")
        console.print("6. [yellow]deepseek-r1:32b[/yellow] - DeepSeek R1 32B")
        console.print("7. Custom model name")
        
        choice = Prompt.ask("\nEnter choice (1-7)", default="1")
        
        model_map = {
            "1": "lfm:latest",
            "2": "lfm:7b",
            "3": "liquid:3b",
            "4": "llama3.3:latest",
            "5": "qwen2.5:14b",
            "6": "deepseek-r1:32b"
        }
        
        if choice in model_map:
            model_name = model_map[choice]
        elif choice == "7":
            model_name = Prompt.ask("Enter model name")
        else:
            console.print("[red]Invalid choice[/red]")
            return
        
        # Confirm download
        if not Confirm.ask(f"Download [bold]{model_name}[/bold]?"):
            return
        
        # Download with progress
        console.print(f"\n[green]Downloading {model_name}...[/green]")
        
        def progress_callback(update):
            if update.get("status") == "downloading":
                if "progress" in update:
                    console.print(f"Progress: {update['progress']}%", end="\r")
                elif "message" in update:
                    console.print(update["message"])
            elif update.get("status") == "complete":
                console.print(f"\n[green]✅ {update['message']}[/green]")
        
        success = await self.manager.download_model(model_name, progress_callback)
        
        if not success:
            console.print(f"[red]❌ Failed to download {model_name}[/red]")
    
    async def delete_model_interactive(self):
        """Interactive model deletion"""
        console.print("\n[bold red]🗑️  Delete Model[/bold red]\n")
        
        # Get downloaded models
        all_models = await self.manager.list_all_models()
        downloaded = []
        
        for model in all_models.get("ollama", []):
            if model.is_downloaded:
                downloaded.append(model.name)
        
        if not downloaded:
            console.print("[yellow]No models to delete[/yellow]")
            return
        
        # Show models
        console.print("Downloaded models:")
        for i, model in enumerate(downloaded, 1):
            console.print(f"{i}. {model}")
        
        choice = Prompt.ask("\nSelect model to delete (number)", default="cancel")
        
        if choice == "cancel":
            return
        
        try:
            idx = int(choice) - 1
            if 0 <= idx < len(downloaded):
                model_name = downloaded[idx]
                
                if Confirm.ask(f"Delete [bold red]{model_name}[/bold red]? This cannot be undone"):
                    success = await self.manager.delete_model(model_name)
                    if success:
                        console.print(f"[green]✅ Deleted {model_name}[/green]")
                    else:
                        console.print(f"[red]❌ Failed to delete {model_name}[/red]")
        except ValueError:
            console.print("[red]Invalid choice[/red]")
    
    async def recommend_model(self):
        """Get model recommendations"""
        console.print("\n[bold cyan]🎯 Model Recommendations[/bold cyan]\n")
        
        task_type = Prompt.ask(
            "What type of task?",
            choices=["coding", "reasoning", "fast_inference", "general"],
            default="general"
        )
        
        max_size = Prompt.ask("Maximum model size in GB", default="20")
        prefer_fast = Confirm.ask("Prefer faster models over quality?", default=False)
        
        constraints = {
            "max_size_gb": float(max_size),
            "prefer_fast": prefer_fast,
            "require_local": True
        }
        
        rec = await self.manager.recommend_model(task_type, constraints)
        
        if rec:
            console.print(f"\n[green]Recommended: {rec}[/green]")
            
            # Show why
            info = await self.manager.get_model_info(rec)
            if info:
                console.print(f"Size: {info.size_gb:.1f}GB")
                console.print(f"Capabilities: {', '.join(info.capabilities or [])}")
        else:
            console.print("[yellow]No suitable models found. Try downloading more models.[/yellow]")
    
    async def run(self):
        """Main interactive loop"""
        console.print("[bold blue]🤖 Universal AI Tools - Model Manager[/bold blue]")
        console.print("Manage your LLM models including Liquid Foundation Models (LFM)\n")
        
        while True:
            console.print("\n[bold]Options:[/bold]")
            console.print("1. List all models")
            console.print("2. Download model")
            console.print("3. Delete model")
            console.print("4. Get model recommendation")
            console.print("5. Exit")
            
            choice = Prompt.ask("\nSelect option", choices=["1", "2", "3", "4", "5"], default="1")
            
            if choice == "1":
                await self.list_models()
            elif choice == "2":
                await self.download_model_interactive()
            elif choice == "3":
                await self.delete_model_interactive()
            elif choice == "4":
                await self.recommend_model()
            elif choice == "5":
                console.print("\n[green]Goodbye! 👋[/green]")
                break


async def main():
    """Run the interactive model manager"""
    try:
        # Check if rich is installed
        import rich
    except ImportError:
        print("Installing required package: rich")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "rich"])
        print("Please run the script again")
        return
    
    manager = InteractiveModelManager()
    await manager.run()


if __name__ == "__main__":
    asyncio.run(main())