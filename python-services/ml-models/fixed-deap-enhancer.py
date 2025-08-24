#!/usr/bin/env python3
"""
Fixed DEAP Evolutionary Training Data Enhancement System
Uses genetic algorithms to evolve and optimize training data for Universal AI Tools MLX fine-tuning
"""

import json
import logging
import numpy as np
from typing import List, Dict, Tuple, Any, Optional
from dataclasses import dataclass, asdict
from pathlib import Path
import random
from deap import base, creator, tools, algorithms
import requests
import time

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('fixed_deap_enhancer.log'),
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
    generation: int = 0

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
                    "Universal AI Tools uses a hybrid architecture with Rust for performance-critical services like LLM routing and ML inference",
                    "Go handles concurrent network operations, WebSocket connections, and API gateway functionality with excellent performance", 
                    "Swift provides native macOS and iOS client applications with SwiftUI for modern user interfaces",
                    "The system implements distributed tracing with OpenTelemetry for comprehensive monitoring across all services",
                    "Services communicate through event-driven messaging patterns with automatic failure recovery"
                ]
            },
            "development": {
                "concepts": [
                    "development server", "hot reload", "debugging", "testing", "deployment",
                    "npm scripts", "go build", "rust cargo", "swift xcode"
                ],
                "details": [
                    "Start development with 'npm run dev:local' to launch the Go API gateway on port 8082",
                    "Rust services are built with 'cargo build --release' for optimal performance and memory safety",
                    "Swift development uses Xcode with SwiftUI previews for instant hot reload during UI development",
                    "The system includes comprehensive test suites covering unit, integration, and end-to-end testing",
                    "Production deployment uses automated blue-green deployment scripts with zero-downtime updates"
                ]
            },
            "performance": {
                "concepts": [
                    "memory optimization", "performance monitoring", "caching", "load balancing",
                    "connection pooling", "async operations", "garbage collection"
                ],
                "details": [
                    "Memory optimization system reduces usage by 60% through intelligent 4-level pressure detection",
                    "Real-time performance metrics are collected via Prometheus and visualized in Grafana dashboards",
                    "Connection pooling and HTTP pipelining optimize network performance across distributed services",
                    "Async/await patterns ensure non-blocking operations throughout the Go and Rust service layers",
                    "Automatic garbage collection optimization prevents memory leaks and maintains system stability"
                ]
            },
            "ai_features": {
                "concepts": [
                    "local ai", "ollama integration", "mlx optimization", "fine-tuning",
                    "voice recognition", "speech synthesis", "offline operation"
                ],
                "details": [
                    "MLX framework provides Apple Silicon optimized AI inference with 3x performance improvements",
                    "Ollama enables local LLM execution without cloud dependencies for complete privacy",
                    "Fine-tuning uses LoRA (Low-Rank Adaptation) for efficient model customization on domain data",
                    "Voice features include advanced speech-to-text and text-to-speech capabilities with 8 voice options",
                    "The entire system operates fully offline for maximum privacy and security"
                ]
            },
            "deployment": {
                "concepts": [
                    "production deployment", "docker containerization", "monitoring setup",
                    "health checks", "ssl configuration", "backup procedures"
                ],
                "details": [
                    "Production deployment uses ./scripts/production-deployment.sh for complete automation",
                    "Blue-green deployment strategy ensures zero-downtime updates with automatic rollback capabilities",
                    "Docker containers provide consistent environments across development, staging, and production",
                    "Comprehensive health monitoring includes service discovery and automatic recovery mechanisms",
                    "SSL certificates are automatically managed through Let's Encrypt with automated renewal"
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

# Create DEAP fitness and individual classes
creator.create("FitnessMax", base.Fitness, weights=(1.0,))
creator.create("Individual", list, fitness=creator.FitnessMax)

class MLXServiceEvaluator:
    """Evaluates training examples using MLX service"""
    
    def __init__(self, base_url: str = "http://localhost:8005"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.timeout = 8
        
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
                    "max_tokens": 60,
                    "stream": False
                }
            )
            
            if response.status_code == 200:
                result = response.json()
                actual_response = result.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                
                if not actual_response:
                    return 0.0
                
                # Calculate quality based on multiple factors
                quality_score = 0.0
                
                # 1. Response relevance (keyword overlap)
                expected_words = set(word.lower() for word in expected_response.split() if len(word) > 2)
                actual_words = set(word.lower() for word in actual_response.split() if len(word) > 2)
                
                if expected_words:
                    overlap = len(expected_words.intersection(actual_words))
                    quality_score += (overlap / len(expected_words)) * 0.4
                
                # 2. Domain-specific terms presence
                domain_terms = ["universal", "ai", "tools", "rust", "go", "swift", "architecture", "performance", "service"]
                domain_score = sum(1 for term in domain_terms if term in actual_response.lower()) / len(domain_terms)
                quality_score += domain_score * 0.3
                
                # 3. Response coherence and quality
                coherence_score = 0.0
                if len(actual_response.strip()) > 15:  # Not too short
                    coherence_score += 0.15
                if len(set(actual_response.split())) / max(1, len(actual_response.split())) > 0.6:  # Low repetition
                    coherence_score += 0.15
                quality_score += coherence_score
                
                # 4. Response length appropriateness
                length_ratio = min(len(actual_response), len(expected_response)) / max(len(actual_response), len(expected_response))
                quality_score += length_ratio * 0.15
                
                return min(1.0, quality_score)
            
        except Exception as e:
            logger.debug(f"Error evaluating response quality: {e}")
            return 0.0
        
        return 0.0

class FixedDEAPTrainingDataEvolver:
    """Fixed DEAP-based evolutionary algorithm for training data enhancement"""
    
    def __init__(self, knowledge_base: UniversalAIToolsKnowledgeBase, evaluator: MLXServiceEvaluator):
        self.knowledge_base = knowledge_base
        self.evaluator = evaluator
        self.generation_count = 0
        
        # Setup DEAP toolbox
        self.toolbox = base.Toolbox()
        
        # Evolution parameters
        self.population_size = 12  # Smaller for faster iteration
        self.num_generations = 5
        self.mutation_rate = 0.4
        self.crossover_rate = 0.6
        
        # Training data templates for evolution
        self.question_templates = [
            "What is {concept}?",
            "How does {concept} work in Universal AI Tools?", 
            "Explain the {concept} implementation",
            "What are the key features of {concept}?",
            "How do you configure {concept}?",
            "What are the benefits of using {concept}?",
            "How does {concept} improve system performance?",
            "When should you use {concept}?",
            "What problems does {concept} solve?"
        ]
        
        # Register DEAP functions
        self.toolbox.register("individual", self.create_individual)
        self.toolbox.register("population", tools.initRepeat, list, self.toolbox.individual)
        self.toolbox.register("evaluate", self.evaluate_individual_wrapper)
        self.toolbox.register("mate", self.crossover_individuals)
        self.toolbox.register("mutate", self.mutate_individual)
        self.toolbox.register("select", tools.selTournament, tournsize=3)
    
    def create_individual(self) -> creator.Individual:
        """Create a random individual (training dataset)"""
        individual_size = random.randint(8, 15)  # Smaller datasets for faster evaluation
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
        
        # Create DEAP individual
        individual = creator.Individual(examples)
        return individual
    
    def evaluate_individual_wrapper(self, individual: creator.Individual) -> Tuple[float,]:
        """Wrapper for DEAP evaluation"""
        return self.evaluate_individual(individual)
    
    def evaluate_individual(self, individual: List[TrainingExample]) -> Tuple[float,]:
        """Evaluate fitness of an individual training dataset"""
        if not individual:
            return (0.0,)
        
        # Sample evaluation on subset for speed
        sample_size = min(3, len(individual))  # Reduced for speed
        sample_examples = random.sample(individual, sample_size)
        
        fitness_scores = []
        
        for example in sample_examples:
            # Quality score from MLX service evaluation
            quality_score = self.evaluator.evaluate_response_quality(
                example.instruction, example.response
            )
            
            # Length appropriateness bonus
            length_score = 1.0
            if len(example.response) < 30:
                length_score *= 0.7
            elif len(example.response) > 300:
                length_score *= 0.8
            
            example_fitness = quality_score * 0.8 + length_score * 0.2
            fitness_scores.append(example_fitness)
        
        # Diversity bonuses
        domain_diversity = len(set(ex.domain for ex in individual)) / len(self.knowledge_base.get_all_domains())
        size_bonus = min(1.0, len(individual) / 15.0) * 0.1
        
        overall_fitness = np.mean(fitness_scores) + domain_diversity * 0.1 + size_bonus
        return (min(1.0, overall_fitness),)
    
    def mutate_individual(self, individual: creator.Individual) -> Tuple[creator.Individual,]:
        """Mutate an individual by modifying examples"""
        if not individual:
            return (individual,)
            
        mutated = individual[:]  # Copy the list
        
        for i in range(len(mutated)):
            if random.random() < self.mutation_rate:
                example = mutated[i]
                
                # Different mutation strategies
                mutation_type = random.choice(["modify_response", "change_domain", "rephrase_question"])
                
                if mutation_type == "modify_response":
                    # Use a different detail from the same or related domain
                    target_domain = random.choice([example.domain] + self.knowledge_base.get_all_domains()[:2])
                    details = self.knowledge_base.get_domain_details(target_domain)
                    if details:
                        mutated[i] = TrainingExample(
                            instruction=example.instruction,
                            response=random.choice(details),
                            domain=target_domain,
                            complexity=example.complexity,
                            generation=self.generation_count
                        )
                
                elif mutation_type == "change_domain":
                    # Move to a different domain
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
                            complexity=random.randint(1, 5),
                            generation=self.generation_count
                        )
                
                elif mutation_type == "rephrase_question":
                    # Use different template for similar concept
                    new_template = random.choice(self.question_templates)
                    # Try to extract concept from original question
                    domain_concepts = self.knowledge_base.get_domain_concepts(example.domain)
                    
                    for concept in domain_concepts:
                        if concept in example.instruction.lower() or any(word in example.instruction.lower() for word in concept.split()):
                            mutated[i] = TrainingExample(
                                instruction=new_template.format(concept=concept),
                                response=example.response,
                                domain=example.domain,
                                complexity=example.complexity,
                                generation=self.generation_count
                            )
                            break
        
        # Create new DEAP individual
        new_individual = creator.Individual(mutated)
        return (new_individual,)
    
    def crossover_individuals(self, ind1: creator.Individual, ind2: creator.Individual) -> Tuple[creator.Individual, creator.Individual]:
        """Crossover two individuals by mixing their examples"""
        if len(ind1) < 2 or len(ind2) < 2:
            return ind1, ind2
        
        # Single point crossover
        cut1 = random.randint(1, len(ind1) - 1)
        cut2 = random.randint(1, len(ind2) - 1)
        
        child1_examples = ind1[:cut1] + ind2[cut2:]
        child2_examples = ind2[:cut2] + ind1[cut1:]
        
        # Update generation info
        for example in child1_examples:
            example.generation = self.generation_count
        for example in child2_examples:
            example.generation = self.generation_count
        
        # Create new DEAP individuals
        child1 = creator.Individual(child1_examples)
        child2 = creator.Individual(child2_examples)
        
        return child1, child2
    
    def evolve_training_data(self, initial_dataset: Optional[List[TrainingExample]] = None) -> Dict[str, Any]:
        """Main evolution loop"""
        logger.info("🧬 Starting Fixed DEAP evolutionary training data enhancement...")
        
        # Initialize population
        pop = []
        
        if initial_dataset and len(initial_dataset) > 0:
            # Seed population with existing data
            seed_individual = creator.Individual(initial_dataset[:15])  # Limit size
            pop.append(seed_individual)
            
            # Create variations of existing data
            for _ in range(self.population_size - 1):
                pop.append(self.create_individual())
        else:
            pop = self.toolbox.population(n=self.population_size)
        
        # Evolution tracking
        generation_stats = []
        best_fitness_trajectory = []
        
        # Evaluate initial population
        logger.info("Evaluating initial population...")
        fitnesses = []
        for ind in pop:
            fitness = self.evaluate_individual_wrapper(ind)
            ind.fitness.values = fitness
            fitnesses.append(fitness[0])
        
        best_fitness_trajectory.append(max(fitnesses))
        
        # Evolution loop
        for generation in range(self.num_generations):
            self.generation_count = generation
            logger.info(f"\n=== Generation {generation + 1}/{self.num_generations} ===")
            
            # Selection and breeding
            offspring = algorithms.varAnd(pop, self.toolbox, self.crossover_rate, self.mutation_rate)
            
            # Evaluate offspring
            logger.info(f"Evaluating {len(offspring)} offspring...")
            for ind in offspring:
                if not ind.fitness.valid:
                    fitness = self.evaluate_individual_wrapper(ind)
                    ind.fitness.values = fitness
            
            # Select next generation
            pop = tools.selBest(pop + offspring, self.population_size)
            
            # Calculate statistics
            fits = [ind.fitness.values[0] for ind in pop]
            generation_stat = {
                'generation': generation,
                'avg_fitness': np.mean(fits),
                'max_fitness': np.max(fits),
                'min_fitness': np.min(fits),
                'population_size': len(pop)
            }
            generation_stats.append(generation_stat)
            best_fitness_trajectory.append(np.max(fits))
            
            logger.info(f"Generation {generation + 1} stats:")
            logger.info(f"  Avg fitness: {generation_stat['avg_fitness']:.3f}")
            logger.info(f"  Max fitness: {generation_stat['max_fitness']:.3f}")
        
        # Get best individual
        best_individual = tools.selBest(pop, 1)[0]
        final_fitness = best_individual.fitness.values[0]
        
        logger.info(f"\n🏆 Evolution Complete!")
        logger.info(f"Final best fitness: {final_fitness:.3f}")
        logger.info(f"Best dataset size: {len(best_individual)}")
        
        return {
            'enhanced_dataset': list(best_individual),
            'generation_stats': generation_stats,
            'best_fitness_trajectory': best_fitness_trajectory,
            'final_fitness': final_fitness
        }

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

def save_enhanced_dataset(result: Dict[str, Any], output_file: str = "enhanced_training_dataset.jsonl"):
    """Save enhanced dataset in MLX training format"""
    enhanced_dataset = result['enhanced_dataset']
    
    with open(output_file, 'w') as f:
        for example in enhanced_dataset:
            training_record = {
                "prompt": f"Instruction: {example.instruction}\nResponse:",
                "completion": example.response
            }
            f.write(json.dumps(training_record) + "\n")
    
    logger.info(f"Enhanced dataset saved to {output_file}")
    
    # Save metadata
    metadata_file = output_file.replace('.jsonl', '_metadata.json')
    metadata = {
        'total_examples': len(enhanced_dataset),
        'final_fitness': result['final_fitness'],
        'generation_stats': result['generation_stats'],
        'best_fitness_trajectory': result['best_fitness_trajectory'],
        'domain_distribution': {},
        'complexity_distribution': {},
        'evolution_timestamp': time.time()
    }
    
    # Calculate distributions
    for example in enhanced_dataset:
        domain = example.domain
        complexity = str(example.complexity)
        metadata['domain_distribution'][domain] = metadata['domain_distribution'].get(domain, 0) + 1
        metadata['complexity_distribution'][complexity] = metadata['complexity_distribution'].get(complexity, 0) + 1
    
    with open(metadata_file, 'w') as f:
        json.dump(metadata, f, indent=2)
    
    logger.info(f"Enhancement metadata saved to {metadata_file}")

def main():
    """Main execution function"""
    logger.info("🧬 Starting Fixed DEAP Evolutionary Training Data Enhancement System")
    
    try:
        # Initialize components
        knowledge_base = UniversalAIToolsKnowledgeBase()
        evaluator = MLXServiceEvaluator()
        evolver = FixedDEAPTrainingDataEvolver(knowledge_base, evaluator)
        
        # Load existing training data as seed
        existing_data = load_existing_training_data()
        
        # Run evolution
        result = evolver.evolve_training_data(initial_dataset=existing_data if existing_data else None)
        
        # Save results
        save_enhanced_dataset(result)
        
        enhanced_dataset = result['enhanced_dataset']
        
        # Display results
        print(f"\n{'='*70}")
        print("🧬 FIXED DEAP EVOLUTIONARY ENHANCEMENT RESULTS")
        print(f"{'='*70}")
        print(f"🎯 Final Fitness: {result['final_fitness']:.3f}")
        print(f"📊 Enhanced Dataset Size: {len(enhanced_dataset)} examples")
        print(f"🌍 Domain Coverage: {len(set(ex.domain for ex in enhanced_dataset))} domains")
        print(f"🔄 Evolution Generations: {len(result['generation_stats'])}")
        print(f"📈 Fitness Improvement: {result['best_fitness_trajectory'][0]:.3f} → {result['best_fitness_trajectory'][-1]:.3f}")
        
        print(f"\n📋 Domain Distribution:")
        domain_dist = {}
        for ex in enhanced_dataset:
            domain_dist[ex.domain] = domain_dist.get(ex.domain, 0) + 1
        
        for domain, count in sorted(domain_dist.items()):
            print(f"  {domain}: {count} examples ({count/len(enhanced_dataset)*100:.1f}%)")
        
        print(f"\n📝 Sample Enhanced Examples:")
        for i, example in enumerate(enhanced_dataset[:3]):
            print(f"  {i+1}. Q: {example.instruction}")
            print(f"     A: {example.response[:100]}...")
            print(f"     Domain: {example.domain}, Complexity: {example.complexity}")
        
        print(f"{'='*70}")
        
        if result['final_fitness'] > 0.6:
            print("🚀 Excellent evolution! Dataset significantly enhanced!")
        elif result['final_fitness'] > 0.4:
            print("✅ Good progress! Enhanced dataset ready for training!")
        else:
            print("📈 Dataset evolved, consider additional cycles for better results")
            
        print(f"\n📁 Files created:")
        print(f"  - enhanced_training_dataset.jsonl ({len(enhanced_dataset)} examples)")
        print(f"  - enhanced_training_dataset_metadata.json")
        print(f"  - fixed_deap_enhancer.log")
            
    except Exception as e:
        logger.error(f"Evolution failed: {e}", exc_info=True)
        raise

if __name__ == "__main__":
    main()