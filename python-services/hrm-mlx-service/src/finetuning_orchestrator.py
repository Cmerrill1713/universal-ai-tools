"""
HRM-Guided Fine-tuning Orchestrator
Intelligent system for deciding when and how to fine-tune LLMs based on HRM analysis
"""

import asyncio
import json
import time
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from collections import defaultdict, deque
import httpx
from datetime import datetime, timedelta

@dataclass
class PerformanceGap:
    gap_type: str  # "accuracy_drop", "domain_weakness", "reasoning_quality", "template_failure"
    domain: str
    severity: float  # 0.0-1.0
    affected_templates: List[str]
    sample_failures: List[Dict[str, Any]]
    confidence_gap: float  # HRM confidence - LLM quality
    
@dataclass
class FineTuningDecision:
    should_finetune: bool
    priority: str  # "low", "medium", "high", "critical"
    recommended_data_size: int
    training_strategy: str
    estimated_improvement: float
    resource_requirements: Dict[str, Any]
    reasoning: List[str]

class HRMFineTuningOrchestrator:
    """Intelligent fine-tuning orchestrator driven by HRM analysis"""
    
    def __init__(self, hrm_base_url: str = "http://localhost:8085"):
        self.hrm_base = hrm_base_url.rstrip("/")
        self.client = httpx.AsyncClient(timeout=30.0)
        
        # Performance tracking
        self.performance_history = deque(maxlen=1000)
        self.domain_performance = defaultdict(list)
        self.template_performance = defaultdict(list)
        self.model_metrics = {}
        
        # Fine-tuning parameters
        self.quality_threshold = 0.75
        self.confidence_gap_threshold = 0.3
        self.domain_weakness_threshold = 0.6
        self.min_training_examples = 50
        
    async def track_llm_interaction(self, 
                                  user_query: str,
                                  hrm_preprocessing: Dict[str, Any],
                                  llm_response: str,
                                  user_satisfaction: Optional[float] = None) -> None:
        """Track LLM performance for fine-tuning analysis"""
        
        interaction_data = {
            "timestamp": datetime.now().isoformat(),
            "user_query": user_query,
            "hrm_confidence": hrm_preprocessing.get("confidence", 0.0),
            "hrm_template": hrm_preprocessing.get("template_used", "unknown"),
            "hrm_steps": len(hrm_preprocessing.get("reasoning_steps", [])),
            "llm_response": llm_response,
            "user_satisfaction": user_satisfaction,
            "domain": await self._classify_domain(user_query),
            "response_quality": user_satisfaction if user_satisfaction is not None else await self._evaluate_response_quality(llm_response, hrm_preprocessing)
        }
        
        self.performance_history.append(interaction_data)
        
        # Update domain and template performance
        domain = interaction_data["domain"]
        template = interaction_data["hrm_template"]
        quality = interaction_data["response_quality"]
        
        self.domain_performance[domain].append(quality)
        self.template_performance[template].append(quality)
        
    async def analyze_performance_gaps(self, lookback_hours: int = 24) -> List[PerformanceGap]:
        """Analyze recent performance to identify fine-tuning opportunities"""
        
        cutoff_time = datetime.now() - timedelta(hours=lookback_hours)
        recent_interactions = [
            interaction for interaction in self.performance_history
            if datetime.fromisoformat(interaction["timestamp"]) > cutoff_time
        ]
        
        if not recent_interactions:
            return []
            
        gaps = []
        
        # 1. Domain weakness analysis
        domain_scores = defaultdict(list)
        for interaction in recent_interactions:
            domain_scores[interaction["domain"]].append(interaction["response_quality"])
            
        for domain, scores in domain_scores.items():
            avg_score = sum(scores) / len(scores)
            if avg_score < self.domain_weakness_threshold and len(scores) >= 5:
                gaps.append(PerformanceGap(
                    gap_type="domain_weakness",
                    domain=domain,
                    severity=(self.domain_weakness_threshold - avg_score) / self.domain_weakness_threshold,
                    affected_templates=self._get_domain_templates(domain, recent_interactions),
                    sample_failures=self._get_domain_failures(domain, recent_interactions),
                    confidence_gap=self._calculate_confidence_gap(domain, recent_interactions)
                ))
                
        # 2. Template failure analysis
        template_scores = defaultdict(list)
        for interaction in recent_interactions:
            template_scores[interaction["hrm_template"]].append(interaction["response_quality"])
            
        for template, scores in template_scores.items():
            avg_score = sum(scores) / len(scores)
            if avg_score < self.quality_threshold and len(scores) >= 3:
                gaps.append(PerformanceGap(
                    gap_type="template_failure",
                    domain=self._get_template_primary_domain(template, recent_interactions),
                    severity=(self.quality_threshold - avg_score) / self.quality_threshold,
                    affected_templates=[template],
                    sample_failures=self._get_template_failures(template, recent_interactions),
                    confidence_gap=self._calculate_template_confidence_gap(template, recent_interactions)
                ))
                
        # 3. Confidence gap analysis
        confidence_gaps = []
        for interaction in recent_interactions:
            gap = interaction["hrm_confidence"] - interaction["response_quality"]
            if gap > self.confidence_gap_threshold:
                confidence_gaps.append(interaction)
                
        if len(confidence_gaps) >= 5:
            gaps.append(PerformanceGap(
                gap_type="reasoning_quality",
                domain="general",
                severity=len(confidence_gaps) / len(recent_interactions),
                affected_templates=list(set(gap["hrm_template"] for gap in confidence_gaps)),
                sample_failures=confidence_gaps[:5],
                confidence_gap=sum(gap["hrm_confidence"] - gap["response_quality"] for gap in confidence_gaps) / len(confidence_gaps)
            ))
            
        return sorted(gaps, key=lambda x: x.severity, reverse=True)
    
    async def make_finetuning_decision(self, performance_gaps: List[PerformanceGap]) -> FineTuningDecision:
        """Make intelligent fine-tuning decision based on HRM analysis"""
        
        if not performance_gaps:
            return FineTuningDecision(
                should_finetune=False,
                priority="none",
                recommended_data_size=0,
                training_strategy="none",
                estimated_improvement=0.0,
                resource_requirements={},
                reasoning=["No significant performance gaps detected"]
            )
            
        # Calculate overall severity
        total_severity = sum(gap.severity for gap in performance_gaps)
        max_severity = max(gap.severity for gap in performance_gaps)
        avg_confidence_gap = sum(gap.confidence_gap for gap in performance_gaps) / len(performance_gaps)
        
        # Decision logic
        should_finetune = (
            max_severity > 0.4 or  # Single severe issue
            total_severity > 1.0 or  # Multiple moderate issues
            avg_confidence_gap > 0.4  # Significant reasoning gap
        )
        
        # Priority calculation
        if max_severity > 0.7 or avg_confidence_gap > 0.5:
            priority = "critical"
        elif max_severity > 0.5 or total_severity > 1.5:
            priority = "high"
        elif max_severity > 0.3 or total_severity > 0.8:
            priority = "medium"
        else:
            priority = "low"
            
        # Training strategy recommendation
        if any(gap.gap_type == "domain_weakness" for gap in performance_gaps):
            strategy = "domain_focused"
            data_size = max(100, len(performance_gaps) * 50)
        elif any(gap.gap_type == "reasoning_quality" for gap in performance_gaps):
            strategy = "reasoning_enhancement"
            data_size = max(150, int(avg_confidence_gap * 300))
        else:
            strategy = "general_improvement"
            data_size = max(75, len(performance_gaps) * 30)
            
        # Estimated improvement (based on severity and confidence gaps)
        estimated_improvement = min(0.95, max_severity * 0.6 + avg_confidence_gap * 0.4)
        
        reasoning = []
        for gap in performance_gaps:
            reasoning.append(f"{gap.gap_type.replace('_', ' ').title()}: {gap.domain} domain, {gap.severity:.2f} severity")
            
        return FineTuningDecision(
            should_finetune=should_finetune,
            priority=priority,
            recommended_data_size=data_size,
            training_strategy=strategy,
            estimated_improvement=estimated_improvement,
            resource_requirements={
                "training_time_hours": data_size / 50,  # Rough estimate
                "memory_gb": 8 if data_size < 200 else 16,
                "iterations_recommended": max(100, data_size // 2)
            },
            reasoning=reasoning
        )
    
    async def curate_training_data(self, performance_gaps: List[PerformanceGap], target_size: int) -> List[Dict[str, Any]]:
        """Use HRM to curate high-quality training data based on performance gaps"""
        
        training_examples = []
        
        for gap in performance_gaps:
            # Generate examples targeting this specific gap
            if gap.gap_type == "domain_weakness":
                examples = await self._generate_domain_examples(gap.domain, gap.affected_templates[0])
            elif gap.gap_type == "reasoning_quality":
                examples = await self._generate_reasoning_examples(gap.affected_templates)
            elif gap.gap_type == "template_failure":
                examples = await self._generate_template_examples(gap.affected_templates[0], gap.domain)
            else:
                examples = await self._generate_general_examples(gap.domain)
                
            # Validate examples with HRM
            validated_examples = []
            for example in examples:
                validation = await self._validate_training_example(example)
                if validation["suitable_for_training"]:
                    validated_examples.append({
                        **example,
                        "hrm_confidence": validation["confidence"],
                        "quality_score": validation["quality_score"],
                        "target_gap": gap.gap_type
                    })
                    
            training_examples.extend(validated_examples)
            
            if len(training_examples) >= target_size:
                break
                
        return training_examples[:target_size]
    
    async def _classify_domain(self, query: str) -> str:
        """Classify query domain using HRM"""
        try:
            response = await self.client.post(
                f"{self.hrm_base}/reasoning",
                json={
                    "task_type": "planning",
                    "input_data": {
                        "prompt": f"Classify the domain of this query: '{query}'",
                        "classification_task": True
                    },
                    "max_steps": 3
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    # Extract domain from HRM reasoning
                    result = data.get("result", {})
                    # Simplified domain extraction - in practice, this would be more sophisticated
                    query_lower = query.lower()
                    if any(word in query_lower for word in ["database", "sql", "data"]):
                        return "database"
                    elif any(word in query_lower for word in ["web", "api", "http"]):
                        return "web_development"
                    elif any(word in query_lower for word in ["ai", "ml", "model"]):
                        return "machine_learning"
                    else:
                        return "general"
        except Exception:
            pass
            
        return "general"
    
    async def _evaluate_response_quality(self, response: str, hrm_data: Dict[str, Any]) -> float:
        """Evaluate LLM response quality using HRM"""
        # For demo purposes, use a simple heuristic that creates realistic quality scores
        # In production, this would use the actual HRM service for evaluation
        
        response_length = len(response)
        response_lower = response.lower()
        
        # Simulate quality based on response characteristics
        base_quality = 0.5
        
        # Length factor
        if response_length > 100:
            base_quality += 0.2
        elif response_length < 30:
            base_quality -= 0.2
            
        # Content quality heuristics (simplified)
        quality_indicators = ["step", "first", "analysis", "solution", "because", "therefore", "however"]
        poor_indicators = ["generic", "basic", "simple"]
        
        for indicator in quality_indicators:
            if indicator in response_lower:
                base_quality += 0.05
                
        for indicator in poor_indicators:
            if indicator in response_lower:
                base_quality -= 0.15
        
        return max(0.1, min(0.95, base_quality))
    
    # Helper methods (simplified implementations)
    def _get_domain_templates(self, domain: str, interactions: List[Dict]) -> List[str]:
        templates = set()
        for interaction in interactions:
            if interaction["domain"] == domain:
                templates.add(interaction["hrm_template"])
        return list(templates)
    
    def _get_domain_failures(self, domain: str, interactions: List[Dict]) -> List[Dict]:
        failures = []
        for interaction in interactions:
            if interaction["domain"] == domain and interaction["response_quality"] < 0.6:
                failures.append({
                    "query": interaction["user_query"][:100],
                    "quality": interaction["response_quality"],
                    "confidence_gap": interaction["hrm_confidence"] - interaction["response_quality"]
                })
        return failures[:5]
    
    def _calculate_confidence_gap(self, domain: str, interactions: List[Dict]) -> float:
        gaps = []
        for interaction in interactions:
            if interaction["domain"] == domain:
                gaps.append(interaction["hrm_confidence"] - interaction["response_quality"])
        return sum(gaps) / len(gaps) if gaps else 0.0
    
    def _get_template_primary_domain(self, template: str, interactions: List[Dict]) -> str:
        """Get the primary domain for a template based on interaction history"""
        domain_counts = defaultdict(int)
        for interaction in interactions:
            if interaction["hrm_template"] == template:
                domain_counts[interaction["domain"]] += 1
        
        if domain_counts:
            return max(domain_counts, key=domain_counts.get)
        return "general"
    
    def _get_template_failures(self, template: str, interactions: List[Dict]) -> List[Dict]:
        failures = []
        for interaction in interactions:
            if interaction["hrm_template"] == template and interaction["response_quality"] < 0.6:
                failures.append({
                    "query": interaction["user_query"][:100],
                    "quality": interaction["response_quality"],
                    "confidence_gap": interaction["hrm_confidence"] - interaction["response_quality"]
                })
        return failures[:5]
    
    def _calculate_template_confidence_gap(self, template: str, interactions: List[Dict]) -> float:
        gaps = []
        for interaction in interactions:
            if interaction["hrm_template"] == template:
                gaps.append(interaction["hrm_confidence"] - interaction["response_quality"])
        return sum(gaps) / len(gaps) if gaps else 0.0
    
    # Additional helper methods would be implemented similarly...
    
    async def _generate_domain_examples(self, domain: str, template: str) -> List[Dict[str, Any]]:
        """Generate domain-specific training examples using HRM"""
        # This would use HRM to generate high-quality examples for the specific domain
        # Placeholder implementation
        return [
            {
                "input": f"Example {domain} question using {template} template",
                "output": f"Example {domain} answer following {template} reasoning"
            }
        ]
    
    async def _generate_reasoning_examples(self, templates: List[str]) -> List[Dict[str, Any]]:
        """Generate reasoning-focused training examples"""
        examples = []
        for template in templates:
            examples.append({
                "input": f"Complex reasoning task requiring {template} approach",
                "output": f"Step-by-step {template} reasoning with clear logical progression"
            })
        return examples
    
    async def _generate_template_examples(self, template: str, domain: str) -> List[Dict[str, Any]]:
        """Generate template-specific training examples"""
        return [
            {
                "input": f"Template-specific {template} question in {domain} domain",
                "output": f"High-quality {template} response for {domain}"
            }
        ]
    
    async def _generate_general_examples(self, domain: str) -> List[Dict[str, Any]]:
        """Generate general training examples for domain"""
        return [
            {
                "input": f"General question in {domain} domain",
                "output": f"Comprehensive response for {domain} topic"
            }
        ]
    
    async def _validate_training_example(self, example: Dict[str, Any]) -> Dict[str, Any]:
        """Validate training example quality using HRM"""
        # This would use HRM to evaluate if an example is suitable for training
        return {
            "suitable_for_training": True,
            "confidence": 0.8,
            "quality_score": 0.85
        }

# Example usage and testing
async def main():
    """Test the fine-tuning orchestrator"""
    orchestrator = HRMFineTuningOrchestrator()
    
    # Simulate some interactions
    await orchestrator.track_llm_interaction(
        user_query="How do I optimize database queries?",
        hrm_preprocessing={
            "confidence": 0.9,
            "template_used": "analytical", 
            "reasoning_steps": ["step1", "step2", "step3"]
        },
        llm_response="You can optimize queries by adding indexes...",
        user_satisfaction=0.6  # Low satisfaction indicates quality gap
    )
    
    # Analyze performance gaps
    gaps = await orchestrator.analyze_performance_gaps()
    print(f"Found {len(gaps)} performance gaps")
    
    # Make fine-tuning decision
    decision = await orchestrator.make_finetuning_decision(gaps)
    print(f"Fine-tuning decision: {asdict(decision)}")

if __name__ == "__main__":
    asyncio.run(main())