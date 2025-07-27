#!/bin/bash

# Targeted Fix Script for Critical Remaining Patterns
# Addresses specific issues that prevent compilation

set -e

echo "🔧 Starting Targeted Critical Pattern Fixes..."
echo "📍 Working directory: $(pwd)"

# Phase 1: Fix critical server.ts compilation issues
echo ""
echo "🚀 Phase 1: Critical Server Fixes"
echo "=================================="

# Fix missing dots in method calls - more specific patterns
echo "🔄 Fixing missing dots in method calls..."

# Fix app use() patterns
find src -name "*.ts" -type f -exec sed -i '' 's/appuse(/app.use(/g' {} \;

# Fix req/res method patterns
find src -name "*.ts" -type f -exec sed -i '' 's/reqmethod/req.method/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/reqpath/req.path/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/reqbody/req.body/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/reqparams/req.params/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/reqquery/req.query/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/reqheaders/req.headers/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/requser/req.user/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/reqip/req.ip/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/reqget(/req.get(/g' {} \;

find src -name "*.ts" -type f -exec sed -i '' 's/resstatus(/res.status(/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/resjson(/res.json(/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/ressend(/res.send(/g' {} \;

# Fix service patterns
find src -name "*.ts" -type f -exec sed -i '' 's/serverlisten(/server.listen(/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/serverclose(/server.close(/g' {} \;

# Fix process patterns
find src -name "*.ts" -type f -exec sed -i '' 's/processexit(/process.exit(/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/processon(/process.on(/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/processenv/process.env/g' {} \;

# Fix console and logger patterns
find src -name "*.ts" -type f -exec sed -i '' 's/consolelog(/console.log(/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/consoleerror(/console.error(/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/consolewarn(/console.warn(/g' {} \;

echo "✅ Phase 1 completed: Critical server patterns fixed"

# Phase 2: Fix malformed object patterns
echo ""
echo "🚀 Phase 2: Object Pattern Fixes"
echo "=================================="

echo "🔄 Fixing malformed object access patterns..."

# Fix common object patterns
find src -name "*.ts" -type f -exec sed -i '' 's/Dateĥnow(/Date.now(/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/Mathĥrandom(/Math.random(/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/Mathĥmax(/Math.max(/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/Mathĥmin(/Math.min(/g' {} \;

# Fix JSON patterns
find src -name "*.ts" -type f -exec sed -i '' 's/JSONĥstringify(/JSON.stringify(/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/JSONĥparse(/JSON.parse(/g' {} \;

# Fix Object patterns
find src -name "*.ts" -type f -exec sed -i '' 's/Objectĥkeys(/Object.keys(/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/Objectĥvalues(/Object.values(/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/Objectĥentries(/Object.entries(/g' {} \;

echo "✅ Phase 2 completed: Object patterns fixed"

# Phase 3: Fix string method patterns
echo ""
echo "🚀 Phase 3: String Method Fixes"
echo "================================"

echo "🔄 Fixing string method patterns..."

# Fix common string methods with specific patterns
find src -name "*.ts" -type f -exec sed -i '' 's/\([a-zA-Z_][a-zA-Z0-9_]*\)toString(/\1.toString(/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/\([a-zA-Z_][a-zA-Z0-9_]*\)toLowerCase(/\1.toLowerCase(/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/\([a-zA-Z_][a-zA-Z0-9_]*\)toUpperCase(/\1.toUpperCase(/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/\([a-zA-Z_][a-zA-Z0-9_]*\)substring(/\1.substring(/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/\([a-zA-Z_][a-zA-Z0-9_]*\)replace(/\1.replace(/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/\([a-zA-Z_][a-zA-Z0-9_]*\)includes(/\1.includes(/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/\([a-zA-Z_][a-zA-Z0-9_]*\)startsWith(/\1.startsWith(/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/\([a-zA-Z_][a-zA-Z0-9_]*\)endsWith(/\1.endsWith(/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/\([a-zA-Z_][a-zA-Z0-9_]*\)trim(/\1.trim(/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/\([a-zA-Z_][a-zA-Z0-9_]*\)split(/\1.split(/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/\([a-zA-Z_][a-zA-Z0-9_]*\)join(/\1.join(/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/\([a-zA-Z_][a-zA-Z0-9_]*\)match(/\1.match(/g' {} \;

echo "✅ Phase 3 completed: String method patterns fixed"

# Phase 4: Fix specific malformed patterns seen in files
echo ""
echo "🚀 Phase 4: Specific Pattern Fixes"
echo "=================================="

echo "🔄 Fixing specific malformed patterns..."

# Fix the weird dotted patterns like .E.T -> ET, .S.T -> ST
find src -name "*.ts" -type f -exec sed -i '' 's/G\.E\.T/GET/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/P\.O\.S\.T/POST/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/H\.T\.T\.P/HTTP/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/A\.P\.I/API/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/J\.W\.T/JWT/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/J\.S\.O\.N/JSON/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/D\.S\.P\.y/DSPy/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/I\.S\.O/ISO/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/G\.D\.P\.R/GDPR/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/U\.I/UI/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/A\.I/AI/g' {} \;

# Fix common method name patterns
find src -name "*.ts" -type f -exec sed -i '' 's/toISO\.String()/toISOString()/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/toLower\.Case()/toLowerCase()/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/toUpper\.Case()/toUpperCase()/g' {} \;

echo "✅ Phase 4 completed: Specific patterns fixed"

# Summary
echo ""
echo "🏁 Targeted Critical Fix Complete!"
echo "=================================="
echo "🔧 Fixed critical server startup patterns"
echo "🔧 Fixed object access patterns"
echo "🔧 Fixed string method patterns"
echo "🔧 Fixed specific malformed acronym patterns"
echo ""
echo "📋 Next Steps:"
echo "1. Test TypeScript compilation: npm run build"
echo "2. Test server startup: npm run dev"
echo ""
echo "🎉 Critical pattern fix completed successfully!"