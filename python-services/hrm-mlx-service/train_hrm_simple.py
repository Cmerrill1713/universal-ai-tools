#!/usr/bin/env python3
"""
Simplified HRM training with knowledge base
Focus on getting a working model rather than perfect architecture
"""

import json
import logging
import os
import time
from pathlib import Path

import mlx.core as mx
import mlx.nn as nn
import mlx.optimizers as optim
import numpy as np
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


def load_knowledge_data():
    """Load the combined knowledge dataset"""
    if os.path.exists("combined_training_data.json"):
        with open("combined_training_data.json", 'r') as f:
            data = json.load(f)
        return data['train'], data['val']
    else:
        # Default samples
        return [
            "HRM uses hierarchical reasoning with adaptive computation.",
            "The model achieves excellent performance with minimal parameters.",
            "MLX provides optimized machine learning for Apple Silicon."
        ], ["Adaptive computation allows dynamic resource allocation."]


def create_batch(texts, tokenizer, max_length=64):
    """Create a batch of tokenized inputs"""
    batch_tokens = []

    for text in texts:
        tokens = tokenizer.encode(
            text,
            max_length=max_length,
            truncation=True,
            padding='max_length')
        batch_tokens.append(tokens)

    return mx.array(batch_tokens)


def compute_loss(model, inputs, targets):
    """Compute cross-entropy loss"""
    logits = model(inputs)

    # Reshape for loss computation
    batch_size, seq_len, vocab_size = logits.shape
    logits = logits.reshape(-1, vocab_size)
    targets = targets.reshape(-1)

    # Cross entropy loss
    loss = mx.mean(nn.losses.cross_entropy(logits, targets))
    return loss


def train_epoch(model, optimizer, train_data, tokenizer, batch_size=4):
    """Train for one epoch"""
    total_loss = 0
    num_batches = 0

    # Shuffle data
    np.random.shuffle(train_data)

    for i in range(0, len(train_data), batch_size):
        batch = train_data[i:i + batch_size]

        # Create input/target pairs
        inputs = create_batch(batch, tokenizer)
        targets = mx.concatenate([inputs[:, 1:], mx.zeros(
            (inputs.shape[0], 1), dtype=mx.int32)], axis=1)

        # Forward and backward pass
        loss_and_grad_fn = nn.value_and_grad(model, compute_loss)
        loss, grads = loss_and_grad_fn(model, inputs, targets)

        # Update weights
        optimizer.update(model, grads)
        mx.eval(model.parameters(), optimizer.state)

        total_loss += loss.item()
        num_batches += 1

        if num_batches % 10 == 0:
            logger.info(f"Batch {num_batches}, Loss: {loss.item():.4f}")

    return total_loss / num_batches


def generate(model, tokenizer, prompt, max_length=50, temperature=0.7):
    """Generate text from a prompt"""
    # Tokenize prompt
    tokens = tokenizer.encode(prompt, return_tensors=None)
    input_ids = mx.array([tokens])

    generated = []

    for _ in range(max_length):
        # Get model predictions
        logits = model(input_ids)

        # Get last token logits
        next_token_logits = logits[0, -1, :] / temperature

        # Sample next token
        probs = mx.softmax(next_token_logits)
        next_token = mx.random.categorical(mx.log(probs))

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
    """Main training loop"""

    # Load tokenizer
    tokenizer_path = "/Users/christianmerrill/Desktop/universal-ai-tools/models/mlx-community--Llama-3.2-3B-Instruct-4bit"
    logger.info(f"Loading tokenizer from {tokenizer_path}")
    tokenizer = AutoTokenizer.from_pretrained(tokenizer_path)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    # Initialize model
    logger.info("Initializing HRM text model...")
    model = HRMTextModel(
        vocab_size=tokenizer.vocab_size,
        hidden_size=512,
        num_layers=4)
    mx.eval(model.parameters())

    # Count parameters
    num_params = 0
    for name, param in model.parameters().items():
        if isinstance(param, mx.array):
            num_params += param.size
        elif isinstance(param, dict):
            # Skip nested dicts for now
            continue
    logger.info(f"Model has approximately {num_params:,} parameters")

    # Initialize optimizer
    optimizer = optim.Adam(learning_rate=1e-4)

    # Load training data
    train_data, val_data = load_knowledge_data()
    logger.info(
        f"Loaded {
            len(train_data)} training samples, {
            len(val_data)} validation samples")

    # Training loop
    num_epochs = 10
    best_loss = float('inf')

    for epoch in range(num_epochs):
        logger.info(f"\nEpoch {epoch + 1}/{num_epochs}")

        # Train
        avg_loss = train_epoch(
            model,
            optimizer,
            train_data,
            tokenizer,
            batch_size=4)
        logger.info(f"Average training loss: {avg_loss:.4f}")

        # Generate sample
        if epoch % 2 == 0:
            prompts = [
                "HRM is",
                "The hierarchical reasoning model",
                "Adaptive computation"
            ]

            for prompt in prompts:
                generated = generate(model, tokenizer, prompt, max_length=30)
                logger.info(f"Generated: {generated}")

        # Save best model
        if avg_loss < best_loss:
            best_loss = avg_loss

            # Save model
            output_dir = "/Users/christianmerrill/Desktop/universal-ai-tools/models/hrm-trained"
            os.makedirs(output_dir, exist_ok=True)

            # Flatten parameters for saving
            flat_params = {}
            for name, param in model.parameters().items():
                if isinstance(param, mx.array):
                    flat_params[name] = param
                # Skip non-array parameters

            weights_file = os.path.join(output_dir, "model.safetensors")
            if flat_params:
                mx.save_safetensors(weights_file, flat_params)

            config_file = os.path.join(output_dir, "config.json")
            config = {
                "vocab_size": tokenizer.vocab_size,
                "hidden_size": 512,
                "num_layers": 4,
                "model_type": "hrm_text"
            }
            with open(config_file, 'w') as f:
                json.dump(config, f, indent=2)

            logger.info(f"Saved best model with loss {best_loss:.4f}")

    logger.info("\nTraining complete!")
    logger.info(
        f"Best model saved to /Users/christianmerrill/Desktop/universal-ai-tools/models/hrm-trained")


if __name__ == "__main__":
    main()
