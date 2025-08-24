#!/bin/bash

# Configure Grafana for easier local access

echo "🔧 Configuring Grafana authentication..."

# Option 1: Create an API key for programmatic access
echo "Creating API key..."
API_KEY_RESPONSE=$(curl -X POST http://localhost:3000/api/auth/keys \
  -H "Content-Type: application/json" \
  -u admin:admin123 \
  -d '{
    "name": "universal-ai-tools",
    "role": "Admin",
    "secondsToLive": 0
  }' 2>/dev/null)

if [ $? -eq 0 ]; then
    API_KEY=$(echo $API_KEY_RESPONSE | jq -r '.key')
    echo "✅ API Key created: $API_KEY"
    echo ""
    echo "You can now access Grafana API with:"
    echo "  curl -H \"Authorization: Bearer $API_KEY\" http://localhost:3000/api/..."
    echo ""
    
    # Save API key
    echo "GRAFANA_API_KEY=$API_KEY" > .grafana-api-key
    echo "API key saved to .grafana-api-key"
else
    echo "⚠️  Failed to create API key"
fi

echo ""
echo "📊 Grafana Access Information:"
echo "================================"
echo "Web UI: http://localhost:3000"
echo "Username: admin"
echo "Password: admin123"
echo ""
echo "Direct Dashboard Links (after login):"
echo "  • Overview: http://localhost:3000/d/universal-ai-overview"
echo "  • Explore: http://localhost:3000/explore"
echo "  • Data Sources: http://localhost:3000/datasources"
echo ""

# Option 2: Update Grafana to allow anonymous access (for local dev only)
echo "To enable anonymous access (local development only):"
echo "1. Stop Grafana container"
echo "2. Add these environment variables to docker-compose-minimal.yml:"
echo "   environment:"
echo "     - GF_AUTH_ANONYMOUS_ENABLED=true"
echo "     - GF_AUTH_ANONYMOUS_ORG_ROLE=Admin"
echo "3. Restart Grafana"
echo ""

# Create a bookmark file
cat > grafana-bookmarks.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Grafana Quick Links</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; }
        h1 { color: #f46800; }
        .links { list-style: none; padding: 0; }
        .links li { margin: 10px 0; }
        .links a { 
            display: block; 
            padding: 15px; 
            background: #f0f0f0; 
            text-decoration: none; 
            color: #333;
            border-radius: 5px;
            transition: background 0.3s;
        }
        .links a:hover { background: #e0e0e0; }
        .creds { 
            background: #fff3cd; 
            padding: 15px; 
            border-radius: 5px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎯 Grafana Quick Access</h1>
        <div class="creds">
            <strong>Login Credentials:</strong><br>
            Username: <code>admin</code><br>
            Password: <code>admin123</code>
        </div>
        <ul class="links">
            <li><a href="http://localhost:3000">🏠 Grafana Home</a></li>
            <li><a href="http://localhost:3000/d/universal-ai-overview">📊 Universal AI Dashboard</a></li>
            <li><a href="http://localhost:3000/explore">🔍 Explore Traces</a></li>
            <li><a href="http://localhost:3000/datasources">🔌 Data Sources</a></li>
            <li><a href="http://localhost:16686">🔬 Jaeger UI</a></li>
            <li><a href="http://localhost:9090">📈 Prometheus</a></li>
            <li><a href="http://localhost:6333/dashboard">💾 Qdrant Dashboard</a></li>
        </ul>
    </div>
</body>
</html>
EOF

echo "✅ Created grafana-bookmarks.html for quick access"
echo ""

# Open the bookmarks page
open grafana-bookmarks.html

echo "🎉 Configuration complete!"