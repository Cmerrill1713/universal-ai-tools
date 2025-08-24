#!/usr/bin/env python3
"""
Extract knowledge from all documentation files for MLX training
"""

import os
import re
import json
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def extract_from_markdown(file_path):
    """Extract Q&A pairs from markdown documentation"""
    examples = []
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    file_name = Path(file_path).stem
    
    # Extract title
    title_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
    if title_match:
        title = title_match.group(1)
        
        # Create overview question
        examples.append({
            'instruction': f'What is {title}?',
            'input': '',
            'output': get_first_paragraph(content)
        })
    
    # Extract sections
    sections = re.findall(r'^##\s+(.+)$\n(.*?)(?=^##|\Z)', content, re.MULTILINE | re.DOTALL)
    for section_title, section_content in sections[:5]:  # Limit to 5 sections per file
        if section_content.strip():
            examples.append({
                'instruction': f'Explain {section_title} in Universal AI Tools',
                'input': '',
                'output': clean_text(section_content)[:500]  # Limit length
            })
    
    # Extract code blocks with context
    code_blocks = re.findall(r'```(\w+)?\n(.*?)```\n(.*?)(?=^#|\Z)', content, re.DOTALL)
    for lang, code, context in code_blocks[:3]:  # Limit to 3 code examples
        if lang and code.strip():
            examples.append({
                'instruction': f'Show example {lang} code for {file_name}',
                'input': clean_text(context)[:100] if context else '',
                'output': code.strip()[:500]
            })
    
    # Extract lists (often contain important points)
    lists = re.findall(r'^[-*]\s+(.+)$', content, re.MULTILINE)
    if lists:
        examples.append({
            'instruction': f'What are key points about {file_name}?',
            'input': '',
            'output': ' '.join(lists[:10])  # First 10 items
        })
    
    return examples

def get_first_paragraph(content):
    """Get the first meaningful paragraph after the title"""
    paragraphs = re.split(r'\n\n+', content)
    for p in paragraphs[1:]:  # Skip title
        if len(p) > 50 and not p.startswith('#'):
            return clean_text(p)[:500]
    return "See documentation for details"

def clean_text(text):
    """Clean markdown text for training"""
    # Remove excessive whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)
    # Remove markdown links but keep text
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
    # Remove HTML comments
    text = re.sub(r'<!--.*?-->', '', text, flags=re.DOTALL)
    return text.strip()

def process_api_documentation(file_path):
    """Special processing for API documentation"""
    examples = []
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract API endpoints
    endpoints = re.findall(r'^###\s+(GET|POST|PUT|DELETE)\s+(.+)$\n(.*?)(?=^###|\Z)', 
                          content, re.MULTILINE | re.DOTALL)
    
    for method, endpoint, description in endpoints[:10]:
        examples.append({
            'instruction': f'How do you use the {method} {endpoint} endpoint?',
            'input': '',
            'output': clean_text(description)[:400]
        })
    
    return examples

def process_migration_docs(file_path):
    """Extract migration and architecture information"""
    examples = []
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract migration status
    status_sections = re.findall(r'✅\s+(.+?):\s+(.+?)(?=\n|$)', content)
    for item, status in status_sections[:10]:
        examples.append({
            'instruction': f'What is the status of {item}?',
            'input': '',
            'output': status
        })
    
    # Extract performance metrics
    metrics = re.findall(r'(\d+%)\s+(improvement|reduction|faster|increase)', content)
    if metrics:
        examples.append({
            'instruction': 'What performance improvements were achieved?',
            'input': '',
            'output': ' '.join([f"{m[0]} {m[1]}" for m in metrics[:5]])
        })
    
    return examples

def main():
    logger.info("📚 Extracting knowledge from documentation files")
    
    all_examples = []
    
    # Process main docs folder
    docs_dir = Path("docs")
    if docs_dir.exists():
        md_files = list(docs_dir.glob("*.md"))
        logger.info(f"Found {len(md_files)} documentation files")
        
        for file_path in md_files[:50]:  # Process up to 50 files
            try:
                # Special handling for certain files
                if 'API' in file_path.stem:
                    examples = process_api_documentation(file_path)
                elif 'MIGRATION' in file_path.stem or 'STATUS' in file_path.stem:
                    examples = process_migration_docs(file_path)
                else:
                    examples = extract_from_markdown(file_path)
                
                all_examples.extend(examples)
                logger.info(f"  ✅ {file_path.name}: {len(examples)} examples")
                
            except Exception as e:
                logger.warning(f"  ⚠️ Error processing {file_path.name}: {e}")
    
    # Process root level markdown files
    root_md_files = list(Path(".").glob("*.md"))
    for file_path in root_md_files[:20]:
        if file_path.name not in ['README.md', 'CLAUDE.md']:  # Skip these
            try:
                examples = extract_from_markdown(file_path)
                all_examples.extend(examples)
                logger.info(f"  ✅ {file_path.name}: {len(examples)} examples")
            except Exception as e:
                logger.warning(f"  ⚠️ Error processing {file_path.name}: {e}")
    
    # Save examples
    output_file = "mlx-training-data/documentation_extracted_examples.jsonl"
    with open(output_file, 'w') as f:
        for example in all_examples:
            f.write(json.dumps(example) + '\n')
    
    logger.info(f"\n✅ Extracted {len(all_examples)} training examples from documentation")
    logger.info(f"📁 Saved to {output_file}")
    
    # Show samples
    if all_examples:
        logger.info("\n📋 Sample examples:")
        for i, ex in enumerate(all_examples[:3], 1):
            logger.info(f"\n{i}. Q: {ex['instruction']}")
            logger.info(f"   A: {ex['output'][:150]}...")

if __name__ == "__main__":
    main()