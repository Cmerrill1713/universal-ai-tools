#!/usr/bin/env python3

import psutil
import time
import json
from datetime import datetime

def benchmark_cpu_usage(duration=60):
    """Benchmark CPU usage over specified duration"""
    print(f"Starting CPU benchmark for {duration} seconds...")
    
    cpu_samples = []
    start_time = time.time()
    
    while time.time() - start_time < duration:
        cpu_percent = psutil.cpu_percent(interval=1)
        cpu_samples.append({
            'timestamp': datetime.now().isoformat(),
            'cpu_percent': cpu_percent
        })
    
    avg_cpu = sum(sample['cpu_percent'] for sample in cpu_samples) / len(cpu_samples)
    max_cpu = max(sample['cpu_percent'] for sample in cpu_samples)
    
    results = {
        'duration_seconds': duration,
        'average_cpu_percent': avg_cpu,
        'max_cpu_percent': max_cpu,
        'samples': cpu_samples
    }
    
    return results

if __name__ == "__main__":
    results = benchmark_cpu_usage(10)  # 10 second test
    print(f"Average CPU usage: {results['average_cpu_percent']:.2f}%")
    print(f"Peak CPU usage: {results['max_cpu_percent']:.2f}%")
    
    # Save results
    with open('cpu_benchmark_results.json', 'w') as f:
        json.dump(results, f, indent=2)
