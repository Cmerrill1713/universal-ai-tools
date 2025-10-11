# Elasticsearch, Logstash, Kibana (ELK) Stack Setup Guide

## Overview

This guide will help you set up and troubleshoot the ELK stack for Universal AI Tools. The ELK stack provides centralized logging, monitoring, and data visualization.

## Architecture

```
Application Logs → Filebeat → Logstash → Elasticsearch → Kibana
System Metrics  → Metricbeat ─────────→ Elasticsearch → Kibana
```

## Prerequisites

### System Requirements

- **Memory**: Minimum 4GB RAM (8GB recommended)
- **Disk**: Minimum 10GB free space
- **Docker**: Version 20.10 or later
- **Docker Compose**: Version 2.0 or later

### macOS Specific Requirements

Elasticsearch requires increased virtual memory limits:

```bash
# Temporary fix (until reboot)
sudo sysctl -w vm.max_map_count=262144

# Permanent fix - add to /etc/sysctl.conf
echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf
```

For macOS, also adjust Docker Desktop settings:
- Memory: At least 4GB (8GB recommended)
- Swap: At least 1GB
- Disk: At least 20GB

## Quick Start

### 1. Start the ELK Stack

```bash
# Navigate to project directory
cd /Users/christianmerrill/Documents/GitHub/AI-Projects/universal-ai-tools

# Create necessary directories
mkdir -p logs

# Start the ELK stack
docker compose -f docker-compose.elk.yml up -d

# Check status
docker compose -f docker-compose.elk.yml ps

# View logs
docker compose -f docker-compose.elk.yml logs -f
```

### 2. Verify Services

Wait 2-3 minutes for all services to start, then verify:

```bash
# Check Elasticsearch
curl -X GET "localhost:9200/_cluster/health?pretty"

# Check Logstash
curl -X GET "localhost:9600/_node/stats?pretty"

# Access Kibana
open http://localhost:5601
```

### 3. Initialize Kibana

1. Open Kibana: http://localhost:5601
2. Go to **Management** → **Stack Management** → **Index Patterns**
3. Create index pattern: `universal-ai-tools-*`
4. Select `@timestamp` as time field
5. Go to **Discover** to view logs

## Common Issues and Solutions

### Issue 1: Elasticsearch Fails to Start

**Symptom**: Container exits with error code 78 or "max virtual memory areas vm.max_map_count [65530] is too low"

**Solution**:
```bash
# macOS/Linux
sudo sysctl -w vm.max_map_count=262144

# Verify
sysctl vm.max_map_count

# Make permanent (macOS)
echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf
```

### Issue 2: Out of Memory Errors

**Symptom**: Elasticsearch crashes or becomes unresponsive

**Solution**:
```bash
# Check memory usage
docker stats

# Increase Docker memory limit in Docker Desktop settings
# Or reduce Elasticsearch heap size in docker-compose.elk.yml:
# ES_JAVA_OPTS=-Xms512m -Xmx512m
```

### Issue 3: Port Already in Use

**Symptom**: "port is already allocated" error

**Solution**:
```bash
# Check what's using the port
lsof -i :9200  # Elasticsearch
lsof -i :5601  # Kibana
lsof -i :5044  # Logstash

# Stop conflicting services or change ports in docker-compose.elk.yml
```

### Issue 4: Elasticsearch Yellow/Red Cluster Health

**Symptom**: Cluster health is not green

**Solution**:
```bash
# Check cluster health
curl -X GET "localhost:9200/_cluster/health?pretty"

# For single-node setup, yellow is normal (due to unassigned replicas)
# Set replicas to 0 for all indices:
curl -X PUT "localhost:9200/_settings" -H 'Content-Type: application/json' -d'
{
  "index": {
    "number_of_replicas": 0
  }
}'
```

### Issue 5: No Data in Kibana

**Symptom**: Kibana shows no data

**Solution**:
```bash
# Verify Elasticsearch has data
curl -X GET "localhost:9200/_cat/indices?v"

# Check if filebeat is sending data
docker logs universal-ai-tools-filebeat

# Check logstash pipeline
docker logs universal-ai-tools-logstash

# Manually test log ingestion
echo '{"message":"test log","level":"INFO","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"}' | \
  curl -X POST "localhost:5000" -H "Content-Type: application/json" -d @-
```

### Issue 6: Slow Performance

**Symptom**: Queries are slow, system is sluggish

**Solution**:
```bash
# Check Elasticsearch performance
curl -X GET "localhost:9200/_nodes/stats?pretty"

# Optimize indices
curl -X POST "localhost:9200/universal-ai-tools-*/_forcemerge?max_num_segments=1"

# Clear old data
curl -X DELETE "localhost:9200/universal-ai-tools-$(date -d '30 days ago' +%Y.%m.%d)"

# Adjust refresh interval
curl -X PUT "localhost:9200/_settings" -H 'Content-Type: application/json' -d'
{
  "index": {
    "refresh_interval": "30s"
  }
}'
```

## Configuration

### Elasticsearch Tuning

Edit `docker-compose.elk.yml`:

```yaml
elasticsearch:
  environment:
    # Increase heap size for production
    - ES_JAVA_OPTS=-Xms2g -Xmx2g
    
    # Adjust thread pool sizes
    - thread_pool.write.queue_size=1000
    - thread_pool.search.queue_size=1000
```

### Logstash Pipeline

Custom pipelines can be added to `monitoring/logstash/pipeline/`:

```bash
# Add custom pipeline
cat > monitoring/logstash/pipeline/custom.conf << 'EOF'
input {
  tcp {
    port => 5001
    codec => json
  }
}

filter {
  # Your filters here
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "custom-%{+YYYY.MM.dd}"
  }
}
EOF

# Restart logstash
docker compose -f docker-compose.elk.yml restart logstash
```

### Filebeat Configuration

Edit `monitoring/filebeat/filebeat.yml` to add more log sources:

```yaml
filebeat.inputs:
  - type: log
    enabled: true
    paths:
      - /path/to/your/logs/*.log
    fields:
      service: your-service-name
```

## Monitoring and Maintenance

### Health Checks

```bash
# Quick health check script
cat > check-elk-health.sh << 'EOF'
#!/bin/bash
echo "Checking Elasticsearch..."
curl -s localhost:9200/_cluster/health?pretty | grep status

echo -e "\nChecking Logstash..."
curl -s localhost:9600/_node/stats | grep -q "pipeline" && echo "OK" || echo "FAIL"

echo -e "\nChecking Kibana..."
curl -s localhost:5601/api/status | grep -q "available" && echo "OK" || echo "FAIL"

echo -e "\nIndex sizes:"
curl -s "localhost:9200/_cat/indices?v&s=store.size:desc"
EOF

chmod +x check-elk-health.sh
./check-elk-health.sh
```

### Backup and Restore

```bash
# Create snapshot repository
curl -X PUT "localhost:9200/_snapshot/backup" -H 'Content-Type: application/json' -d'
{
  "type": "fs",
  "settings": {
    "location": "/usr/share/elasticsearch/backup"
  }
}'

# Create snapshot
curl -X PUT "localhost:9200/_snapshot/backup/snapshot_1?wait_for_completion=true"

# List snapshots
curl -X GET "localhost:9200/_snapshot/backup/_all?pretty"

# Restore snapshot
curl -X POST "localhost:9200/_snapshot/backup/snapshot_1/_restore"
```

### Log Rotation

```bash
# Delete indices older than 30 days
curl -X DELETE "localhost:9200/universal-ai-tools-$(date -d '30 days ago' +%Y.%m.%d)"

# Or use ILM (Index Lifecycle Management) in Kibana:
# Management → Stack Management → Index Lifecycle Policies
```

## Integration with Applications

### JavaScript/TypeScript

```typescript
import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';

const logger = winston.createLogger({
  transports: [
    new ElasticsearchTransport({
      level: 'info',
      clientOpts: {
        node: 'http://localhost:9200',
      },
      index: 'universal-ai-tools-logs',
    }),
  ],
});

logger.info('Application started', { service: 'api', version: '1.0.0' });
```

### Python

```python
from elasticsearch import Elasticsearch
import logging
from datetime import datetime

es = Elasticsearch(['http://localhost:9200'])

def log_to_elasticsearch(level, message, **kwargs):
    doc = {
        'timestamp': datetime.utcnow().isoformat(),
        'level': level,
        'message': message,
        **kwargs
    }
    es.index(index='universal-ai-tools-logs', document=doc)

log_to_elasticsearch('INFO', 'Application started', service='api')
```

### Direct TCP/JSON

```bash
# Send JSON logs directly to Logstash
echo '{"level":"INFO","message":"Direct log","service":"test"}' | \
  nc localhost 5000
```

## Useful Commands

```bash
# Start ELK stack
docker compose -f docker-compose.elk.yml up -d

# Stop ELK stack
docker compose -f docker-compose.elk.yml down

# Stop and remove all data
docker compose -f docker-compose.elk.yml down -v

# View logs
docker compose -f docker-compose.elk.yml logs -f elasticsearch
docker compose -f docker-compose.elk.yml logs -f logstash
docker compose -f docker-compose.elk.yml logs -f kibana

# Restart specific service
docker compose -f docker-compose.elk.yml restart elasticsearch

# Check resource usage
docker stats universal-ai-tools-elasticsearch
docker stats universal-ai-tools-logstash
docker stats universal-ai-tools-kibana
```

## Production Recommendations

1. **Security**:
   - Enable X-Pack security
   - Configure SSL/TLS
   - Set up authentication
   - Use API keys for applications

2. **Performance**:
   - Use SSD storage
   - Increase heap size based on available RAM
   - Configure ILM policies
   - Use separate nodes for different roles

3. **High Availability**:
   - Deploy multiple Elasticsearch nodes
   - Configure replication
   - Use load balancer for Kibana
   - Set up monitoring with Metricbeat

4. **Backup**:
   - Configure automated snapshots
   - Store snapshots off-site
   - Test restore procedures regularly

## Troubleshooting Commands

```bash
# Reset Elasticsearch (DANGER: deletes all data)
docker compose -f docker-compose.elk.yml down -v
docker volume rm universal-ai-tools-elk_elasticsearch_data

# Check Elasticsearch logs
docker logs universal-ai-tools-elasticsearch 2>&1 | less

# Enter Elasticsearch container
docker exec -it universal-ai-tools-elasticsearch bash

# Check Elasticsearch configuration
curl -X GET "localhost:9200/_cluster/settings?pretty"

# Check node information
curl -X GET "localhost:9200/_nodes?pretty"

# Check index settings
curl -X GET "localhost:9200/universal-ai-tools-*/_settings?pretty"
```

## Support

For issues not covered in this guide:

1. Check the official documentation:
   - [Elasticsearch](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)
   - [Logstash](https://www.elastic.co/guide/en/logstash/current/index.html)
   - [Kibana](https://www.elastic.co/guide/en/kibana/current/index.html)

2. Review Docker logs:
   ```bash
   docker compose -f docker-compose.elk.yml logs
   ```

3. Check system resources:
   ```bash
   docker stats
   df -h
   free -h  # Linux only
   ```

## Next Steps

After setting up the ELK stack:

1. Create custom dashboards in Kibana
2. Set up alerts and notifications
3. Configure Index Lifecycle Management (ILM)
4. Integrate with your applications
5. Set up automated backups
6. Configure monitoring for the ELK stack itself

---

**Last Updated**: 2025-01-10
**Version**: 1.0.0

