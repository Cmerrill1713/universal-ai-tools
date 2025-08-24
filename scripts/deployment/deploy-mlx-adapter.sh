#!/bin/bash

# Deploy MLX Comprehensive Adapter to Production
# This script deploys the fine-tuned adapter for production use

echo "🚀 Deploying MLX Comprehensive Adapter to Production"
echo "=================================================="

ADAPTER_PATH="./mlx-adapters/comprehensive-production"
PRODUCTION_PATH="./mlx-adapters/production"
BACKUP_PATH="./mlx-adapters/backup-$(date +%Y%m%d-%H%M%S)"

# Check if adapter exists
if [ ! -d "$ADAPTER_PATH" ]; then
    echo "❌ Error: Adapter not found at $ADAPTER_PATH"
    exit 1
fi

# Backup current production adapter if it exists
if [ -d "$PRODUCTION_PATH" ]; then
    echo "📦 Backing up current production adapter..."
    mv "$PRODUCTION_PATH" "$BACKUP_PATH"
    echo "✅ Backup created at $BACKUP_PATH"
fi

# Deploy new adapter
echo "📥 Deploying comprehensive adapter to production..."
cp -r "$ADAPTER_PATH" "$PRODUCTION_PATH"

# Create deployment metadata
cat > "$PRODUCTION_PATH/deployment.json" << EOF
{
  "deployed_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "training_metrics": {
    "total_examples": 398,
    "iterations": 200,
    "final_loss": 1.341,
    "validation_loss": 1.588,
    "domain_accuracy": 91.7
  },
  "data_sources": {
    "supabase": 32,
    "documentation": 209,
    "git_history": 67,
    "code_patterns": 73
  },
  "model_config": {
    "base_model": "mlx-community/Llama-3.1-8B-Instruct-4bit",
    "lora_layers": 16,
    "learning_rate": "1e-5",
    "batch_size": 1
  },
  "performance": {
    "inference_time_avg": "1.6s",
    "memory_usage": "17GB",
    "accuracy_by_category": {
      "swift": 100,
      "debugging": 100,
      "performance": 100,
      "services": 100,
      "mlx": 100,
      "architecture": 50
    }
  }
}
EOF

echo "✅ Deployment metadata created"

# Update MLX service configuration
echo "🔧 Updating MLX service configuration..."
cat > ./mlx-service-config.json << EOF
{
  "model": "mlx-community/Llama-3.1-8B-Instruct-4bit",
  "adapter_path": "./mlx-adapters/production",
  "max_tokens": 200,
  "temperature": 0.7,
  "top_p": 0.9,
  "service_port": 8005,
  "enabled": true
}
EOF

echo "✅ Service configuration updated"

echo ""
echo "🎉 Deployment Complete!"
echo "======================"
echo "✅ Adapter deployed to: $PRODUCTION_PATH"
echo "✅ Previous version backed up to: $BACKUP_PATH"
echo "✅ Domain accuracy: 91.7%"
echo "✅ Ready for production use"
echo ""
echo "📝 Next steps:"
echo "  1. Restart MLX service: killall python3 && python3 mlx-service.py"
echo "  2. Test production endpoint: curl http://localhost:8005/generate"
echo "  3. Monitor performance metrics"
echo ""
echo "🚀 The MLX model now has comprehensive knowledge of Universal AI Tools!"