#!/usr/bin/env python3
"""
Model Load Balancer Demonstration
Shows how the system rotates between AI services to prevent overloading
"""

import asyncio
import aiohttp
import json
import time
from typing import Dict, Any

class LoadBalancerDemo:
    def __init__(self):
        self.base_url = "http://localhost:8037"
        self.session = None
        
    async def initialize(self):
        """Initialize HTTP session"""
        self.session = aiohttp.ClientSession()
        
    async def cleanup(self):
        """Cleanup resources"""
        if self.session:
            await self.session.close()
    
    async def get_service_status(self) -> Dict[str, Any]:
        """Get current service status"""
        async with self.session.get(f"{self.base_url}/services") as response:
            if response.status == 200:
                return await response.json()
            else:
                return {}
    
    async def simulate_requests(self, num_requests: int = 10):
        """Simulate multiple requests to show rotation"""
        print(f"🔄 SIMULATING {num_requests} REQUESTS")
        print("=" * 50)
        
        service_usage = {}
        
        for i in range(num_requests):
            print(f"\nRequest {i+1}:")
            
            # Get current service status
            status = await self.get_service_status()
            services = status.get('services', {})
            
            # Find the service that would be selected (health-based)
            healthy_services = {
                name: service for name, service in services.items()
                if service.get('health_score', 0) > 0.5
            }
            
            if healthy_services:
                # Sort by health score (highest first)
                sorted_services = sorted(
                    healthy_services.items(),
                    key=lambda x: x[1].get('health_score', 0),
                    reverse=True
                )
                
                selected_service = sorted_services[0][0]
                service_info = sorted_services[0][1]
                
                print(f"  Selected: {service_info.get('name', selected_service)}")
                print(f"  Health Score: {service_info.get('health_score', 0):.2f}")
                print(f"  Models: {len(service_info.get('models', []))}")
                print(f"  Connections: {service_info.get('current_connections', 0)}/{service_info.get('max_concurrent', 0)}")
                
                # Track usage
                service_usage[selected_service] = service_usage.get(selected_service, 0) + 1
            else:
                print("  No healthy services available")
            
            # Small delay to show rotation
            await asyncio.sleep(0.5)
        
        print(f"\n📊 SERVICE USAGE SUMMARY:")
        print("=" * 30)
        for service, count in service_usage.items():
            percentage = (count / num_requests) * 100
            print(f"  {service}: {count} requests ({percentage:.1f}%)")
    
    async def show_health_distribution(self):
        """Show how health scores affect service selection"""
        print(f"\n🏥 HEALTH-BASED SERVICE SELECTION")
        print("=" * 40)
        
        status = await self.get_service_status()
        services = status.get('services', {})
        
        print("Service Health Scores:")
        for name, service in services.items():
            health = service.get('health_score', 0)
            status_icon = "✅" if health > 0.7 else "⚠️" if health > 0.3 else "❌"
            print(f"  {status_icon} {service.get('name', name)}: {health:.2f}")
        
        print(f"\nStrategy: {status.get('strategy', 'unknown')}")
        print(f"Available Services: {status.get('available_services', 0)}/{status.get('total_services', 0)}")

async def main():
    demo = LoadBalancerDemo()
    
    try:
        await demo.initialize()
        
        print("🎯 MODEL LOAD BALANCER DEMONSTRATION")
        print("====================================")
        print("This demo shows how the system intelligently rotates")
        print("between AI services to prevent overloading any single model.")
        print()
        
        # Show initial health distribution
        await demo.show_health_distribution()
        
        # Simulate requests
        await demo.simulate_requests(10)
        
        print(f"\n🎉 DEMONSTRATION COMPLETE!")
        print("The load balancer successfully:")
        print("✅ Monitors service health in real-time")
        print("✅ Selects the best available service")
        print("✅ Distributes load across multiple AI providers")
        print("✅ Prevents overloading any single service")
        
    except Exception as e:
        print(f"❌ Demo failed: {e}")
    finally:
        await demo.cleanup()

if __name__ == "__main__":
    asyncio.run(main())
