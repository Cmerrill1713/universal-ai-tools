#!/usr/bin/env python3
"""
Performance Grading System for MLX Models
Implements A-F grading based on multiple metrics with weighted scoring
"""

import json
import logging
import time
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Tuple
from enum import Enum
import numpy as np
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class PerformanceGrade(Enum):
    """Model performance grades"""
    A = "A"  # 90-100%
    B = "B"  # 80-89%
    C = "C"  # 70-79%
    D = "D"  # 60-69%
    F = "F"  # <60%

@dataclass
class ModelMetrics:
    """Comprehensive model performance metrics"""
    domain_accuracy: float      # Percentage of domain-specific correct responses
    bleu_score: float          # BLEU score (0-1)
    rouge_l_score: float       # ROUGE-L score (0-1)
    perplexity: float          # Model perplexity (lower is better)
    inference_time: float      # Average inference time in seconds
    memory_usage_gb: float     # Memory usage in GB
    
    # Additional quality metrics
    response_relevance: float   # How relevant responses are to questions
    coherence_score: float     # How coherent the responses are
    consistency_score: float   # Consistency across similar queries

@dataclass
class PerformanceReport:
    """Complete performance report for a model"""
    model_name: str
    model_path: str
    adapter_version: str
    evaluation_timestamp: float
    metrics: ModelMetrics
    grade: PerformanceGrade
    weighted_score: float
    grade_thresholds: Dict[str, float]
    recommendations: List[str]
    comparison_to_baseline: Optional[Dict[str, float]] = None

class PerformanceGrader:
    """A-F performance grading system for MLX models"""
    
    def __init__(self, config_path: Optional[str] = None):
        self.logger = logging.getLogger(self.__class__.__name__)
        
        # Default grading configuration
        self.grading_config = {
            # Metric weights (must sum to 1.0)
            "weights": {
                "domain_accuracy": 0.35,      # Most important for domain-specific tasks
                "bleu_score": 0.20,           # Text generation quality
                "rouge_l_score": 0.15,        # Content preservation
                "perplexity": 0.15,           # Language modeling quality
                "response_relevance": 0.10,   # Relevance to queries
                "coherence_score": 0.05       # Response coherence
            },
            
            # Grade thresholds (weighted score percentages)
            "grade_thresholds": {
                "A": 90.0,  # Excellence
                "B": 80.0,  # Good
                "C": 70.0,  # Acceptable
                "D": 60.0,  # Poor
                "F": 0.0    # Failing
            },
            
            # Metric normalization ranges
            "normalization": {
                "domain_accuracy": {"min": 0, "max": 100, "invert": False},
                "bleu_score": {"min": 0, "max": 1.0, "invert": False},
                "rouge_l_score": {"min": 0, "max": 1.0, "invert": False},
                "perplexity": {"min": 1, "max": 100, "invert": True},  # Lower is better
                "response_relevance": {"min": 0, "max": 100, "invert": False},
                "coherence_score": {"min": 0, "max": 100, "invert": False}
            }
        }
        
        if config_path and Path(config_path).exists():
            self.load_config(config_path)
    
    def load_config(self, config_path: str):
        """Load grading configuration from JSON file"""
        try:
            with open(config_path, 'r') as f:
                custom_config = json.load(f)
                self.grading_config.update(custom_config)
            self.logger.info(f"✅ Loaded grading config from {config_path}")
        except Exception as e:
            self.logger.error(f"❌ Failed to load config: {e}")
    
    def normalize_metric(self, metric_name: str, value: float) -> float:
        """Normalize metric to 0-100 scale"""
        norm_config = self.grading_config["normalization"][metric_name]
        
        # Clamp to range
        clamped = max(norm_config["min"], min(norm_config["max"], value))
        
        # Normalize to 0-1
        normalized = (clamped - norm_config["min"]) / (norm_config["max"] - norm_config["min"])
        
        # Invert if lower values are better (like perplexity)
        if norm_config["invert"]:
            normalized = 1.0 - normalized
        
        # Convert to 0-100 scale
        return normalized * 100
    
    def calculate_weighted_score(self, metrics: ModelMetrics) -> float:
        """Calculate weighted performance score"""
        weights = self.grading_config["weights"]
        
        # Normalize all metrics to 0-100 scale
        normalized_scores = {}
        
        # Handle special case for perplexity (lower is better)
        normalized_scores["domain_accuracy"] = self.normalize_metric("domain_accuracy", metrics.domain_accuracy)
        normalized_scores["bleu_score"] = self.normalize_metric("bleu_score", metrics.bleu_score)
        normalized_scores["rouge_l_score"] = self.normalize_metric("rouge_l_score", metrics.rouge_l_score)
        normalized_scores["perplexity"] = self.normalize_metric("perplexity", metrics.perplexity)
        normalized_scores["response_relevance"] = self.normalize_metric("response_relevance", metrics.response_relevance)
        normalized_scores["coherence_score"] = self.normalize_metric("coherence_score", metrics.coherence_score)
        
        # Calculate weighted average
        weighted_score = 0.0
        for metric, weight in weights.items():
            if metric in normalized_scores:
                weighted_score += normalized_scores[metric] * weight
                self.logger.debug(f"  {metric}: {normalized_scores[metric]:.1f} * {weight} = {normalized_scores[metric] * weight:.1f}")
        
        return weighted_score
    
    def determine_grade(self, weighted_score: float) -> PerformanceGrade:
        """Determine letter grade based on weighted score"""
        thresholds = self.grading_config["grade_thresholds"]
        
        if weighted_score >= thresholds["A"]:
            return PerformanceGrade.A
        elif weighted_score >= thresholds["B"]:
            return PerformanceGrade.B
        elif weighted_score >= thresholds["C"]:
            return PerformanceGrade.C
        elif weighted_score >= thresholds["D"]:
            return PerformanceGrade.D
        else:
            return PerformanceGrade.F
    
    def generate_recommendations(self, metrics: ModelMetrics, grade: PerformanceGrade) -> List[str]:
        """Generate improvement recommendations based on performance"""
        recommendations = []
        
        # Domain accuracy recommendations
        if metrics.domain_accuracy < 80:
            recommendations.append("🎯 Increase domain-specific training data")
            recommendations.append("📚 Add more diverse examples for edge cases")
        
        # BLEU score recommendations
        if metrics.bleu_score < 0.3:
            recommendations.append("✍️ Improve text generation quality with better prompt engineering")
            recommendations.append("🔄 Consider increasing training iterations")
        
        # Perplexity recommendations
        if metrics.perplexity > 50:
            recommendations.append("📉 High perplexity indicates model uncertainty - add more training data")
            recommendations.append("⚙️ Consider adjusting learning rate or LoRA rank")
        
        # Performance recommendations
        if metrics.inference_time > 2.0:
            recommendations.append("⚡ Optimize model for faster inference")
            recommendations.append("🔧 Consider using smaller model or quantization")
        
        # Memory recommendations
        if metrics.memory_usage_gb > 20:
            recommendations.append("💾 High memory usage - consider 4-bit quantization")
            recommendations.append("📦 Optimize model size for deployment constraints")
        
        # Grade-specific recommendations
        if grade == PerformanceGrade.F:
            recommendations.append("🚨 CRITICAL: Model performance is unacceptable - immediate retraining required")
        elif grade == PerformanceGrade.D:
            recommendations.append("⚠️ Model performance is poor - schedule retraining soon")
        elif grade == PerformanceGrade.C:
            recommendations.append("📈 Model performance is acceptable but could be improved")
        
        return recommendations
    
    def grade_model(self, 
                   metrics: ModelMetrics, 
                   model_name: str,
                   model_path: str, 
                   adapter_version: str,
                   baseline_metrics: Optional[ModelMetrics] = None) -> PerformanceReport:
        """Generate complete performance report with A-F grade"""
        
        self.logger.info(f"📊 Grading model: {model_name}")
        
        # Calculate weighted score
        weighted_score = self.calculate_weighted_score(metrics)
        
        # Determine grade
        grade = self.determine_grade(weighted_score)
        
        # Generate recommendations
        recommendations = self.generate_recommendations(metrics, grade)
        
        # Compare to baseline if provided
        comparison = None
        if baseline_metrics:
            comparison = self.compare_to_baseline(metrics, baseline_metrics)
        
        # Create performance report
        report = PerformanceReport(
            model_name=model_name,
            model_path=model_path,
            adapter_version=adapter_version,
            evaluation_timestamp=time.time(),
            metrics=metrics,
            grade=grade,
            weighted_score=weighted_score,
            grade_thresholds=self.grading_config["grade_thresholds"],
            recommendations=recommendations,
            comparison_to_baseline=comparison
        )
        
        # Log results
        self.logger.info(f"🎓 Grade: {grade.value} ({weighted_score:.1f}%)")
        self.logger.info(f"📈 Key metrics:")
        self.logger.info(f"  - Domain Accuracy: {metrics.domain_accuracy:.1f}%")
        self.logger.info(f"  - BLEU Score: {metrics.bleu_score:.3f}")
        self.logger.info(f"  - Perplexity: {metrics.perplexity:.1f}")
        self.logger.info(f"  - Inference Time: {metrics.inference_time:.2f}s")
        
        return report
    
    def compare_to_baseline(self, current: ModelMetrics, baseline: ModelMetrics) -> Dict[str, float]:
        """Compare current metrics to baseline"""
        return {
            "domain_accuracy_delta": current.domain_accuracy - baseline.domain_accuracy,
            "bleu_score_delta": current.bleu_score - baseline.bleu_score,
            "rouge_l_delta": current.rouge_l_score - baseline.rouge_l_score,
            "perplexity_delta": baseline.perplexity - current.perplexity,  # Inverted (lower is better)
            "inference_time_delta": baseline.inference_time - current.inference_time,  # Inverted
            "memory_delta": baseline.memory_usage_gb - current.memory_usage_gb  # Inverted
        }
    
    def save_report(self, report: PerformanceReport, output_path: str):
        """Save performance report to JSON file"""
        try:
            # Convert to dictionary for JSON serialization
            report_dict = asdict(report)
            report_dict["grade"] = report.grade.value
            
            with open(output_path, 'w') as f:
                json.dump(report_dict, f, indent=2, default=str)
            
            self.logger.info(f"💾 Report saved to {output_path}")
        except Exception as e:
            self.logger.error(f"❌ Failed to save report: {e}")
    
    def should_retire_model(self, grade: PerformanceGrade) -> bool:
        """Determine if model should be retired based on grade"""
        return grade in [PerformanceGrade.D, PerformanceGrade.F]
    
    def should_retrain_model(self, grade: PerformanceGrade) -> bool:
        """Determine if model should be retrained based on grade"""
        return grade in [PerformanceGrade.C, PerformanceGrade.D, PerformanceGrade.F]

def main():
    """Demo of the performance grading system"""
    grader = PerformanceGrader()
    
    # Example metrics for demonstration
    example_metrics = ModelMetrics(
        domain_accuracy=91.7,
        bleu_score=0.42,
        rouge_l_score=0.38,
        perplexity=18.5,
        inference_time=1.17,
        memory_usage_gb=17.2,
        response_relevance=85.0,
        coherence_score=88.0,
        consistency_score=82.0
    )
    
    # Grade the model
    report = grader.grade_model(
        metrics=example_metrics,
        model_name="Universal-AI-Tools-8B-v1",
        model_path="./mlx-adapters/production",
        adapter_version="comprehensive-production"
    )
    
    # Save report
    grader.save_report(report, "model-performance-report.json")
    
    print(f"\n🎓 Model Grade: {report.grade.value}")
    print(f"📊 Weighted Score: {report.weighted_score:.1f}%")
    print(f"\n💡 Recommendations:")
    for rec in report.recommendations:
        print(f"  {rec}")

if __name__ == "__main__":
    main()