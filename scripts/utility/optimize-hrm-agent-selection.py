#!/usr/bin/env python3
"""
HRM Agent Selection Optimization
Enhances agent selection logic with intelligent matching and fallback strategies
"""

import json
import requests
from typing import Dict, List, Any, Optional
import time

class HRMAgentOptimizer:
    def __init__(self, api_base: str = "http://localhost:9999"):
        self.api_base = api_base
        self.agent_cache = None
        self.cache_expiry = 0
        self.cache_ttl = 30  # 30 seconds
        
    def get_available_agents(self) -> List[Dict[str, Any]]:
        """Get cached list of available agents"""
        current_time = time.time()
        
        if self.agent_cache and current_time < self.cache_expiry:
            return self.agent_cache
            
        try:
            response = requests.get(f"{self.api_base}/api/agents/available", timeout=5)
            if response.ok:
                self.agent_cache = response.json()
                self.cache_expiry = current_time + self.cache_ttl
                return self.agent_cache
        except:
            pass
            
        return []
    
    def calculate_agent_fitness(self, agent: Dict[str, Any], task_requirements: Dict[str, Any]) -> float:
        """Calculate how well an agent fits the task requirements"""
        fitness_score = 0.0
        
        # Task type matching (40% weight)
        task_type = task_requirements.get('task_type', '').lower()
        agent_capabilities = [cap.lower() for cap in agent.get('capabilities', [])]
        
        if task_type in ['swift_development', 'ios_development', 'macos_development']:
            if 'swiftui' in agent_capabilities or 'ios' in agent_capabilities:
                fitness_score += 0.4
        elif task_type in ['performance_optimization', 'code_optimization']:
            if 'performance' in agent_capabilities or 'optimization' in agent_capabilities:
                fitness_score += 0.4
        elif task_type in ['code_review', 'code_analysis']:
            if 'code-review' in agent_capabilities or 'static-analysis' in agent_capabilities:
                fitness_score += 0.4
        elif task_type in ['testing', 'test_automation']:
            if 'test-execution' in agent_capabilities or 'test-automation' in agent_capabilities:
                fitness_score += 0.4
        
        # Performance metrics (30% weight)
        performance = agent.get('performance', {})
        success_rate = performance.get('success_rate', 0.0)
        avg_response_ms = performance.get('average_response_ms', 1000)
        
        fitness_score += success_rate * 0.2  # Success rate contribution
        
        # Response time bonus (faster = better, with diminishing returns)
        if avg_response_ms <= 500:
            fitness_score += 0.1
        elif avg_response_ms <= 1000:
            fitness_score += 0.05
        
        # Complexity matching (20% weight)
        complexity = task_requirements.get('complexity', 'moderate').lower()
        tasks_completed = performance.get('tasks_completed', 0)
        
        if complexity == 'high' and tasks_completed >= 50:
            fitness_score += 0.2
        elif complexity == 'moderate' and tasks_completed >= 20:
            fitness_score += 0.15
        elif complexity == 'simple':
            fitness_score += 0.1
        
        # Agent status (10% weight)
        if agent.get('status') == 'healthy':
            fitness_score += 0.1
        elif agent.get('status') == 'partial':
            fitness_score += 0.05
            
        return min(fitness_score, 1.0)  # Cap at 1.0
    
    def select_optimal_agents(self, task_requirements: Dict[str, Any], max_agents: int = 3) -> List[Dict[str, Any]]:
        """Select the most suitable agents for the task"""
        available_agents = self.get_available_agents()
        
        if not available_agents:
            return []
        
        # Calculate fitness scores
        agent_scores = []
        for agent in available_agents:
            fitness = self.calculate_agent_fitness(agent, task_requirements)
            if fitness > 0.1:  # Only consider agents with minimum fitness
                agent_scores.append((agent, fitness))
        
        # Sort by fitness score (descending)
        agent_scores.sort(key=lambda x: x[1], reverse=True)
        
        # Select top agents
        selected = []
        for agent, score in agent_scores[:max_agents]:
            selected.append({
                **agent,
                'fitness_score': score,
                'selection_reason': self._get_selection_reason(agent, task_requirements, score)
            })
        
        return selected
    
    def _get_selection_reason(self, agent: Dict[str, Any], task_requirements: Dict[str, Any], score: float) -> str:
        """Generate human-readable reason for agent selection"""
        reasons = []
        
        task_type = task_requirements.get('task_type', '').lower()
        agent_caps = agent.get('capabilities', [])
        performance = agent.get('performance', {})
        
        # Task matching reasons
        if task_type in ['swift_development', 'ios_development'] and 'swiftui' in [c.lower() for c in agent_caps]:
            reasons.append("Expert in SwiftUI development")
        elif task_type in ['performance_optimization'] and 'performance' in [c.lower() for c in agent_caps]:
            reasons.append("Specializes in performance optimization")
        elif 'code-review' in [c.lower() for c in agent_caps]:
            reasons.append("Code review expertise")
        
        # Performance reasons
        success_rate = performance.get('success_rate', 0)
        if success_rate >= 0.9:
            reasons.append(f"High success rate ({success_rate:.1%})")
        
        avg_response = performance.get('average_response_ms', 0)
        if avg_response <= 800:
            reasons.append(f"Fast response time ({avg_response}ms)")
        
        if not reasons:
            reasons.append(f"Good overall fit (score: {score:.2f})")
        
        return "; ".join(reasons)
    
    def test_enhanced_decision(self, task_description: str, task_type: str, complexity: str = "moderate") -> Dict[str, Any]:
        """Test enhanced HRM decision with optimized agent selection"""
        
        task_requirements = {
            'task_description': task_description,
            'task_type': task_type,
            'complexity': complexity
        }
        
        print(f"🎯 Task: {task_description}")
        print(f"📝 Type: {task_type}, Complexity: {complexity}")
        print()
        
        # Get optimal agents
        selected_agents = self.select_optimal_agents(task_requirements, max_agents=3)
        
        if not selected_agents:
            return {
                'success': False,
                'error': 'No suitable agents found',
                'fallback': 'Use general-purpose agent'
            }
        
        # Create optimized decision response
        primary_agent = selected_agents[0]
        
        decision_response = {
            'success': True,
            'decision_id': f"optimized_{int(time.time())}",
            'recommended_action': 'execute_with_primary_agent',
            'primary_agent': {
                'name': primary_agent['name'],
                'type': primary_agent['type'],
                'fitness_score': primary_agent['fitness_score'],
                'reason': primary_agent['selection_reason']
            },
            'backup_agents': [
                {
                    'name': agent['name'],
                    'fitness_score': agent['fitness_score'],
                    'reason': agent['selection_reason']
                }
                for agent in selected_agents[1:]
            ],
            'confidence_score': primary_agent['fitness_score'],
            'execution_plan': {
                'primary_execution': f"Execute with {primary_agent['name']}",
                'fallback_strategy': f"If primary fails, try {selected_agents[1]['name'] if len(selected_agents) > 1 else 'general agent'}",
                'expected_response_time': primary_agent.get('performance', {}).get('average_response_ms', 1000)
            },
            'optimization_metadata': {
                'agents_evaluated': len(self.get_available_agents()),
                'agents_qualified': len(selected_agents),
                'selection_algorithm': 'fitness_based_ranking',
                'cache_hit': self.agent_cache is not None
            }
        }
        
        return decision_response

def run_hrm_optimization_tests():
    """Run comprehensive HRM optimization tests"""
    
    print("🚀 HRM Agent Selection Optimization Tests")
    print("=" * 50)
    
    optimizer = HRMAgentOptimizer()
    
    # Test cases
    test_cases = [
        {
            'description': "Create advanced SwiftUI animation system", 
            'type': "swift_development", 
            'complexity': "high"
        },
        {
            'description': "Optimize database query performance", 
            'type': "performance_optimization", 
            'complexity': "high"
        },
        {
            'description': "Review TypeScript codebase for best practices", 
            'type': "code_review", 
            'complexity': "moderate"
        },
        {
            'description': "Run comprehensive test suite", 
            'type': "testing", 
            'complexity': "simple"
        },
        {
            'description': "Debug memory leak in iOS app", 
            'type': "ios_development", 
            'complexity': "high"
        }
    ]
    
    results = []
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n🧪 Test {i}: {test_case['description']}")
        print("-" * 40)
        
        start_time = time.time()
        result = optimizer.test_enhanced_decision(
            test_case['description'],
            test_case['type'],
            test_case['complexity']
        )
        execution_time = int((time.time() - start_time) * 1000)
        
        if result['success']:
            primary = result['primary_agent']
            print(f"✅ Primary Agent: {primary['name']} ({primary['type']})")
            print(f"📊 Fitness Score: {primary['fitness_score']:.3f}")
            print(f"💡 Reason: {primary['reason']}")
            print(f"🔄 Backups: {len(result['backup_agents'])} agents")
            print(f"⚡ Selection Time: {execution_time}ms")
            
            results.append({
                'test': test_case['description'],
                'success': True,
                'primary_agent': primary['name'],
                'fitness_score': primary['fitness_score'],
                'selection_time_ms': execution_time
            })
        else:
            print(f"❌ Failed: {result['error']}")
            results.append({
                'test': test_case['description'],
                'success': False,
                'error': result['error'],
                'selection_time_ms': execution_time
            })
    
    # Summary
    print(f"\n📊 Optimization Results Summary")
    print("=" * 40)
    successful = sum(1 for r in results if r['success'])
    total = len(results)
    avg_fitness = sum(r.get('fitness_score', 0) for r in results if r['success']) / max(successful, 1)
    avg_time = sum(r['selection_time_ms'] for r in results) / total
    
    print(f"✅ Success Rate: {successful}/{total} ({successful/total:.1%})")
    print(f"📈 Average Fitness Score: {avg_fitness:.3f}")
    print(f"⚡ Average Selection Time: {avg_time:.1f}ms")
    
    if successful >= 4:
        print(f"\n🏆 EXCELLENT: HRM Agent Selection Optimization is working perfectly!")
        print(f"🎯 High-confidence agent matching with intelligent fallback strategies")
        return True
    elif successful >= 2:
        print(f"\n📈 GOOD: HRM optimization working but needs refinement")
        return True
    else:
        print(f"\n⚠️ NEEDS WORK: HRM agent selection needs debugging")
        return False

if __name__ == "__main__":
    success = run_hrm_optimization_tests()
    exit(0 if success else 1)