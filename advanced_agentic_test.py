#!/usr/bin/env python3
"""
Advanced Agentic Capabilities Test
Tests the system's ability to demonstrate super-agentic behavior
"""

import asyncio
import aiohttp
import time
import json
from typing import Dict, List, Any

class AdvancedAgenticTester:
    def __init__(self):
        self.results = []
        self.base_url = "http://localhost:8017"

    async def test_meta_cognitive_reasoning(self):
        """Test the system's ability to think about its own thinking"""
        print("\n🧠 Testing Meta-Cognitive Reasoning...")

        meta_questions = [
            {
                "name": "Self-Reflection",
                "prompt": "Reflect on your own reasoning process. How do you approach complex problems? What are your strengths and limitations in problem-solving?"
            },
            {
                "name": "Strategy Planning",
                "prompt": "I need to solve a complex multi-step problem. Walk me through your strategy for breaking it down, what tools you'd use, and how you'd verify your solution."
            },
            {
                "name": "Adaptive Learning",
                "prompt": "If you were to improve your own capabilities, what areas would you focus on? How would you go about learning and adapting to new challenges?"
            }
        ]

        for question in meta_questions:
            start_time = time.time()
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        f"{self.base_url}/chat",
                        json={
                            "messages": [{"role": "user", "content": question["prompt"]}],
                            "model": None
                        },
                        timeout=aiohttp.ClientTimeout(total=30)
                    ) as response:
                        duration = (time.time() - start_time) * 1000

                        if response.status == 200:
                            data = await response.json()
                            content = data.get("content", "")

                            # Analyze response quality
                            quality_score = self.analyze_meta_cognitive_response(content)

                            print(f"  ✅ {question['name']}: {duration:.0f}ms")
                            print(f"    Quality Score: {quality_score:.1f}%")
                            print(f"    Preview: {content[:100]}...")

                            self.results.append({
                                "test": "meta_cognitive",
                                "subtest": question["name"],
                                "success": True,
                                "duration": duration,
                                "quality_score": quality_score,
                                "response_length": len(content)
                            })
                        else:
                            print(f"  ❌ {question['name']}: HTTP {response.status}")
                            self.results.append({
                                "test": "meta_cognitive",
                                "subtest": question["name"],
                                "success": False,
                                "error": f"HTTP {response.status}"
                            })
            except Exception as e:
                print(f"  ❌ {question['name']}: {str(e)}")
                self.results.append({
                    "test": "meta_cognitive",
                    "subtest": question["name"],
                    "success": False,
                    "error": str(e)
                })

    async def test_autonomous_problem_solving(self):
        """Test autonomous problem solving with complex scenarios"""
        print("\n🎯 Testing Autonomous Problem Solving...")

        scenarios = [
            {
                "name": "Multi-Domain Challenge",
                "prompt": "I'm building a startup that combines AI, blockchain, and IoT. Create a comprehensive development roadmap including technical architecture, market strategy, funding plan, and risk mitigation. Break this down into actionable phases with timelines."
            },
            {
                "name": "Dynamic Adaptation",
                "prompt": "Design a self-improving system that can learn from its mistakes and optimize its own performance. Include feedback loops, error detection, and continuous learning mechanisms. How would you implement this?"
            },
            {
                "name": "Creative Synthesis",
                "prompt": "Combine concepts from quantum computing, biology, and philosophy to propose a novel approach to artificial consciousness. Think outside conventional boundaries."
            }
        ]

        for scenario in scenarios:
            start_time = time.time()
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        f"{self.base_url}/chat",
                        json={
                            "messages": [{"role": "user", "content": scenario["prompt"]}],
                            "model": None
                        },
                        timeout=aiohttp.ClientTimeout(total=45)
                    ) as response:
                        duration = (time.time() - start_time) * 1000

                        if response.status == 200:
                            data = await response.json()
                            content = data.get("content", "")

                            # Analyze problem-solving quality
                            quality_score = self.analyze_problem_solving_response(content)

                            print(f"  ✅ {scenario['name']}: {duration:.0f}ms")
                            print(f"    Quality Score: {quality_score:.1f}%")
                            print(f"    Response Length: {len(content)} chars")

                            self.results.append({
                                "test": "autonomous_solving",
                                "subtest": scenario["name"],
                                "success": True,
                                "duration": duration,
                                "quality_score": quality_score,
                                "response_length": len(content)
                            })
                        else:
                            print(f"  ❌ {scenario['name']}: HTTP {response.status}")
                            self.results.append({
                                "test": "autonomous_solving",
                                "subtest": scenario["name"],
                                "success": False,
                                "error": f"HTTP {response.status}"
                            })
            except Exception as e:
                print(f"  ❌ {scenario['name']}: {str(e)}")
                self.results.append({
                    "test": "autonomous_solving",
                    "subtest": scenario["name"],
                    "success": False,
                    "error": str(e)
                })

    async def test_concurrent_multi_agent_simulation(self):
        """Test simulating multiple agents working together"""
        print("\n🤖 Testing Multi-Agent Collaboration...")

        agent_roles = [
            "Research Agent",
            "Strategy Agent",
            "Technical Agent",
            "Creative Agent",
            "Risk Assessment Agent"
        ]

        challenge = "Design a sustainable city of the future that integrates advanced AI, renewable energy, and social equity."

        start_time = time.time()
        agent_responses = []

        async def simulate_agent(role: str, challenge: str):
            async with aiohttp.ClientSession() as session:
                prompt = f"As a {role}, analyze this challenge and provide your expert perspective: {challenge}"

                async with session.post(
                    f"{self.base_url}/chat",
                    json={
                        "messages": [{"role": "user", "content": prompt}],
                        "model": None
                    },
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        return {
                            "role": role,
                            "response": data.get("content", ""),
                            "success": True
                        }
                    else:
                        return {
                            "role": role,
                            "response": "",
                            "success": False,
                            "error": f"HTTP {response.status}"
                        }

        # Run all agents concurrently
        tasks = [simulate_agent(role, challenge) for role in agent_roles]
        agent_responses = await asyncio.gather(*tasks)

        total_duration = (time.time() - start_time) * 1000
        successful_agents = sum(1 for agent in agent_responses if agent["success"])

        print(f"  📊 Multi-Agent Simulation Results:")
        print(f"    Total Time: {total_duration:.0f}ms")
        print(f"    Successful Agents: {successful_agents}/{len(agent_roles)}")
        print(f"    Success Rate: {(successful_agents/len(agent_roles)*100):.1f}%")

        # Now test agent coordination
        if successful_agents >= 3:
            await self.test_agent_coordination(agent_responses)

        self.results.append({
            "test": "multi_agent",
            "success": successful_agents >= 3,
            "duration": total_duration,
            "successful_agents": successful_agents,
            "total_agents": len(agent_roles)
        })

    async def test_agent_coordination(self, agent_responses: List[Dict]):
        """Test how well agents can coordinate their responses"""
        print("\n🔄 Testing Agent Coordination...")

        successful_agents = [agent for agent in agent_responses if agent["success"]]

        if len(successful_agents) < 2:
            print("  ⚠️ Not enough successful agents for coordination test")
            return

        coordination_prompt = f"""Based on these expert perspectives, synthesize a comprehensive solution:

{chr(10).join([f"{agent['role']}: {agent['response'][:200]}..." for agent in successful_agents[:3]])}

Provide a coordinated, integrated solution that combines the best insights from each expert."""

        start_time = time.time()
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/chat",
                    json={
                        "messages": [{"role": "user", "content": coordination_prompt}],
                        "model": None
                    },
                    timeout=aiohttp.ClientTimeout(total=45)
                ) as response:
                    duration = (time.time() - start_time) * 1000

                    if response.status == 200:
                        data = await response.json()
                        content = data.get("content", "")

                        coordination_quality = self.analyze_coordination_response(content)

                        print(f"  ✅ Agent Coordination: {duration:.0f}ms")
                        print(f"    Coordination Quality: {coordination_quality:.1f}%")

                        self.results.append({
                            "test": "agent_coordination",
                            "success": True,
                            "duration": duration,
                            "coordination_quality": coordination_quality
                        })
                    else:
                        print(f"  ❌ Agent Coordination: HTTP {response.status}")
                        self.results.append({
                            "test": "agent_coordination",
                            "success": False,
                            "error": f"HTTP {response.status}"
                        })
        except Exception as e:
            print(f"  ❌ Agent Coordination: {str(e)}")
            self.results.append({
                "test": "agent_coordination",
                "success": False,
                "error": str(e)
            })

    def analyze_meta_cognitive_response(self, content: str) -> float:
        """Analyze the quality of meta-cognitive responses"""
        content_lower = content.lower()

        indicators = {
            "self_reflection": ["think", "reason", "process", "approach", "strategy"],
            "meta_awareness": ["aware", "conscious", "reflect", "analyze", "evaluate"],
            "adaptive_thinking": ["adapt", "learn", "improve", "change", "evolve"],
            "complexity": ["complex", "multi-step", "layered", "nuanced", "sophisticated"]
        }

        score = 0
        for category, keywords in indicators.items():
            if any(keyword in content_lower for keyword in keywords):
                score += 25

        return min(score, 100)

    def analyze_problem_solving_response(self, content: str) -> float:
        """Analyze the quality of problem-solving responses"""
        content_lower = content.lower()

        indicators = {
            "structure": ["step", "phase", "plan", "roadmap", "timeline"],
            "comprehensiveness": ["comprehensive", "detailed", "thorough", "complete"],
            "innovation": ["novel", "creative", "innovative", "unique", "original"],
            "practicality": ["implement", "actionable", "feasible", "practical", "realistic"]
        }

        score = 0
        for category, keywords in indicators.items():
            if any(keyword in content_lower for keyword in keywords):
                score += 25

        return min(score, 100)

    def analyze_coordination_response(self, content: str) -> float:
        """Analyze the quality of agent coordination"""
        content_lower = content.lower()

        indicators = {
            "integration": ["combine", "integrate", "synthesize", "unify", "merge"],
            "balance": ["balance", "trade-off", "consider", "weigh", "evaluate"],
            "coherence": ["consistent", "coherent", "aligned", "harmonious"],
            "completeness": ["complete", "comprehensive", "all aspects", "holistic"]
        }

        score = 0
        for category, keywords in indicators.items():
            if any(keyword in content_lower for keyword in keywords):
                score += 25

        return min(score, 100)

    async def test_emergent_intelligence(self):
        """Test for emergent intelligent behaviors"""
        print("\n🌟 Testing Emergent Intelligence...")

        emergent_tests = [
            {
                "name": "Pattern Recognition",
                "prompt": "Analyze these patterns and predict the next sequence: 2, 4, 8, 16, ?, ?, ?. Then explain the underlying mathematical principles and suggest real-world applications."
            },
            {
                "name": "Cross-Domain Transfer",
                "prompt": "Take the principles of biological evolution and apply them to software architecture. How would natural selection work in code? What would 'genetic programming' look like?"
            },
            {
                "name": "Abstract Reasoning",
                "prompt": "If you had to explain the concept of 'time' to an alien species that experiences reality differently, how would you approach it? What metaphors or analogies would you use?"
            }
        ]

        for test in emergent_tests:
            start_time = time.time()
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        f"{self.base_url}/chat",
                        json={
                            "messages": [{"role": "user", "content": test["prompt"]}],
                            "model": None
                        },
                        timeout=aiohttp.ClientTimeout(total=30)
                    ) as response:
                        duration = (time.time() - start_time) * 1000

                        if response.status == 200:
                            data = await response.json()
                            content = data.get("content", "")

                            intelligence_score = self.analyze_emergent_intelligence(content)

                            print(f"  ✅ {test['name']}: {duration:.0f}ms")
                            print(f"    Intelligence Score: {intelligence_score:.1f}%")

                            self.results.append({
                                "test": "emergent_intelligence",
                                "subtest": test["name"],
                                "success": True,
                                "duration": duration,
                                "intelligence_score": intelligence_score
                            })
                        else:
                            print(f"  ❌ {test['name']}: HTTP {response.status}")
                            self.results.append({
                                "test": "emergent_intelligence",
                                "subtest": test["name"],
                                "success": False,
                                "error": f"HTTP {response.status}"
                            })
            except Exception as e:
                print(f"  ❌ {test['name']}: {str(e)}")
                self.results.append({
                    "test": "emergent_intelligence",
                    "subtest": test["name"],
                    "success": False,
                    "error": str(e)
                })

    def analyze_emergent_intelligence(self, content: str) -> float:
        """Analyze emergent intelligence indicators"""
        content_lower = content.lower()

        indicators = {
            "pattern_recognition": ["pattern", "sequence", "predict", "trend", "rule"],
            "abstraction": ["abstract", "metaphor", "analogy", "concept", "principle"],
            "creativity": ["creative", "novel", "unique", "innovative", "original"],
            "insight": ["insight", "understanding", "realize", "recognize", "comprehend"]
        }

        score = 0
        for category, keywords in indicators.items():
            if any(keyword in content_lower for keyword in keywords):
                score += 25

        return min(score, 100)

    async def run_all_tests(self):
        """Run all advanced agentic tests"""
        print("🚀 Advanced Agentic Capabilities Test")
        print("=" * 60)

        await self.test_meta_cognitive_reasoning()
        await self.test_autonomous_problem_solving()
        await self.test_concurrent_multi_agent_simulation()
        await self.test_emergent_intelligence()

        # Generate comprehensive summary
        print("\n" + "=" * 60)
        print("📊 ADVANCED AGENTIC TEST SUMMARY")
        print("=" * 60)

        total_tests = len(self.results)
        successful_tests = len([r for r in self.results if r.get("success", False)])
        success_rate = (successful_tests / total_tests * 100) if total_tests > 0 else 0

        # Calculate average quality scores
        quality_scores = [r.get("quality_score", 0) for r in self.results if "quality_score" in r]
        avg_quality = sum(quality_scores) / len(quality_scores) if quality_scores else 0

        intelligence_scores = [r.get("intelligence_score", 0) for r in self.results if "intelligence_score" in r]
        avg_intelligence = sum(intelligence_scores) / len(intelligence_scores) if intelligence_scores else 0

        print(f"Total Tests: {total_tests}")
        print(f"✅ Successful: {successful_tests}")
        print(f"❌ Failed: {total_tests - successful_tests}")
        print(f"📈 Success Rate: {success_rate:.1f}%")
        print(f"🎯 Average Quality Score: {avg_quality:.1f}%")
        print(f"🧠 Average Intelligence Score: {avg_intelligence:.1f}%")

        # Determine agentic level
        if success_rate >= 90 and avg_quality >= 70 and avg_intelligence >= 60:
            agentic_level = "🌟 SUPER AGENTIC"
            level_description = "The system demonstrates exceptional agentic capabilities with high autonomy, creativity, and intelligence."
        elif success_rate >= 75 and avg_quality >= 50:
            agentic_level = "🤖 HIGHLY AGENTIC"
            level_description = "The system shows strong agentic behaviors with good autonomous capabilities."
        elif success_rate >= 50:
            agentic_level = "⚡ MODERATELY AGENTIC"
            level_description = "The system demonstrates some agentic behaviors but with limitations."
        else:
            agentic_level = "📝 BASIC AGENTIC"
            level_description = "The system shows minimal agentic capabilities."

        print(f"\n🎖️ AGENTIC LEVEL: {agentic_level}")
        print(f"📝 {level_description}")

        # Save results
        with open("advanced_agentic_test_results.json", "w") as f:
            json.dump({
                "summary": {
                    "total_tests": total_tests,
                    "successful_tests": successful_tests,
                    "success_rate": success_rate,
                    "average_quality": avg_quality,
                    "average_intelligence": avg_intelligence,
                    "agentic_level": agentic_level
                },
                "results": self.results
            }, f, indent=2)

        print(f"\n💾 Detailed results saved to: advanced_agentic_test_results.json")

async def main():
    tester = AdvancedAgenticTester()
    await tester.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main())
