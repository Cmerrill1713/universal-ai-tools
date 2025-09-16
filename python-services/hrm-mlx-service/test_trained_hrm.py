#!/usr/bin/env python3
"""
Test the trained HRM model with knowledge-based prompts
"""

import json
import logging
import os

import mlx.core as mx
import mlx.nn as nn
from transformers import AutoTokenizer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class HRMTextModel(nn.Module):
    """HRM adapted for text generation"""

    def __init__(self, vocab_size=128000, hidden_size=512, num_layers=4):
        super().__init__()

        self.vocab_size = vocab_size
        self.hidden_size = hidden_size

        # Token embeddings
        self.embeddings = nn.Embedding(vocab_size, hidden_size)

        # Simple transformer layers
        self.layers = []
        for i in range(num_layers):
            self.layers.append({
                'attention': nn.MultiHeadAttention(hidden_size, num_heads=8),
                'norm1': nn.LayerNorm(hidden_size),
                'mlp': nn.Sequential(
                    nn.Linear(hidden_size, hidden_size * 4),
                    nn.GELU(),
                    nn.Linear(hidden_size * 4, hidden_size)
                ),
                'norm2': nn.LayerNorm(hidden_size)
            })

        # Output projection
        self.output = nn.Linear(hidden_size, vocab_size)

    def __call__(self, x):
        # Token embeddings
        h = self.embeddings(x)

        # Apply transformer layers
        for layer in self.layers:
            # Self-attention with residual
            attn_out = layer['attention'](h, h, h)
            h = layer['norm1'](h + attn_out)

            # MLP with residual
            mlp_out = layer['mlp'](h)
            h = layer['norm2'](h + mlp_out)

        # Output logits
        return self.output(h)


def load_model(model_path):
    """Load the trained HRM model"""
    # Load config
    config_file = os.path.join(model_path, "config.json")
    with open(config_file, 'r') as f:
        config = json.load(f)

    # Initialize model
    model = HRMTextModel(
        vocab_size=config['vocab_size'],
        hidden_size=config['hidden_size'],
        num_layers=config['num_layers']
    )

    # Load weights
    weights_file = os.path.join(model_path, "model.safetensors")
    if os.path.exists(weights_file):
        weights = mx.load(weights_file)
        model.update(weights)
        logger.info(f"Loaded model weights from {weights_file}")

    mx.eval(model.parameters())
    return model


def generate(
        model,
        tokenizer,
        prompt,
        max_length=100,
        temperature=0.7,
        top_p=0.9):
    """Generate text from a prompt with nucleus sampling"""
    # Tokenize prompt
    tokens = tokenizer.encode(prompt, return_tensors=None)
    input_ids = mx.array([tokens])

    generated = []

    for _ in range(max_length):
        # Get model predictions
        logits = model(input_ids)

        # Get last token logits
        next_token_logits = logits[0, -1, :] / temperature

        # Apply nucleus (top-p) sampling
        probs = mx.softmax(next_token_logits)
        sorted_indices = mx.argsort(probs, axis=-1)[::-1]
        sorted_probs = probs[sorted_indices]

        # Find cutoff for top-p
        cumsum = mx.cumsum(sorted_probs)
        mask = cumsum <= top_p
        if mx.sum(mask) > 0:
            cutoff_idx = mx.sum(mask).item()
            valid_indices = sorted_indices[:cutoff_idx]
            valid_probs = sorted_probs[:cutoff_idx]
            valid_probs = valid_probs / mx.sum(valid_probs)  # Renormalize

            # Sample from valid tokens
            sampled_idx = mx.random.categorical(mx.log(valid_probs))
            next_token = valid_indices[sampled_idx]
        else:
            # Fallback to argmax if no tokens meet criteria
            next_token = mx.argmax(probs)

        # Append to sequence
        generated.append(next_token.item())
        input_ids = mx.concatenate(
            [input_ids, next_token.reshape(1, 1)], axis=1)

        # Stop at EOS token
        if next_token.item() == tokenizer.eos_token_id:
            break

    # Decode generated tokens
    full_tokens = tokens + generated
    return tokenizer.decode(full_tokens, skip_special_tokens=True)


def main():
    """Test the trained HRM model"""

    # Load tokenizer
    tokenizer_path = "/Users/christianmerrill/Desktop/universal-ai-tools/models/mlx-community--Llama-3.2-3B-Instruct-4bit"
    logger.info(f"Loading tokenizer from {tokenizer_path}")
    tokenizer = AutoTokenizer.from_pretrained(tokenizer_path)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    # Load trained model
    model_path = "/Users/christianmerrill/Desktop/universal-ai-tools/models/hrm-trained"
    logger.info(f"Loading model from {model_path}")
    model = load_model(model_path)

    # Test prompts based on training data
    test_prompts = [
        "HRM stands for",
        "The Hierarchical Reasoning Model is",
        "Adaptive computation time allows",
        "MLX optimization provides",
        "Universal AI Tools",
        "The advantage of local AI is",
        "Service-oriented architecture enables",
        "Multi-tier LLM routing",
        "What is HRM?",
        "How does adaptive computation work?"
    ]

    logger.info("\n" + "=" * 50)
    logger.info("Testing HRM Text Generation")
    logger.info("=" * 50 + "\n")

    for prompt in test_prompts:
        # Generate with different temperatures
        for temp in [0.5, 0.7, 1.0]:
            generated = generate(
                model,
                tokenizer,
                prompt,
                max_length=50,
                temperature=temp)
            logger.info(f"Prompt: '{prompt}'")
            logger.info(f"Temperature: {temp}")
            logger.info(f"Generated: {generated}\n")
            break  # Only use first temperature for now

    # Interactive mode
    logger.info("\n" + "=" * 50)
    logger.info("Interactive Mode (type 'quit' to exit)")
    logger.info("=" * 50 + "\n")

    while True:
        prompt = input("\nEnter prompt: ")
        if prompt.lower() == 'quit':
            break

        generated = generate(
            model,
            tokenizer,
            prompt,
            max_length=100,
            temperature=0.7)
        print(f"\nGenerated: {generated}")


if __name__ == "__main__":
    main()
