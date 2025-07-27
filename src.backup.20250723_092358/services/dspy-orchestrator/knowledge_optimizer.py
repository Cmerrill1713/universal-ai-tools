import json
import logging
from datetime import datetime
from typing import Any, Dict, List

import numpy as np
from dspy import ChainOfThought, InputField, Module, OutputField, Signature
from dspy.teleprompt import MIPROv2

logger = logging.getLogger(__name__)


class KnowledgeExtractionSignature(Signature):
    """Extract structured knowledge from raw content with context awareness."""

    raw_content = InputField(desc="Raw content to extract knowledge from")
    context = InputField(desc="Additional context for extraction (type, domain, etc.)")
    structured_knowledge = OutputField(desc="Extracted structured knowledge as JSON")
    key_concepts = OutputField(desc="List of key concepts extracted")
    relationships = OutputField(desc="Identified relationships between concepts")
    confidence_score = OutputField(desc="Confidence score for extraction (0-1)")


class KnowledgeSearchSignature(Signature):
    """Intelligent search through knowledge base with semantic understanding."""

    query = InputField(desc="Search query or question")
    search_context = InputField(desc="Context for search (filters, preferences)")
    relevant_items = OutputField(desc="List of relevant knowledge items with scores")
    search_strategy = OutputField(desc="Strategy used for search")
    confidence = OutputField(desc="Search confidence score (0-1)")


class KnowledgeEvolutionSignature(Signature):
    """Evolve and merge knowledge based on new information."""

    existing_knowledge = InputField(desc="Current knowledge state")
    new_information = InputField(desc="New information to integrate")
    evolution_context = InputField(desc="Context for evolution (source, reliability)")
    evolved_knowledge = OutputField(desc="Updated knowledge after evolution")
    changes_summary = OutputField(desc="Summary of changes made")
    evolution_confidence = OutputField(desc="Confidence in evolution (0-1)")


class KnowledgeValidationSignature(Signature):
    """Validate knowledge for consistency and accuracy."""

    knowledge_item = InputField(desc="Knowledge item to validate")
    validation_context = InputField(desc="Context for validation (domain rules, constraints)")
    is_valid = OutputField(desc="Boolean indicating validity")
    validation_issues = OutputField(desc="List of validation issues found")
    improvement_suggestions = OutputField(desc="Suggestions for improvement")
    validation_score = OutputField(desc="Validation score (0-1)")


class OptimizedKnowledgeExtractor(Module):
    """MIPROv2-optimized knowledge extraction module."""

    def __init__(self):
        super().__init__()
        self.extract = ChainOfThought(KnowledgeExtractionSignature)
        self.performance_history = []

    def forward(self, raw_content: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Extract knowledge with performance tracking."""
        start_time = datetime.now()

        try:
            result = self.extract(raw_content=raw_content, context=json.dumps(context))

            # Parse structured knowledge
            try:
                structured_data = json.loads(result.structured_knowledge)
            except:
                structured_data = {"raw": result.structured_knowledge}

            # Parse lists
            key_concepts = self._parse_list(result.key_concepts)
            relationships = self._parse_list(result.relationships)

            extraction_result = {
                "structured_knowledge": structured_data,
                "key_concepts": key_concepts,
                "relationships": relationships,
                "confidence": float(result.confidence_score),
                "extraction_time": (datetime.now() - start_time).total_seconds(),
            }

            # Track performance
            self._track_performance(extraction_result)

            return extraction_result

        except Exception as e:
            logger.error(f"Knowledge extraction failed: {e}")
            return {
                "structured_knowledge": {},
                "key_concepts": [],
                "relationships": [],
                "confidence": 0.0,
                "error": str(e),
            }

    def _parse_list(self, text: str) -> List[str]:
        """Parse a text representation of a list."""
        if not text:
            return []
        # Handle various list formats
        text = text.strip()
        if text.startswith("[") and text.endswith("]"):
            try:
                return json.loads(text)
            except:
                pass
        # Parse comma or newline separated
        items = [item.strip() for item in text.replace("\n", ",").split(",")]
        return [item for item in items if item]

    def _track_performance(self, result: Dict[str, Any]):
        """Track extraction performance for optimization."""
        self.performance_history.append(
            {
                "timestamp": datetime.now().isoformat(),
                "confidence": result["confidence"],
                "extraction_time": result["extraction_time"],
                "concepts_count": len(result["key_concepts"]),
                "relationships_count": len(result["relationships"]),
            }
        )

        # Keep only recent history
        if len(self.performance_history) > 100:
            self.performance_history = self.performance_history[-100:]


class OptimizedKnowledgeSearcher(Module):
    """MIPROv2-optimized knowledge search module."""

    def __init__(self):
        super().__init__()
        self.search = ChainOfThought(KnowledgeSearchSignature)
        self.search_metrics = {
            "total_searches": 0,
            "average_confidence": 0.0,
            "successful_searches": 0,
        }

    def forward(self, query: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Search knowledge with semantic understanding."""
        self.search_metrics["total_searches"] += 1

        try:
            result = self.search(query=query, search_context=json.dumps(context))

            # Parse relevant items
            try:
                relevant_items = json.loads(result.relevant_items)
            except:
                relevant_items = []

            confidence = float(result.confidence)

            # Update metrics
            if confidence > 0.7:
                self.search_metrics["successful_searches"] += 1

            # Update rolling average confidence
            n = self.search_metrics["total_searches"]
            avg = self.search_metrics["average_confidence"]
            self.search_metrics["average_confidence"] = (avg * (n - 1) + confidence) / n

            return {
                "relevant_items": relevant_items,
                "search_strategy": result.search_strategy,
                "confidence": confidence,
                "metrics": self.search_metrics.copy(),
            }

        except Exception as e:
            logger.error(f"Knowledge search failed: {e}")
            return {
                "relevant_items": [],
                "search_strategy": "fallback",
                "confidence": 0.0,
                "error": str(e),
            }


class OptimizedKnowledgeEvolver(Module):
    """MIPROv2-optimized knowledge evolution module."""

    def __init__(self):
        super().__init__()
        self.evolve = ChainOfThought(KnowledgeEvolutionSignature)
        self.evolution_history = []

    def forward(
        self, existing: Dict[str, Any], new_info: Dict[str, Any], context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Evolve knowledge with new information."""
        context = context or {}

        try:
            result = self.evolve(
                existing_knowledge=json.dumps(existing),
                new_information=json.dumps(new_info),
                evolution_context=json.dumps(context),
            )

            # Parse evolved knowledge
            try:
                evolved_knowledge = json.loads(result.evolved_knowledge)
            except:
                evolved_knowledge = existing  # Fallback to existing if parsing fails

            evolution_result = {
                "evolved_knowledge": evolved_knowledge,
                "changes_summary": result.changes_summary,
                "confidence": float(result.evolution_confidence),
                "timestamp": datetime.now().isoformat(),
            }

            # Track evolution history
            self._track_evolution(evolution_result)

            return evolution_result

        except Exception as e:
            logger.error(f"Knowledge evolution failed: {e}")
            return {
                "evolved_knowledge": existing,
                "changes_summary": "Evolution failed",
                "confidence": 0.0,
                "error": str(e),
            }

    def _track_evolution(self, result: Dict[str, Any]):
        """Track evolution history for pattern learning."""
        self.evolution_history.append(
            {
                "timestamp": result["timestamp"],
                "confidence": result["confidence"],
                "changes": result["changes_summary"],
            }
        )

        # Keep limited history
        if len(self.evolution_history) > 50:
            self.evolution_history = self.evolution_history[-50:]


class OptimizedKnowledgeValidator(Module):
    """MIPROv2-optimized knowledge validation module."""

    def __init__(self):
        super().__init__()
        self.validate = ChainOfThought(KnowledgeValidationSignature)
        self.validation_stats = {"total_validations": 0, "valid_items": 0, "average_score": 0.0}

    def forward(self, knowledge: Dict[str, Any], context: Dict[str, Any] = None) -> Dict[str, Any]:
        """Validate knowledge item."""
        context = context or {}
        self.validation_stats["total_validations"] += 1

        try:
            result = self.validate(
                knowledge_item=json.dumps(knowledge), validation_context=json.dumps(context)
            )

            # Parse validation results
            is_valid = result.is_valid.lower() == "true"
            validation_score = float(result.validation_score)

            # Parse issues and suggestions
            issues = self._parse_list(result.validation_issues)
            suggestions = self._parse_list(result.improvement_suggestions)

            # Update stats
            if is_valid:
                self.validation_stats["valid_items"] += 1

            # Update average score
            n = self.validation_stats["total_validations"]
            avg = self.validation_stats["average_score"]
            self.validation_stats["average_score"] = (avg * (n - 1) + validation_score) / n

            return {
                "is_valid": is_valid,
                "validation_score": validation_score,
                "issues": issues,
                "suggestions": suggestions,
                "stats": self.validation_stats.copy(),
            }

        except Exception as e:
            logger.error(f"Knowledge validation failed: {e}")
            return {
                "is_valid": False,
                "validation_score": 0.0,
                "issues": ["Validation error occurred"],
                "suggestions": [],
                "error": str(e),
            }

    def _parse_list(self, text: str) -> List[str]:
        """Parse text representation of a list."""
        if not text:
            return []
        text = text.strip()
        if text.startswith("[") and text.endswith("]"):
            try:
                return json.loads(text)
            except:
                pass
        items = [item.strip() for item in text.replace("\n", ",").split(",")]
        return [item for item in items if item]


class KnowledgeOptimizer:
    """Main optimizer class using MIPROv2 for continuous improvement."""

    def __init__(self, metric_fn=None):
        self.extractor = OptimizedKnowledgeExtractor()
        self.searcher = OptimizedKnowledgeSearcher()
        self.evolver = OptimizedKnowledgeEvolver()
        self.validator = OptimizedKnowledgeValidator()

        # Default metric function
        self.metric_fn = metric_fn or self._default_metric

        # Performance tracking
        self.optimization_history = []
        self.best_performance = 0.0

    def optimize_with_examples(
        self, examples: List[Dict[str, Any]], num_iterations: int = 10
    ) -> Dict[str, Any]:
        """Optimize modules using MIPROv2 with provided examples."""

        # Initialize MIPROv2 optimizer
        optimizer = MIPROv2(
            metric=self.metric_fn,
            num_iterations=num_iterations,
            temperature_range=(0.7, 1.0),
            depth_range=(1, 3),
        )

        # Prepare training data
        trainset = self._prepare_training_data(examples)

        # Optimize each module
        optimization_results = {}

        try:
            # Optimize extractor
            logger.info("Optimizing knowledge extractor...")
            optimized_extractor = optimizer.compile(
                self.extractor, trainset=trainset.get("extraction", [])
            )
            self.extractor = optimized_extractor
            optimization_results["extractor"] = "optimized"

            # Optimize searcher
            logger.info("Optimizing knowledge searcher...")
            optimized_searcher = optimizer.compile(
                self.searcher, trainset=trainset.get("search", [])
            )
            self.searcher = optimized_searcher
            optimization_results["searcher"] = "optimized"

            # Optimize evolver
            logger.info("Optimizing knowledge evolver...")
            optimized_evolver = optimizer.compile(
                self.evolver, trainset=trainset.get("evolution", [])
            )
            self.evolver = optimized_evolver
            optimization_results["evolver"] = "optimized"

            # Optimize validator
            logger.info("Optimizing knowledge validator...")
            optimized_validator = optimizer.compile(
                self.validator, trainset=trainset.get("validation", [])
            )
            self.validator = optimized_validator
            optimization_results["validator"] = "optimized"

            # Track optimization
            self._track_optimization(optimization_results)

            return {
                "success": True,
                "results": optimization_results,
                "performance_improvement": self._calculate_improvement(),
            }

        except Exception as e:
            logger.error(f"Optimization failed: {e}")
            return {"success": False, "error": str(e), "results": optimization_results}

    def _prepare_training_data(self, examples: List[Dict[str, Any]]) -> Dict[str, List]:
        """Prepare training data for different modules."""
        trainset = {"extraction": [], "search": [], "evolution": [], "validation": []}

        for example in examples:
            if "raw_content" in example:
                trainset["extraction"].append(example)
            if "query" in example:
                trainset["search"].append(example)
            if "existing_knowledge" in example:
                trainset["evolution"].append(example)
            if "knowledge_item" in example:
                trainset["validation"].append(example)

        return trainset

    def _default_metric(self, example, prediction, trace=None) -> float:
        """Default metric function for optimization."""
        # Simple confidence-based metric
        confidence_scores = []

        if hasattr(prediction, "confidence"):
            confidence_scores.append(float(prediction.confidence))
        if hasattr(prediction, "confidence_score"):
            confidence_scores.append(float(prediction.confidence_score))
        if hasattr(prediction, "validation_score"):
            confidence_scores.append(float(prediction.validation_score))
        if hasattr(prediction, "evolution_confidence"):
            confidence_scores.append(float(prediction.evolution_confidence))

        if confidence_scores:
            return np.mean(confidence_scores)
        return 0.5  # Default middle score

    def _track_optimization(self, results: Dict[str, Any]):
        """Track optimization history."""
        self.optimization_history.append(
            {
                "timestamp": datetime.now().isoformat(),
                "results": results,
                "extractor_metrics": (
                    self.extractor.performance_history[-1]
                    if self.extractor.performance_history
                    else {}
                ),
                "searcher_metrics": self.searcher.search_metrics.copy(),
                "validator_stats": self.validator.validation_stats.copy(),
            }
        )

    def _calculate_improvement(self) -> float:
        """Calculate performance improvement from optimization."""
        if not self.optimization_history:
            return 0.0

        # Simple improvement calculation based on metrics
        current_metrics = self.optimization_history[-1]

        # Calculate composite score
        scores = []

        if (
            "extractor_metrics" in current_metrics
            and "confidence" in current_metrics["extractor_metrics"]
        ):
            scores.append(current_metrics["extractor_metrics"]["confidence"])

        if (
            "searcher_metrics" in current_metrics
            and "average_confidence" in current_metrics["searcher_metrics"]
        ):
            scores.append(current_metrics["searcher_metrics"]["average_confidence"])

        if (
            "validator_stats" in current_metrics
            and "average_score" in current_metrics["validator_stats"]
        ):
            scores.append(current_metrics["validator_stats"]["average_score"])

        if scores:
            current_performance = np.mean(scores)
            improvement = current_performance - self.best_performance
            if current_performance > self.best_performance:
                self.best_performance = current_performance
            return improvement

        return 0.0

    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get current performance metrics."""
        return {
            "extractor": {
                "history_length": len(self.extractor.performance_history),
                "latest": (
                    self.extractor.performance_history[-1]
                    if self.extractor.performance_history
                    else None
                ),
            },
            "searcher": self.searcher.search_metrics.copy(),
            "evolver": {
                "history_length": len(self.evolver.evolution_history),
                "latest": (
                    self.evolver.evolution_history[-1] if self.evolver.evolution_history else None
                ),
            },
            "validator": self.validator.validation_stats.copy(),
            "best_performance": self.best_performance,
            "optimization_count": len(self.optimization_history),
        }


# Create global optimizer instance
knowledge_optimizer = KnowledgeOptimizer()
