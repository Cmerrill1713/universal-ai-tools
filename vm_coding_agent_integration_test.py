#!/usr/bin/env python3
"""
VM Coding Agent Integration Test
Tests the vm-coding-agent's integration with the orchestration system
"""

import asyncio
import time
from datetime import datetime

import aiohttp


class VMCodingAgentIntegrationTester:
    def __init__(self):
        self.base_urls = {
            "api_gateway": "http://localhost:8080",
            "llm_router": "http://localhost:3033",
            "ml_inference": "http://localhost:8091",
            "memory_service": "http://localhost:8017",
            "vision_service": "http://localhost:8084",
            "parameter_analytics": "http://localhost:3032",
        }
        self.start_time = time.time()

    async def test_vm_coding_workflow(self, session: aiohttp.ClientSession) -> dict:
        """Test a complete VM coding workflow"""
        print("\n🤖 Testing VM Coding Agent Workflow...")

        # Step 1: Create a coding task through LLM Router
        print("  📝 Step 1: Creating coding task...")
        task_prompt = """
        Create a REST API service in Rust that:
        1. Has endpoints for user management (create, read, update, delete)
        2. Uses PostgreSQL for data persistence
        3. Implements JWT authentication
        4. Has proper error handling and validation
        5. Includes unit tests

        Please provide a complete implementation with all necessary files.
        """

        try:
            async with session.post(
                f"{self.base_urls['llm_router']}/chat",
                json={
                    "model": "llama3.2:3b",
                    "messages": [{"role": "user", "content": task_prompt}],
                    "max_tokens": 1000,
                    "temperature": 0.3,
                },
                timeout=60,
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    llm_response = data.get("response", "")
                    print(f"    ✅ LLM Response: {len(llm_response)} characters")

                    # Step 2: Store the task in memory
                    print("  💾 Step 2: Storing task in memory...")
                    memory_data = {
                        "content": f"Coding task: {task_prompt[:200]}...",
                        "tags": ["coding-task", "rust", "api", "user-management"],
                        "metadata": {
                            "source": "vm_coding_agent",
                            "task_type": "rust_api_service",
                            "timestamp": datetime.now().isoformat(),
                            "llm_response_length": len(llm_response),
                        },
                    }

                    headers = {"X-User-ID": "vm-coding-agent-test"}
                    async with session.post(
                        f"{self.base_urls['memory_service']}/memories",
                        json=memory_data,
                        headers=headers,
                        timeout=15,
                    ) as mem_response:
                        if mem_response.status == 200:
                            print("    ✅ Task stored in memory")
                        else:
                            print(
                                f"    ❌ Memory storage failed ({mem_response.status})"
                            )

                    # Step 3: Process with ML Inference for code analysis
                    print("  🔬 Step 3: Analyzing code requirements...")
                    analysis_prompt = f"""
                    Analyze this coding task and provide:
                    1. Required dependencies
                    2. Project structure
                    3. Key implementation details
                    4. Testing strategy

                    Task: {task_prompt[:300]}...
                    """

                    async with session.post(
                        f"{self.base_urls['ml_inference']}/infer",
                        json={
                            "model_id": "llama3.2:3b",
                            "input": analysis_prompt,
                            "parameters": {"max_tokens": 500, "temperature": 0.2},
                        },
                        timeout=30,
                    ) as ml_response:
                        if ml_response.status == 200:
                            ml_data = await ml_response.json()
                            analysis = ml_data.get("output", "")
                            print(f"    ✅ Code analysis: {len(analysis)} characters")
                        else:
                            print(f"    ❌ ML analysis failed ({ml_response.status})")

                    return {
                        "workflow_success": True,
                        "llm_response_length": len(llm_response),
                        "analysis_length": (
                            len(analysis) if "analysis" in locals() else 0
                        ),
                    }
                else:
                    print(f"    ❌ LLM task creation failed ({response.status})")
                    return {"workflow_success": False}
        except Exception as e:
            print(f"    ❌ Workflow error: {str(e)}")
            return {"workflow_success": False}

    async def test_multi_language_code_generation(
        self, session: aiohttp.ClientSession
    ) -> dict:
        """Test code generation in multiple languages"""
        print("\n🌐 Testing Multi-Language Code Generation...")

        languages = [
            {
                "name": "Rust",
                "task": "Create a simple web server with actix-web that serves a JSON API",
                "expected_keywords": ["actix-web", "serde", "tokio"],
            },
            {
                "name": "Python",
                "task": "Create a FastAPI application with SQLAlchemy for user management",
                "expected_keywords": ["fastapi", "sqlalchemy", "pydantic"],
            },
            {
                "name": "Go",
                "task": "Create a REST API using Gin framework with GORM for database operations",
                "expected_keywords": ["gin", "gorm", "golang"],
            },
        ]

        successful_generations = 0
        for lang in languages:
            try:
                print(f"  🔧 Generating {lang['name']} code...")
                async with session.post(
                    f"{self.base_urls['llm_router']}/chat",
                    json={
                        "model": "llama3.2:3b",
                        "messages": [{"role": "user", "content": lang["task"]}],
                        "max_tokens": 800,
                        "temperature": 0.2,
                    },
                    timeout=45,
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        code = data.get("response", "")

                        # Check if expected keywords are present
                        keywords_found = sum(
                            1
                            for keyword in lang["expected_keywords"]
                            if keyword.lower() in code.lower()
                        )

                        if keywords_found >= 2:  # At least 2 keywords should be present
                            print(
                                f"    ✅ {lang['name']}: Generated {len(code)} chars, {keywords_found}/{len(lang['expected_keywords'])} keywords"
                            )
                            successful_generations += 1
                        else:
                            print(
                                f"    ⚠️ {lang['name']}: Generated but missing expected keywords"
                            )
                    else:
                        print(f"    ❌ {lang['name']}: Failed ({response.status})")
            except Exception as e:
                print(f"    ❌ {lang['name']}: Error - {str(e)}")

        return {
            "multi_lang_success": successful_generations,
            "total_languages": len(languages),
        }

    async def test_orchestrated_development_workflow(
        self, session: aiohttp.ClientSession
    ) -> dict:
        """Test a complete orchestrated development workflow"""
        print("\n🎭 Testing Orchestrated Development Workflow...")

        # Step 1: Plan the project through LLM
        print("  📋 Step 1: Project Planning...")
        planning_prompt = """
        Plan a microservices architecture for an e-commerce platform with:
        1. User service (authentication, profiles)
        2. Product service (catalog, inventory)
        3. Order service (order management, payments)
        4. API Gateway (routing, load balancing)

        Provide technology stack recommendations and service communication patterns.
        """

        try:
            async with session.post(
                f"{self.base_urls['llm_router']}/chat",
                json={
                    "model": "llama3.2:3b",
                    "messages": [{"role": "user", "content": planning_prompt}],
                    "max_tokens": 600,
                    "temperature": 0.4,
                },
                timeout=45,
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    plan = data.get("response", "")
                    print(f"    ✅ Project plan: {len(plan)} characters")

                    # Step 2: Store the plan in memory
                    print("  💾 Step 2: Storing project plan...")
                    plan_memory = {
                        "content": f"E-commerce microservices architecture plan: {plan[:300]}...",
                        "tags": [
                            "architecture",
                            "microservices",
                            "e-commerce",
                            "planning",
                        ],
                        "metadata": {
                            "source": "orchestrated_workflow",
                            "project_type": "e-commerce",
                            "timestamp": datetime.now().isoformat(),
                        },
                    }

                    headers = {"X-User-ID": "orchestrated-workflow-test"}
                    async with session.post(
                        f"{self.base_urls['memory_service']}/memories",
                        json=plan_memory,
                        headers=headers,
                        timeout=15,
                    ) as mem_response:
                        if mem_response.status == 200:
                            print("    ✅ Plan stored in memory")
                        else:
                            print(f"    ❌ Plan storage failed ({mem_response.status})")

                    # Step 3: Generate implementation details
                    print("  🔧 Step 3: Generating implementation details...")
                    impl_prompt = f"""
                    Based on this architecture plan, provide detailed implementation for the User Service:
                    - Technology stack (Rust/Go/Python)
                    - Database schema
                    - API endpoints
                    - Authentication flow
                    - Docker configuration

                    Plan: {plan[:400]}...
                    """

                    async with session.post(
                        f"{self.base_urls['ml_inference']}/infer",
                        json={
                            "model_id": "llama3.2:3b",
                            "input": impl_prompt,
                            "parameters": {"max_tokens": 800, "temperature": 0.3},
                        },
                        timeout=45,
                    ) as impl_response:
                        if impl_response.status == 200:
                            impl_data = await impl_response.json()
                            implementation = impl_data.get("output", "")
                            print(
                                f"    ✅ Implementation details: {len(implementation)} characters"
                            )
                        else:
                            print(
                                f"    ❌ Implementation generation failed ({impl_response.status})"
                            )

                    return {
                        "orchestration_success": True,
                        "plan_length": len(plan),
                        "implementation_length": (
                            len(implementation) if "implementation" in locals() else 0
                        ),
                    }
                else:
                    print(f"    ❌ Planning failed ({response.status})")
                    return {"orchestration_success": False}
        except Exception as e:
            print(f"    ❌ Orchestration error: {str(e)}")
            return {"orchestration_success": False}

    async def test_performance_under_load(self, session: aiohttp.ClientSession) -> dict:
        """Test system performance under concurrent load"""
        print("\n⚡ Testing Performance Under Load...")

        # Create multiple concurrent tasks
        tasks = []
        for i in range(5):
            task = self.simulate_coding_task(session, i)
            tasks.append(task)

        start_time = time.time()
        results = await asyncio.gather(*tasks, return_exceptions=True)
        total_time = time.time() - start_time

        successful_tasks = sum(
            1
            for result in results
            if isinstance(result, dict) and result.get("success", False)
        )

        print(f"  📊 Concurrent Tasks: {successful_tasks}/5 successful")
        print(f"  ⏱️ Total Time: {total_time:.2f} seconds")
        print(f"  🚀 Average Time per Task: {total_time/5:.2f} seconds")

        return {
            "load_test_success": successful_tasks,
            "total_tasks": 5,
            "total_time": total_time,
        }

    async def simulate_coding_task(
        self, session: aiohttp.ClientSession, task_id: int
    ) -> dict:
        """Simulate a single coding task"""
        try:
            async with session.post(
                f"{self.base_urls['llm_router']}/chat",
                json={
                    "model": "llama3.2:3b",
                    "messages": [
                        {
                            "role": "user",
                            "content": f"Generate a simple {['Rust', 'Python', 'Go', 'JavaScript', 'TypeScript'][task_id % 5]} function for task {task_id}",
                        }
                    ],
                    "max_tokens": 200,
                    "temperature": 0.5,
                },
                timeout=30,
            ) as response:
                if response.status == 200:
                    return {"success": True, "task_id": task_id}
                else:
                    return {"success": False, "task_id": task_id}
        except Exception as e:
            return {"success": False, "task_id": task_id, "error": str(e)}

    async def run_integration_test(self):
        """Run comprehensive VM Coding Agent integration test"""
        print("🤖 Starting VM Coding Agent Integration Test")
        print("=" * 60)

        async with aiohttp.ClientSession() as session:
            # Test 1: VM Coding Workflow
            workflow_results = await self.test_vm_coding_workflow(session)

            # Test 2: Multi-Language Code Generation
            multi_lang_results = await self.test_multi_language_code_generation(session)

            # Test 3: Orchestrated Development Workflow
            orchestration_results = await self.test_orchestrated_development_workflow(
                session
            )

            # Test 4: Performance Under Load
            performance_results = await self.test_performance_under_load(session)

            # Calculate overall results
            total_time = time.time() - self.start_time

            print("\n" + "=" * 60)
            print("📊 VM CODING AGENT INTEGRATION RESULTS")
            print("=" * 60)
            print(f"⏱️  Total Test Time: {total_time:.2f} seconds")
            print(
                f"🤖 VM Coding Workflow: {'✅ Success' if workflow_results['workflow_success'] else '❌ Failed'}"
            )
            print(
                f"🌐 Multi-Language Generation: {multi_lang_results['multi_lang_success']}/{multi_lang_results['total_languages']} languages"
            )
            print(
                f"🎭 Orchestrated Workflow: {'✅ Success' if orchestration_results['orchestration_success'] else '❌ Failed'}"
            )
            print(
                f"⚡ Performance Under Load: {performance_results['load_test_success']}/{performance_results['total_tasks']} tasks"
            )

            # Overall assessment
            success_count = sum(
                [
                    workflow_results["workflow_success"],
                    multi_lang_results["multi_lang_success"] >= 2,
                    orchestration_results["orchestration_success"],
                    performance_results["load_test_success"] >= 3,
                ]
            )

            if success_count >= 4:
                status = "🟢 EXCELLENT"
            elif success_count >= 3:
                status = "🟡 GOOD"
            elif success_count >= 2:
                status = "🟠 FAIR"
            else:
                status = "🔴 POOR"

            print(f"📈 Overall Integration Score: {success_count}/4")
            print(f"🎯 VM Coding Agent Status: {status}")
            print(
                f"🚀 System Ready for Production: {'✅ YES' if success_count >= 3 else '❌ NO'}"
            )


if __name__ == "__main__":
    tester = VMCodingAgentIntegrationTester()
    asyncio.run(tester.run_integration_test())
