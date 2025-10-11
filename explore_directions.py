#!/usr/bin/env python3
"""
Direction Exploration Script
Tests different capabilities to help identify the most promising path forward
"""

import asyncio
import aiohttp
import time
import json
from typing import Dict, List, Any

class DirectionExplorer:
    def __init__(self):
        self.results = {}
        self.assistant_base_url = "http://localhost:8017"
        self.llm_router_url = "http://localhost:3033"
        
    async def explore_all_directions(self):
        """Explore all possible directions"""
        print("🧭 EXPLORING SYSTEM DIRECTIONS")
        print("=" * 50)
        
        directions = [
            ("🧠 AI Reasoning", self.explore_ai_reasoning),
            ("⚡ Performance", self.explore_performance),
            ("🤖 Agentic Features", self.explore_agentic_features),
            ("📚 Memory & Knowledge", self.explore_memory_knowledge),
            ("🔧 Technical Integration", self.explore_technical_integration),
            ("🎯 Real-world Use Cases", self.explore_real_world_cases),
            ("🚀 Advanced Capabilities", self.explore_advanced_capabilities)
        ]
        
        for name, func in directions:
            print(f"\n{name}")
            print("-" * 30)
            try:
                result = await func()
                self.results[name] = result
                self.print_direction_summary(name, result)
            except Exception as e:
                print(f"❌ Error exploring {name}: {e}")
                self.results[name] = {"error": str(e)}
        
        # Generate final recommendations
        self.generate_recommendations()
    
    async def explore_ai_reasoning(self):
        """Test AI reasoning capabilities"""
        print("Testing complex reasoning scenarios...")
        
        reasoning_tests = [
            {
                "name": "Logical Reasoning",
                "prompt": "If all cats are animals, and Fluffy is a cat, what can we conclude about Fluffy?"
            },
            {
                "name": "Problem Solving",
                "prompt": "A developer needs to choose between two algorithms: one with O(n²) time complexity but simple to implement, and another with O(n log n) complexity but harder to implement. What factors should they consider?"
            },
            {
                "name": "Creative Thinking",
                "prompt": "Design a mobile app that helps people reduce their carbon footprint. What unique features would make it stand out?"
            }
        ]
        
        results = []
        for test in reasoning_tests:
            result = await self.test_reasoning_scenario(test)
            results.append(result)
        
        return {
            "tests": results,
            "avg_quality": sum(r["quality_score"] for r in results) / len(results),
            "avg_response_time": sum(r["response_time"] for r in results) / len(results)
        }
    
    async def test_reasoning_scenario(self, test: Dict) -> Dict:
        """Test a specific reasoning scenario"""
        start_time = time.time()
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.assistant_base_url}/chat",
                    json={"messages": [{"role": "user", "content": test["prompt"]}]},
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    response_time = (time.time() - start_time) * 1000
                    
                    if response.status == 200:
                        data = await response.json()
                        content = data.get("content", "")
                        
                        quality_score = self.analyze_reasoning_quality(content, test["name"])
                        
                        print(f"  ✅ {test['name']}: {response_time:.0f}ms (Quality: {quality_score:.1f}%)")
                        
                        return {
                            "name": test["name"],
                            "success": True,
                            "response_time": response_time,
                            "quality_score": quality_score,
                            "content_length": len(content),
                            "model": data.get("model")
                        }
                    else:
                        print(f"  ❌ {test['name']}: HTTP {response.status}")
                        return {
                            "name": test["name"],
                            "success": False,
                            "response_time": response_time,
                            "quality_score": 0
                        }
        except Exception as e:
            response_time = (time.time() - start_time) * 1000
            print(f"  ❌ {test['name']}: {str(e)}")
            return {
                "name": test["name"],
                "success": False,
                "response_time": response_time,
                "quality_score": 0,
                "error": str(e)
            }
    
    def analyze_reasoning_quality(self, content: str, test_type: str) -> float:
        """Analyze reasoning quality"""
        content_lower = content.lower()
        
        # Quality indicators
        logical_indicators = ["therefore", "thus", "consequently", "hence", "because", "since", "if-then"]
        problem_solving_indicators = ["consider", "factor", "trade-off", "pros and cons", "solution", "approach"]
        creative_indicators = ["unique", "innovative", "creative", "novel", "different", "standout", "feature"]
        
        if test_type == "Logical Reasoning":
            indicators = logical_indicators
        elif test_type == "Problem Solving":
            indicators = problem_solving_indicators
        else:
            indicators = creative_indicators
        
        # Check for relevant keywords
        relevant_count = sum(1 for indicator in indicators if indicator in content_lower)
        
        # Check for structured response
        has_structure = any(marker in content_lower for marker in ["1.", "2.", "first", "second", "step"])
        
        # Check for explanation quality
        has_explanation = len(content) > 100 and any(word in content_lower for word in ["explain", "because", "reason", "why"])
        
        score = (relevant_count / len(indicators) * 40) + (has_structure * 30) + (has_explanation * 30)
        return min(score, 100)
    
    async def explore_performance(self):
        """Test performance characteristics"""
        print("Testing performance under different loads...")
        
        # Test different request sizes
        performance_tests = [
            {"name": "Simple Request", "size": "small"},
            {"name": "Medium Request", "size": "medium"},
            {"name": "Complex Request", "size": "large"},
            {"name": "Concurrent Requests", "size": "concurrent"}
        ]
        
        results = []
        for test in performance_tests:
            result = await self.test_performance_scenario(test)
            results.append(result)
        
        return {"tests": results}
    
    async def test_performance_scenario(self, test: Dict) -> Dict:
        """Test a specific performance scenario"""
        start_time = time.time()
        
        if test["size"] == "concurrent":
            # Test 5 concurrent requests
            try:
                async with aiohttp.ClientSession() as session:
                    tasks = []
                    for i in range(5):
                        task = session.post(
                            f"{self.assistant_base_url}/chat",
                            json={"messages": [{"role": "user", "content": f"Concurrent test {i}"}]},
                            timeout=aiohttp.ClientTimeout(total=30)
                        )
                        tasks.append(task)
                    
                    responses = await asyncio.gather(*tasks, return_exceptions=True)
                    total_time = (time.time() - start_time) * 1000
                    
                    successful = sum(1 for r in responses if not isinstance(r, Exception) and r.status == 200)
                    
                    print(f"  ✅ {test['name']}: {total_time:.0f}ms ({successful}/5 successful)")
                    
                    return {
                        "name": test["name"],
                        "total_time": total_time,
                        "successful_requests": successful,
                        "throughput": successful / total_time * 1000 if total_time > 0 else 0
                    }
            except Exception as e:
                print(f"  ❌ {test['name']}: {str(e)}")
                return {"name": test["name"], "error": str(e)}
        else:
            # Test single request with different complexity
            prompt = self.get_performance_prompt(test["size"])
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        f"{self.assistant_base_url}/chat",
                        json={"messages": [{"role": "user", "content": prompt}]},
                        timeout=aiohttp.ClientTimeout(total=30)
                    ) as response:
                        response_time = (time.time() - start_time) * 1000
                        
                        if response.status == 200:
                            data = await response.json()
                            content_length = len(data.get("content", ""))
                            
                            print(f"  ✅ {test['name']}: {response_time:.0f}ms ({content_length} chars)")
                            
                            return {
                                "name": test["name"],
                                "response_time": response_time,
                                "content_length": content_length,
                                "success": True
                            }
                        else:
                            print(f"  ❌ {test['name']}: HTTP {response.status}")
                            return {"name": test["name"], "success": False}
            except Exception as e:
                print(f"  ❌ {test['name']}: {str(e)}")
                return {"name": test["name"], "error": str(e)}
    
    def get_performance_prompt(self, size: str) -> str:
        """Get appropriate prompt for performance testing"""
        if size == "small":
            return "What is 2+2?"
        elif size == "medium":
            return "Explain the benefits of using async/await in programming."
        else:  # large
            return "Write a comprehensive guide on building scalable microservices architecture, including best practices, common pitfalls, and implementation examples."
    
    async def explore_agentic_features(self):
        """Test agentic capabilities"""
        print("Testing advanced agentic features...")
        
        agentic_tests = [
            {
                "name": "Multi-step Planning",
                "endpoint": "/chat/agentic",
                "prompt": "Plan a complete software development project from idea to deployment."
            },
            {
                "name": "Adaptive Problem Solving",
                "endpoint": "/chat/agentic",
                "prompt": "I have a complex bug in my distributed system. Help me systematically debug it."
            },
            {
                "name": "Creative Synthesis",
                "endpoint": "/chat/agentic",
                "prompt": "Combine concepts from machine learning and mobile development to create an innovative app idea."
            }
        ]
        
        results = []
        for test in agentic_tests:
            result = await self.test_agentic_scenario(test)
            results.append(result)
        
        return {"tests": results}
    
    async def test_agentic_scenario(self, test: Dict) -> Dict:
        """Test a specific agentic scenario"""
        start_time = time.time()
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.assistant_base_url}{test['endpoint']}",
                    json={"messages": [{"role": "user", "content": test["prompt"]}]},
                    timeout=aiohttp.ClientTimeout(total=45)
                ) as response:
                    response_time = (time.time() - start_time) * 1000
                    
                    if response.status == 200:
                        data = await response.json()
                        content = data.get("content", "")
                        
                        agentic_score = self.analyze_agentic_quality(content)
                        
                        print(f"  ✅ {test['name']}: {response_time:.0f}ms (Agentic: {agentic_score:.1f}%)")
                        
                        return {
                            "name": test["name"],
                            "success": True,
                            "response_time": response_time,
                            "agentic_score": agentic_score,
                            "content_length": len(content)
                        }
                    else:
                        print(f"  ❌ {test['name']}: HTTP {response.status}")
                        return {"name": test["name"], "success": False}
        except Exception as e:
            print(f"  ❌ {test['name']}: {str(e)}")
            return {"name": test["name"], "error": str(e)}
    
    def analyze_agentic_quality(self, content: str) -> float:
        """Analyze agentic quality"""
        content_lower = content.lower()
        
        # Agentic indicators
        planning_indicators = ["plan", "step", "phase", "timeline", "strategy", "approach"]
        adaptive_indicators = ["adapt", "adjust", "modify", "change", "evolve", "learn"]
        creative_indicators = ["combine", "synthesize", "innovative", "creative", "unique", "novel"]
        
        all_indicators = planning_indicators + adaptive_indicators + creative_indicators
        
        # Count relevant indicators
        relevant_count = sum(1 for indicator in all_indicators if indicator in content_lower)
        
        # Check for structured thinking
        has_structure = any(marker in content_lower for marker in ["1.", "2.", "first", "second", "next", "then"])
        
        # Check for comprehensive response
        is_comprehensive = len(content) > 500
        
        # Check for actionable content
        has_actionable = any(word in content_lower for word in ["do", "implement", "create", "build", "develop", "execute"])
        
        score = (relevant_count / len(all_indicators) * 30) + (has_structure * 25) + (is_comprehensive * 25) + (has_actionable * 20)
        return min(score, 100)
    
    async def explore_memory_knowledge(self):
        """Test memory and knowledge capabilities"""
        print("Testing memory and knowledge features...")
        
        # Test memory storage and retrieval
        memory_tests = [
            {"name": "Store Knowledge", "type": "store"},
            {"name": "Retrieve Knowledge", "type": "retrieve"},
            {"name": "Search Knowledge", "type": "search"}
        ]
        
        results = []
        for test in memory_tests:
            result = await self.test_memory_scenario(test)
            results.append(result)
        
        return {"tests": results}
    
    async def test_memory_scenario(self, test: Dict) -> Dict:
        """Test a specific memory scenario"""
        start_time = time.time()
        
        try:
            async with aiohttp.ClientSession() as session:
                if test["type"] == "store":
                    # Store some test knowledge
                    data = {
                        "type": "knowledge",
                        "content": "Swift is a programming language developed by Apple for iOS development.",
                        "metadata": {"category": "programming", "language": "swift"},
                        "tags": ["programming", "swift", "ios"]
                    }
                    
                    async with session.post(
                        f"{self.assistant_base_url}/memories",
                        json=data,
                        timeout=aiohttp.ClientTimeout(total=10)
                    ) as response:
                        response_time = (time.time() - start_time) * 1000
                        
                        if response.status == 200:
                            print(f"  ✅ {test['name']}: {response_time:.0f}ms")
                            return {"name": test["name"], "success": True, "response_time": response_time}
                        else:
                            print(f"  ❌ {test['name']}: HTTP {response.status}")
                            return {"name": test["name"], "success": False}
                
                elif test["type"] == "search":
                    # Search for stored knowledge
                    data = {"query": "Swift programming", "k": 5}
                    
                    async with session.post(
                        f"{self.assistant_base_url}/memory/search",
                        json=data,
                        timeout=aiohttp.ClientTimeout(total=10)
                    ) as response:
                        response_time = (time.time() - start_time) * 1000
                        
                        if response.status == 200:
                            result_data = await response.json()
                            results_count = len(result_data.get("results", []))
                            print(f"  ✅ {test['name']}: {response_time:.0f}ms ({results_count} results)")
                            return {
                                "name": test["name"],
                                "success": True,
                                "response_time": response_time,
                                "results_count": results_count
                            }
                        else:
                            print(f"  ❌ {test['name']}: HTTP {response.status}")
                            return {"name": test["name"], "success": False}
                
                else:  # retrieve
                    # Test knowledge retrieval through chat
                    async with session.post(
                        f"{self.assistant_base_url}/chat",
                        json={"messages": [{"role": "user", "content": "What do you know about Swift programming?"}]},
                        timeout=aiohttp.ClientTimeout(total=20)
                    ) as response:
                        response_time = (time.time() - start_time) * 1000
                        
                        if response.status == 200:
                            data = await response.json()
                            content = data.get("content", "")
                            has_knowledge = "swift" in content.lower()
                            print(f"  ✅ {test['name']}: {response_time:.0f}ms (Has knowledge: {has_knowledge})")
                            return {
                                "name": test["name"],
                                "success": True,
                                "response_time": response_time,
                                "has_knowledge": has_knowledge
                            }
                        else:
                            print(f"  ❌ {test['name']}: HTTP {response.status}")
                            return {"name": test["name"], "success": False}
        except Exception as e:
            print(f"  ❌ {test['name']}: {str(e)}")
            return {"name": test["name"], "error": str(e)}
    
    async def explore_technical_integration(self):
        """Test technical integration capabilities"""
        print("Testing technical integration...")
        
        integration_tests = [
            {"name": "API Gateway", "url": "http://localhost:8080/health"},
            {"name": "LLM Router", "url": f"{self.llm_router_url}/health"},
            {"name": "Assistant Service", "url": f"{self.assistant_base_url}/health"},
            {"name": "Redis Cache", "test": "redis_connection"},
            {"name": "Database", "test": "db_connection"}
        ]
        
        results = []
        for test in integration_tests:
            result = await self.test_integration_scenario(test)
            results.append(result)
        
        return {"tests": results}
    
    async def test_integration_scenario(self, test: Dict) -> Dict:
        """Test a specific integration scenario"""
        start_time = time.time()
        
        try:
            if "url" in test:
                # Test HTTP endpoint
                async with aiohttp.ClientSession() as session:
                    async with session.get(test["url"], timeout=aiohttp.ClientTimeout(total=5)) as response:
                        response_time = (time.time() - start_time) * 1000
                        
                        if response.status == 200:
                            print(f"  ✅ {test['name']}: {response_time:.0f}ms")
                            return {"name": test["name"], "success": True, "response_time": response_time}
                        else:
                            print(f"  ❌ {test['name']}: HTTP {response.status}")
                            return {"name": test["name"], "success": False}
            else:
                # Test other integrations (placeholder for now)
                print(f"  ⏳ {test['name']}: Not implemented yet")
                return {"name": test["name"], "success": False, "note": "Not implemented"}
        except Exception as e:
            print(f"  ❌ {test['name']}: {str(e)}")
            return {"name": test["name"], "error": str(e)}
    
    async def explore_real_world_cases(self):
        """Test real-world use cases"""
        print("Testing real-world use cases...")
        
        use_cases = [
            {
                "name": "Code Review Assistant",
                "prompt": "Review this Swift code for potential issues: \n\nfunc calculateTotal(items: [Item]) -> Double {\n    var total = 0.0\n    for item in items {\n        total += item.price\n    }\n    return total\n}"
            },
            {
                "name": "API Design Consultant",
                "prompt": "I need to design a REST API for a task management app. What endpoints would you recommend and why?"
            },
            {
                "name": "Debugging Helper",
                "prompt": "My iOS app crashes when users scroll quickly through a large list. What could be causing this and how can I fix it?"
            }
        ]
        
        results = []
        for case in use_cases:
            result = await self.test_use_case(case)
            results.append(result)
        
        return {"tests": results}
    
    async def test_use_case(self, case: Dict) -> Dict:
        """Test a specific use case"""
        start_time = time.time()
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.assistant_base_url}/chat",
                    json={"messages": [{"role": "user", "content": case["prompt"]}]},
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    response_time = (time.time() - start_time) * 1000
                    
                    if response.status == 200:
                        data = await response.json()
                        content = data.get("content", "")
                        
                        usefulness_score = self.analyze_usefulness(content, case["name"])
                        
                        print(f"  ✅ {case['name']}: {response_time:.0f}ms (Usefulness: {usefulness_score:.1f}%)")
                        
                        return {
                            "name": case["name"],
                            "success": True,
                            "response_time": response_time,
                            "usefulness_score": usefulness_score,
                            "content_length": len(content)
                        }
                    else:
                        print(f"  ❌ {case['name']}: HTTP {response.status}")
                        return {"name": case["name"], "success": False}
        except Exception as e:
            print(f"  ❌ {case['name']}: {str(e)}")
            return {"name": case["name"], "error": str(e)}
    
    def analyze_usefulness(self, content: str, case_name: str) -> float:
        """Analyze how useful the response is for the use case"""
        content_lower = content.lower()
        
        # Usefulness indicators
        code_review_indicators = ["issue", "problem", "bug", "improve", "better", "suggest", "recommend"]
        api_design_indicators = ["endpoint", "rest", "http", "get", "post", "put", "delete", "design"]
        debugging_indicators = ["crash", "performance", "memory", "thread", "ui", "scroll", "fix", "solution"]
        
        if "code review" in case_name.lower():
            indicators = code_review_indicators
        elif "api" in case_name.lower():
            indicators = api_design_indicators
        else:
            indicators = debugging_indicators
        
        # Count relevant indicators
        relevant_count = sum(1 for indicator in indicators if indicator in content_lower)
        
        # Check for actionable advice
        has_actionable = any(word in content_lower for word in ["should", "recommend", "suggest", "try", "implement"])
        
        # Check for technical depth
        is_technical = any(word in content_lower for word in ["algorithm", "complexity", "memory", "performance", "thread"])
        
        score = (relevant_count / len(indicators) * 40) + (has_actionable * 30) + (is_technical * 30)
        return min(score, 100)
    
    async def explore_advanced_capabilities(self):
        """Test advanced system capabilities"""
        print("Testing advanced capabilities...")
        
        advanced_tests = [
            {
                "name": "Multi-modal Understanding",
                "prompt": "Analyze this architecture diagram: [API Gateway] -> [Service A] -> [Database]. What are the potential bottlenecks?"
            },
            {
                "name": "Context Awareness",
                "prompt": "Given our previous conversation about microservices, how would you implement a distributed logging system?"
            },
            {
                "name": "Learning & Adaptation",
                "prompt": "I've noticed that my users prefer shorter responses. Can you adapt your communication style?"
            }
        ]
        
        results = []
        for test in advanced_tests:
            result = await self.test_advanced_scenario(test)
            results.append(result)
        
        return {"tests": results}
    
    async def test_advanced_scenario(self, test: Dict) -> Dict:
        """Test a specific advanced scenario"""
        start_time = time.time()
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.assistant_base_url}/chat",
                    json={"messages": [{"role": "user", "content": test["prompt"]}]},
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    response_time = (time.time() - start_time) * 1000
                    
                    if response.status == 200:
                        data = await response.json()
                        content = data.get("content", "")
                        
                        advanced_score = self.analyze_advanced_capability(content, test["name"])
                        
                        print(f"  ✅ {test['name']}: {response_time:.0f}ms (Advanced: {advanced_score:.1f}%)")
                        
                        return {
                            "name": test["name"],
                            "success": True,
                            "response_time": response_time,
                            "advanced_score": advanced_score,
                            "content_length": len(content)
                        }
                    else:
                        print(f"  ❌ {test['name']}: HTTP {response.status}")
                        return {"name": test["name"], "success": False}
        except Exception as e:
            print(f"  ❌ {test['name']}: {str(e)}")
            return {"name": test["name"], "error": str(e)}
    
    def analyze_advanced_capability(self, content: str, test_name: str) -> float:
        """Analyze advanced capability"""
        content_lower = content.lower()
        
        # Advanced indicators
        multimodal_indicators = ["diagram", "visual", "architecture", "flow", "bottleneck", "analyze"]
        context_indicators = ["previous", "conversation", "context", "given", "mentioned", "earlier"]
        learning_indicators = ["adapt", "learn", "prefer", "style", "adjust", "change", "modify"]
        
        if "multi-modal" in test_name.lower():
            indicators = multimodal_indicators
        elif "context" in test_name.lower():
            indicators = context_indicators
        else:
            indicators = learning_indicators
        
        # Count relevant indicators
        relevant_count = sum(1 for indicator in indicators if indicator in content_lower)
        
        # Check for sophisticated analysis
        is_sophisticated = len(content) > 300 and any(word in content_lower for word in ["complex", "sophisticated", "advanced", "intricate"])
        
        score = (relevant_count / len(indicators) * 50) + (is_sophisticated * 50)
        return min(score, 100)
    
    def print_direction_summary(self, name: str, result: Dict):
        """Print summary for a direction"""
        if "error" in result:
            print(f"❌ {name}: Error - {result['error']}")
            return
        
        if "tests" in result:
            tests = result["tests"]
            successful = len([t for t in tests if t.get("success", False)])
            total = len(tests)
            
            print(f"📊 {name}: {successful}/{total} tests successful")
            
            # Print key metrics if available
            if "avg_quality" in result:
                print(f"   🎯 Average Quality: {result['avg_quality']:.1f}%")
            if "avg_response_time" in result:
                print(f"   ⏱️ Average Response Time: {result['avg_response_time']:.0f}ms")
    
    def generate_recommendations(self):
        """Generate recommendations based on exploration results"""
        print("\n" + "=" * 50)
        print("🎯 DIRECTION RECOMMENDATIONS")
        print("=" * 50)
        
        # Analyze results and provide recommendations
        recommendations = []
        
        for direction, result in self.results.items():
            if "error" in result:
                recommendations.append(f"❌ {direction}: Has errors - needs fixing")
                continue
            
            if "tests" in result:
                tests = result["tests"]
                successful = len([t for t in tests if t.get("success", False)])
                total = len(tests)
                success_rate = successful / total * 100 if total > 0 else 0
                
                if success_rate >= 80:
                    recommendations.append(f"🟢 {direction}: Excellent ({success_rate:.0f}% success) - Great potential!")
                elif success_rate >= 60:
                    recommendations.append(f"🟡 {direction}: Good ({success_rate:.0f}% success) - Worth developing")
                elif success_rate >= 40:
                    recommendations.append(f"🟠 {direction}: Fair ({success_rate:.0f}% success) - Needs improvement")
                else:
                    recommendations.append(f"🔴 {direction}: Poor ({success_rate:.0f}% success) - Not ready")
        
        print("\n📋 RECOMMENDATIONS:")
        for rec in recommendations:
            print(f"  {rec}")
        
        # Overall direction advice
        print(f"\n💡 NEXT STEPS:")
        print(f"  1. Focus on directions with 🟢 or 🟡 ratings")
        print(f"  2. Fix any 🔴 issues before moving forward")
        print(f"  3. Consider combining multiple strong directions")
        print(f"  4. Test with your Swift frontend for real-world validation")
        
        # Save results
        with open("direction_exploration_results.json", "w") as f:
            json.dump(self.results, f, indent=2)
        
        print(f"\n💾 Detailed results saved to: direction_exploration_results.json")

async def main():
    explorer = DirectionExplorer()
    await explorer.explore_all_directions()

if __name__ == "__main__":
    asyncio.run(main())
