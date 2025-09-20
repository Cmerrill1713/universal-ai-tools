#!/usr/bin/env python3
"""
Parallel Service Management for Universal AI Tools
Manages all services in parallel with health monitoring and automatic restart
"""

import asyncio
import signal
import subprocess
import sys
import time
from dataclasses import dataclass
from typing import Dict, List

import aiohttp


@dataclass
class ServiceConfig:
    name: str
    command: List[str]
    port: int
    health_endpoint: str
    working_dir: str
    env_vars: Dict[str, str]
    restart_on_failure: bool = True
    max_restarts: int = 3


class ParallelServiceManager:
    def __init__(self):
        self.services = {"ollama": ServiceConfig(name="ollama",
                                                 command=["ollama",
                                                          "serve"],
                                                 port=11434,
                                                 health_endpoint="/api/tags",
                                                 working_dir="/Users/christianmerrill/Desktop/universal-ai-tools",
                                                 env_vars={},
                                                 ),
                         "hrm-service": ServiceConfig(name="hrm-service",
                                                      command=["python3",
                                                               "python-services/hrm-service.py",
                                                               "--port",
                                                               "8002"],
                                                      port=8002,
                                                      health_endpoint="/health",
                                                      working_dir="/Users/christianmerrill/Desktop/universal-ai-tools",
                                                      env_vars={"HRM_PORT": "8002",
                                                                "MLX_MODELS_PATH": "/Users/christianmerrill/Desktop/universal-ai-tools/models",
                                                                },
                                                      ),
                         "llm-router": ServiceConfig(name="llm-router",
                                                     command=["cargo",
                                                              "run",
                                                              "-p",
                                                              "llm-router"],
                                                     port=3033,
                                                     health_endpoint="/health",
                                                     working_dir="/Users/christianmerrill/Desktop/universal-ai-tools",
                                                     env_vars={"OLLAMA_URL": "http://localhost:11434"},
                                                     ),
                         "api-gateway": ServiceConfig(name="api-gateway",
                                                      command=["go",
                                                               "run",
                                                               "go-services/api-gateway/main.go"],
                                                      port=8080,
                                                      health_endpoint="/health",
                                                      working_dir="/Users/christianmerrill/Desktop/universal-ai-tools",
                                                      env_vars={},
                                                      ),
                         "agent-coordination": ServiceConfig(name="agent-coordination",
                                                             command=["cargo",
                                                                      "run",
                                                                      "-p",
                                                                      "agent-orchestrator"],
                                                             port=3034,
                                                             health_endpoint="/health",
                                                             working_dir="/Users/christianmerrill/Desktop/universal-ai-tools",
                                                             env_vars={},
                                                             ),
                         "memory-service": ServiceConfig(name="memory-service",
                                                         command=["go",
                                                                  "run",
                                                                  "go-services/memory-service/main.go"],
                                                         port=8017,
                                                         health_endpoint="/health",
                                                         working_dir="/Users/christianmerrill/Desktop/universal-ai-tools",
                                                         env_vars={},
                                                         ),
                         "ml-inference": ServiceConfig(name="ml-inference",
                                                       command=["cargo",
                                                                "run",
                                                                "-p",
                                                                "ml-inference-service"],
                                                       port=8084,
                                                       health_endpoint="/health",
                                                       working_dir="/Users/christianmerrill/Desktop/universal-ai-tools",
                                                       env_vars={},
                                                       ),
                         }

        self.running_processes = {}
        self.service_status = {}
        self.restart_counts = {}
        self.shutdown_event = asyncio.Event()

    async def start_all_services(self) -> bool:
        """Start all services in parallel"""
        print("🚀 Starting Universal AI Tools Services in Parallel...")
        print("=" * 60)

        # Start services concurrently
        tasks = []
        for service_name, config in self.services.items():
            task = asyncio.create_task(
                self.start_service(
                    service_name, config))
            tasks.append(task)

        # Wait for all services to start
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Check results
        successful_starts = 0
        for i, result in enumerate(results):
            service_name = list(self.services.keys())[i]
            if isinstance(result, Exception):
                print(f"❌ {service_name}: Failed to start - {result}")
            elif result:
                print(f"✅ {service_name}: Started successfully")
                successful_starts += 1
            else:
                print(f"⚠️  {service_name}: Started but not healthy")

        print(
            f"\n📊 Service Startup Summary: {successful_starts}/{len(self.services)} services healthy"
        )
        return successful_starts >= len(
            self.services) * 0.8  # 80% success rate

    async def start_service(
            self,
            service_name: str,
            config: ServiceConfig) -> bool:
        """Start a single service"""
        try:
            print(f"  Starting {service_name}...")

            # Prepare environment
            env = {**os.environ, **config.env_vars}

            # Start process
            process = subprocess.Popen(
                config.command,
                cwd=config.working_dir,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                preexec_fn=os.setsid if os.name != "nt" else None,
            )

            self.running_processes[service_name] = process

            # Wait for service to initialize
            await asyncio.sleep(5)

            # Check health
            is_healthy = await self.check_service_health(service_name, config)

            if is_healthy:
                self.service_status[service_name] = "healthy"
                return True
            else:
                self.service_status[service_name] = "unhealthy"
                return False

        except Exception as e:
            print(f"    ❌ Error starting {service_name}: {e}")
            self.service_status[service_name] = "failed"
            return False

    async def check_service_health(
        self, service_name: str, config: ServiceConfig
    ) -> bool:
        """Check if a service is healthy"""
        try:
            url = f"http://localhost:{config.port}{config.health_endpoint}"

            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url, timeout=aiohttp.ClientTimeout(total=5)
                ) as response:
                    if response.status == 200:
                        print(f"    ✅ {service_name} is healthy")
                        return True
                    else:
                        print(
                            f"    ⚠️  {service_name} responded with status {response.status}")
                        return False
        except Exception as e:
            print(f"    ❌ {service_name} health check failed: {e}")
            return False

    async def monitor_services(self):
        """Monitor all services and restart if needed"""
        print("\n🔍 Starting service monitoring...")

        while not self.shutdown_event.is_set():
            try:
                # Check each service
                for service_name, config in self.services.items():
                    if service_name in self.running_processes:
                        process = self.running_processes[service_name]

                        # Check if process is still running
                        if process.poll() is not None:
                            print(
                                f"⚠️  {service_name} process died, restarting...")
                            await self.restart_service(service_name, config)
                        else:
                            # Check health
                            is_healthy = await self.check_service_health(
                                service_name, config
                            )
                            if not is_healthy and config.restart_on_failure:
                                print(
                                    f"⚠️  {service_name} is unhealthy, restarting...")
                                await self.restart_service(service_name, config)

                # Wait before next check
                await asyncio.sleep(10)

            except Exception as e:
                print(f"❌ Error in service monitoring: {e}")
                await asyncio.sleep(5)

    async def restart_service(self, service_name: str, config: ServiceConfig):
        """Restart a service"""
        try:
            # Check restart count
            restart_count = self.restart_counts.get(service_name, 0)
            if restart_count >= config.max_restarts:
                print(
                    f"❌ {service_name} exceeded max restarts ({
                        config.max_restarts}), giving up")
                return

            # Stop existing process
            if service_name in self.running_processes:
                process = self.running_processes[service_name]
                try:
                    process.terminate()
                    process.wait(timeout=5)
                except BaseException:
                    process.kill()
                del self.running_processes[service_name]

            # Wait a bit
            await asyncio.sleep(2)

            # Start new process
            env = {**os.environ, **config.env_vars}
            process = subprocess.Popen(
                config.command,
                cwd=config.working_dir,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                preexec_fn=os.setsid if os.name != "nt" else None,
            )

            self.running_processes[service_name] = process
            self.restart_counts[service_name] = restart_count + 1

            # Wait for initialization
            await asyncio.sleep(5)

            # Check health
            is_healthy = await self.check_service_health(service_name, config)
            if is_healthy:
                print(f"✅ {service_name} restarted successfully")
                self.service_status[service_name] = "healthy"
            else:
                print(f"❌ {service_name} restart failed")
                self.service_status[service_name] = "unhealthy"

        except Exception as e:
            print(f"❌ Error restarting {service_name}: {e}")

    async def get_service_status(self) -> Dict:
        """Get comprehensive service status"""
        status = {
            "timestamp": time.time(),
            "services": {},
            "summary": {
                "total": len(self.services),
                "healthy": 0,
                "unhealthy": 0,
                "failed": 0,
            },
        }

        for service_name, config in self.services.items():
            service_info = {
                "name": service_name,
                "port": config.port,
                "status": self.service_status.get(service_name, "unknown"),
                "restart_count": self.restart_counts.get(service_name, 0),
                "running": service_name in self.running_processes,
            }

            # Add process info if running
            if service_name in self.running_processes:
                process = self.running_processes[service_name]
                service_info["pid"] = process.pid
                service_info["return_code"] = process.poll()

            status["services"][service_name] = service_info

            # Update summary
            if service_info["status"] == "healthy":
                status["summary"]["healthy"] += 1
            elif service_info["status"] == "unhealthy":
                status["summary"]["unhealthy"] += 1
            else:
                status["summary"]["failed"] += 1

        return status

    async def print_status(self):
        """Print current service status"""
        status = await self.get_service_status()

        print("\n📊 Service Status Report")
        print("=" * 40)
        print(f"Total Services: {status['summary']['total']}")
        print(f"Healthy: {status['summary']['healthy']}")
        print(f"Unhealthy: {status['summary']['unhealthy']}")
        print(f"Failed: {status['summary']['failed']}")
        print()

        for service_name, service_info in status["services"].items():
            status_icon = "✅" if service_info["status"] == "healthy" else "❌"
            print(f"{status_icon} {service_name}: {service_info['status']}")
            if service_info["restart_count"] > 0:
                print(f"   Restarts: {service_info['restart_count']}")

    async def shutdown_all_services(self):
        """Shutdown all services gracefully"""
        print("\n🛑 Shutting down all services...")

        self.shutdown_event.set()

        for service_name, process in self.running_processes.items():
            try:
                print(f"  Stopping {service_name}...")
                process.terminate()
                process.wait(timeout=5)
                print(f"  ✅ {service_name} stopped")
            except Exception as e:
                print(f"  ❌ Error stopping {service_name}: {e}")
                try:
                    process.kill()
                except BaseException:
                    pass

        self.running_processes.clear()
        print("✅ All services stopped")

    def setup_signal_handlers(self):
        """Setup signal handlers for graceful shutdown"""

        def signal_handler(signum, frame):
            print(f"\n🛑 Received signal {signum}, shutting down...")
            asyncio.create_task(self.shutdown_all_services())
            sys.exit(0)

        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)


async def main():
    """Main service manager"""
    manager = ParallelServiceManager()
    manager.setup_signal_handlers()

    try:
        # Start all services
        success = await manager.start_all_services()

        if not success:
            print("❌ Failed to start required services")
            return

        # Start monitoring
        monitor_task = asyncio.create_task(manager.monitor_services())

        # Print status every 30 seconds
        while not manager.shutdown_event.is_set():
            await manager.print_status()
            await asyncio.sleep(30)

    except KeyboardInterrupt:
        print("\n🛑 Keyboard interrupt received")
    except Exception as e:
        print(f"❌ Error in service manager: {e}")
    finally:
        await manager.shutdown_all_services()


if __name__ == "__main__":
    import os

    asyncio.run(main())
