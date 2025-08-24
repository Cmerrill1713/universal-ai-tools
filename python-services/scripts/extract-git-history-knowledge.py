#!/usr/bin/env python3
"""
Extract knowledge from git commit history for MLX training
"""

import subprocess
import json
import re
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def get_recent_commits(limit=100):
    """Get recent commits with full messages"""
    try:
        # Get commit hashes and messages
        result = subprocess.run(
            ['git', 'log', f'--max-count={limit}', '--format=%H|%s|%b', '--no-merges'],
            capture_output=True,
            text=True,
            check=True
        )
        
        commits = []
        for line in result.stdout.strip().split('\n'):
            if line:
                parts = line.split('|', 2)
                if len(parts) >= 2:
                    commits.append({
                        'hash': parts[0][:8],
                        'subject': parts[1],
                        'body': parts[2] if len(parts) > 2 else ''
                    })
        
        return commits
    except Exception as e:
        logger.error(f"Error getting commits: {e}")
        return []

def extract_fixes_from_commits(commits):
    """Extract bug fixes and solutions from commit messages"""
    examples = []
    
    fix_patterns = [
        r'[Ff]ix(?:ed|es)?:?\s+(.+)',
        r'[Bb]ug(?:fix)?:?\s+(.+)',
        r'[Rr]esolve[ds]?:?\s+(.+)',
        r'[Ss]olve[ds]?:?\s+(.+)',
        r'[Pp]atch(?:ed)?:?\s+(.+)'
    ]
    
    for commit in commits:
        subject = commit['subject']
        body = commit['body']
        
        # Check for fix patterns
        for pattern in fix_patterns:
            match = re.search(pattern, subject)
            if match:
                problem = match.group(1).strip()
                
                # Extract solution from body or use subject
                solution = body.strip() if body else f"Fixed in commit {commit['hash']}: {subject}"
                
                examples.append({
                    'instruction': f'How do you fix "{problem}"?',
                    'input': '',
                    'output': solution[:500]  # Limit length
                })
                break
    
    return examples

def extract_features_from_commits(commits):
    """Extract feature implementations from commits"""
    examples = []
    
    feature_patterns = [
        r'[Ff]eat(?:ure)?:?\s+(.+)',
        r'[Aa]dd(?:ed)?:?\s+(.+)',
        r'[Ii]mplement(?:ed)?:?\s+(.+)',
        r'[Cc]reate[ds]?:?\s+(.+)',
        r'[Nn]ew:?\s+(.+)'
    ]
    
    for commit in commits[:50]:  # Limit to 50 features
        subject = commit['subject']
        body = commit['body']
        
        for pattern in feature_patterns:
            match = re.search(pattern, subject)
            if match:
                feature = match.group(1).strip()
                
                # Create implementation explanation
                implementation = body.strip() if body else subject
                
                examples.append({
                    'instruction': f'How is "{feature}" implemented?',
                    'input': '',
                    'output': implementation[:500]
                })
                break
    
    return examples

def extract_performance_improvements(commits):
    """Extract performance optimizations from commits"""
    examples = []
    
    perf_patterns = [
        r'[Pp]erf(?:ormance)?:?\s+(.+)',
        r'[Oo]ptimiz(?:e|ation):?\s+(.+)',
        r'[Ii]mprov(?:e|ement):?\s+(.+)',
        r'[Ss]peed(?:up)?:?\s+(.+)',
        r'[Rr]educe[ds]?:?\s+(.+)'
    ]
    
    for commit in commits:
        subject = commit['subject']
        body = commit['body']
        
        for pattern in perf_patterns:
            match = re.search(pattern, subject)
            if match:
                improvement = match.group(1).strip()
                
                examples.append({
                    'instruction': f'How was "{improvement}" performance optimized?',
                    'input': '',
                    'output': body.strip() if body else subject
                })
                break
    
    return examples

def extract_refactoring_patterns(commits):
    """Extract refactoring and architecture changes"""
    examples = []
    
    refactor_patterns = [
        r'[Rr]efactor(?:ed)?:?\s+(.+)',
        r'[Rr]estructure[ds]?:?\s+(.+)',
        r'[Mm]igrat(?:e|ion):?\s+(.+)',
        r'[Uu]pdate[ds]?:?\s+(.+)',
        r'[Mm]oderniz(?:e|ation):?\s+(.+)'
    ]
    
    for commit in commits[:30]:  # Limit to 30
        subject = commit['subject']
        body = commit['body']
        
        for pattern in refactor_patterns:
            match = re.search(pattern, subject)
            if match:
                change = match.group(1).strip()
                
                examples.append({
                    'instruction': f'Explain the refactoring of "{change}"',
                    'input': '',
                    'output': body.strip() if body else subject
                })
                break
    
    return examples

def get_changed_files_examples():
    """Extract examples from recently changed files"""
    examples = []
    
    try:
        # Get files changed in last 50 commits
        result = subprocess.run(
            ['git', 'diff', '--name-only', 'HEAD~50..HEAD'],
            capture_output=True,
            text=True,
            check=True
        )
        
        files = result.stdout.strip().split('\n')
        
        # Group by file type
        file_types = {}
        for file in files:
            if '.' in file:
                ext = file.split('.')[-1]
                if ext not in file_types:
                    file_types[ext] = []
                file_types[ext].append(file)
        
        # Create examples for different file types
        for ext, file_list in file_types.items():
            if ext in ['ts', 'tsx', 'js', 'jsx', 'go', 'rs', 'swift', 'py']:
                examples.append({
                    'instruction': f'What {ext} files were recently modified?',
                    'input': '',
                    'output': f"Recently modified {ext} files: {', '.join(file_list[:10])}"
                })
        
    except Exception as e:
        logger.error(f"Error getting changed files: {e}")
    
    return examples

def main():
    logger.info("📝 Extracting knowledge from git history")
    
    # Get recent commits
    commits = get_recent_commits(200)
    logger.info(f"Found {len(commits)} recent commits")
    
    all_examples = []
    
    # Extract different types of knowledge
    fixes = extract_fixes_from_commits(commits)
    all_examples.extend(fixes)
    logger.info(f"  ✅ Extracted {len(fixes)} bug fix examples")
    
    features = extract_features_from_commits(commits)
    all_examples.extend(features)
    logger.info(f"  ✅ Extracted {len(features)} feature examples")
    
    performance = extract_performance_improvements(commits)
    all_examples.extend(performance)
    logger.info(f"  ✅ Extracted {len(performance)} performance examples")
    
    refactoring = extract_refactoring_patterns(commits)
    all_examples.extend(refactoring)
    logger.info(f"  ✅ Extracted {len(refactoring)} refactoring examples")
    
    file_changes = get_changed_files_examples()
    all_examples.extend(file_changes)
    logger.info(f"  ✅ Extracted {len(file_changes)} file change examples")
    
    # Save examples
    output_file = "mlx-training-data/git_history_extracted_examples.jsonl"
    with open(output_file, 'w') as f:
        for example in all_examples:
            f.write(json.dumps(example) + '\n')
    
    logger.info(f"\n✅ Extracted {len(all_examples)} training examples from git history")
    logger.info(f"📁 Saved to {output_file}")
    
    # Show samples
    if all_examples:
        logger.info("\n📋 Sample examples:")
        for i, ex in enumerate(all_examples[:3], 1):
            logger.info(f"\n{i}. Q: {ex['instruction']}")
            logger.info(f"   A: {ex['output'][:150]}...")

if __name__ == "__main__":
    main()