# ELK Stack - Quick Start Guide

## TL;DR

```bash
# 1. Fix system settings (macOS)
sudo sysctl -w vm.max_map_count=262144

# 2. Start ELK stack
./elk-manager.sh start

# 3. Wait 2-3 minutes, then access Kibana
open http://localhost:5601

# 4. Create index pattern: universal-ai-tools-*
# Go to Management → Index Patterns → Create
```

## Common Commands

```bash
# Start
./elk-manager.sh start

# Check status
./elk-manager.sh status

# View logs
./elk-manager.sh logs

# Test log ingestion
./elk-manager.sh test

# Health check
./elk-manager.sh health

# Stop
./elk-manager.sh stop

# Clean (removes all data)
./elk-manager.sh clean
```

## Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Kibana | http://localhost:5601 | Web UI for logs/dashboards |
| Elasticsearch | http://localhost:9200 | Data storage API |
| Logstash | http://localhost:9600 | Pipeline API |

## Ingestion Endpoints

| Type | Endpoint | Example |
|------|----------|---------|
| Beats | localhost:5044 | Filebeat, Metricbeat |
| TCP/JSON | localhost:5000 | `echo '{"message":"test"}' \| nc localhost 5000` |
| HTTP | http://localhost:8080 | POST JSON logs |

## Troubleshooting

### Elasticsearch won't start?
```bash
# Check memory
docker stats

# Fix vm.max_map_count
sudo sysctl -w vm.max_map_count=262144

# Check logs
./elk-manager.sh logs elasticsearch
```

### No data in Kibana?
```bash
# Check indices
curl localhost:9200/_cat/indices?v

# Send test log
./elk-manager.sh test

# Check filebeat
./elk-manager.sh logs filebeat
```

### Port conflicts?
```bash
# Check ports
lsof -i :9200  # Elasticsearch
lsof -i :5601  # Kibana
lsof -i :5044  # Logstash

# Stop conflicting services
```

## Next Steps

1. ✅ Start ELK stack
2. ✅ Create index pattern in Kibana
3. Configure your apps to send logs
4. Create custom dashboards
5. Set up alerts

For detailed documentation, see:
- `docs/ELK_SETUP_GUIDE.md` - Complete setup guide
- `./elk-manager.sh help` - All available commands

## Resource Requirements

| Component | CPU | RAM | Disk |
|-----------|-----|-----|------|
| Elasticsearch | 0.5-2 cores | 1-2GB | 10GB+ |
| Logstash | 0.5-1 core | 512MB-1GB | 1GB |
| Kibana | 0.5-1 core | 512MB-1GB | 1GB |
| **Total** | **2-4 cores** | **2-4GB** | **12GB+** |

## Integration Examples

### JavaScript/Node.js
```javascript
fetch('http://localhost:5000', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    level: 'INFO',
    message: 'User logged in',
    userId: 123,
    timestamp: new Date().toISOString()
  })
});
```

### Python
```python
import requests
import json
from datetime import datetime

log = {
    'level': 'INFO',
    'message': 'Process completed',
    'duration': 1.23,
    'timestamp': datetime.utcnow().isoformat()
}

requests.post('http://localhost:5000', json=log)
```

### cURL
```bash
curl -X POST http://localhost:5000 \
  -H "Content-Type: application/json" \
  -d '{"level":"INFO","message":"Test log","timestamp":"2025-01-10T12:00:00.000Z"}'
```

## Support

- 📖 Full docs: `docs/ELK_SETUP_GUIDE.md`
- 🛠️ Manager help: `./elk-manager.sh help`
- 📊 Elastic docs: https://www.elastic.co/guide/

---

**Last Updated**: 2025-01-10

