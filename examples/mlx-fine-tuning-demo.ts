#!/usr/bin/env ts-node

/**
 * MLX Fine-tuning Service Demo
 * Comprehensive example showing all features of the MLX fine-tuning service
 * 
 * This demo covers:
 * - Dataset loading and validation
 * - Fine-tuning job creation and management
 * - Progress monitoring
 * - Hyperparameter optimization
 * - Model evaluation
 * - Model export and deployment
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { mlxFineTuningService } from '../src/services/mlx-fine-tuning-service';

// Demo configuration
const DEMO_CONFIG = {
  userId: 'demo-user-123',
  datasetName: 'demo-training-dataset',
  jobName: 'demo-fine-tuning-job',
  baseModelName: 'llama3.2-3b',
  baseModelPath: '/Users/christianmerrill/Desktop/universal-ai-tools/models/llama3.2-3b',
  sampleDatasetPath: join(process.cwd(), 'temp', 'demo-dataset.jsonl')
};

class MLXFineTuningDemo {
  private demoJobId: string | null = null;
  private demoDatasetId: string | null = null;

  async run(): Promise<void> {
    console.log('🍎 MLX Fine-tuning Service Demo Starting...\n');

    try {
      // Step 1: Create sample dataset
      await this.createSampleDataset();

      // Step 2: Load and validate dataset
      await this.demonstrateDatasetManagement();

      // Step 3: Create and manage fine-tuning job
      await this.demonstrateJobManagement();

      // Step 4: Monitor progress (simulated)
      await this.demonstrateProgressMonitoring();

      // Step 5: Hyperparameter optimization
      await this.demonstrateHyperparameterOptimization();

      // Step 6: Model evaluation
      await this.demonstrateModelEvaluation();

      // Step 7: Model export and deployment
      await this.demonstrateModelExportDeployment();

      // Step 8: Service health and status
      await this.demonstrateHealthMonitoring();

      console.log('✅ Demo completed successfully!');

    } catch (error) {
      console.error('❌ Demo failed:', error);
      process.exit(1);
    }
  }

  private async createSampleDataset(): Promise<void> {
    console.log('📊 Creating sample training dataset...');

    // Create temp directory
    const tempDir = join(process.cwd(), 'temp');
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }

    // Sample training data in instruction-response format
    const sampleData = [
      {
        input: "What is the capital of France?",
        output: "The capital of France is Paris, a beautiful city known for its art, culture, and the Eiffel Tower."
      },
      {
        input: "Explain machine learning in simple terms.",
        output: "Machine learning is a way for computers to learn patterns from data without being explicitly programmed for every scenario. It's like teaching a computer to recognize cats by showing it thousands of cat pictures."
      },
      {
        input: "How do you make coffee?",
        output: "To make coffee: 1) Boil water, 2) Add ground coffee to a filter, 3) Pour hot water over the grounds, 4) Let it brew for 3-4 minutes, 5) Enjoy your fresh coffee!"
      },
      {
        input: "What are the benefits of exercise?",
        output: "Exercise benefits include improved cardiovascular health, stronger muscles and bones, better mental health, increased energy levels, and enhanced quality of sleep."
      },
      {
        input: "Describe the water cycle.",
        output: "The water cycle involves evaporation from water bodies, condensation into clouds, precipitation as rain or snow, and collection back into water bodies. This continuous process is powered by solar energy."
      }
    ];

    // Add more samples to make it realistic (duplicate with variations)
    const expandedData = [];
    for (let i = 0; i < 50; i++) {
      const baseEntry = sampleData[i % sampleData.length];
      expandedData.push({
        input: baseEntry.input + (i > 4 ? ` (variation ${Math.floor(i/5)})` : ''),
        output: baseEntry.output
      });
    }

    // Write to JSONL format
    const jsonlContent = expandedData
      .map(entry => JSON.stringify(entry))
      .join('\n');

    writeFileSync(DEMO_CONFIG.sampleDatasetPath, jsonlContent, 'utf8');

    console.log(`✅ Created sample dataset with ${expandedData.length} entries`);
    console.log(`   Path: ${DEMO_CONFIG.sampleDatasetPath}\n`);
  }

  private async demonstrateDatasetManagement(): Promise<void> {
    console.log('📚 Demonstrating Dataset Management...');

    try {
      // Load dataset with custom preprocessing config
      const preprocessingConfig = {
        maxLength: 1024,
        truncation: true,
        padding: true,
        removeDuplicates: true,
        shuffle: true,
        validationSplit: 0.2  // 20% for validation
      };

      const dataset = await mlxFineTuningService.loadDataset(
        DEMO_CONFIG.sampleDatasetPath,
        DEMO_CONFIG.datasetName,
        DEMO_CONFIG.userId,
        preprocessingConfig
      );

      this.demoDatasetId = dataset.id;

      console.log('✅ Dataset loaded successfully:');
      console.log(`   Name: ${dataset.name}`);
      console.log(`   Total samples: ${dataset.totalSamples}`);
      console.log(`   Training samples: ${dataset.trainingSamples}`);
      console.log(`   Validation samples: ${dataset.validationSamples}`);
      console.log(`   Quality score: ${dataset.validationResults.qualityScore.toFixed(2)}`);
      console.log(`   Average length: ${Math.round(dataset.statistics.avgLength)} characters`);
      console.log('');

    } catch (error) {
      console.error('❌ Dataset management failed:', error);
      throw error;
    }
  }

  private async demonstrateJobManagement(): Promise<void> {
    console.log('🎯 Demonstrating Fine-tuning Job Management...');

    try {
      // Create fine-tuning job with custom hyperparameters
      const hyperparameters = {
        learningRate: 0.0001,
        batchSize: 2,
        epochs: 2, // Small for demo
        maxSeqLength: 1024,
        gradientAccumulation: 2,
        warmupSteps: 50,
        weightDecay: 0.01,
        dropout: 0.1
      };

      const validationConfig = {
        splitRatio: 0.2,
        validationMetrics: ['loss', 'perplexity', 'accuracy'],
        earlyStopping: true,
        patience: 2
      };

      const job = await mlxFineTuningService.createFineTuningJob(
        DEMO_CONFIG.jobName,
        DEMO_CONFIG.userId,
        DEMO_CONFIG.baseModelName,
        DEMO_CONFIG.baseModelPath,
        DEMO_CONFIG.sampleDatasetPath,
        hyperparameters,
        validationConfig
      );

      this.demoJobId = job.id;

      console.log('✅ Fine-tuning job created successfully:');
      console.log(`   Job ID: ${job.id}`);
      console.log(`   Job Name: ${job.jobName}`);
      console.log(`   Status: ${job.status}`);
      console.log(`   Base Model: ${job.baseModelName}`);
      console.log(`   Output Model: ${job.outputModelName}`);
      console.log(`   Learning Rate: ${job.hyperparameters.learningRate}`);
      console.log(`   Batch Size: ${job.hyperparameters.batchSize}`);
      console.log(`   Epochs: ${job.hyperparameters.epochs}`);
      console.log('');

      // Demonstrate job operations
      console.log('🔄 Demonstrating job operations...');

      // Note: In a real scenario, you would start the job here
      // await mlxFineTuningService.startFineTuningJob(job.id);
      // 
      // For demo purposes, we'll simulate different states
      console.log('   ▶️  Job start (simulated)');
      console.log('   ⏸️  Job pause (simulated)');  
      console.log('   ▶️  Job resume (simulated)');
      console.log('');

    } catch (error) {
      console.error('❌ Job management failed:', error);
      throw error;
    }
  }

  private async demonstrateProgressMonitoring(): Promise<void> {
    console.log('📊 Demonstrating Progress Monitoring...');

    if (!this.demoJobId) {
      console.log('⚠️  No demo job available, skipping progress monitoring');
      return;
    }

    try {
      // Get job progress
      const progress = await mlxFineTuningService.getJobProgress(this.demoJobId);
      
      console.log('✅ Progress monitoring available:');
      console.log(`   Current Epoch: ${progress?.currentEpoch || 0}/${progress?.totalEpochs || 0}`);
      console.log(`   Current Step: ${progress?.currentStep || 0}/${progress?.totalSteps || 0}`);
      console.log(`   Progress: ${progress?.progressPercentage.toFixed(1) || 0}%`);
      console.log('');

      // Get training metrics
      const metrics = await mlxFineTuningService.getJobMetrics(this.demoJobId);
      
      console.log('📈 Training metrics available:');
      console.log(`   Training loss history: ${metrics?.trainingLoss.length || 0} points`);
      console.log(`   Validation loss history: ${metrics?.validationLoss.length || 0} points`);
      console.log(`   Learning rate history: ${metrics?.learningRates.length || 0} points`);
      console.log('');

      // Demonstrate real-time subscription (conceptual)
      console.log('🔄 Real-time progress subscription:');
      console.log('   const unsubscribe = mlxFineTuningService.subscribeToJobProgress(');
      console.log('     jobId,');
      console.log('     (progress) => console.log(`Progress: ${progress.progressPercentage}%`)');
      console.log('   );');
      console.log('');

    } catch (error) {
      console.error('❌ Progress monitoring failed:', error);
    }
  }

  private async demonstrateHyperparameterOptimization(): Promise<void> {
    console.log('🔬 Demonstrating Hyperparameter Optimization...');

    if (!this.demoJobId) {
      console.log('⚠️  No demo job available, skipping hyperparameter optimization');
      return;
    }

    try {
      // Define parameter search space
      const parameterSpace = {
        learningRate: [0.00005, 0.0001, 0.0002, 0.0005],
        batchSize: [2, 4, 8],
        epochs: { min: 2, max: 5 },
        dropout: { min: 0.05, max: 0.2, step: 0.05 },
        weightDecay: { min: 0.005, max: 0.02, step: 0.005 }
      };

      console.log('✅ Hyperparameter optimization configured:');
      console.log('   Parameter space:');
      console.log(`     Learning rates: ${JSON.stringify(parameterSpace.learningRate)}`);
      console.log(`     Batch sizes: ${JSON.stringify(parameterSpace.batchSize)}`);
      console.log(`     Epochs: ${parameterSpace.epochs.min}-${parameterSpace.epochs.max}`);
      console.log(`     Dropout: ${parameterSpace.dropout.min}-${parameterSpace.dropout.max}`);
      console.log(`     Weight decay: ${parameterSpace.weightDecay.min}-${parameterSpace.weightDecay.max}`);
      console.log('');

      // Note: In a real scenario, you would run the optimization
      // const experiment = await mlxFineTuningService.runHyperparameterOptimization(
      //   'demo-optimization-experiment',
      //   this.demoJobId,
      //   DEMO_CONFIG.userId,
      //   'random_search',
      //   parameterSpace,
      //   10 // max trials
      // );

      console.log('🎯 Optimization methods available:');
      console.log('   • Grid Search - Exhaustive search over parameter grid');
      console.log('   • Random Search - Random sampling from parameter space');
      console.log('   • Bayesian Optimization - Smart search using previous results');
      console.log('   • Genetic Algorithm - Evolutionary parameter optimization');
      console.log('');

    } catch (error) {
      console.error('❌ Hyperparameter optimization failed:', error);
    }
  }

  private async demonstrateModelEvaluation(): Promise<void> {
    console.log('📊 Demonstrating Model Evaluation...');

    if (!this.demoJobId) {
      console.log('⚠️  No demo job available, skipping model evaluation');
      return;
    }

    try {
      const evaluationConfig = {
        numSamples: 20,
        maxTokens: 128,
        temperature: 0.7,
        topP: 0.9
      };

      console.log('✅ Model evaluation configured:');
      console.log(`   Evaluation samples: ${evaluationConfig.numSamples}`);
      console.log(`   Max tokens per sample: ${evaluationConfig.maxTokens}`);
      console.log(`   Temperature: ${evaluationConfig.temperature}`);
      console.log(`   Top-p: ${evaluationConfig.topP}`);
      console.log('');

      // Note: In a real scenario, you would run the evaluation
      // const evaluation = await mlxFineTuningService.evaluateModel(
      //   this.demoJobId,
      //   '/path/to/model',
      //   'final',
      //   evaluationConfig
      // );

      console.log('📈 Evaluation metrics available:');
      console.log('   • Perplexity - Language model quality metric');
      console.log('   • Loss - Training objective loss');
      console.log('   • Accuracy - Task-specific accuracy');
      console.log('   • BLEU Score - Text generation quality');
      console.log('   • ROUGE Scores - Summary quality metrics');
      console.log('');

      console.log('💡 Sample evaluation output:');
      console.log('   Input: "What is machine learning?"');
      console.log('   Reference: "Machine learning is a subset of AI..."');
      console.log('   Generated: "Machine learning is a method for computers..."');
      console.log('   Confidence: 85.2%');
      console.log('');

    } catch (error) {
      console.error('❌ Model evaluation failed:', error);
    }
  }

  private async demonstrateModelExportDeployment(): Promise<void> {
    console.log('📦 Demonstrating Model Export and Deployment...');

    if (!this.demoJobId) {
      console.log('⚠️  No demo job available, skipping model export/deployment');
      return;
    }

    try {
      console.log('✅ Model export formats available:');
      console.log('   • MLX - Native MLX format (fastest inference)');
      console.log('   • GGUF - Universal format compatible with llama.cpp');
      console.log('   • SafeTensors - Secure tensor format');
      console.log('');

      // Note: In a real scenario, you would export the model
      // const exportPath = await mlxFineTuningService.exportModel(
      //   this.demoJobId,
      //   'mlx',
      //   '/path/to/exported/model'
      // );

      console.log('🚀 Model deployment options:');
      console.log('   • Local deployment - Ready for MLX inference');
      console.log('   • API endpoint - Serve via REST API');
      console.log('   • Batch processing - For large-scale inference');
      console.log('');

      // Note: In a real scenario, you would deploy the model
      // const deploymentId = await mlxFineTuningService.deployModel(
      //   this.demoJobId,
      //   'demo-deployment'
      // );

      console.log('💡 Deployment example:');
      console.log('   Deployment ID: demo-fine-tuned-model-v1');
      console.log('   Endpoint: http://localhost:8080/api/v1/inference/demo-fine-tuned-model-v1');
      console.log('   Status: Active');
      console.log('   Performance: ~50ms average response time');
      console.log('');

    } catch (error) {
      console.error('❌ Model export/deployment failed:', error);
    }
  }

  private async demonstrateHealthMonitoring(): Promise<void> {
    console.log('🏥 Demonstrating Health Monitoring...');

    try {
      // Get service health status
      const health = await mlxFineTuningService.getHealthStatus();

      console.log('✅ Service health status:');
      console.log(`   Status: ${health.status}`);
      console.log(`   Active jobs: ${health.activeJobs}`);
      console.log(`   Queued jobs: ${health.queuedJobs}`);
      console.log(`   Total jobs: ${health.totalJobs}`);
      console.log(`   Memory usage: ${health.resourceUsage.memoryUsageMB} MB`);
      console.log(`   Disk usage: ${health.resourceUsage.diskUsageMB} MB`);
      console.log('');

      // Get queue status
      const queueStatus = await mlxFineTuningService.getQueueStatus();

      console.log('📋 Job queue status:');
      console.log(`   Running jobs: ${queueStatus.running.length}/${queueStatus.totalCapacity}`);
      console.log(`   Queued jobs: ${queueStatus.queued.length}`);
      console.log(`   Available capacity: ${queueStatus.availableCapacity}`);
      console.log('');

      if (queueStatus.running.length > 0) {
        console.log('🏃 Currently running jobs:');
        queueStatus.running.forEach((job, index) => {
          console.log(`   ${index + 1}. ${job.jobName} (${job.progress.progressPercentage.toFixed(1)}% complete)`);
        });
        console.log('');
      }

      if (queueStatus.queued.length > 0) {
        console.log('⏳ Queued jobs:');
        queueStatus.queued.forEach((job, index) => {
          console.log(`   ${index + 1}. ${job.jobName} (priority: ${job.hyperparameters.epochs})`);
        });
        console.log('');
      }

    } catch (error) {
      console.error('❌ Health monitoring failed:', error);
    }
  }

  private async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up demo resources...');

    try {
      // Clean up demo job if created
      if (this.demoJobId) {
        // Note: In a real scenario, you might want to keep the job for inspection
        // await mlxFineTuningService.deleteJob(this.demoJobId);
        console.log(`   Demo job ${this.demoJobId} kept for inspection`);
      }

      // Remove temp dataset file
      if (existsSync(DEMO_CONFIG.sampleDatasetPath)) {
        const { unlinkSync } = await import('fs');
        unlinkSync(DEMO_CONFIG.sampleDatasetPath);
        console.log('   Temporary dataset file removed');
      }

      console.log('✅ Cleanup completed');

    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }
}

// ============================================================================
// Interactive Demo Functions
// ============================================================================

async function runInteractiveDemo(): Promise<void> {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const ask = (question: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  };

  try {
    console.log('🎮 MLX Fine-tuning Interactive Demo');
    console.log('=====================================\n');

    const response = await ask('Would you like to run the full demo? (y/n): ');
    
    if (response.toLowerCase().startsWith('y')) {
      const demo = new MLXFineTuningDemo();
      await demo.run();
    } else {
      console.log('Demo cancelled. You can run individual components using:');
      console.log('  npm run demo:mlx-fine-tuning');
      console.log('  npm run demo:mlx-fine-tuning:interactive');
    }

  } catch (error) {
    console.error('❌ Interactive demo failed:', error);
  } finally {
    rl.close();
  }
}

// ============================================================================
// CLI Interface
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.includes('--interactive')) {
    await runInteractiveDemo();
  } else if (args.includes('--help')) {
    console.log('MLX Fine-tuning Demo Usage:');
    console.log('  ts-node examples/mlx-fine-tuning-demo.ts              # Run full demo');
    console.log('  ts-node examples/mlx-fine-tuning-demo.ts --interactive # Interactive mode');
    console.log('  ts-node examples/mlx-fine-tuning-demo.ts --help        # Show this help');
  } else {
    const demo = new MLXFineTuningDemo();
    await demo.run();
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { MLXFineTuningDemo };