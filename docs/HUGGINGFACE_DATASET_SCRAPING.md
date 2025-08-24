# HuggingFace Dataset Comprehensive Scraping

This system provides comprehensive scraping and ingestion of ALL datasets from HuggingFace Hub into the knowledge base.

## Overview

The system consists of:

1. **Comprehensive Scraper Script** - Discovers and processes ALL HuggingFace datasets
2. **API Endpoints** - REST API for controlling and monitoring scraping
3. **Existing Ingestion Service** - Leverages existing crawl4ai-based ingestion
4. **Progress Tracking** - Real-time progress updates and statistics

## Features

✅ **Complete Dataset Discovery** - Uses HuggingFace API with pagination to find ALL datasets  
✅ **Batch Processing** - Configurable batch sizes with rate limiting  
✅ **Progress Tracking** - Real-time progress updates and ETA calculations  
✅ **Error Handling** - Graceful failure handling, continues with remaining datasets  
✅ **Resume Support** - Can resume from specific dataset ID  
✅ **Filtering** - Support for author, tag, and other filters  
✅ **Statistics** - Comprehensive reporting and analytics  
✅ **API Integration** - Both standalone script and API endpoint  

## Quick Start

### 1. Environment Setup

Ensure your `.env` file contains:
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
LOCAL_API_BASE=http://localhost:9999/api  # Optional, defaults to this
```

### 2. Test with Small Subset

```bash
# Test with first 20 datasets
node scripts/test-dataset-scraping.js
```

### 3. Full Dataset Scraping

```bash
# Scrape ALL datasets (recommended for production)
node scripts/scrape-all-huggingface-datasets.js

# Or with custom parameters
node scripts/scrape-all-huggingface-datasets.js --batch-size 10 --delay 2000
```

## Script Usage

### Command Line Options

```bash
node scripts/scrape-all-huggingface-datasets.js [options]

Options:
  --limit <number>        Limit total datasets to process
  --batch-size <number>   Datasets per batch (default: 5)
  --delay <milliseconds>  Delay between batches (default: 3000)
  --skip-existing         Skip datasets already in knowledge base (default)
  --no-skip-existing      Process all datasets, even if they exist
  --dry-run              Show what would be done without ingesting
  --start-from <id>      Start from specific dataset ID (resume)
  --filter <tags>        Filter by tags (e.g., "text-classification")
  --author <name>        Filter by author/organization
  --help, -h             Show help message
```

### Examples

```bash
# Production: Scrape all datasets
node scripts/scrape-all-huggingface-datasets.js

# Testing: First 100 datasets only
node scripts/scrape-all-huggingface-datasets.js --limit 100

# Dry run to see what would be processed
node scripts/scrape-all-huggingface-datasets.js --dry-run --limit 10

# Resume from specific dataset
node scripts/scrape-all-huggingface-datasets.js --start-from "huggingface/CodeSearchNet"

# Filter by specific criteria
node scripts/scrape-all-huggingface-datasets.js --filter "text-classification" --author "huggingface"

# Faster processing
node scripts/scrape-all-huggingface-datasets.js --batch-size 10 --delay 1000
```

## API Endpoints

### Start Comprehensive Scraping

```http
POST /api/huggingface-knowledge/ingest/all-datasets
Content-Type: application/json

{
  "limit": null,           // null for all datasets
  "batchSize": 5,         // datasets per batch
  "delay": 3000,          // ms between batches
  "skipExisting": true,   // skip existing datasets
  "filter": null,         // tag filter
  "author": null,         // author filter
  "dryRun": false         // test mode
}
```

Response:
```json
{
  "success": true,
  "message": "Comprehensive dataset scraping initiated",
  "status": "started",
  "configuration": {
    "limit": "unlimited",
    "batchSize": 5,
    "delay": 3000,
    "skipExisting": true
  },
  "note": "Monitor server logs for progress"
}
```

### Get Dataset Statistics

```http
GET /api/huggingface-knowledge/dataset-stats
```

Response:
```json
{
  "success": true,
  "statistics": {
    "total_datasets": 1542,
    "recent_ingestions": [...],
    "daily_stats_last_week": {
      "2025-08-21": 234,
      "2025-08-20": 189
    }
  }
}
```

### Service Status

```http
GET /api/huggingface-knowledge/status
```

## Progress Monitoring

The script provides detailed progress updates:

```
📊 Progress Update:
   Processed: 150/5000
   ✅ Successful: 142
   ❌ Failed: 3
   ⏭️ Skipped: 5
   📈 Success rate: 94.7%
   ⚡ Rate: 45.2 datasets/min
   ⏱️ Elapsed: 3m 19s
   🎯 ETA: 1h 47m
```

## Expected Performance

### Processing Time Estimates

- **Small Test (100 datasets)**: ~3-5 minutes
- **Medium Batch (1,000 datasets)**: ~30-45 minutes  
- **Full Scraping (100,000+ datasets)**: ~30-50 hours

### Rate Limiting

- **Default Settings**: 5 datasets per batch, 3 seconds between batches
- **Conservative Rate**: ~100 datasets/hour
- **Optimized Rate**: ~300-500 datasets/hour (faster settings)

### Resource Usage

- **Memory**: ~50-100MB (efficient streaming)
- **Network**: Moderate (API calls + web scraping)
- **Storage**: ~1-5KB per dataset in knowledge base

## Architecture

```
HuggingFace Hub API
       ↓
   Dataset Discovery
   (with pagination)
       ↓
   Batch Processing
   (rate limited)
       ↓
   Existing Ingestion Service
   (crawl4ai + chunking)
       ↓
   Supabase Knowledge Base
```

## Error Handling

The system handles various failure scenarios:

1. **API Rate Limits** - Automatic retry with exponential backoff
2. **Network Timeouts** - Retry failed requests up to 3 times
3. **Individual Dataset Failures** - Continue with remaining datasets
4. **Memory Issues** - Efficient streaming, small batches
5. **Process Interruption** - Graceful shutdown, resume support

## Database Schema

Datasets are stored in the `knowledge_base` table:

```sql
{
  source: 'huggingface',
  source_id: 'dataset-id',
  category: 'dataset',
  title: 'Dataset Name',
  content: 'Full scraped content',
  metadata: {
    author: 'organization',
    tags: ['tag1', 'tag2'],
    license: 'license-type',
    dataset_size: '10GB',
    language: ['en', 'fr']
  },
  url: 'https://huggingface.co/datasets/dataset-id',
  created_at: '2025-08-21T10:30:00Z'
}
```

## Monitoring and Analytics

### Real-time Monitoring

- Progress percentage and ETA
- Success/failure rates
- Processing speed (datasets/min)
- Error categorization

### Post-completion Analytics

- Total datasets ingested
- Processing time breakdown
- Error analysis and recommendations
- Knowledge base impact metrics

## Best Practices

### For Production Use

1. **Start with dry run** to estimate scope
2. **Use conservative batch sizes** (3-5 datasets)
3. **Monitor server resources** during processing
4. **Enable skip-existing** to avoid duplicates
5. **Run during off-peak hours** for large batches

### For Testing

1. **Use small limits** (10-100 datasets)
2. **Enable dry-run mode** first
3. **Test with specific filters** to validate
4. **Check logs for any issues**

### For Resume/Recovery

1. **Note last processed dataset ID** from logs
2. **Use --start-from parameter** to resume
3. **Monitor for duplicate prevention**

## Troubleshooting

### Common Issues

**Script won't start:**
- Check environment variables (SUPABASE_URL, SUPABASE_SERVICE_KEY)
- Ensure local API server is running
- Verify network connectivity

**Slow processing:**
- Reduce batch size (--batch-size 3)
- Increase delay (--delay 5000)
- Check for rate limiting

**High failure rate:**
- Check crawl4ai service status
- Verify Supabase connection
- Review error logs for patterns

**Memory issues:**
- Reduce batch size
- Check for memory leaks in logs
- Restart with fresh process

### Log Analysis

Key log patterns to monitor:
```
✅ [dataset-id]: success          # Successful ingestion
❌ [dataset-id]: failed - error   # Failed ingestion
⏭️ [dataset-id]: skipped         # Already exists
📊 Progress Update:               # Regular status updates
```

## Future Enhancements

Planned improvements:

1. **Parallel Processing** - Multiple concurrent workers
2. **Smart Filtering** - ML-based dataset prioritization  
3. **Incremental Updates** - Only process new/updated datasets
4. **Quality Metrics** - Dataset quality scoring
5. **UI Dashboard** - Web interface for monitoring
6. **Webhook Integration** - Notifications for completion/errors

## Integration

This system integrates with:

- **Existing HuggingFace Ingestion Service** - Reuses proven crawl4ai infrastructure
- **Supabase Knowledge Base** - Stores all ingested data
- **Chunking Service** - Optimizes content for retrieval
- **Search System** - Enables querying of ingested datasets
- **API Router** - Provides REST endpoints for control

The comprehensive dataset scraping enhances the knowledge base with the complete catalog of HuggingFace datasets, enabling powerful search and discovery capabilities for AI researchers and developers.