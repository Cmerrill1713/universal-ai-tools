#!/bin/bash

# Remove voice services (we have voice-processing in Rust)
rm -f src/services/voice-*.ts
rm -f src/services/whisper-*.ts
rm -f src/services/nari-*.ts
rm -f src/services/tts-*.ts
rm -f src/services/speech-*.ts

# Remove vision services (we have vision crates in Rust)
rm -f src/services/vision-*.ts
rm -f src/services/visual-*.ts
rm -f src/services/image-*.ts

# Remove ML services (handled by Rust/Go)
rm -f src/services/ml-*.ts
rm -f src/services/llm-*.ts
rm -f src/services/ai-*.ts
rm -f src/services/model-*.ts

# Remove memory services (Go has this)
rm -f src/services/memory-*.ts
rm -f src/services/knowledge-*.ts

# Remove orchestration services (Rust handles this)
rm -f src/services/orchestrat*.ts
rm -f src/services/coordinator*.ts
rm -f src/services/agent-*.ts
rm -f src/services/autonomous-*.ts

# Remove duplicate infrastructure
rm -f src/services/cache-*.ts
rm -f src/services/redis-*.ts
rm -f src/services/database-*.ts
rm -f src/services/websocket-*.ts
rm -f src/services/stream-*.ts

# Remove test and demo files
rm -f src/services/test-*.ts
rm -f src/services/demo-*.ts
rm -f src/services/*-test.ts
rm -f src/services/*-demo.ts
rm -f src/services/*-example.ts

# Remove self-improvement and healing (consolidated)
rm -f src/services/self-*.ts
rm -f src/services/healing-*.ts
rm -f src/services/predictive-*.ts

# Remove template services (not core functionality)
rm -f src/services/template-*.ts
rm -f src/services/prp-*.ts

echo "Cleanup complete!"
echo "Remaining services:"
ls src/services/*.ts | wc -l
