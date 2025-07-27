#!/bin/bash
# Quick cleanup script for test files

echo "🧹 Cleaning up test files from root directory..."
echo ""

# Create directories if they don't exist
mkdir -p scripts/testing
mkdir -p scripts/security
mkdir -p scripts/validation
mkdir -p docs/test-reports
mkdir -p tests/html
mkdir -p tests/integration
mkdir -p archive/old-tests
mkdir -p logs

# Move test report markdown files
echo "📄 Moving test reports..."
mv -v *TEST*.md *TESTING*.md docs/test-reports/ 2>/dev/null
mv -v ACTUAL_TEST_RESULTS.md MODEL_TESTING_RESULTS.md REAL_WORLD_TEST_RESULTS.md docs/test-reports/ 2>/dev/null
mv -v USER_ACCEPTANCE_TESTING.md docs/test-reports/ 2>/dev/null

# Move test HTML files
echo "🌐 Moving test HTML files..."
mv -v test-*.html minimal-test.html tests/html/ 2>/dev/null

# Move test scripts
echo "📜 Moving test scripts..."
mv -v test-*.js test-*.ts test-*.mjs test-*.cjs scripts/testing/ 2>/dev/null
mv -v test-*.sh run-*test*.sh scripts/testing/ 2>/dev/null
mv -v test-*.py scripts/testing/ 2>/dev/null

# Move security test files
echo "🔒 Moving security test files..."
mv -v security-test*.js security-test*.ts test-security*.js test-auth*.js scripts/security/ 2>/dev/null

# Move validation scripts
echo "✅ Moving validation scripts..."
mv -v validate-*.js validate-*.cjs verify-*.sh verify-*.js scripts/validation/ 2>/dev/null

# Move log files
echo "📝 Moving log files..."
mv -v *.log logs/ 2>/dev/null

# Delete PID files
echo "🗑️  Deleting PID files..."
rm -v *.pid 2>/dev/null

# Archive old server test files
echo "📦 Archiving old server test files..."
mv -v server-debug*.ts server-debug*.js server-test*.js test-server*.js archive/old-tests/ 2>/dev/null
mv -v server-*-test.js server-*-test.ts archive/old-tests/ 2>/dev/null

# Count remaining test files
echo ""
echo "📊 Summary:"
echo "Test files remaining in root:"
ls -1 | grep -E "(test|Test|TEST)" | wc -l
echo ""
echo "To see remaining test files:"
echo "ls -1 | grep -E '(test|Test|TEST)'"
echo ""
echo "✅ Cleanup complete!"