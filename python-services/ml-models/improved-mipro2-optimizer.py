#!/usr/bin/env python3
"""
Improved DSPy + MIPRO2 Prompt Optimization Pipeline for MLX
Fixed evaluation method based on debug findings
"""

import requests
import json
import logging
import numpy as np
from typing import List, Dict, Tuple, Any, Optional
from dataclasses import dataclass
import time
from pathlib import Path
import re

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('improved_mipro2_optimizer.log'),
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
        self.session.timeout = 15  # Reduced timeout
        
    def test_connection(self) -> bool:
        """Test if MLX service is available"""
        try:
            response = self.session.get(f"{self.base_url}/health")
            return response.status_code == 200
        except Exception as e:
            logger.error(f"MLX service connection failed: {e}")
            return False
    
    def generate_response(self, prompt: str, max_tokens: int = 80) -> Optional[str]:
        """Generate response from MLX service with shorter max_tokens"""
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
                content = result.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                # Clean up repetitive patterns
                content = re.sub(r'(.{20,}?)\1+', r'\1', content)  # Remove repetitions
                return content
            else:
                logger.warning(f"MLX service returned status {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"Error generating response from MLX: {e}")
            return None

class UniversalAIToolsDataset:
    """Dataset for Universal AI Tools domain knowledge"""
    
    def __init__(self):
        self.examples = self._load_evaluation_examples()
        
    def _load_evaluation_examples(self) -> List[Dict[str, str]]:
        """Load evaluation examples optimized for the domain"""
        examples = [
            {
                "question": "What is Universal AI Tools?",
                "expected_keywords": ["universal ai tools", "ai", "tools", "platform", "system", "automation"],
                "avoid_keywords": ["error", "undefined", "null"]
            },
            {
                "question": "How do you start the development server?",
                "expected_keywords": ["npm run dev", "go run", "dev", "server", "localhost", "8082", "development"],
                "avoid_keywords": ["error", "failed", "not found"]
            },
            {
                "question": "What programming languages does Universal AI Tools use?",
                "expected_keywords": ["rust", "go", "swift", "typescript", "javascript", "languages", "programming"],
                "avoid_keywords": ["unknown", "error"]
            },
            {
                "question": "What is the architecture of Universal AI Tools?",
                "expected_keywords": ["architecture", "rust", "go", "swift", "services", "hybrid", "microservices"],
                "avoid_keywords": ["error", "unknown"]
            },
            {
                "question": "How does memory optimization work?",
                "expected_keywords": ["memory", "optimization", "reduction", "monitoring", "performance", "usage"],
                "avoid_keywords": ["error", "failed"]
            },
            {
                "question": "What are the key features?",
                "expected_keywords": ["features", "ai", "local", "offline", "voice", "chat", "assistant"],
                "avoid_keywords": ["error", "unknown"]
            },
            {
                "question": "How do you deploy to production?",
                "expected_keywords": ["production", "deploy", "script", "docker", "deployment", "monitoring"],
                "avoid_keywords": ["error", "failed"]
            }
        ]
        
        logger.info(f"Loaded {len(examples)} evaluation examples")
        return examples
    
    def get_training_split(self) -> Tuple[List[Dict[str, str]], List[Dict[str, str]]]:
        """Split data into training and validation sets"""
        split_idx = int(len(self.examples) * 0.7)  # 70/30 split
        return self.examples[:split_idx], self.examples[split_idx:]

class PromptTemplate:
    """Dynamic prompt template with optimization parameters"""
    
    def __init__(self, 
                 instruction_prefix: str = "Instruction:",
                 context_separator: str = "\n",
                 response_prefix: str = "Response:",
                 system_context: str = "",
                 format_style: str = "conversational"):
        self.instruction_prefix = instruction_prefix
        self.context_separator = context_separator
        self.response_prefix = response_prefix
        self.system_context = system_context
        self.format_style = format_style
    
    def format_prompt(self, question: str) -> str:
        """Format question into optimized prompt"""
        if self.format_style == "simple":
            return question
        elif self.format_style == "system_context" and self.system_context:
            return f"{self.system_context} {question}"
        elif self.format_style == "chat":
            return f"User: {question}\nAssistant:"
        elif self.format_style == "qa":
            return f"Question: {question}\nAnswer:"
        else:  # conversational/instruction format
            if self.system_context:
                return f"{self.system_context}{self.context_separator}{self.instruction_prefix} {question}{self.context_separator}{self.response_prefix}"
            else:
                return f"{self.instruction_prefix} {question}{self.context_separator}{self.response_prefix}"

class ImprovedMIPRO2Optimizer:
    """Improved MIPRO2 optimizer with better evaluation"""
    
    def __init__(self, mlx_service: MLXServiceInterface, dataset: UniversalAIToolsDataset):
        self.mlx_service = mlx_service
        self.dataset = dataset
        self.optimization_history = []
        
        # MIPRO2 parameters - reduced for faster iteration
        self.num_candidates = 8   # Reduced from 12
        self.num_iterations = 5   # Reduced from 8
        
        # Parameter space for optimization
        self.parameter_space = {
            'format_style': ['simple', 'system_context', 'chat', 'qa', 'conversational'],
            'instruction_prefix': ['Instruction:', 'Question:', 'Query:', ''],
            'response_prefix': ['Response:', 'Answer:', ''],
            'system_context': [
                'You are Universal AI Tools assistant.',
                'You are an expert on Universal AI Tools.',
                ''  # No system context
            ]
        }
    
    def evaluate_prompt_template(self, template: PromptTemplate, test_examples: List[Dict[str, str]]) -> Tuple[float, List[str]]:
        """Improved evaluation with keyword-based scoring"""
        total_score = 0.0
        responses = []
        
        for example in test_examples:
            prompt = template.format_prompt(example["question"])
            predicted_answer = self.mlx_service.generate_response(prompt, max_tokens=60)
            
            if predicted_answer:
                responses.append(predicted_answer)
                
                # Convert to lowercase for comparison
                answer_lower = predicted_answer.lower()
                
                # Score based on expected keywords
                expected_keywords = example.get("expected_keywords", [])
                keyword_score = sum(1 for kw in expected_keywords if kw in answer_lower) / len(expected_keywords) if expected_keywords else 0
                
                # Penalty for avoid keywords
                avoid_keywords = example.get("avoid_keywords", [])
                avoid_penalty = sum(0.5 for kw in avoid_keywords if kw in answer_lower)
                
                # Quality checks
                quality_score = 0.0
                if len(predicted_answer.strip()) > 10:  # Not too short
                    quality_score += 0.2
                if not re.search(r'(.{10,})\1', predicted_answer):  # Not repetitive
                    quality_score += 0.3
                if any(char.isalpha() for char in predicted_answer):  # Contains actual words
                    quality_score += 0.2
                if predicted_answer.count('\n') <= 2:  # Not too fragmented
                    quality_score += 0.3
                
                # Final score (0-1 scale)
                score = max(0, keyword_score * 0.6 + quality_score * 0.4 - avoid_penalty * 0.1)
                total_score += score
            else:
                responses.append("")
        
        accuracy = total_score / len(test_examples) if test_examples else 0
        return accuracy, responses
    
    def generate_candidate_templates(self, iteration: int) -> List[PromptTemplate]:
        """Generate candidate prompt templates"""
        candidates = []
        
        if iteration == 0:
            # Initial diverse candidates focusing on format styles
            base_configs = [
                {'format_style': 'simple', 'instruction_prefix': '', 'response_prefix': '', 'system_context': ''},
                {'format_style': 'system_context', 'instruction_prefix': '', 'response_prefix': '', 'system_context': 'You are Universal AI Tools assistant.'},
                {'format_style': 'chat', 'instruction_prefix': '', 'response_prefix': '', 'system_context': ''},
                {'format_style': 'qa', 'instruction_prefix': '', 'response_prefix': '', 'system_context': ''},
                {'format_style': 'conversational', 'instruction_prefix': 'Instruction:', 'response_prefix': 'Response:', 'system_context': ''},
                {'format_style': 'conversational', 'instruction_prefix': 'Question:', 'response_prefix': 'Answer:', 'system_context': ''},
                {'format_style': 'system_context', 'instruction_prefix': '', 'response_prefix': '', 'system_context': 'You are an expert on Universal AI Tools.'},
                {'format_style': 'simple', 'instruction_prefix': '', 'response_prefix': '', 'system_context': ''}
            ]
            
            for config in base_configs:
                template = PromptTemplate(**config)
                candidates.append(template)
        else:
            # Use historical performance to guide selection
            best_performers = sorted(self.optimization_history, 
                                   key=lambda x: x['accuracy'], reverse=True)[:3]
            
            # Generate variations of best performers
            for i in range(self.num_candidates):
                if i < 4 and best_performers:  # Exploitation
                    base_config = best_performers[i % len(best_performers)]['template_params']
                    # Add variations
                    config = base_config.copy()
                    if np.random.random() < 0.3:  # 30% chance to vary each parameter
                        config['format_style'] = np.random.choice(self.parameter_space['format_style'])
                else:  # Exploration
                    config = {
                        'format_style': np.random.choice(self.parameter_space['format_style']),
                        'instruction_prefix': np.random.choice(self.parameter_space['instruction_prefix']),
                        'response_prefix': np.random.choice(self.parameter_space['response_prefix']),
                        'system_context': np.random.choice(self.parameter_space['system_context'])
                    }
                
                template = PromptTemplate(**config)
                candidates.append(template)
        
        return candidates
    
    def optimize(self) -> OptimizationResult:
        """Run improved MIPRO2 optimization"""
        logger.info("🚀 Starting Improved MIPRO2 prompt optimization...")
        
        # Check MLX service availability
        if not self.mlx_service.test_connection():
            raise RuntimeError("MLX service not available. Please ensure it's running on port 8005")
        
        # Get training data
        train_examples, val_examples = self.dataset.get_training_split()
        logger.info(f"Using {len(train_examples)} training examples, {len(val_examples)} validation examples")
        
        best_template = None
        best_accuracy = 0.0
        best_responses = []
        
        for iteration in range(self.num_iterations):
            logger.info(f"\n=== MIPRO2 Iteration {iteration + 1}/{self.num_iterations} ===")
            
            # Generate candidate templates
            candidates = self.generate_candidate_templates(iteration)
            iteration_results = []
            
            for idx, template in enumerate(candidates):
                logger.info(f"Testing candidate {idx + 1}/{len(candidates)}...")
                accuracy, responses = self.evaluate_prompt_template(template, val_examples)
                
                result = {
                    'iteration': iteration,
                    'candidate_idx': idx,
                    'accuracy': accuracy,
                    'template_params': {
                        'format_style': template.format_style,
                        'instruction_prefix': template.instruction_prefix,
                        'response_prefix': template.response_prefix,
                        'system_context': template.system_context
                    },
                    'sample_responses': responses[:2]  # Store first 2 responses as examples
                }
                
                iteration_results.append(result)
                self.optimization_history.append(result)
                
                logger.info(f"  Accuracy: {accuracy:.1%} | Format: {template.format_style}")
                
                # Track best template
                if accuracy > best_accuracy:
                    best_accuracy = accuracy
                    best_template = template
                    best_responses = responses
                    logger.info(f"🎯 New best template! Accuracy: {accuracy:.1%}")
            
            # Log iteration summary
            avg_accuracy = np.mean([r['accuracy'] for r in iteration_results])
            max_accuracy = max([r['accuracy'] for r in iteration_results])
            logger.info(f"Iteration {iteration + 1} results: Avg={avg_accuracy:.1%}, Max={max_accuracy:.1%}")
        
        # Calculate convergence score
        recent_scores = [r['accuracy'] for r in self.optimization_history[-6:]]
        convergence_score = 1.0 - (np.std(recent_scores) if len(recent_scores) > 1 else 0.0)
        
        result = OptimizationResult(
            best_prompt_template=best_template.format_prompt("{question}") if best_template else "",
            accuracy=best_accuracy,
            optimization_history=self.optimization_history,
            best_parameters={
                'format_style': best_template.format_style,
                'instruction_prefix': best_template.instruction_prefix,
                'response_prefix': best_template.response_prefix,
                'system_context': best_template.system_context
            } if best_template else {},
            convergence_score=convergence_score
        )
        
        logger.info(f"\n🏆 MIPRO2 Optimization Complete!")
        logger.info(f"Best accuracy: {best_accuracy:.1%}")
        logger.info(f"Best format style: {best_template.format_style if best_template else 'None'}")
        
        # Show sample responses with best template
        if best_responses:
            logger.info("\n📝 Sample responses with best template:")
            for i, (example, response) in enumerate(zip(val_examples[:2], best_responses[:2])):
                logger.info(f"Q: {example['question']}")
                logger.info(f"A: {response}")
        
        return result

def main():
    """Main execution function"""
    logger.info("🚀 Starting Improved DSPy + MIPRO2 MLX Prompt Optimization Pipeline")
    
    try:
        # Initialize components
        mlx_service = MLXServiceInterface()
        dataset = UniversalAIToolsDataset()
        optimizer = ImprovedMIPRO2Optimizer(mlx_service, dataset)
        
        # Run optimization
        result = optimizer.optimize()
        
        # Save results
        results_file = "improved_mipro2_results.json"
        with open(results_file, 'w') as f:
            json.dump({
                'best_template': result.best_prompt_template,
                'best_accuracy': result.accuracy,
                'best_parameters': result.best_parameters,
                'convergence_score': result.convergence_score,
                'optimization_history': result.optimization_history,
                'total_evaluations': len(result.optimization_history),
                'optimization_timestamp': time.time()
            }, f, indent=2)
        
        logger.info(f"✅ Results saved to {results_file}")
        
        # Display final results
        print(f"\n{'='*70}")
        print("🏆 IMPROVED MIPRO2 OPTIMIZATION RESULTS")
        print(f"{'='*70}")
        print(f"🎯 Best Accuracy: {result.accuracy:.1%}")
        print(f"📊 Convergence Score: {result.convergence_score:.3f}")
        print(f"🔄 Total Evaluations: {len(result.optimization_history)}")
        print(f"\n🎨 Optimal Prompt Configuration:")
        print(f"  Format Style: {result.best_parameters.get('format_style', 'N/A')}")
        print(f"  Instruction Prefix: '{result.best_parameters.get('instruction_prefix', 'N/A')}'")
        print(f"  Response Prefix: '{result.best_parameters.get('response_prefix', 'N/A')}'")
        print(f"  System Context: {result.best_parameters.get('system_context', 'N/A')}")
        print(f"\n📋 Template Pattern:")
        print(f"  {result.best_prompt_template}")
        print(f"{'='*70}")
        
        # Performance assessment
        if result.accuracy >= 0.7:
            print("🚀 Excellent! Achieved ≥70% accuracy - ready for production!")
        elif result.accuracy >= 0.5:
            print("✅ Good! Achieved ≥50% accuracy - significant improvement!")
        elif result.accuracy >= 0.3:
            print("📈 Progress! Achieved ≥30% accuracy - continue optimization")
        else:
            print("⚠️ Need more work - consider training data improvements")
            
    except Exception as e:
        logger.error(f"Optimization failed: {e}", exc_info=True)
        raise

if __name__ == "__main__":
    main()