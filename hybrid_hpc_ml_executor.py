#!/usr/bin/env python3
"""
Hybrid HPC/ML Workflow Executor
Based on latest research for scalable runtime architecture
"""

import asyncio
import multiprocessing as mp
import time
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from dataclasses import dataclass
from enum import Enum
from typing import Any, Callable, Dict, List, Optional

import numpy as np
import psutil


class TaskType(Enum):
    """Types of tasks in the hybrid workflow"""

    ML_INFERENCE = "ml_inference"
    HPC_COMPUTATION = "hpc_computation"
    DATA_PROCESSING = "data_processing"
    MODEL_TRAINING = "model_training"
    OPTIMIZATION = "optimization"


class ResourceType(Enum):
    """Types of computational resources"""

    CPU = "cpu"
    GPU = "gpu"
    MEMORY = "memory"
    STORAGE = "storage"
    NETWORK = "network"


@dataclass
class ResourceAllocation:
    """Resource allocation for a task"""

    cpu_cores: int
    memory_gb: float
    gpu_count: int = 0
    storage_gb: float = 0.0
    network_bandwidth: float = 0.0


@dataclass
class Task:
    """A task in the hybrid workflow"""

    task_id: str
    task_type: TaskType
    function: Callable
    args: tuple
    kwargs: dict
    resource_requirements: ResourceAllocation
    priority: int = 0
    dependencies: List[str] = None
    timeout: float = 300.0


@dataclass
class ExecutionResult:
    """Result of task execution"""

    task_id: str
    success: bool
    result: Any
    execution_time: float
    resource_usage: Dict[str, float]
    error: Optional[str] = None


class HybridHPCMLExecutor:
    """Scalable executor for hybrid HPC/ML workflows"""

    def __init__(self, max_workers: Optional[int] = None):
        self.max_workers = max_workers or mp.cpu_count()
        self.resource_monitor = ResourceMonitor()
        self.task_queue = asyncio.Queue()
        self.results = {}
        self.running_tasks = {}
        self.completed_tasks = set()

        # Resource pools
        self.cpu_pool = ThreadPoolExecutor(max_workers=self.max_workers)
        self.gpu_pool = None  # Will be initialized if GPU is available
        self.hpc_pool = ProcessPoolExecutor(max_workers=self.max_workers)

        # Workflow state
        self.workflow_running = False
        self.workflow_stats = {
            "total_tasks": 0,
            "completed_tasks": 0,
            "failed_tasks": 0,
            "total_execution_time": 0.0,
            "resource_utilization": {},
        }

    async def execute_workflow(
            self, tasks: List[Task]) -> Dict[str, ExecutionResult]:
        """Execute a hybrid HPC/ML workflow with intelligent resource allocation"""
        print("🚀 Starting Hybrid HPC/ML Workflow Execution")
        print("=" * 60)

        self.workflow_running = True
        self.workflow_stats["total_tasks"] = len(tasks)

        # Build dependency graph
        dependency_graph = self._build_dependency_graph(tasks)

        # Start resource monitoring
        monitor_task = asyncio.create_task(self._monitor_resources())

        # Execute tasks with intelligent scheduling
        execution_task = asyncio.create_task(
            self._execute_tasks_intelligently(tasks, dependency_graph)
        )

        # Wait for completion
        await execution_task
        monitor_task.cancel()

        self.workflow_running = False

        # Generate execution report
        report = self._generate_execution_report()
        print("\n📊 Workflow Execution Complete!")
        print(f"📄 Report: {report}")

        return self.results

    def _build_dependency_graph(
            self, tasks: List[Task]) -> Dict[str, List[str]]:
        """Build dependency graph from tasks"""
        graph = {}
        for task in tasks:
            graph[task.task_id] = task.dependencies or []
        return graph

    async def _execute_tasks_intelligently(
        self, tasks: List[Task], dependency_graph: Dict[str, List[str]]
    ):
        """Execute tasks with intelligent resource allocation and scheduling"""
        # Create task lookup
        task_lookup = {task.task_id: task for task in tasks}

        # Initialize task queue with ready tasks
        ready_tasks = [task for task in tasks if not task.dependencies]
        for task in ready_tasks:
            await self.task_queue.put(task)

        # Start task execution workers
        workers = []
        for i in range(self.max_workers):
            worker = asyncio.create_task(self._task_worker(f"worker-{i}"))
            workers.append(worker)

        # Monitor for task completion and dependency resolution
        while len(self.completed_tasks) < len(tasks):
            await asyncio.sleep(0.1)

            # Check for newly ready tasks
            for task_id in list(self.completed_tasks):
                # Find tasks that depend on this completed task
                for dependent_task_id, dependencies in dependency_graph.items():
                    if (
                        dependent_task_id not in self.completed_tasks
                        and dependent_task_id not in self.running_tasks
                    ):
                        if task_id in dependencies:
                            # Check if all dependencies are completed
                            all_deps_completed = all(
                                dep in self.completed_tasks for dep in dependencies)
                            if all_deps_completed:
                                dependent_task = task_lookup[dependent_task_id]
                                await self.task_queue.put(dependent_task)

        # Cancel workers
        for worker in workers:
            worker.cancel()

        await asyncio.gather(*workers, return_exceptions=True)

    async def _task_worker(self, worker_id: str):
        """Worker coroutine for executing tasks"""
        while self.workflow_running:
            try:
                # Get next task
                task = await asyncio.wait_for(self.task_queue.get(), timeout=1.0)

                # Check if task is already completed
                if task.task_id in self.completed_tasks:
                    continue

                # Mark task as running
                self.running_tasks[task.task_id] = task

                # Execute task with appropriate resource allocation
                result = await self._execute_task_with_resources(task, worker_id)

                # Store result
                self.results[task.task_id] = result

                # Mark as completed
                self.completed_tasks.add(task.task_id)
                if task.task_id in self.running_tasks:
                    del self.running_tasks[task.task_id]

                # Update stats
                self.workflow_stats["completed_tasks"] += 1
                if not result.success:
                    self.workflow_stats["failed_tasks"] += 1

                print(
                    f"✅ {worker_id}: Completed task {
                        task.task_id} ({
                        task.task_type.value})")

            except asyncio.TimeoutError:
                continue
            except Exception as e:
                print(f"❌ {worker_id}: Error in task worker: {e}")

    async def _execute_task_with_resources(
        self, task: Task, worker_id: str
    ) -> ExecutionResult:
        """Execute a task with appropriate resource allocation"""
        start_time = time.time()

        try:
            # Allocate resources
            await self._allocate_resources(task)

            # Execute task based on type
            if task.task_type == TaskType.ML_INFERENCE:
                result = await self._execute_ml_inference(task)
            elif task.task_type == TaskType.HPC_COMPUTATION:
                result = await self._execute_hpc_computation(task)
            elif task.task_type == TaskType.DATA_PROCESSING:
                result = await self._execute_data_processing(task)
            elif task.task_type == TaskType.MODEL_TRAINING:
                result = await self._execute_model_training(task)
            elif task.task_type == TaskType.OPTIMIZATION:
                result = await self._execute_optimization(task)
            else:
                result = await self._execute_generic_task(task)

            execution_time = time.time() - start_time

            # Get resource usage
            resource_usage = await self._get_resource_usage(task)

            return ExecutionResult(
                task_id=task.task_id,
                success=True,
                result=result,
                execution_time=execution_time,
                resource_usage=resource_usage,
            )

        except Exception as e:
            execution_time = time.time() - start_time
            return ExecutionResult(
                task_id=task.task_id,
                success=False,
                result=None,
                execution_time=execution_time,
                resource_usage={},
                error=str(e),
            )
        finally:
            # Release resources
            await self._release_resources(task)

    async def _allocate_resources(self, task: Task):
        """Allocate resources for a task"""
        # This is a simplified version - in practice, you'd implement
        # sophisticated resource allocation logic
        requirements = task.resource_requirements

        # Check if resources are available
        available_resources = await self.resource_monitor.get_available_resources()

        if (
            available_resources["cpu_cores"] < requirements.cpu_cores
            or available_resources["memory_gb"] < requirements.memory_gb
        ):
            raise Exception(f"Insufficient resources for task {task.task_id}")

        # Reserve resources
        await self.resource_monitor.reserve_resources(requirements)

    async def _release_resources(self, task: Task):
        """Release resources after task completion"""
        await self.resource_monitor.release_resources(task.resource_requirements)

    async def _execute_ml_inference(self, task: Task) -> Any:
        """Execute ML inference task"""
        # Run in thread pool for CPU-bound ML tasks
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            self.cpu_pool, task.function, *task.args, **task.kwargs
        )
        return result

    async def _execute_hpc_computation(self, task: Task) -> Any:
        """Execute HPC computation task"""
        # Run in process pool for CPU-intensive HPC tasks
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            self.hpc_pool, task.function, *task.args, **task.kwargs
        )
        return result

    async def _execute_data_processing(self, task: Task) -> Any:
        """Execute data processing task"""
        # Run in thread pool for I/O-bound data processing
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            self.cpu_pool, task.function, *task.args, **task.kwargs
        )
        return result

    async def _execute_model_training(self, task: Task) -> Any:
        """Execute model training task"""
        # Run in process pool for intensive training
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            self.hpc_pool, task.function, *task.args, **task.kwargs
        )
        return result

    async def _execute_optimization(self, task: Task) -> Any:
        """Execute optimization task"""
        # Run in process pool for optimization algorithms
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            self.hpc_pool, task.function, *task.args, **task.kwargs
        )
        return result

    async def _execute_generic_task(self, task: Task) -> Any:
        """Execute generic task"""
        # Run in thread pool by default
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            self.cpu_pool, task.function, *task.args, **task.kwargs
        )
        return result

    async def _get_resource_usage(self, task: Task) -> Dict[str, float]:
        """Get resource usage for a task"""
        # Simplified resource usage tracking
        return {
            "cpu_cores": task.resource_requirements.cpu_cores,
            "memory_gb": task.resource_requirements.memory_gb,
            "gpu_count": task.resource_requirements.gpu_count,
        }

    async def _monitor_resources(self):
        """Monitor system resources during execution"""
        while self.workflow_running:
            try:
                # Get current resource usage
                cpu_percent = psutil.cpu_percent()
                memory_percent = psutil.virtual_memory().percent

                # Update stats
                self.workflow_stats["resource_utilization"] = {
                    "cpu_percent": cpu_percent,
                    "memory_percent": memory_percent,
                    "timestamp": time.time(),
                }

                await asyncio.sleep(1.0)
            except Exception as e:
                print(f"Error monitoring resources: {e}")
                await asyncio.sleep(1.0)

    def _generate_execution_report(self) -> str:
        """Generate execution report"""
        stats = self.workflow_stats

        report = f"""
Hybrid HPC/ML Workflow Execution Report
=====================================
Total Tasks: {stats['total_tasks']}
Completed: {stats['completed_tasks']}
Failed: {stats['failed_tasks']}
Success Rate: {(stats['completed_tasks'] / stats['total_tasks'] * 100):.1f}%

Resource Utilization:
- CPU: {stats['resource_utilization'].get('cpu_percent', 0):.1f}%
- Memory: {stats['resource_utilization'].get('memory_percent', 0):.1f}%
"""
        return report


class ResourceMonitor:
    """Monitor and manage system resources"""

    def __init__(self):
        self.reserved_resources = {
            "cpu_cores": 0,
            "memory_gb": 0,
            "gpu_count": 0}

    async def get_available_resources(self) -> Dict[str, float]:
        """Get currently available resources"""
        total_cpu = psutil.cpu_count()
        total_memory = psutil.virtual_memory().total / (1024**3)  # GB

        return {
            "cpu_cores": total_cpu - self.reserved_resources["cpu_cores"],
            "memory_gb": total_memory - self.reserved_resources["memory_gb"],
            "gpu_count": 0,  # Simplified - would detect actual GPU count
        }

    async def reserve_resources(self, requirements: ResourceAllocation):
        """Reserve resources for a task"""
        self.reserved_resources["cpu_cores"] += requirements.cpu_cores
        self.reserved_resources["memory_gb"] += requirements.memory_gb
        self.reserved_resources["gpu_count"] += requirements.gpu_count

    async def release_resources(self, requirements: ResourceAllocation):
        """Release resources after task completion"""
        self.reserved_resources["cpu_cores"] -= requirements.cpu_cores
        self.reserved_resources["memory_gb"] -= requirements.memory_gb
        self.reserved_resources["gpu_count"] -= requirements.gpu_count


# Example usage and test functions
def ml_inference_task(data: np.ndarray) -> np.ndarray:
    """Example ML inference task"""
    # Simulate ML inference
    time.sleep(0.1)
    return data * 2


def hpc_computation_task(matrix_size: int) -> np.ndarray:
    """Example HPC computation task"""
    # Simulate HPC computation
    time.sleep(0.2)
    return np.random.rand(matrix_size, matrix_size)


def data_processing_task(data: List[float]) -> List[float]:
    """Example data processing task"""
    # Simulate data processing
    time.sleep(0.05)
    return [x * 1.5 for x in data]


async def main():
    """Example usage of the hybrid executor"""
    executor = HybridHPCMLExecutor(max_workers=4)

    # Create example tasks
    tasks = [
        Task(
            task_id="ml_inf_1",
            task_type=TaskType.ML_INFERENCE,
            function=ml_inference_task,
            args=(np.random.rand(100),),
            kwargs={},
            resource_requirements=ResourceAllocation(
                cpu_cores=2, memory_gb=1.0),
            priority=1,
        ),
        Task(
            task_id="hpc_comp_1",
            task_type=TaskType.HPC_COMPUTATION,
            function=hpc_computation_task,
            args=(1000,),
            kwargs={},
            resource_requirements=ResourceAllocation(
                cpu_cores=4, memory_gb=2.0),
            priority=2,
        ),
        Task(
            task_id="data_proc_1",
            task_type=TaskType.DATA_PROCESSING,
            function=data_processing_task,
            args=([1, 2, 3, 4, 5],),
            kwargs={},
            resource_requirements=ResourceAllocation(
                cpu_cores=1, memory_gb=0.5),
            priority=3,
        ),
        Task(
            task_id="ml_inf_2",
            task_type=TaskType.ML_INFERENCE,
            function=ml_inference_task,
            args=(np.random.rand(200),),
            kwargs={},
            resource_requirements=ResourceAllocation(
                cpu_cores=2, memory_gb=1.5),
            priority=1,
            dependencies=["ml_inf_1"],  # Depends on first ML task
        ),
    ]

    # Execute workflow
    results = await executor.execute_workflow(tasks)

    # Print results
    print("\n📊 Execution Results:")
    for task_id, result in results.items():
        status = "✅" if result.success else "❌"
        print(f"{status} {task_id}: {result.execution_time:.2f}s")


if __name__ == "__main__":
    asyncio.run(main())
