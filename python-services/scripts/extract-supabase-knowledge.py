#!/usr/bin/env python3
"""
Extract all knowledge from Supabase context_storage for MLX training
"""

import os
import json
import logging
from datetime import datetime
from supabase import create_client, Client

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "http://127.0.0.1:54321")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU")

def extract_context_storage():
    """Extract all valuable context from Supabase"""
    
    # Create Supabase client
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Query all context storage
    logger.info("🔍 Querying Supabase context_storage...")
    
    try:
        response = supabase.table('context_storage').select("*").execute()
        
        if not response.data:
            logger.warning("No data found in context_storage")
            return []
        
        logger.info(f"✅ Found {len(response.data)} context entries")
        
        # Process each entry into training examples
        training_examples = []
        categories_found = set()
        
        for entry in response.data:
            category = entry.get('category', 'unknown')
            categories_found.add(category)
            
            # Parse content based on category
            content = entry.get('content', '')
            if isinstance(content, str):
                try:
                    content = json.loads(content)
                except:
                    pass
            
            # Extract based on category type
            if category == 'swift_documentation':
                examples = extract_swift_examples(content)
                training_examples.extend(examples)
                
            elif category == 'code_patterns':
                examples = extract_pattern_examples(content)
                training_examples.extend(examples)
                
            elif category == 'ui_patterns' or category == 'architecture_patterns':
                examples = extract_architecture_examples(content)
                training_examples.extend(examples)
                
            elif category == 'swiftui_debugging_patterns':
                examples = extract_debugging_examples(content)
                training_examples.extend(examples)
                
            elif category == 'mlx_best_practices':
                examples = extract_mlx_examples(content)
                training_examples.extend(examples)
                
            else:
                # Generic extraction for other categories
                examples = extract_generic_examples(content, category)
                training_examples.extend(examples)
        
        logger.info(f"📊 Categories found: {', '.join(categories_found)}")
        logger.info(f"✅ Extracted {len(training_examples)} training examples from Supabase")
        
        return training_examples
        
    except Exception as e:
        logger.error(f"❌ Error querying Supabase: {e}")
        return []

def extract_swift_examples(content):
    """Extract Swift-specific training examples"""
    examples = []
    
    if isinstance(content, dict):
        # Architecture patterns
        if 'architecture' in content:
            arch = content['architecture']
            examples.append({
                'instruction': 'What Swift version and patterns does Universal AI Tools use?',
                'input': '',
                'output': f"Uses {arch.get('language', 'Swift 6.0')} with {arch.get('framework', 'SwiftUI')}, featuring {', '.join(arch.get('patterns', []))} patterns and {', '.join(arch.get('keyFeatures', []))} capabilities."
            })
        
        # Core components
        if 'coreComponents' in content:
            for comp_name, comp_data in content['coreComponents'].items():
                if isinstance(comp_data, dict):
                    examples.append({
                        'instruction': f'Explain the {comp_name} component in the Swift implementation',
                        'input': '',
                        'output': f"{comp_data.get('description', '')} File: {comp_data.get('file', '')}. Features: {', '.join(comp_data.get('features', []))}"
                    })
        
        # Security features
        if 'securityFeatures' in content:
            examples.append({
                'instruction': 'What security features are implemented in the Swift app?',
                'input': '',
                'output': ' '.join(content['securityFeatures'])
            })
        
        # Performance metrics
        if 'performanceMetrics' in content:
            metrics = content['performanceMetrics']
            examples.append({
                'instruction': 'What performance improvements were achieved in the Swift implementation?',
                'input': '',
                'output': f"Memory usage: {metrics.get('memoryUsage', 'N/A')}, Startup time: {metrics.get('startupTime', 'N/A')}, Response time: {metrics.get('responseTime', 'N/A')}"
            })
    
    return examples

def extract_pattern_examples(content):
    """Extract code pattern examples"""
    examples = []
    
    if isinstance(content, dict):
        # Error patterns
        if 'errorPatterns' in content:
            for pattern in content['errorPatterns'][:10]:  # Limit to 10
                if isinstance(pattern, dict):
                    examples.append({
                        'instruction': f"How do you fix '{pattern.get('description', 'this error')}'?",
                        'input': pattern.get('pattern', ''),
                        'output': pattern.get('fixSuggestion', 'Check the code for issues')
                    })
        
        # UI patterns
        if 'uiPatterns' in content:
            for pattern in content['uiPatterns'][:5]:
                if isinstance(pattern, dict):
                    examples.append({
                        'instruction': f"How do you handle {pattern.get('description', 'UI issue')}?",
                        'input': pattern.get('type', ''),
                        'output': pattern.get('fixSuggestion', 'Review UI implementation')
                    })
    
    return examples

def extract_architecture_examples(content):
    """Extract architecture and UI pattern examples"""
    examples = []
    
    if isinstance(content, dict):
        # Architecture patterns
        if 'architecturePatterns' in content:
            for key, value in content['architecturePatterns'].items():
                if isinstance(value, dict):
                    examples.append({
                        'instruction': f'Explain the {key} pattern in Universal AI Tools',
                        'input': '',
                        'output': f"{value.get('pattern', '')}. Implementation: {value.get('implementation', '')}. Benefits: {', '.join(value.get('benefits', []))}"
                    })
        
        # Component patterns
        if 'componentPatterns' in content:
            for comp_type, comp_data in content['componentPatterns'].items():
                if isinstance(comp_data, dict):
                    examples.append({
                        'instruction': f'What components are used for {comp_type}?',
                        'input': '',
                        'output': f"Components: {', '.join(comp_data.get('components', []))}. Features: {', '.join(comp_data.get('features', []))}"
                    })
    
    return examples

def extract_debugging_examples(content):
    """Extract debugging pattern examples"""
    examples = []
    
    if isinstance(content, dict):
        # Core debugging techniques
        if 'coreDebuggingTechniques' in content:
            for tech_name, tech_data in content['coreDebuggingTechniques'].items():
                if isinstance(tech_data, dict):
                    examples.append({
                        'instruction': f'How do you use {tech_name} for SwiftUI debugging?',
                        'input': '',
                        'output': f"{tech_data.get('description', '')} Usage: {tech_data.get('usage', '')}. {tech_data.get('importance', '')}"
                    })
        
        # Observable pattern debugging
        if 'observablePatternDebugging' in content:
            if 'commonIssues' in content['observablePatternDebugging']:
                for issue_name, issue_data in content['observablePatternDebugging']['commonIssues'].items():
                    if isinstance(issue_data, dict):
                        examples.append({
                            'instruction': f"How do you debug {issue_data.get('problem', 'Observable issues')}?",
                            'input': '',
                            'output': issue_data.get('solution', '') + ' Best practice: ' + issue_data.get('bestPractice', '')
                        })
    
    return examples

def extract_mlx_examples(content):
    """Extract MLX-specific examples"""
    examples = []
    
    if isinstance(content, dict):
        # Hyperparameters
        if 'loraHyperparameters' in content or 'hyperparametersOptimal' in content:
            params = content.get('hyperparametersOptimal', content.get('loraHyperparameters', {}))
            examples.append({
                'instruction': 'What are the optimal MLX LoRA hyperparameters?',
                'input': '',
                'output': f"LoRA rank: {params.get('loraRank', params.get('rank', {}).get('recommended', '8-16'))}, Alpha: {params.get('loraAlpha', 'rank x 2')}, Learning rate: {params.get('learningRate', '1e-5')}, Iterations: {params.get('iterations', '100+')}"
            })
        
        # Troubleshooting
        if 'troubleshooting' in content:
            for issue_type, solutions in content['troubleshooting'].items():
                if isinstance(solutions, list):
                    examples.append({
                        'instruction': f'How do you fix MLX {issue_type.replace("_", " ")}?',
                        'input': '',
                        'output': ' '.join(solutions[:3])  # First 3 solutions
                    })
    
    return examples

def extract_generic_examples(content, category):
    """Extract examples from generic content"""
    examples = []
    
    if isinstance(content, dict):
        # Try to extract any Q&A style content
        if 'title' in content:
            examples.append({
                'instruction': f"What is {content.get('title', category)}?",
                'input': '',
                'output': content.get('summary', content.get('description', str(content)[:500]))
            })
    
    return examples

def save_training_data(examples, output_file):
    """Save training examples to JSONL file"""
    
    with open(output_file, 'w') as f:
        for example in examples:
            f.write(json.dumps(example) + '\n')
    
    logger.info(f"📁 Saved {len(examples)} examples to {output_file}")

def main():
    logger.info("🚀 Starting Supabase knowledge extraction for MLX training")
    
    # Extract from Supabase
    training_examples = extract_context_storage()
    
    if training_examples:
        # Save to file
        output_file = "mlx-training-data/supabase_extracted_examples.jsonl"
        save_training_data(training_examples, output_file)
        
        # Show sample
        logger.info("\n📋 Sample extracted examples:")
        for i, example in enumerate(training_examples[:3], 1):
            logger.info(f"\n{i}. Q: {example['instruction']}")
            logger.info(f"   A: {example['output'][:200]}...")
    else:
        logger.warning("❌ No training examples extracted")

if __name__ == "__main__":
    main()