#!/bin/bash

# Script to push large commit in smaller chunks
# This will create multiple smaller commits from the large commit

echo "🚀 Starting chunked push strategy..."

# Create a backup branch
git checkout -b backup-before-chunking
git checkout main

# Get the list of all files in the large commit
git show --name-only --pretty=format: bf8278cd1 > all_files.txt

# Split files into categories
echo "📁 Categorizing files..."

# Core Rust services
grep -E "^crates/" all_files.txt > rust_files.txt
echo "Rust files: $(wc -l < rust_files.txt)"

# Go services
grep -E "^go-services/" all_files.txt > go_files.txt
echo "Go files: $(wc -l < go_files.txt)"

# Swift app
grep -E "^swift-companion-app/" all_files.txt > swift_files.txt
echo "Swift files: $(wc -l < swift_files.txt)"

# Python services
grep -E "^python-services/" all_files.txt > python_files.txt
echo "Python files: $(wc -l < python_files.txt)"

# Documentation
grep -E "\.(md|txt)$" all_files.txt > docs_files.txt
echo "Documentation files: $(wc -l < docs_files.txt)"

# Scripts
grep -E "^scripts/" all_files.txt > scripts_files.txt
echo "Scripts files: $(wc -l < scripts_files.txt)"

# Other files
grep -vE "^(crates/|go-services/|swift-companion-app/|python-services/|scripts/)" all_files.txt | grep -vE "\.(md|txt)$" > other_files.txt
echo "Other files: $(wc -l < other_files.txt)"

echo "✅ File categorization complete!"
echo "📊 Total files to process: $(wc -l < all_files.txt)"
