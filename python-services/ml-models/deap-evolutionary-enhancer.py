#!/usr/bin/env python3
"""
DEAP Evolutionary Training Data Enhancement System
Uses genetic algorithms to evolve and optimize training data for Universal AI Tools MLX fine-tuning
"""

import json
import logging
import numpy as np
from typing import List, Dict, Tuple, Any, Optional
from dataclasses import dataclass
from pathlib import Path
import random
from deap import base, creator, tools, algorithms
import requests
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('deap_evolutionary_enhancer.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class TrainingExample:
    """Enhanced training example with metadata"""
    instruction: str
    response: str
    domain: str = "general"
    complexity: int = 1  # 1-5 scale
    quality_score: float = 0.0
    parent_examples: List[int] = None
    generation: int = 0
    
    def __post_init__(self):
        if self.parent_examples is None:
            self.parent_examples = []

@dataclass
class EvolutionResult:
    """Results from evolutionary enhancement"""
    enhanced_dataset: List[TrainingExample]
    generation_stats: List[Dict[str, Any]]
    best_fitness_trajectory: List[float]
    diversity_scores: List[float]
    final_fitness: float

class UniversalAIToolsKnowledgeBase:
    """Knowledge base for generating domain-specific training data"""
    
    def __init__(self):
        self.knowledge_domains = self._build_knowledge_base()
        
    def _build_knowledge_base(self) -> Dict[str, Dict[str, List[str]]]:
        """Build comprehensive knowledge base for Universal AI Tools"""
        return {
            "architecture": {
                "concepts": [
                    "hybrid architecture", "microservices", "rust services", "go api gateway",
                    "swift macos app", "distributed system", "service mesh", "containerization"
                ],
                "details": [
                    "Universal AI Tools uses a hybrid architecture with Rust for performance-critical services",
                    "Go handles concurrent network operations and API gateway functionality", 
                    "Swift provides native macOS and iOS client applications",
                    "The system implements distributed tracing with OpenTelemetry",
                    "Services communicate through event-driven messaging patterns"
                ]
            },
            "development": {
                "concepts": [
                    "development server", "hot reload", "debugging", "testing", "deployment",
                    "npm scripts", "go build", "rust cargo", "swift xcode"
                ],
                "details": [
                    "Start development with 'npm run dev:local' for Go API gateway on port 8082",
                    "Rust services are built with 'cargo build --release' for optimal performance",
                    "Swift development uses Xcode with SwiftUI previews for hot reload",
                    "The system includes comprehensive test suites for all language components",
                    "Production deployment uses automated blue-green deployment scripts"
                ]
            },
            "performance": {
                "concepts": [
                    "memory optimization", "performance monitoring", "caching", "load balancing",
                    "connection pooling", "async operations", "garbage collection"
                ],
                "details": [
                    "Memory optimization system reduces usage by 60% through intelligent monitoring",
                    "4-level memory pressure detection with automatic optimization strategies",
                    "Real-time performance metrics collected via Prometheus and Grafana",
                    "Connection pooling and HTTP pipelining optimize network performance",
                    "Async/await patterns ensure non-blocking operations across services"
                ]
            },
            "ai_features": {
                "concepts": [
                    "local ai", "ollama integration", "mlx optimization", "fine-tuning",
                    "voice recognition", "speech synthesis", "offline operation"
                ],
                "details": [
                    "MLX framework provides Apple Silicon optimized AI inference",
                    "Ollama enables local LLM execution without cloud dependencies",
                    "Fine-tuning uses LoRA (Low-Rank Adaptation) for efficient model customization",
                    "Voice features include speech-to-text and text-to-speech capabilities",
                    "The system operates fully offline for privacy and security"
                ]
            },
            "deployment": {
                "concepts": [
                    "production deployment", "docker containerization", "monitoring setup",
                    "health checks", "ssl configuration", "backup procedures"
                ],
                "details": [
                    "Production deployment uses ./scripts/production-deployment.sh for automation",
                    "Blue-green deployment ensures zero-downtime updates",
                    "Docker containers provide consistent environment across platforms",
                    "Comprehensive health monitoring with automatic service recovery",
                    "SSL certificates are managed through automated scripts"
                ]
            },
            "troubleshooting": {
                "concepts": [
                    "debugging", "log analysis", "error handling", "performance profiling",
                    "service recovery", "diagnostic tools", "monitoring alerts"
                ],
                "details": [
                    "Multi-language debugging with LLDB for Rust/Swift and Delve for Go",
                    "Distributed tracing helps identify bottlenecks across services",
                    "Automated error recovery through evolutionary healing mechanisms",
                    "Performance profiling tools identify optimization opportunities",
                    "Comprehensive logging with structured JSON output for analysis"
                ]
            }
        }
    
    def get_domain_concepts(self, domain: str) -> List[str]:
        """Get concepts for a specific domain"""
        return self.knowledge_domains.get(domain, {}).get("concepts", [])
    
    def get_domain_details(self, domain: str) -> List[str]:
        """Get detailed information for a specific domain"""
        return self.knowledge_domains.get(domain, {}).get("details", [])
    
    def get_all_domains(self) -> List[str]:
        """Get all available knowledge domains"""
        return list(self.knowledge_domains.keys())

class MLXServiceEvaluator:
    """Evaluates training examples using MLX service"""
    
    def __init__(self, base_url: str = "http://localhost:8005"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.timeout = 10
        
        # Use optimized prompt format from MIPRO2 results
        self.optimal_prompt_template = "You are an expert on Universal AI Tools. {question}"
    
    def evaluate_response_quality(self, instruction: str, expected_response: str) -> float:
        """Evaluate quality of a training example by testing response"""
        try:
            prompt = self.optimal_prompt_template.format(question=instruction)
            
            response = self.session.post(
                f"{self.base_url}/v1/chat/completions",
                json={
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 80,
                    "stream": False
                }
            )
            
            if response.status_code == 200:
                result = response.json()
                actual_response = result.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                
                # Calculate quality based on multiple factors
                quality_score = 0.0
                
                # 1. Response relevance (keyword overlap)
                expected_words = set(expected_response.lower().split())
                actual_words = set(actual_response.lower().split())
                if expected_words:
                    overlap = len(expected_words.intersection(actual_words))
                    quality_score += (overlap / len(expected_words)) * 0.4
                
                # 2. Response length appropriateness
                length_ratio = min(len(actual_response), len(expected_response)) / max(len(actual_response), len(expected_response))
                quality_score += length_ratio * 0.2
                
                # 3. Domain-specific terms presence
                domain_terms = ["universal ai tools", "rust", "go", "swift", "architecture", "performance", "ai", "service"]
                domain_score = sum(1 for term in domain_terms if term in actual_response.lower()) / len(domain_terms)
                quality_score += domain_score * 0.2
                
                # 4. Response coherence (no repetition, proper structure)
                coherence_score = 0.2  # Base score
                if len(set(actual_response.split())) / len(actual_response.split()) > 0.7:  # Low repetition
                    coherence_score = 0.2
                quality_score += coherence_score
                
                return min(1.0, quality_score)
            
        except Exception as e:
            logger.warning(f"Error evaluating response quality: {e}")
            return 0.0
        
        return 0.0

class DEAPTrainingDataEvolver:
    """DEAP-based evolutionary algorithm for training data enhancement"""
    
    def __init__(self, knowledge_base: UniversalAIToolsKnowledgeBase, evaluator: MLXServiceEvaluator):
        self.knowledge_base = knowledge_base
        self.evaluator = evaluator
        self.generation_count = 0
        
        # DEAP setup
        creator.create("FitnessMax", base.Fitness, weights=(1.0,))  # Maximize fitness
        creator.create("Individual", list, fitness=creator.FitnessMax)
        
        self.toolbox = base.Toolbox()
        
        # Evolution parameters
        self.population_size = 20
        self.num_generations = 8
        self.mutation_rate = 0.3
        self.crossover_rate = 0.7
        self.elite_size = 3
        
        # Training data templates for evolution
        self.question_templates = [
            "What is {concept}?",
            "How does {concept} work?", 
            "Explain {concept} in Universal AI Tools",
            "What are the key features of {concept}?",
            "How do you use {concept}?",
            "What are the benefits of {concept}?",
            "When should you use {concept}?",
            "How do you configure {concept}?",
            "What problems does {concept} solve?",
            "How does {concept} improve performance?"
        ]
    
    def create_individual(self) -> List[TrainingExample]:
        """Create a random individual (training dataset)"""
        individual_size = random.randint(15, 25)  # Variable dataset size
        examples = []
        
        for _ in range(individual_size):
            domain = random.choice(self.knowledge_base.get_all_domains())
            concepts = self.knowledge_base.get_domain_concepts(domain)
            details = self.knowledge_base.get_domain_details(domain)
            
            if concepts and details:
                concept = random.choice(concepts)
                template = random.choice(self.question_templates)
                detail = random.choice(details)
                
                instruction = template.format(concept=concept)
                response = detail
                
                example = TrainingExample(
                    instruction=instruction,
                    response=response,
                    domain=domain,
                    complexity=random.randint(1, 5),
                    generation=self.generation_count
                )
                examples.append(example)
        
        return examples
    
    def evaluate_individual(self, individual: List[TrainingExample]) -> Tuple[float,]:
        """Evaluate fitness of an individual training dataset"""
        if not individual:
            return (0.0,)
        
        fitness_scores = []
        
        # Sample evaluation on subset for speed
        sample_size = min(5, len(individual))
        sample_examples = random.sample(individual, sample_size)
        
        for example in sample_examples:
            # Quality score from MLX service evaluation
            quality_score = self.evaluator.evaluate_response_quality(
                example.instruction, example.response
            )
            
            # Diversity bonus (favor varied domains and complexity)
            domain_diversity = len(set(ex.domain for ex in individual)) / len(set(self.knowledge_base.get_all_domains()))
            complexity_variety = len(set(ex.complexity for ex in individual)) / 5.0  # 1-5 scale
            
            # Length appropriateness (not too short, not too long)
            length_score = 1.0
            if len(example.response) < 20:
                length_score *= 0.5
            elif len(example.response) > 500:
                length_score *= 0.7
            
            example_fitness = quality_score * 0.6 + domain_diversity * 0.2 + complexity_variety * 0.1 + length_score * 0.1
            fitness_scores.append(example_fitness)
        
        # Dataset size bonus (encourage comprehensive datasets)
        size_bonus = min(1.0, len(individual) / 25.0) * 0.1
        
        overall_fitness = np.mean(fitness_scores) + size_bonus
        return (overall_fitness,)
    
    def mutate_individual(self, individual: List[TrainingExample]) -> Tuple[List[TrainingExample],]:
        """Mutate an individual by modifying examples"""
        mutated = individual.copy()
        
        for i, example in enumerate(mutated):
            if random.random() < self.mutation_rate:
                # Different mutation strategies
                mutation_type = random.choice(["modify_response", "change_domain", "rephrase_question"])
                
                if mutation_type == "modify_response":
                    # Use a different detail from the same domain
                    details = self.knowledge_base.get_domain_details(example.domain)
                    if details:
                        mutated[i] = TrainingExample(
                            instruction=example.instruction,
                            response=random.choice(details),
                            domain=example.domain,
                            complexity=example.complexity,
                            parent_examples=[i],
                            generation=self.generation_count
                        )
                
                elif mutation_type == "change_domain":
                    # Move to related domain
                    new_domain = random.choice(self.knowledge_base.get_all_domains())
                    concepts = self.knowledge_base.get_domain_concepts(new_domain)
                    details = self.knowledge_base.get_domain_details(new_domain)
                    
                    if concepts and details:
                        concept = random.choice(concepts)
                        template = random.choice(self.question_templates)
                        
                        mutated[i] = TrainingExample(
                            instruction=template.format(concept=concept),
                            response=random.choice(details),
                            domain=new_domain,
                            complexity=example.complexity,
                            parent_examples=[i],
                            generation=self.generation_count
                        )
                
                elif mutation_type == "rephrase_question":
                    # Use different template for same concept
                    # Extract concept from current instruction (simple heuristic)
                    for domain in self.knowledge_base.get_all_domains():
                        concepts = self.knowledge_base.get_domain_concepts(domain)
                        for concept in concepts:
                            if concept in example.instruction.lower():
                                new_template = random.choice(self.question_templates)
                                mutated[i] = TrainingExample(
                                    instruction=new_template.format(concept=concept),
                                    response=example.response,
                                    domain=example.domain,
                                    complexity=example.complexity,
                                    parent_examples=[i],
                                    generation=self.generation_count
                                )
                                break
        
        return (mutated,)
    
    def crossover_individuals(self, ind1: List[TrainingExample], ind2: List[TrainingExample]) -> Tuple[List[TrainingExample], List[TrainingExample]]:
        """Crossover two individuals by mixing their examples"""
        if len(ind1) < 2 or len(ind2) < 2:
            return ind1, ind2
        
        # Single point crossover
        cut1 = random.randint(1, len(ind1) - 1)
        cut2 = random.randint(1, len(ind2) - 1)
        
        child1 = ind1[:cut1] + ind2[cut2:]
        child2 = ind2[:cut2] + ind1[cut1:]
        
        # Update generation info
        for example in child1:
            example.generation = self.generation_count
        for example in child2:
            example.generation = self.generation_count
        
        return child1, child2
    
    def evolve_training_data(self, initial_dataset: Optional[List[TrainingExample]] = None) -> EvolutionResult:
        """Main evolution loop"""
        logger.info("🧬 Starting DEAP evolutionary training data enhancement...")
        
        # Setup DEAP toolbox
        self.toolbox.register("individual", self.create_individual)
        self.toolbox.register("population", tools.initRepeat, list, self.toolbox.individual)
        self.toolbox.register("evaluate", self.evaluate_individual)
        self.toolbox.register("mate", self.crossover_individuals)
        self.toolbox.register("mutate", self.mutate_individual)
        self.toolbox.register("select", tools.selTournament, tournsize=3)
        
        # Initialize population
        if initial_dataset:
            # Seed population with existing data
            pop = [initial_dataset] + [self.create_individual() for _ in range(self.population_size - 1)]
        else:
            pop = self.toolbox.population(n=self.population_size)
        
        # Statistics tracking
        stats = tools.Statistics(lambda ind: ind.fitness.values)
        stats.register("avg", np.mean)
        stats.register("max", np.max)
        stats.register("min", np.min)
        stats.register("std", np.std)
        
        # Evolution tracking
        generation_stats = []
        best_fitness_trajectory = []
        diversity_scores = []
        
        # Evaluate initial population
        logger.info("Evaluating initial population...")
        fitnesses = []
        
        # Batch evaluation for efficiency
        with ThreadPoolExecutor(max_workers=4) as executor:
            fitness_futures = {executor.submit(self.evaluate_individual, ind): ind for ind in pop}
            
            for future in as_completed(fitness_futures):
                ind = fitness_futures[future]
                try:
                    fitness = future.result()
                    fitnesses.append(fitness)
                    ind.fitness.values = fitness
                except Exception as e:
                    logger.error(f"Error evaluating individual: {e}")
                    fitnesses.append((0.0,))
                    ind.fitness.values = (0.0,)
        
        # Evolution loop
        for generation in range(self.num_generations):
            self.generation_count = generation
            logger.info(f"\n=== Generation {generation + 1}/{self.num_generations} ===")
            
            # Selection and breeding
            offspring = algorithms.varAnd(pop, self.toolbox, self.crossover_rate, self.mutation_rate)
            
            # Evaluate offspring
            logger.info(f"Evaluating {len(offspring)} offspring...")
            with ThreadPoolExecutor(max_workers=4) as executor:
                fitness_futures = {executor.submit(self.evaluate_individual, ind): ind for ind in offspring if not ind.fitness.valid}
                
                for future in as_completed(fitness_futures):
                    ind = fitness_futures[future]
                    try:
                        fitness = future.result()
                        ind.fitness.values = fitness
                    except Exception as e:
                        logger.error(f"Error evaluating offspring: {e}")
                        ind.fitness.values = (0.0,)
            
            # Select next generation
            pop = tools.selBest(pop + offspring, self.population_size)
            
            # Calculate statistics
            fits = [ind.fitness.values[0] for ind in pop]
            generation_stat = {
                'generation': generation,
                'avg_fitness': np.mean(fits),
                'max_fitness': np.max(fits),
                'min_fitness': np.min(fits),
                'std_fitness': np.std(fits),
                'population_size': len(pop)
            }
            generation_stats.append(generation_stat)
            best_fitness_trajectory.append(np.max(fits))
            
            # Calculate diversity (unique instruction count across population)
            all_instructions = set()
            for ind in pop:
                all_instructions.update(ex.instruction for ex in ind)
            diversity = len(all_instructions) / sum(len(ind) for ind in pop) if pop else 0
            diversity_scores.append(diversity)
            
            logger.info(f"Generation {generation + 1} stats:")
            logger.info(f"  Avg fitness: {generation_stat['avg_fitness']:.3f}")
            logger.info(f"  Max fitness: {generation_stat['max_fitness']:.3f}")
            logger.info(f"  Diversity: {diversity:.3f}")
        
        # Get best individual
        best_individual = tools.selBest(pop, 1)[0]
        final_fitness = best_individual.fitness.values[0]
        
        logger.info(f"\n🏆 Evolution Complete!")
        logger.info(f"Final best fitness: {final_fitness:.3f}")
        logger.info(f"Best dataset size: {len(best_individual)}")
        logger.info(f"Domain coverage: {len(set(ex.domain for ex in best_individual))} domains")
        
        return EvolutionResult(
            enhanced_dataset=best_individual,
            generation_stats=generation_stats,
            best_fitness_trajectory=best_fitness_trajectory,
            diversity_scores=diversity_scores,
            final_fitness=final_fitness
        )

def load_existing_training_data() -> List[TrainingExample]:
    """Load existing training data as seed population"""
    examples = []
    train_file = Path("mlx-lora-training/train.jsonl")
    
    if train_file.exists():
        with open(train_file, 'r') as f:
            for line_num, line in enumerate(f):
                try:
                    data = json.loads(line.strip())
                    prompt_text = data.get("prompt", "")
                    
                    # Extract instruction
                    if "Instruction:" in prompt_text and "Response:" in prompt_text:
                        instruction = prompt_text.split("Instruction:")[1].split("Response:")[0].strip()
                        response = data.get("completion", "").strip()
                        
                        if instruction and response:
                            example = TrainingExample(
                                instruction=instruction,
                                response=response,
                                domain="existing",
                                complexity=3,
                                generation=0
                            )
                            examples.append(example)
                except Exception as e:
                    logger.warning(f"Error parsing training example {line_num}: {e}")
    
    logger.info(f"Loaded {len(examples)} existing training examples")
    return examples

def save_enhanced_dataset(result: EvolutionResult, output_file: str = "enhanced_training_dataset.jsonl"):
    """Save enhanced dataset in MLX training format"""
    with open(output_file, 'w') as f:
        for example in result.enhanced_dataset:
            training_record = {
                "prompt": f"Instruction: {example.instruction}\nResponse:",
                "completion": example.response
            }
            f.write(json.dumps(training_record) + "\n")
    
    logger.info(f"Enhanced dataset saved to {output_file}")
    
    # Save metadata
    metadata_file = output_file.replace('.jsonl', '_metadata.json')
    with open(metadata_file, 'w') as f:
        json.dump({
            'total_examples': len(result.enhanced_dataset),
            'final_fitness': result.final_fitness,
            'generation_stats': result.generation_stats,
            'best_fitness_trajectory': result.best_fitness_trajectory,
            'diversity_scores': result.diversity_scores,
            'domain_distribution': {domain: sum(1 for ex in result.enhanced_dataset if ex.domain == domain) 
                                  for domain in set(ex.domain for ex in result.enhanced_dataset)},
            'complexity_distribution': {str(complexity): sum(1 for ex in result.enhanced_dataset if ex.complexity == complexity)
                                      for complexity in range(1, 6)},
            'evolution_timestamp': time.time()
        }, f, indent=2)
    
    logger.info(f"Enhancement metadata saved to {metadata_file}")

def main():
    """Main execution function"""
    logger.info("🧬 Starting DEAP Evolutionary Training Data Enhancement System")
    
    try:
        # Initialize components
        knowledge_base = UniversalAIToolsKnowledgeBase()
        evaluator = MLXServiceEvaluator()
        evolver = DEAPTrainingDataEvolver(knowledge_base, evaluator)
        
        # Load existing training data as seed
        existing_data = load_existing_training_data()
        
        # Run evolution
        result = evolver.evolve_training_data(initial_dataset=existing_data if existing_data else None)
        
        # Save results
        save_enhanced_dataset(result)
        
        # Display results
        print(f"\n{'='*70}")
        print("🧬 DEAP EVOLUTIONARY ENHANCEMENT RESULTS")
        print(f"{'='*70}")
        print(f"🎯 Final Fitness: {result.final_fitness:.3f}")
        print(f"📊 Enhanced Dataset Size: {len(result.enhanced_dataset)} examples")
        print(f"🌍 Domain Coverage: {len(set(ex.domain for ex in result.enhanced_dataset))} domains")
        print(f"🔄 Evolution Generations: {len(result.generation_stats)}")
        print(f"📈 Fitness Improvement: {result.best_fitness_trajectory[0]:.3f} → {result.best_fitness_trajectory[-1]:.3f}")
        print(f"🎲 Final Diversity Score: {result.diversity_scores[-1]:.3f}")
        
        print(f"\n📋 Domain Distribution:")
        domain_dist = {}
        for ex in result.enhanced_dataset:
            domain_dist[ex.domain] = domain_dist.get(ex.domain, 0) + 1
        
        for domain, count in sorted(domain_dist.items()):
            print(f"  {domain}: {count} examples ({count/len(result.enhanced_dataset)*100:.1f}%)")
        
        print(f"{'='*70}")
        
        if result.final_fitness > 0.6:
            print("🚀 Excellent evolution! Dataset significantly enhanced!")
        elif result.final_fitness > 0.4:
            print("✅ Good progress! Enhanced dataset ready for training!")
        else:
            print("⚠️ Consider additional evolution cycles or parameter tuning")
            
        print(f"\n📁 Files created:")
        print(f"  - enhanced_training_dataset.jsonl")
        print(f"  - enhanced_training_dataset_metadata.json")
        print(f"  - deap_evolutionary_enhancer.log")
            
    except Exception as e:
        logger.error(f"Evolution failed: {e}", exc_info=True)
        raise

if __name__ == "__main__":
    main()