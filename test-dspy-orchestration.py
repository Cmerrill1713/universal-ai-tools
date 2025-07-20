#!/usr/bin/env python3
"""
Test DSPy Orchestration Features
"""

import asyncio
import json
import sys
import websockets
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

console = Console()

async def test_dspy_server():
    """Test the DSPy orchestration server"""
    uri = "ws://localhost:8766"
    
    console.print("[bold cyan]🧠 Testing DSPy Orchestration Server[/bold cyan]")
    console.print("=" * 60)
    
    test_requests = [
        {
            "name": "Simple Orchestration",
            "request": {
                "requestId": "test-1",
                "method": "orchestrate",
                "params": {
                    "userRequest": "Help me write a Python function",
                    "context": {"complexity": "moderate"}
                }
            }
        },
        {
            "name": "Model Info",
            "request": {
                "requestId": "test-2",
                "method": "get_model_info",
                "params": {}
            }
        },
        {
            "name": "Knowledge Extraction",
            "request": {
                "requestId": "test-3",
                "method": "manage_knowledge",
                "params": {
                    "operation": "extract",
                    "data": {
                        "content": "Python is a high-level programming language known for its simplicity.",
                        "context": {"topic": "programming"}
                    }
                }
            }
        },
        {
            "name": "Model Escalation",
            "request": {
                "requestId": "test-4",
                "method": "escalate_model",
                "params": {
                    "min_quality_score": 0.7
                }
            }
        },
        {
            "name": "Agent Coordination",
            "request": {
                "requestId": "test-5",
                "method": "coordinate_agents",
                "params": {
                    "task": "Build a web application",
                    "agents": ["planner", "developer", "tester", "deployer"],
                    "context": {"project_type": "web"}
                }
            }
        }
    ]
    
    try:
        async with websockets.connect(uri) as websocket:
            console.print(f"[green]✅ Connected to DSPy server at {uri}[/green]\n")
            
            # Create results table
            table = Table(title="DSPy Orchestration Test Results", show_lines=True)
            table.add_column("Test", style="cyan")
            table.add_column("Method", style="magenta")
            table.add_column("Status", justify="center")
            table.add_column("Key Results", style="yellow")
            
            for test in test_requests:
                console.print(f"🔄 Testing: {test['name']}...")
                
                # Send request
                await websocket.send(json.dumps(test['request']))
                
                # Get response
                response = await websocket.recv()
                result = json.loads(response)
                
                # Extract key info
                if result.get('success'):
                    status = "[green]✅ Success[/green]"
                    
                    # Extract relevant data based on method
                    method = test['request']['method']
                    if method == 'orchestrate':
                        data = result.get('data', {})
                        key_info = f"Intent: {data.get('intent', 'N/A')}, Complexity: {data.get('complexity', 'N/A')}"
                    elif method == 'get_model_info':
                        data = result.get('data', {})
                        key_info = f"Model: {data.get('name', 'N/A')}, Provider: {data.get('provider', 'N/A')}"
                    elif method == 'manage_knowledge':
                        data = result.get('data', {})
                        key_info = f"Extracted: {len(str(data.get('entities', [])))} chars of knowledge"
                    elif method == 'escalate_model':
                        data = result.get('data', {})
                        if data.get('escalated'):
                            key_info = data.get('message', 'Model escalated')
                        else:
                            key_info = "No escalation needed"
                    elif method == 'coordinate_agents':
                        data = result.get('data', {})
                        key_info = f"Selected: {data.get('selected_agents', 'N/A')}"
                    else:
                        key_info = "Operation completed"
                else:
                    status = "[red]❌ Failed[/red]"
                    key_info = result.get('error', 'Unknown error')
                
                table.add_row(
                    test['name'],
                    test['request']['method'],
                    status,
                    key_info
                )
                
                # Show detailed response for debugging
                if not result.get('success'):
                    console.print(f"   Error details: {result}", style="red dim")
            
            console.print(table)
            
    except websockets.exceptions.WebSocketException as e:
        console.print(f"[red]❌ Could not connect to DSPy server: {e}[/red]")
        console.print("\n[yellow]Start the DSPy server with:[/yellow]")
        console.print("   cd src/services/dspy-orchestrator && python server.py")
        return False
    except Exception as e:
        console.print(f"[red]❌ Test failed: {e}[/red]")
        return False
    
    return True

async def test_api_integration():
    """Test the main API integration with DSPy"""
    import httpx
    
    console.print("\n[bold cyan]🔌 Testing API-DSPy Integration[/bold cyan]")
    console.print("=" * 60)
    
    base_url = "http://localhost:9999"
    
    # Check if server is running
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{base_url}/health", timeout=2.0)
            if response.status_code != 200:
                console.print("[yellow]⚠️  Main server not running[/yellow]")
                return
    except:
        console.print("[yellow]⚠️  Main server not running[/yellow]")
        return
    
    # Test orchestration endpoint
    async with httpx.AsyncClient(timeout=30.0) as client:
        test_data = {
            "userRequest": "Create a REST API for user management",
            "context": {
                "project_type": "backend",
                "framework": "express"
            }
        }
        
        try:
            response = await client.post(
                f"{base_url}/api/v1/orchestrate",
                json=test_data,
                headers={"X-API-Key": "test-key-12345"}
            )
            
            if response.status_code == 200:
                result = response.json()
                console.print("[green]✅ Orchestration API working![/green]")
                console.print(f"   Response: {json.dumps(result, indent=2)[:200]}...")
            else:
                console.print(f"[red]❌ Orchestration API failed: {response.status_code}[/red]")
                console.print(f"   Response: {response.text[:200]}")
        except Exception as e:
            console.print(f"[red]❌ API test failed: {e}[/red]")

async def main():
    """Run all DSPy tests"""
    console.print(Panel.fit(
        "[bold cyan]Universal AI Tools - DSPy Orchestration Tests[/bold cyan]\n"
        "Testing DSPy server and API integration",
        border_style="cyan"
    ))
    
    # Test DSPy server
    server_ok = await test_dspy_server()
    
    # Test API integration if server is running
    if server_ok:
        await test_api_integration()
    
    console.print("\n[bold green]✅ DSPy tests completed![/bold green]")

if __name__ == "__main__":
    asyncio.run(main())