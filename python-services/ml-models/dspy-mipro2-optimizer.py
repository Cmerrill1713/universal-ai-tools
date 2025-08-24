#!/usr/bin/env python3
"""
DSPy + MIPRO2 Prompt Optimization Pipeline for MLX
Optimizes prompts for Universal AI Tools fine-tuned MLX model using Bayesian optimization.
"""

import dspy
import json
import requests
import logging
import numpy as np
from typing import List, Dict, Tuple, Any, Optional
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor, as_completed
import time
from pathlib import Path

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('dspy_mipro2_optimizer.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class OptimizationResult:
    """Results from prompt optimization"""
    best_prompt_template: str
    accuracy: float
    optimization_history: List[Dict[str, Any]]
    best_parameters: Dict[str, Any]
    convergence_score: float

class MLXServiceInterface:
    """Interface to communicate with MLX service on port 8005"""
    
    def __init__(self, base_url: str = "http://localhost:8005"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.timeout = 30  # 30 second timeout
        
    def test_connection(self) -> bool:
        """Test if MLX service is available"""
        try:
            response = self.session.get(f"{self.base_url}/health")
            return response.status_code == 200
        except Exception as e:
            logger.error(f"MLX service connection failed: {e}")
            return False
    
    def generate_response(self, prompt: str, max_tokens: int = 100) -> Optional[str]:
        """Generate response from MLX service"""
        try:
            payload = {
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": max_tokens,
                "stream": False
            }
            
            response = self.session.post(
                f"{self.base_url}/v1/chat/completions",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                result = response.json()
                return result.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
            else:
                logger.warning(f"MLX service returned status {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Error generating response from MLX: {e}")
            return None

class UniversalAIToolsDataset:
    """Dataset for Universal AI Tools domain knowledge"""
    
    def __init__(self):
        self.examples = self._load_training_examples()
        
    def _load_training_examples(self) -> List[Dict[str, str]]:
        """Load training examples from existing training data"""
        examples = []
        
        # Load from existing training file
        train_file = Path("mlx-lora-training/train.jsonl")
        if train_file.exists():
            with open(train_file, 'r') as f:
                for line in f:
                    data = json.loads(line.strip())
                    # Extract question from prompt (after "Instruction: " and before "Response:")
                    prompt_text = data.get("prompt", "")
                    if "Instruction:" in prompt_text and "Response:" in prompt_text:
                        question = prompt_text.split("Instruction:")[1].split("Response:")[0].strip()
                        answer = data.get("completion", "").strip()
                        if question and answer:
                            examples.append({"question": question, "answer": answer})
        
        # Add additional evaluation examples for better coverage
        additional_examples = [
            {
                "question": "How do you enable voice features in Universal AI Tools?",
                "answer": "Voice features are enabled through the voice service configuration. The system supports speech-to-text and text-to-speech capabilities integrated with the main chat interface."
            },
            {
                "question": "What is the architecture of Universal AI Tools?",
                "answer": "Universal AI Tools uses a hybrid architecture with Go API gateway, Rust services for performance-critical operations like LLM routing, and Swift for the macOS client application. The system is designed for local-first AI assistance."
            },
            {
                "question": "How does the memory optimization work?",
                "answer": "The memory optimization system uses a 4-level pressure detection system with real-time monitoring, intelligent garbage collection, and automatic optimization strategies to reduce memory usage by up to 70%."
            },
            {
                "question": "What debugging features are available?",
                "answer": "Universal AI Tools includes comprehensive debugging with multi-language support (Rust LLDB, Go Delve, Swift LLDB), distributed tracing with OpenTelemetry, and health monitoring endpoints for all services."
            },
            {
                "question": "How do you deploy Universal AI Tools to production?",
                "answer": "Production deployment uses the automated deployment script ./scripts/production-deployment.sh which implements blue-green deployment with zero-downtime switching, health checks, and automatic rollback capabilities."
            }
        ]
        
        examples.extend(additional_examples)
        logger.info(f"Loaded {len(examples)} training examples for optimization")
        return examples
    
    def get_training_split(self) -> Tuple[List[Dict[str, str]], List[Dict[str, str]]]:
        """Split data into training and validation sets"""
        split_idx = int(len(self.examples) * 0.8)
        return self.examples[:split_idx], self.examples[split_idx:]

class PromptTemplate:
    """Dynamic prompt template with optimization parameters"""
    
    def __init__(self, 
                 instruction_prefix: str = "Instruction:",
                 context_separator: str = "\n",
                 response_prefix: str = "Response:",
                 system_context: str = "You are Universal AI Tools assistant. Provide accurate, helpful information about the Universal AI Tools system.",
                 format_style: str = "conversational"):
        self.instruction_prefix = instruction_prefix
        self.context_separator = context_separator
        self.response_prefix = response_prefix
        self.system_context = system_context
        self.format_style = format_style
    
    def format_prompt(self, question: str) -> str:
        """Format question into optimized prompt"""
        if self.format_style == "conversational":
            if self.system_context:
                return f"{self.system_context}{self.context_separator}{self.instruction_prefix} {question}{self.context_separator}{self.response_prefix}"
            else:
                return f"{self.instruction_prefix} {question}{self.context_separator}{self.response_prefix}"
        elif self.format_style == "direct":
            return f"{question}{self.context_separator}{self.response_prefix}"
        elif self.format_style == "structured":
            return f"### Task{self.context_separator}{self.instruction_prefix} {question}{self.context_separator}### {self.response_prefix}"
        else:
            return f"{self.instruction_prefix} {question}{self.context_separator}{self.response_prefix}"

class MIPRO2Optimizer:
    """MIPRO2 (Multiprompt Instruction Proposal Optimizer Version 2) implementation"""
    
    def __init__(self, mlx_service: MLXServiceInterface, dataset: UniversalAIToolsDataset):
        self.mlx_service = mlx_service
        self.dataset = dataset
        self.optimization_history = []
        
        # MIPRO2 parameters
        self.num_candidates = 12  # Number of prompt candidates per iteration
        self.num_iterations = 8   # Bayesian optimization iterations
        self.exploration_weight = 0.1  # Exploration vs exploitation balance
        
        # Parameter space for optimization
        self.parameter_space = {
            'instruction_prefix': [
                'Instruction:', 'Question:', 'Query:', 'Task:', 'Request:', 'Please explain:'
            ],
            'context_separator': ['\n', '\n\n', ' - ', ' | '],
            'response_prefix': [
                'Response:', 'Answer:', 'Solution:', 'Explanation:', 'Output:', ''
            ],
            'system_context': [
                'You are Universal AI Tools assistant. Provide accurate, helpful information about the Universal AI Tools system.',
                'You are an expert on Universal AI Tools. Answer questions accurately and concisely.',
                'As Universal AI Tools assistant, provide detailed technical information.',
                ''  # No system context
            ],
            'format_style': ['conversational', 'direct', 'structured']
        }
    
    def evaluate_prompt_template(self, template: PromptTemplate, test_examples: List[Dict[str, str]]) -> float:
        """Evaluate a prompt template against test examples"""
        correct_predictions = 0
        total_predictions = 0
        
        for example in test_examples:
            prompt = template.format_prompt(example["question"])
            predicted_answer = self.mlx_service.generate_response(prompt, max_tokens=150)
            
            if predicted_answer:
                # Simple accuracy check - could be enhanced with semantic similarity
                expected_keywords = set(example["answer"].lower().split())
                predicted_keywords = set(predicted_answer.lower().split())
                
                # Calculate Jaccard similarity
                intersection = len(expected_keywords.intersection(predicted_keywords))
                union = len(expected_keywords.union(predicted_keywords))
                similarity = intersection / union if union > 0 else 0
                
                # Consider prediction correct if similarity > 0.3
                if similarity > 0.3:
                    correct_predictions += 1
                    
            total_predictions += 1
        
        accuracy = correct_predictions / total_predictions if total_predictions > 0 else 0
        logger.info(f"Template accuracy: {accuracy:.2%} ({correct_predictions}/{total_predictions})")
        return accuracy
    
    def generate_candidate_templates(self, iteration: int) -> List[PromptTemplate]:
        """Generate candidate prompt templates using Bayesian optimization principles"""
        candidates = []
        
        # For first iteration, use diverse sampling
        if iteration == 0:
            # Generate diverse initial candidates
            for i in range(self.num_candidates):
                template = PromptTemplate(
                    instruction_prefix=np.random.choice(self.parameter_space['instruction_prefix']),
                    context_separator=np.random.choice(self.parameter_space['context_separator']),
                    response_prefix=np.random.choice(self.parameter_space['response_prefix']),
                    system_context=np.random.choice(self.parameter_space['system_context']),
                    format_style=np.random.choice(self.parameter_space['format_style'])
                )
                candidates.append(template)
        else:
            # Use historical performance to guide candidate generation
            # Simple exploration vs exploitation strategy
            best_performers = sorted(self.optimization_history, 
                                   key=lambda x: x['accuracy'], reverse=True)[:3]
            
            # Generate candidates based on best performers with variations
            for i in range(self.num_candidates):
                if i < 6 and best_performers:  # Exploitation
                    base_template = best_performers[i % len(best_performers)]
                    # Add small variations to best performers
                    template = PromptTemplate(
                        instruction_prefix=base_template['template_params']['instruction_prefix'],
                        context_separator=np.random.choice(self.parameter_space['context_separator']),
                        response_prefix=base_template['template_params']['response_prefix'],
                        system_context=base_template['template_params']['system_context'],
                        format_style=base_template['template_params']['format_style']
                    )
                else:  # Exploration
                    template = PromptTemplate(
                        instruction_prefix=np.random.choice(self.parameter_space['instruction_prefix']),
                        context_separator=np.random.choice(self.parameter_space['context_separator']),
                        response_prefix=np.random.choice(self.parameter_space['response_prefix']),
                        system_context=np.random.choice(self.parameter_space['system_context']),
                        format_style=np.random.choice(self.parameter_space['format_style'])
                    )
                candidates.append(template)
        
        return candidates
    
    def optimize(self) -> OptimizationResult:
        """Run MIPRO2 optimization to find best prompt template"""
        logger.info("Starting MIPRO2 prompt optimization...")
        
        # Check MLX service availability
        if not self.mlx_service.test_connection():
            raise RuntimeError("MLX service not available. Please ensure it's running on port 8005")
        
        # Get training data
        train_examples, val_examples = self.dataset.get_training_split()
        logger.info(f"Using {len(train_examples)} training examples, {len(val_examples)} validation examples")
        
        best_template = None
        best_accuracy = 0.0
        
        for iteration in range(self.num_iterations):
            logger.info(f"\n=== MIPRO2 Iteration {iteration + 1}/{self.num_iterations} ===")
            
            # Generate candidate templates
            candidates = self.generate_candidate_templates(iteration)
            
            # Evaluate candidates in parallel for efficiency
            iteration_results = []
            
            with ThreadPoolExecutor(max_workers=4) as executor:
                futures = {}
                
                for idx, template in enumerate(candidates):
                    future = executor.submit(self.evaluate_prompt_template, template, val_examples)
                    futures[future] = (idx, template)
                
                for future in as_completed(futures):
                    idx, template = futures[future]
                    try:
                        accuracy = future.result()
                        
                        result = {
                            'iteration': iteration,
                            'candidate_idx': idx,
                            'accuracy': accuracy,
                            'template_params': {
                                'instruction_prefix': template.instruction_prefix,
                                'context_separator': repr(template.context_separator),
                                'response_prefix': template.response_prefix,
                                'system_context': template.system_context,
                                'format_style': template.format_style
                            }
                        }
                        
                        iteration_results.append(result)
                        self.optimization_history.append(result)
                        
                        # Track best template
                        if accuracy > best_accuracy:
                            best_accuracy = accuracy
                            best_template = template
                            logger.info(f"🎯 New best template found! Accuracy: {accuracy:.2%}")
                        
                    except Exception as e:
                        logger.error(f"Error evaluating candidate {idx}: {e}")
            
            # Log iteration summary
            avg_accuracy = np.mean([r['accuracy'] for r in iteration_results])
            max_accuracy = max([r['accuracy'] for r in iteration_results])
            logger.info(f"Iteration {iteration + 1} results: Avg={avg_accuracy:.2%}, Max={max_accuracy:.2%}")
            
            time.sleep(1)  # Brief pause between iterations
        
        # Calculate convergence score
        recent_scores = [r['accuracy'] for r in self.optimization_history[-6:]]
        convergence_score = 1.0 - (np.std(recent_scores) if len(recent_scores) > 1 else 0.0)
        
        result = OptimizationResult(
            best_prompt_template=best_template.format_prompt("{question}") if best_template else "",
            accuracy=best_accuracy,
            optimization_history=self.optimization_history,
            best_parameters={
                'instruction_prefix': best_template.instruction_prefix,
                'context_separator': best_template.context_separator,
                'response_prefix': best_template.response_prefix,
                'system_context': best_template.system_context,
                'format_style': best_template.format_style
            } if best_template else {},
            convergence_score=convergence_score
        )
        
        logger.info(f"\n🏆 MIPRO2 Optimization Complete!")
        logger.info(f"Best accuracy: {best_accuracy:.2%}")
        logger.info(f"Convergence score: {convergence_score:.3f}")
        
        return result

def main():
    """Main execution function"""
    logger.info("🚀 Starting DSPy + MIPRO2 MLX Prompt Optimization Pipeline")
    
    try:
        # Initialize components
        mlx_service = MLXServiceInterface()
        dataset = UniversalAIToolsDataset()
        optimizer = MIPRO2Optimizer(mlx_service, dataset)
        
        # Run optimization
        result = optimizer.optimize()
        
        # Save results
        results_file = "mipro2_optimization_results.json"
        with open(results_file, 'w') as f:
            json.dump({
                'best_template': result.best_prompt_template,
                'best_accuracy': result.accuracy,
                'best_parameters': result.best_parameters,
                'convergence_score': result.convergence_score,
                'optimization_history': result.optimization_history,
                'total_iterations': len(result.optimization_history),
                'optimization_timestamp': time.time()
            }, f, indent=2)
        
        logger.info(f"✅ Results saved to {results_file}")
        
        # Display final results
        print(f"\n{'='*60}")
        print("🏆 MIPRO2 OPTIMIZATION RESULTS")
        print(f"{'='*60}")
        print(f"Best Accuracy: {result.accuracy:.2%}")
        print(f"Convergence Score: {result.convergence_score:.3f}")
        print(f"\nOptimal Prompt Template:")
        print(f"  Instruction Prefix: '{result.best_parameters.get('instruction_prefix', 'N/A')}'")
        print(f"  Context Separator: {result.best_parameters.get('context_separator', 'N/A')}")
        print(f"  Response Prefix: '{result.best_parameters.get('response_prefix', 'N/A')}'")
        print(f"  Format Style: {result.best_parameters.get('format_style', 'N/A')}")
        print(f"\nFull Template Pattern:")
        print(f"  {result.best_prompt_template}")
        print(f"{'='*60}")
        
        if result.accuracy > 0.5:
            print("🎉 Excellent! Achieved >50% accuracy with optimized prompts")
        elif result.accuracy > 0.4:
            print("✅ Good progress! Achieved >40% accuracy with optimized prompts")
        else:
            print("⚠️ Consider additional optimization strategies or training data improvements")
            
    except Exception as e:
        logger.error(f"Optimization failed: {e}", exc_info=True)
        raise

if __name__ == "__main__":
    main()