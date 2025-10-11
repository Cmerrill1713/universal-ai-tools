# MLX Fine-tuning Service
A comprehensive fine-tuning service for Apple Silicon optimized with MLX, providing the complete lifecycle management for training custom language models.
## Overview
The MLX Fine-tuning Service is a production-ready system that handles the entire fine-tuning workflow from dataset preparation to model deployment. Built specifically for Apple Silicon with MLX optimization, it provides enterprise-grade features including job queuing, progress monitoring, hyperparameter optimization, and automated evaluation.
## Architecture
```

┌─────────────────────────────────────────────────────────────┐

│                   MLX Fine-tuning Service                   │

├─────────────────────────────────────────────────────────────┤

│  📊 Dataset Management  │  🎯 Job Orchestration            │

│  • Load & Validate      │  • Create & Start Jobs           │

│  • Preprocess Data      │  • Pause/Resume/Cancel           │

│  • Quality Scoring      │  • Queue Management              │

├─────────────────────────────────────────────────────────────┤

│  📈 Progress Monitor    │  🔬 Hyperparameter Optimization  │

│  • Real-time Metrics   │  • Grid/Random/Bayesian Search   │

│  • Loss Tracking       │  • Multi-trial Management        │

│  • Resource Usage      │  • Best Model Selection          │

├─────────────────────────────────────────────────────────────┤

│  📊 Model Evaluation    │  📦 Export & Deployment          │

│  • Automated Testing   │  • MLX/GGUF/SafeTensors Export   │

│  • Quality Metrics     │  • Production Deployment         │

│  • Sample Generation   │  • API Integration               │

└─────────────────────────────────────────────────────────────┘

         │                        │                     │

         ▼                        ▼                     ▼

    🍎 MLX Core           📊 Supabase Database    🔄 Job Queue

    Apple Silicon         Persistent Storage      Resource Management

```
## Features
### 🎯 **Complete Lifecycle Management**

- **Dataset Management**: Load, validate, and preprocess training data

- **Job Orchestration**: Create, start, pause, resume, and cancel training jobs

- **Progress Monitoring**: Real-time training metrics and progress tracking

- **Model Evaluation**: Automated quality assessment and benchmarking

- **Export & Deployment**: Multi-format model export and production deployment
### 🔬 **Advanced Optimization**

- **Hyperparameter Tuning**: Grid search, random search, Bayesian optimization

- **Resource Management**: Intelligent job queuing and capacity planning

- **Quality Assurance**: Automated dataset validation and model evaluation

- **Performance Optimization**: MLX-optimized training for Apple Silicon
### 🏗️ **Production Ready**

- **Database Persistence**: All jobs and data stored in Supabase

- **Error Handling**: Comprehensive error recovery and retry mechanisms

- **Health Monitoring**: Service health checks and resource monitoring

- **API Integration**: RESTful API with comprehensive endpoints
## Quick Start
### 1. Setup
```bash
# Install dependencies

npm install

# Setup database (run migration)

npx supabase migration up

# Configure environment

cp .env.example .env
# Edit .env with your configuration

```
### 2. Basic Usage
```typescript

import { mlxFineTuningService } from './src/services/mlx-fine-tuning-service';
// Load a dataset

const dataset = await mlxFineTuningService.loadDataset(

  '/path/to/dataset.jsonl',

  'my-dataset',

  'user-123'

);
// Create a fine-tuning job

const job = await mlxFineTuningService.createFineTuningJob(

  'my-fine-tuning-job',

  'user-123',

  'llama3.2-3b',

  '/path/to/base/model',

  dataset.path,

  {

    learningRate: 0.0001,

    batchSize: 4,

    epochs: 3

  }

);
// Start training

await mlxFineTuningService.startFineTuningJob(job.id);
// Monitor progress

const unsubscribe = mlxFineTuningService.subscribeToJobProgress(

  job.id,

  (progress) => console.log(`Progress: ${progress.progressPercentage}%`)

);

```
### 3. Run Demo
```bash
# Run the comprehensive demo

npm run demo:mlx-fine-tuning

# Or run interactively

npm run demo:mlx-fine-tuning:interactive

```
## API Endpoints
### Dataset Management

- `POST /api/v1/mlx-fine-tuning/datasets` - Upload and validate dataset

- `GET /api/v1/mlx-fine-tuning/datasets` - List user datasets
### Job Management

- `POST /api/v1/mlx-fine-tuning/jobs` - Create fine-tuning job

- `GET /api/v1/mlx-fine-tuning/jobs` - List jobs

- `GET /api/v1/mlx-fine-tuning/jobs/:id` - Get job details

- `POST /api/v1/mlx-fine-tuning/jobs/:id/start` - Start job

- `POST /api/v1/mlx-fine-tuning/jobs/:id/pause` - Pause job

- `POST /api/v1/mlx-fine-tuning/jobs/:id/resume` - Resume job

- `POST /api/v1/mlx-fine-tuning/jobs/:id/cancel` - Cancel job

- `DELETE /api/v1/mlx-fine-tuning/jobs/:id` - Delete job
### Progress Monitoring

- `GET /api/v1/mlx-fine-tuning/jobs/:id/progress` - Get job progress

- `GET /api/v1/mlx-fine-tuning/jobs/:id/metrics` - Get training metrics
### Hyperparameter Optimization

- `POST /api/v1/mlx-fine-tuning/experiments` - Start optimization experiment
### Model Operations

- `POST /api/v1/mlx-fine-tuning/jobs/:id/evaluate` - Evaluate model

- `POST /api/v1/mlx-fine-tuning/jobs/:id/export` - Export model

- `POST /api/v1/mlx-fine-tuning/jobs/:id/deploy` - Deploy model
### System Management

- `GET /api/v1/mlx-fine-tuning/queue` - Get queue status

- `PUT /api/v1/mlx-fine-tuning/jobs/:id/priority` - Set job priority

- `GET /api/v1/mlx-fine-tuning/health` - Get service health
## Dataset Format
The service supports multiple dataset formats:
### JSONL Format (Recommended)

```jsonl

{"input": "What is machine learning?", "output": "Machine learning is a subset of AI..."}

{"input": "Explain neural networks", "output": "Neural networks are computing systems..."}

```
### JSON Format

```json

[

  {

    "input": "Question or instruction",

    "output": "Expected response"

  }

]

```
### CSV Format

```csv

input,output

"What is AI?","Artificial Intelligence is..."

"Define ML","Machine Learning is..."

```
## Configuration
### Hyperparameters

```typescript

interface Hyperparameters {

  learningRate: number;      // 0.00001 - 0.01

  batchSize: number;         // 1, 2, 4, 8, 16

  epochs: number;            // 1 - 20

  maxSeqLength: number;      // 512 - 4096

  gradientAccumulation: number; // 1 - 8

  warmupSteps: number;       // 0 - 500

  weightDecay: number;       // 0.0 - 0.1

  dropout: number;           // 0.0 - 0.3

}

```
### Validation Configuration

```typescript

interface ValidationConfig {

  splitRatio: number;        // 0.1 - 0.3

  validationMetrics: string[]; // ['loss', 'perplexity', 'accuracy']

  earlyStopping: boolean;    // Enable early stopping

  patience: number;          // 2 - 10

}

```
## Hyperparameter Optimization
The service supports multiple optimization strategies:
### Grid Search

Exhaustive search over parameter combinations:

```typescript

const parameterSpace = {

  learningRate: [0.00005, 0.0001, 0.0002],

  batchSize: [2, 4, 8],

  epochs: [3, 5, 7]

};

```
### Random Search

Random sampling from parameter distributions:

```typescript

const parameterSpace = {

  learningRate: { min: 0.00001, max: 0.001 },

  batchSize: [2, 4, 8, 16],

  epochs: { min: 2, max: 10 }

};

```
### Bayesian Optimization

Intelligent search using previous trial results:

```typescript

await mlxFineTuningService.runHyperparameterOptimization(

  'optimization-experiment',

  baseJobId,

  userId,

  'bayesian',

  parameterSpace,

  20 // max trials

);

```
## Model Evaluation
Comprehensive evaluation metrics:
### Standard Metrics

- **Perplexity**: Language model quality

- **Loss**: Training objective value

- **Accuracy**: Task-specific accuracy
### Advanced Metrics

- **BLEU Score**: Text generation quality

- **ROUGE Scores**: Summary quality (ROUGE-1, ROUGE-2, ROUGE-L)

- **Custom Metrics**: Domain-specific evaluations
### Sample Evaluation

```typescript

const evaluation = await mlxFineTuningService.evaluateModel(

  jobId,

  modelPath,

  'final',

  {

    numSamples: 100,

    maxTokens: 256,

    temperature: 0.7,

    topP: 0.9

  }

);

```
## Export Formats
### MLX Format (Native)

- Optimized for Apple Silicon

- Fastest inference performance

- Direct integration with MLX
### GGUF Format

- Universal compatibility

- Works with llama.cpp

- Cross-platform deployment
### SafeTensors Format

- Secure tensor storage

- Memory-safe loading

- Industry standard
## Real-time Monitoring
### Progress Updates

```typescript

const unsubscribe = mlxFineTuningService.subscribeToJobProgress(

  jobId,

  (progress) => {

    console.log(`Epoch: ${progress.currentEpoch}/${progress.totalEpochs}`);

    console.log(`Step: ${progress.currentStep}/${progress.totalSteps}`);

    console.log(`Progress: ${progress.progressPercentage}%`);

  }

);

```
### Training Metrics

```typescript

mlxFineTuningService.on('jobMetricsUpdated', (job) => {

  const metrics = job.metrics;

  console.log(`Training Loss: ${metrics.trainingLoss.slice(-1)[0]}`);

  console.log(`Validation Loss: ${metrics.validationLoss.slice(-1)[0]}`);

  console.log(`Learning Rate: ${metrics.learningRates.slice(-1)[0]}`);

});

```
## Best Practices
### Dataset Preparation

1. **Quality over Quantity**: Ensure high-quality, relevant examples

2. **Diverse Examples**: Include varied inputs and outputs

3. **Proper Formatting**: Use consistent input/output structure

4. **Remove Duplicates**: Clean data for better training
### Hyperparameter Selection

1. **Start Conservative**: Begin with lower learning rates

2. **Batch Size**: Balance memory usage and gradient quality

3. **Early Stopping**: Prevent overfitting with patience

4. **Validation Split**: Use 10-20% for validation
### Resource Management

1. **Monitor Memory**: Apple Silicon has unified memory

2. **Queue Priority**: Set appropriate job priorities

3. **Concurrent Jobs**: Balance throughput and resources

4. **Cleanup**: Remove old jobs and models regularly
## Troubleshooting
### Common Issues

#### Dataset Loading Fails

```

Error: Dataset validation failed: Missing required field: input

```

**Solution**: Ensure dataset has required 'input' and 'output' fields

#### Memory Issues

```

Error: MLX out of memory during training

```

**Solution**: Reduce batch size or sequence length

#### Model Loading Fails

```

Error: Base model path does not exist

```

**Solution**: Verify model path and permissions
### Performance Optimization

#### Slow Training

- Reduce sequence length

- Increase batch size (if memory allows)

- Use gradient accumulation

- Enable MLX optimizations

#### Poor Model Quality

- Increase dataset size

- Improve data quality

- Tune hyperparameters

- Extend training epochs
## Integration Examples
### Express.js API

```typescript

import express from 'express';

import { mlxFineTuningService } from './services/mlx-fine-tuning-service';
const app = express();
app.post('/fine-tune', async (req, res) => {

  const job = await mlxFineTuningService.createFineTuningJob(

    req.body.name,

    req.user.id,

    req.body.baseModel,

    req.body.modelPath,

    req.body.datasetPath

  );

  

  res.json({ jobId: job.id });

});

```
### WebSocket Integration

```typescript

import { Server as SocketIOServer } from 'socket.io';
const io = new SocketIOServer(server);
mlxFineTuningService.on('jobProgressUpdated', (job) => {

  io.to(`job:${job.id}`).emit('progress', job.progress);

});
mlxFineTuningService.on('jobCompleted', (job) => {

  io.to(`user:${job.userId}`).emit('jobComplete', {

    jobId: job.id,

    modelPath: job.outputModelPath

  });

});

```
### React Frontend

```tsx

import { useEffect, useState } from 'react';

import io from 'socket.io-client';
function TrainingMonitor({ jobId }) {

  const [progress, setProgress] = useState(0);

  

  useEffect(() => {

    const socket = io();

    socket.emit('join', `job:${jobId}`);

    

    socket.on('progress', (data) => {

      setProgress(data.progressPercentage);

    });

    

    return () => socket.disconnect();

  }, [jobId]);

  

  return (

    <div className="progress-bar">

      <div 

        className="progress-fill" 

        style={{ width: `${progress}%` }}

      />

      <span>{progress.toFixed(1)}%</span>

    </div>

  );

}

```
## Performance Benchmarks
### Apple Silicon Performance

- **M1 Max (32GB)**: ~2-3 tokens/second training

- **M2 Ultra (64GB)**: ~4-6 tokens/second training

- **Memory Usage**: ~8-12GB for 3B parameter models
### Throughput Examples

- **Small Model (1B params)**: 2-3 hours for 3 epochs

- **Medium Model (3B params)**: 6-8 hours for 3 epochs  

- **Large Model (7B params)**: 12-16 hours for 3 epochs
## Contributing
We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.
### Development Setup

```bash

git clone <repository>

cd universal-ai-tools

npm install

npm run dev

```
### Running Tests

```bash

npm test

npm run test:integration

npm run test:performance

```
## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
## Support
- **Documentation**: [Full API Documentation](API_DOCUMENTATION.md)

- **Issues**: [GitHub Issues](https://github.com/your-org/universal-ai-tools/issues)

- **Discussions**: [GitHub Discussions](https://github.com/your-org/universal-ai-tools/discussions)

- **Email**: support@universal-ai-tools.com
---
**Built with ❤️ for Apple Silicon and MLX optimization**