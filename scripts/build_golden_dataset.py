#!/usr/bin/env python3
"""
Build Golden Dataset for Evolution System
Creates initial training data for the nightly evolution analyzer
"""

import json
from pathlib import Path
from datetime import datetime, timedelta
import random

def build_golden_dataset():
    """Build initial golden dataset with realistic routing examples"""
    
    output_dir = Path("/Users/christianmerrill/Documents/GitHub/AI-Projects/universal-ai-tools/data/evolution")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Define example routing patterns
    golden_examples = {
        "routing_patterns": [
            # General conversation tasks
            {
                "task_type": "general",
                "keywords": ["hello", "hi", "chat", "talk", "conversation"],
                "backend": "ai_assistant",
                "success_rate": 0.98,
                "avg_latency": 0.8,
                "confidence": 0.95
            },
            # Code-related tasks
            {
                "task_type": "code",
                "keywords": ["code", "function", "debug", "python", "javascript", "fix bug"],
                "backend": "ai_assistant",
                "success_rate": 0.95,
                "avg_latency": 1.2,
                "confidence": 0.90
            },
            # Research tasks
            {
                "task_type": "research",
                "keywords": ["research", "find", "search", "information", "learn about"],
                "backend": "ai_assistant",
                "success_rate": 0.92,
                "avg_latency": 2.5,
                "confidence": 0.85
            },
            # Analysis tasks
            {
                "task_type": "analysis",
                "keywords": ["analyze", "evaluate", "compare", "review"],
                "backend": "ai_assistant",
                "success_rate": 0.94,
                "avg_latency": 1.8,
                "confidence": 0.88
            },
            # Task execution
            {
                "task_type": "task_execution",
                "keywords": ["execute", "run", "open", "screenshot", "control"],
                "backend": "ai_assistant",
                "success_rate": 0.89,
                "avg_latency": 1.5,
                "confidence": 0.82
            }
        ],
        
        "routing_history": []
    }
    
    # Generate sample routing history (last 30 days)
    base_date = datetime.now() - timedelta(days=30)
    
    for day in range(30):
        current_date = base_date + timedelta(days=day)
        daily_routings = random.randint(10, 50)  # 10-50 requests per day
        
        for i in range(daily_routings):
            # Pick random pattern
            pattern = random.choice(golden_examples["routing_patterns"])
            
            # Generate routing entry
            routing = {
                "timestamp": (current_date + timedelta(hours=random.randint(6, 22), minutes=random.randint(0, 59))).isoformat(),
                "task_type": pattern["task_type"],
                "backend": pattern["backend"],
                "success": random.random() < pattern["success_rate"],
                "latency": pattern["avg_latency"] + random.uniform(-0.3, 0.3),
                "confidence": pattern["confidence"] + random.uniform(-0.05, 0.05)
            }
            
            golden_examples["routing_history"].append(routing)
    
    # Add metadata
    golden_examples["metadata"] = {
        "created": datetime.now().isoformat(),
        "version": "1.0",
        "total_patterns": len(golden_examples["routing_patterns"]),
        "total_history": len(golden_examples["routing_history"]),
        "date_range": {
            "start": base_date.isoformat(),
            "end": datetime.now().isoformat()
        }
    }
    
    # Save golden dataset
    output_file = output_dir / "golden_dataset.json"
    with open(output_file, 'w') as f:
        json.dump(golden_examples, f, indent=2)
    
    print(f"✅ Golden dataset created: {output_file}")
    print(f"   - Routing patterns: {len(golden_examples['routing_patterns'])}")
    print(f"   - Routing history: {len(golden_examples['routing_history'])} entries")
    print(f"   - Date range: {golden_examples['metadata']['date_range']['start']} to {golden_examples['metadata']['date_range']['end']}")
    
    # Create initial stats
    stats = {
        "total_routings": len(golden_examples["routing_history"]),
        "success_rate": sum(1 for r in golden_examples["routing_history"] if r["success"]) / len(golden_examples["routing_history"]),
        "avg_latency": sum(r["latency"] for r in golden_examples["routing_history"]) / len(golden_examples["routing_history"]),
        "backends_used": list(set(r["backend"] for r in golden_examples["routing_history"])),
        "task_types": list(set(r["task_type"] for r in golden_examples["routing_history"]))
    }
    
    stats_file = output_dir / "initial_stats.json"
    with open(stats_file, 'w') as f:
        json.dump(stats, f, indent=2)
    
    print(f"\n📊 Initial Statistics:")
    print(f"   - Total routings: {stats['total_routings']}")
    print(f"   - Success rate: {stats['success_rate']:.1%}")
    print(f"   - Avg latency: {stats['avg_latency']:.2f}s")
    print(f"   - Backends: {', '.join(stats['backends_used'])}")
    print(f"   - Task types: {', '.join(stats['task_types'])}")
    
    return output_file

if __name__ == "__main__":
    build_golden_dataset()

