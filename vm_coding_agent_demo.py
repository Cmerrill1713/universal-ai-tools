#!/usr/bin/env python3
"""
VM Coding Agent Demo Script

This script demonstrates how to use the VM Coding Agent to autonomously
spin up virtual machines and generate code for various tasks.

The agent can:
- Create virtual machines on demand
- Generate code in multiple programming languages
- Build and test applications
- Deploy services automatically
- Clean up resources when done
"""

import asyncio
import subprocess
import time
import uuid
from typing import List


class VMCodingAgentDemo:
    """Demo class for the VM Coding Agent capabilities"""

    def __init__(self):
        self.base_url = "http://localhost:8081"  # API Gateway
        self.agent_tasks = []
        self.completed_projects = []

    async def start_vm_coding_agent(self) -> bool:
        """Start the VM Coding Agent service"""
        print("🤖 Starting VM Coding Agent...")

        try:
            # Build the VM Coding Agent
            result = subprocess.run(
                ["cargo", "build", "-p", "vm-coding-agent"],
                capture_output=True,
                text=True,
                cwd="/Users/christianmerrill/Desktop/universal-ai-tools",
            )

            if result.returncode != 0:
                print(f"❌ Failed to build VM Coding Agent: {result.stderr}")
                return False

            print("✅ VM Coding Agent built successfully")

            # Start the agent (in a real scenario, this would be managed by the orchestrator)
            print("🚀 VM Coding Agent ready to accept tasks")
            return True

        except Exception as e:
            print(f"❌ Error starting VM Coding Agent: {e}")
            return False

    async def submit_coding_task(
        self, task_description: str, language: str, complexity: str = "medium"
    ) -> str:
        """Submit a coding task to the VM Coding Agent"""
        task_id = str(uuid.uuid4())

        task = {
            "id": task_id,
            "description": task_description,
            "language": language,
            "complexity": complexity,
            "requirements": self._extract_requirements(task_description),
            "test_cases": self._generate_test_cases(task_description),
            "deployment_target": "docker",
            "created_at": time.time(),
        }

        self.agent_tasks.append(task)

        print(f"📝 Task submitted: {task_description}")
        print(f"   Language: {language}")
        print(f"   Complexity: {complexity}")
        print(f"   Task ID: {task_id}")

        return task_id

    def _extract_requirements(self, description: str) -> List[str]:
        """Extract requirements from task description"""
        requirements = []
        description_lower = description.lower()

        if "api" in description_lower:
            requirements.append("Implement REST API endpoints")
        if "database" in description_lower:
            requirements.append("Add database integration")
        if "authentication" in description_lower:
            requirements.append("Implement authentication system")
        if "test" in description_lower:
            requirements.append("Add comprehensive tests")
        if "deploy" in description_lower:
            requirements.append("Prepare for deployment")
        if "web" in description_lower:
            requirements.append("Create web interface")
        if "data" in description_lower:
            requirements.append("Implement data processing")

        if not requirements:
            requirements = [
                "Implement core functionality",
                "Add error handling",
                "Include input validation",
            ]

        return requirements

    def _generate_test_cases(self, description: str) -> List[str]:
        """Generate test cases from task description"""
        test_cases = []
        description_lower = description.lower()

        if "api" in description_lower:
            test_cases.extend(
                [
                    "Test API endpoint responses",
                    "Test API error handling",
                    "Test request validation",
                ]
            )
        if "user" in description_lower:
            test_cases.extend(
                [
                    "Test user creation",
                    "Test user validation",
                    "Test user authentication",
                ]
            )
        if "data" in description_lower:
            test_cases.extend(
                [
                    "Test data processing",
                    "Test data validation",
                    "Test data persistence",
                ]
            )

        if not test_cases:
            test_cases = [
                "Test basic functionality",
                "Test error conditions",
                "Test edge cases",
            ]

        return test_cases

    async def demonstrate_rust_web_service(self):
        """Demonstrate creating a Rust web service"""
        print("\n🦀 Demonstrating Rust Web Service Creation")
        print("=" * 50)

        task_description = """
        Create a REST API service in Rust with the following features:
        - User management (CRUD operations)
        - JWT authentication
        - Input validation
        - Error handling
        - Database integration
        - Comprehensive tests
        """

        task_id = await self.submit_coding_task(
            task_description.strip(), "rust", "medium"
        )

        # Simulate the agent working on the task
        await self._simulate_task_execution(task_id, "Rust Web Service")

    async def demonstrate_python_data_service(self):
        """Demonstrate creating a Python data processing service"""
        print("\n🐍 Demonstrating Python Data Service Creation")
        print("=" * 50)

        task_description = """
        Create a Python service for processing CSV files and generating reports:
        - CSV file upload and processing
        - Data validation and cleaning
        - Statistical analysis
        - PDF report generation
        - Web interface for file upload
        - Error handling for invalid files
        """

        task_id = await self.submit_coding_task(
            task_description.strip(), "python", "medium"
        )

        await self._simulate_task_execution(task_id, "Python Data Service")

    async def demonstrate_go_microservice(self):
        """Demonstrate creating a Go microservice"""
        print("\n🐹 Demonstrating Go Microservice Creation")
        print("=" * 50)

        task_description = """
        Create a Go microservice for handling authentication:
        - User registration and login
        - JWT token generation and validation
        - Password hashing with bcrypt
        - Middleware for authentication
        - Rate limiting
        - Health checks
        """

        task_id = await self.submit_coding_task(
            task_description.strip(), "go", "medium"
        )

        await self._simulate_task_execution(task_id, "Go Microservice")

    async def demonstrate_typescript_api(self):
        """Demonstrate creating a TypeScript API"""
        print("\n📘 Demonstrating TypeScript API Creation")
        print("=" * 50)

        task_description = """
        Create a TypeScript/Node.js API for a task management system:
        - Task CRUD operations
        - User authentication
        - Real-time updates with WebSockets
        - File upload for task attachments
        - Email notifications
        - Comprehensive API documentation
        """

        task_id = await self.submit_coding_task(
            task_description.strip(), "typescript", "complex"
        )

        await self._simulate_task_execution(task_id, "TypeScript API")

    async def _simulate_task_execution(self, task_id: str, service_name: str):
        """Simulate the VM Coding Agent executing a task"""
        print(f"\n⚙️  VM Coding Agent executing: {service_name}")

        steps = [
            "🔍 Analyzing task requirements...",
            "🖥️  Spinning up virtual machine...",
            "📦 Installing development tools...",
            "📝 Generating code structure...",
            "🔧 Implementing core functionality...",
            "🧪 Writing tests...",
            "🏗️  Building application...",
            "✅ Running tests...",
            "🐳 Creating Docker container...",
            "🚀 Deploying service...",
            "🔍 Health checking deployment...",
        ]

        for i, step in enumerate(steps):
            print(f"   {step}")
            await asyncio.sleep(1)  # Simulate work

        # Simulate successful completion
        project_info = {
            "task_id": task_id,
            "service_name": service_name,
            "vm_id": str(uuid.uuid4()),
            "project_id": str(uuid.uuid4()),
            "build_status": "success",
            "test_status": "passed",
            "deployment_url": f"http://localhost:8081/{service_name.lower().replace(' ', '-')}",
            "completion_time": time.time(),
        }

        self.completed_projects.append(project_info)

        print(f"✅ {service_name} completed successfully!")
        print(f"   📊 Build Status: {project_info['build_status']}")
        print(f"   🧪 Test Status: {project_info['test_status']}")
        print(f"   🌐 Deployment URL: {project_info['deployment_url']}")

    async def show_agent_capabilities(self):
        """Show the capabilities of the VM Coding Agent"""
        print("\n🎯 VM Coding Agent Capabilities")
        print("=" * 50)

        capabilities = [
            "🖥️  Virtual Machine Management",
            "   • Spin up VMs on demand",
            "   • Configure VM specifications",
            "   • Install development tools",
            "   • Manage VM lifecycle",
            "",
            "💻 Multi-Language Code Generation",
            "   • Rust (web services, CLI tools)",
            "   • Go (microservices, APIs)",
            "   • Python (data processing, ML)",
            "   • TypeScript (web APIs, frontend)",
            "   • JavaScript (Node.js applications)",
            "",
            "🏗️  Automated Development Workflow",
            "   • Project structure generation",
            "   • Dependency management",
            "   • Build system setup",
            "   • Test framework integration",
            "",
            "🚀 Deployment & Operations",
            "   • Docker containerization",
            "   • Service deployment",
            "   • Health monitoring",
            "   • Resource cleanup",
            "",
            "🤖 Intelligent Task Processing",
            "   • Natural language task parsing",
            "   • Requirement extraction",
            "   • Test case generation",
            "   • Complexity assessment",
        ]

        for capability in capabilities:
            print(capability)

    async def show_resource_management(self):
        """Show resource management capabilities"""
        print("\n📊 Resource Management")
        print("=" * 50)

        # Simulate resource usage
        resources = {
            "Total CPU Cores": "16",
            "Allocated CPU Cores": "8",
            "Available CPU Cores": "8",
            "Total Memory": "64GB",
            "Allocated Memory": "32GB",
            "Available Memory": "32GB",
            "Total Storage": "500GB",
            "Allocated Storage": "120GB",
            "Available Storage": "380GB",
            "Active VMs": "3",
            "Running Projects": "4",
            "Completed Tasks": str(len(self.completed_projects)),
        }

        for resource, value in resources.items():
            print(f"   {resource}: {value}")

    async def show_completed_projects(self):
        """Show completed projects"""
        print("\n📁 Completed Projects")
        print("=" * 50)

        if not self.completed_projects:
            print("   No projects completed yet.")
            return

        for project in self.completed_projects:
            print(f"   🎯 {project['service_name']}")
            print(f"      Task ID: {project['task_id']}")
            print(f"      VM ID: {project['vm_id']}")
            print(f"      Project ID: {project['project_id']}")
            print(
                f"      Status: ✅ {project['build_status']} / {project['test_status']}"
            )
            print(f"      URL: {project['deployment_url']}")
            print()

    async def run_demo(self):
        """Run the complete VM Coding Agent demo"""
        print("🚀 VM Coding Agent Demo")
        print("=" * 50)
        print("This demo shows how agents can autonomously:")
        print("• Spin up virtual machines")
        print("• Generate code in multiple languages")
        print("• Build and test applications")
        print("• Deploy services automatically")
        print("• Manage resources efficiently")

        # Start the agent
        if not await self.start_vm_coding_agent():
            print("❌ Failed to start VM Coding Agent")
            return

        # Show capabilities
        await self.show_agent_capabilities()

        # Demonstrate different services
        await self.demonstrate_rust_web_service()
        await self.demonstrate_python_data_service()
        await self.demonstrate_go_microservice()
        await self.demonstrate_typescript_api()

        # Show results
        await self.show_resource_management()
        await self.show_completed_projects()

        print("\n🎉 Demo Complete!")
        print("The VM Coding Agent has successfully:")
        print("✅ Created 4 virtual machines")
        print("✅ Generated code in 4 different languages")
        print("✅ Built and tested all applications")
        print("✅ Deployed all services")
        print("✅ Managed resources efficiently")

        print("\n💡 Next Steps:")
        print("• Integrate with your existing agent orchestrator")
        print("• Add LLM integration for smarter code generation")
        print("• Implement real VM provisioning (AWS, GCP, Azure)")
        print("• Add monitoring and alerting")
        print("• Scale to handle multiple concurrent tasks")


async def main():
    """Main demo function"""
    demo = VMCodingAgentDemo()
    await demo.run_demo()


if __name__ == "__main__":
    asyncio.run(main())
