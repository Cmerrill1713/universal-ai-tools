# RLVR (Reinforcement Learning from Verifier Feedback) System Guide

## Overview

The RLVR system implements a sophisticated reinforcement learning loop that uses verifier feedback to improve AI-generated outputs iteratively. This system is particularly valuable for evaluation, training, and improving AI models through iterative refinement.

## Architecture

### Core Components

1. **Generator Model**: Produces outputs based on prompts and feedback
2. **Verifier Model**: Evaluates generated outputs for correctness and quality
3. **Training Engine**: Orchestrates the RLVR loop with policy gradient updates
4. **Experience Manager**: Handles experience replay and analysis
5. **Metrics System**: Comprehensive evaluation and monitoring

### RLVR Loop Process

```
1. Generate → 2. Verify → 3. Calculate Reward → 4. Update Policy → 5. Repeat
```

1. **Generate**: Generator creates output based on prompt and previous feedback
2. **Verify**: Verifier evaluates output for correctness, quality, and errors
3. **Calculate Reward**: Reward function combines verifier scores and improvement
4. **Update Policy**: Policy gradient updates improve generator performance
5. **Repeat**: Continue until convergence or max iterations

## Key Features

### 🎯 Intelligent Feedback Loop

- Iterative improvement based on verifier feedback
- Policy gradient updates using REINFORCE-style learning
- Experience replay for stable training

### 🔍 Comprehensive Verification

- Rule-based verification for common patterns
- LLM-based verification for nuanced evaluation
- Multi-dimensional scoring (correctness, quality, errors)

### 📊 Advanced Metrics

- Real-time performance tracking
- Convergence analysis
- Error pattern recognition
- Training statistics

### 🚀 Production Ready

- RESTful API with comprehensive endpoints
- Docker support
- Health monitoring
- Configurable parameters

## API Endpoints

### Core Training

- `POST /train` - Run RLVR training loop
- `POST /evaluate` - Evaluate task performance
- `GET /health` - Service health check

### Monitoring

- `GET /metrics` - Aggregated performance metrics
- `GET /stats` - Current training statistics
- `GET /experiences/:task_id` - Get training experiences
- `GET /analysis/:task_id` - Analyze task patterns

## Configuration

### Environment Variables

```bash
PORT=3035                          # Service port
LLM_ENDPOINT=http://localhost:3031/generate  # LLM service endpoint
RUST_LOG=info                      # Logging level
```

### Training Configuration

```rust
TrainingConfig {
    max_iterations: 10,            # Maximum training iterations
    min_confidence: 0.8,           # Target confidence threshold
    batch_size: 32,                # Experience batch size
    learning_rate: 0.001,          # Policy learning rate
    entropy_coefficient: 0.01,     # Entropy regularization
    value_coefficient: 0.5,        # Value function weight
    policy_coefficient: 1.0,       # Policy gradient weight
    experience_buffer_size: 1000,  # Experience replay buffer
    min_experiences_for_training: 50,  # Minimum experiences for training
    convergence_threshold: 0.01,   # Convergence detection threshold
}
```

## Usage Examples

### Basic Training Request

```json
{
  "task_id": "code_fibonacci",
  "prompt": "Write a function to calculate the nth Fibonacci number",
  "context": "Python programming, should be efficient and handle edge cases",
  "max_iterations": 8,
  "min_confidence": 0.85
}
```

### Training Response

```json
{
    "session_id": "uuid-here",
    "final_solution": "def fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)",
    "confidence": 0.92,
    "iterations": 5,
    "training_data": [...],
    "metrics": {
        "total_reward": 4.2,
        "average_reward": 0.84,
        "improvement_rate": 0.15,
        "convergence_iteration": 5,
        "verifier_accuracy": 0.87,
        "training_loss": 0.12,
        "policy_entropy": 0.23
    }
}
```

## Evaluation Framework

### Comprehensive Test Suite

The RLVR system includes a comprehensive evaluation framework with:

- **Code Generation Tasks**: Fibonacci, sorting algorithms, debugging
- **Problem Solving**: Math problems, logic puzzles
- **Creative Writing**: Stories, technical explanations
- **Complex Reasoning**: System design, architecture

### Evaluation Metrics

- **Success Rate**: Percentage of tasks achieving target confidence
- **Convergence Rate**: How often tasks converge before max iterations
- **Improvement Rate**: Average confidence improvement per iteration
- **Error Analysis**: Common error patterns and reduction rates
- **Efficiency**: Time per iteration, tokens generated

## Getting Started

### 1. Start the Service

```bash
# Using the startup script
./scripts/start-rlvr-service.sh

# Or manually
cargo run -p rlvr-service
```

### 2. Run Evaluation

```bash
# Full evaluation suite
python scripts/test_rlvr_evaluation.py

# Quick evaluation
python scripts/test_rlvr_evaluation.py --quick

# Specific tasks
python scripts/test_rlvr_evaluation.py --tasks code_fibonacci math_problem
```

### 3. Monitor Performance

```bash
# Check health
curl http://localhost:3035/health

# Get metrics
curl http://localhost:3035/metrics

# Get training stats
curl http://localhost:3035/stats
```

## Integration with Existing Services

### LLM Router Integration

The RLVR service integrates with your existing LLM router:

- Uses the same LLM endpoint for generation
- Leverages existing model routing capabilities
- Maintains consistency with your current setup

### Assistant Integration

RLVR can enhance your assistant service:

- Improve response quality through iterative refinement
- Learn from user feedback patterns
- Provide better evaluation metrics

### Monitoring Integration

- Prometheus metrics export
- Structured logging
- Health check endpoints
- Performance tracking

## Advanced Features

### Experience Replay

- Maintains buffer of training experiences
- Enables stable policy updates
- Supports batch training

### Multi-Task Learning

- Shared experience across tasks
- Task-specific performance tracking
- Cross-task pattern analysis

### Adaptive Learning

- Dynamic learning rate adjustment
- Entropy regularization to prevent collapse
- Convergence detection

## Performance Characteristics

### Typical Performance

- **Startup Time**: < 2 seconds
- **Memory Usage**: ~50MB base + model memory
- **Training Speed**: 1-5 iterations per second (depending on LLM)
- **Convergence**: Usually 3-8 iterations for most tasks

### Scalability

- Horizontal scaling via multiple instances
- Shared experience buffers
- Distributed training support

## Troubleshooting

### Common Issues

1. **Service Won't Start**

   - Check if port 3035 is available
   - Verify LLM service is running
   - Check Rust installation

2. **Poor Performance**

   - Verify LLM endpoint is responding
   - Check training configuration
   - Monitor memory usage

3. **Slow Convergence**
   - Adjust learning rate
   - Increase max iterations
   - Check verifier accuracy

### Debug Commands

```bash
# Check service status
curl http://localhost:3035/health

# View logs
RUST_LOG=debug cargo run -p rlvr-service

# Test specific endpoint
curl -X POST http://localhost:3035/train \
  -H "Content-Type: application/json" \
  -d '{"task_id":"test","prompt":"Hello world"}'
```

## Future Enhancements

### Planned Features

- **Multi-Modal Support**: Image and text generation
- **Advanced Reward Functions**: Custom reward shaping
- **Distributed Training**: Multi-node training support
- **Model Persistence**: Save/load trained models
- **Web UI**: Browser-based interface

### Research Directions

- **Meta-Learning**: Learn to learn across tasks
- **Adversarial Training**: Generator-verifier competition
- **Human-in-the-Loop**: Incorporate human feedback
- **Transfer Learning**: Apply learned policies to new domains

## Contributing

### Development Setup

1. Clone the repository
2. Install Rust 1.70+
3. Run `cargo build --workspace`
4. Start the service with `cargo run -p rlvr-service`

### Testing

```bash
# Run unit tests
cargo test -p rlvr-service

# Run integration tests
python scripts/test_rlvr_evaluation.py --quick

# Run full evaluation
python scripts/test_rlvr_evaluation.py
```

### Code Structure

- `src/models.rs` - Core data structures
- `src/verifier.rs` - Verifier model implementation
- `src/generator.rs` - Generator model implementation
- `src/trainer.rs` - Training engine
- `src/experience.rs` - Experience management
- `src/metrics.rs` - Metrics and evaluation
- `src/server.rs` - HTTP API server

## Conclusion

The RLVR system provides a powerful framework for iterative AI improvement through verifier feedback. It's particularly valuable for:

- **Evaluation**: Comprehensive testing of AI capabilities
- **Training**: Improving model performance through feedback
- **Research**: Studying learning patterns and convergence
- **Production**: Enhancing real-world AI applications

The system is designed to be production-ready while remaining flexible enough for research and experimentation.
