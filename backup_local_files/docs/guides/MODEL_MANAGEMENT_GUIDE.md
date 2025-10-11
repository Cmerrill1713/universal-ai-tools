# Model Management Guide for Universal AI Tools
## Overview
The Universal AI Tools platform now includes comprehensive model management with:

- **Intelligent Model Selection**: Automatically chooses the best model based on task complexity

- **Dynamic Discovery**: Detects all available models without hardcoding

- **Model Download/Delete**: Easy management of your model library

- **Support for Liquid/LFM models**: When available through Ollama

- **MLX Fine-tuning Support**: For Apple Silicon optimization
## Features Implemented
### 1. **Intelligent Model Selection** (`model_selector.py`)

- Analyzes task complexity (simple, moderate, complex, critical)

- Considers model capabilities (basic, reasoning, coding, advanced)

- Balances speed vs quality based on requirements

- Automatically escalates to larger models when needed
### 2. **Dynamic Model Discovery** (`llm_discovery.py`)

- Scans all LLM providers on startup

- No hardcoded model lists

- Tests each model before use

- Graceful fallback handling
### 3. **Model Management** (`model_manager.py`)

- List all available models (local and remote)

- Download new models

- Delete unused models

- Get model recommendations based on task type

- Support for Liquid/LFM models (when available)
## Using the Model Manager
### Interactive CLI

```bash

python manage-models.py

```
This provides a menu-driven interface to:

- List all models with download status

- Download new models (including Liquid/LFM)

- Delete models

- Get recommendations
### Download Specific Models

#### For Liquid/LFM Models

Since Liquid models may not be in the standard Ollama registry, you can:
1. **Import GGUF files directly**:

```bash
# If you have a GGUF file

ollama create liquid-custom -f Modelfile

```
2. **Use the download script**:

```bash

./download-lfm.sh

```
3. **Try alternative names**:

```bash
# Common model names to try

ollama pull liquid

ollama pull lfm

ollama pull liquid-ai/lfm

```
## Model Selection Logic
### Task Analysis

The system analyzes your request to determine:

- **Complexity Level**

  - Simple: Basic Q&A, definitions

  - Moderate: Analysis, explanations

  - Complex: Code generation, design

  - Critical: Production code, security
- **Required Capabilities**

  - Basic text generation

  - Reasoning and analysis

  - Code generation

  - Advanced multi-step tasks
### Model Profiles

Models are categorized by size and capability:

- **Small (<3B)**: Fast responses, basic tasks

- **Medium (3-7B)**: Balanced performance

- **Large (8-15B)**: Quality focused

- **Extra Large (20B+)**: Maximum capability
### Special Model Support

- **Liquid Models**: Efficient inference, adaptive computation

- **MLX Models**: Apple Silicon optimized, fine-tuning capable

- **Coder Models**: Specialized for programming tasks
## API Integration
### Request with Specific Requirements

```json

{

  "method": "orchestrate",

  "params": {

    "userRequest": "Write a complex algorithm",

    "context": {

      "max_response_time_ms": 5000,

      "prefer_quality": true,

      "complexity": "complex"

    }

  }

}

```
### Escalate to Larger Model

```json

{

  "method": "escalate_model",

  "params": {

    "min_quality_score": 0.8

  }

}

```
### Get Current Model Info

```json

{

  "method": "get_model_info"

}

```
## MLX Fine-tuning Support
For Apple Silicon users, MLX models can be fine-tuned:
1. **Install MLX** (if not already installed):

```bash

pip install mlx mlx-lm

```
2. **Fine-tune a model**:

```python

from mlx_fine_tuning_service import MLXFineTuningService
service = MLXFineTuningService()

await service.fine_tune_model(

    base_model="mlx-community/Llama-3.3-8B-Instruct-MLX",

    dataset_path="your_dataset.jsonl",

    output_path="models/custom-llama"

)

```
## Configuration
### Environment Variables

```bash
# Preferred LLM endpoints

export OLLAMA_URL=http://localhost:11434

export REMOTE_LLM_URL=http://192.168.1.179:5901

export LM_STUDIO_URL=http://localhost:1234

# Model selection preferences

export PREFER_FAST_MODELS=false

export MAX_MODEL_SIZE_GB=50

```
### Priority Order

1. Task-specific selection (based on complexity)

2. OpenAI API (if configured)

3. Local Ollama models

4. Remote LM Studio models

5. Fallback options
## Troubleshooting
### Liquid/LFM Models Not Found

If Liquid models aren't in the Ollama registry:
1. **Check model availability**:

```bash

ollama list

```
2. **Try alternative sources**:

- Download GGUF files from HuggingFace

- Convert models using llama.cpp

- Check community repositories
3. **Create custom Modelfile**:

```dockerfile

FROM ./liquid-lfm-7b.gguf

TEMPLATE "{{ .Prompt }}"

PARAMETER temperature 0.7

```
### Model Selection Issues

- Check logs for task analysis details

- Verify model capabilities match requirements

- Ensure sufficient resources for larger models
## Future Enhancements

- Automatic model pruning based on usage

- Model performance tracking

- Custom model import wizard

- Integration with more model registries