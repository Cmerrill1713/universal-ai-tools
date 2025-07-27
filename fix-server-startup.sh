#!/bin/bash

echo "Fixing server.ts startup issues..."

# Create a simple test server to verify the environment works
cat > src/test-minimal-server.ts << 'EOF'
import express from 'express';

const app = express();
const PORT = process.env.PORT || 8080;

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
EOF

echo "Testing minimal server..."
npx tsx src/test-minimal-server.ts &
SERVER_PID=$!
sleep 2
kill $SERVER_PID

echo "If minimal server works, the issue is in server.ts"

# Try to identify the exact issue
echo -e "\nChecking server.ts syntax..."
npx esbuild src/server.ts --format=cjs --platform=node --analyze 2>&1 | grep -A5 -B5 "ERROR"