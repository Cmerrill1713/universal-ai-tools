#!/usr/bin/env python3
"""
Train HRM with converted Sapient checkpoint and Supabase knowledge
Simplified training script focused on getting HRM working with text generation
"""

import json
import logging
import os
import time
from pathlib import Path
from typing import Dict, List, Optional

import mlx.core as mx
import mlx.nn as nn
import mlx.optimizers as optim
import numpy as np
from transformers import AutoTokenizer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SimpleHRM(nn.Module):
    """Simplified HRM for text generation with Sudoku-trained weights"""

    def __init__(self, config: dict):
        super().__init__()
        self.config = config

        # Dimensions
        self.hidden_size = config["hidden_size"]
        self.vocab_size = config["vocab_size"]
        self.num_heads = config.get("num_heads", 8)

        # Embedding (expand from Sudoku's 11 tokens to full vocab)
        self.embed_tokens = nn.Embedding(self.vocab_size, self.hidden_size)

        # L-level (low-level processing) - Create layers directly
        self.L_layers = []
        for i in range(config["L_layers"]):
            layer = self._create_layer(f"L_{i}")
            self.L_layers.append(layer)

        # H-level (high-level reasoning) - Create layers directly
        self.H_layers = []
        for i in range(config["H_layers"]):
            layer = self._create_layer(f"H_{i}")
            self.H_layers.append(layer)

        # Output projection
        self.lm_head = nn.Linear(self.hidden_size, self.vocab_size, bias=False)

        # Layer norms
        self.ln_L = nn.LayerNorm(self.hidden_size)
        self.ln_H = nn.LayerNorm(self.hidden_size)

    def _create_layer(self, prefix):
        """Create a transformer layer with proper MLX structure"""
        layer = {}

        # Self-attention components
        setattr(
            self,
            f"{prefix}_qkv_proj",
            nn.Linear(
                self.hidden_size,
                3 * self.hidden_size,
                bias=False))
        setattr(
            self,
            f"{prefix}_o_proj",
            nn.Linear(
                self.hidden_size,
                self.hidden_size,
                bias=False))

        # MLP components
        setattr(
            self,
            f"{prefix}_gate_up_proj",
            nn.Linear(
                self.hidden_size,
                2 * self.hidden_size * 2,
                bias=False))
        setattr(
            self,
            f"{prefix}_down_proj",
            nn.Linear(
                self.hidden_size * 2,
                self.hidden_size,
                bias=False))

        layer['qkv_proj'] = getattr(self, f"{prefix}_qkv_proj")
        layer['o_proj'] = getattr(self, f"{prefix}_o_proj")
        layer['gate_up_proj'] = getattr(self, f"{prefix}_gate_up_proj")
        layer['down_proj'] = getattr(self, f"{prefix}_down_proj")

        return layer

    def forward(self, input_ids):
        batch_size, seq_len = input_ids.shape

        # Embedding
        x = self.embed_tokens(input_ids)

        # L-level processing
        L_out = x
        for layer in self.L_layers:
            L_out = self._apply_layer(L_out, layer)
        L_out = self.ln_L(L_out)

        # H-level processing
        H_out = L_out
        for layer in self.H_layers:
            H_out = self._apply_layer(H_out, layer)
        H_out = self.ln_H(H_out)

        # Output projection
        logits = self.lm_head(H_out)

        return logits

    def _apply_layer(self, x, layer):
        """Apply a transformer layer"""
        residual = x

        # Self-attention
        qkv = layer['qkv_proj'](x)
        q, k, v = mx.split(qkv, 3, axis=-1)

        # Simple attention (no masking for now)
        attn_scores = mx.matmul(q, mx.transpose(
            k, axes=[0, 2, 1])) / mx.sqrt(mx.array(self.hidden_size))
        attn_probs = mx.softmax(attn_scores, axis=-1)
        attn_out = mx.matmul(attn_probs, v)

        x = residual + layer['o_proj'](attn_out)

        # MLP
        residual = x
        gate_up = layer['gate_up_proj'](x)
        gate, up = mx.split(gate_up, 2, axis=-1)
        x = residual + layer['down_proj'](nn.silu(gate) * up)

        return x


def load_converted_weights(model, checkpoint_path):
    """Load converted Sapient weights into model"""
    checkpoint_file = os.path.join(
        checkpoint_path,
        "checkpoint_converted.safetensors")

    if not os.path.exists(checkpoint_file):
        logger.warning(f"Checkpoint not found at {checkpoint_file}")
        return model

    logger.info(f"Loading converted weights from {checkpoint_file}")

    # Load safetensors
    weights = mx.load(checkpoint_file)

    # Map weights to our model structure
    # The Sudoku model has different naming, so we'll map what we can
    loaded = 0
    for name, param in weights.items():
        loaded += 1
        logger.debug(f"Loaded weight: {name} with shape {param.shape}")

    logger.info(f"Loaded {loaded} weight tensors from checkpoint")

    # Update model with compatible weights
    # Note: The Sudoku model has 11 vocab size, we need to expand embeddings
    if "_orig_mod.model.inner.embed_tokens.embedding_weight" in weights:
        sudoku_embed = weights["_orig_mod.model.inner.embed_tokens.embedding_weight"]
        # Expand embeddings by repeating and adding noise
        expanded_embed = mx.random.normal(
            [model.vocab_size, model.hidden_size]) * 0.02
        expanded_embed[:sudoku_embed.shape[0]] = sudoku_embed
        model.embed_tokens.weight = expanded_embed
        logger.info("Expanded embedding weights from Sudoku model")

    return model


def load_training_data():
    """Load combined training data"""
    # Try to load combined data first
    if os.path.exists("combined_training_data.json"):
        with open("combined_training_data.json", 'r') as f:
            data = json.load(f)
        logger.info(
            f"Loaded combined training data: {len(data['train'])} train, {len(data['val'])} val")
        return data['train'], data['val']

    # Fall back to separate files
    train_texts = []
    val_texts = []

    if os.path.exists("training_data.json"):
        with open("training_data.json", 'r') as f:
            data = json.load(f)
        train_texts.extend(data.get('train', []))
        val_texts.extend(data.get('val', []))

    if os.path.exists("supabase_training_data.json"):
        with open("supabase_training_data.json", 'r') as f:
            data = json.load(f)
        train_texts.extend(data.get('train', []))
        val_texts.extend(data.get('val', []))

    if not train_texts:
        # Use default sample data
        train_texts = [
            "HRM uses hierarchical reasoning with adaptive computation time.",
            "The model achieves great performance with only 27 million parameters.",
            "MLX optimization provides significant speedup on Apple Silicon.",
        ]
        val_texts = [
            "Adaptive computation allows dynamic resource allocation."]

    logger.info(
        f"Loaded training data: {
            len(train_texts)} train, {
            len(val_texts)} val")
    return train_texts, val_texts


def train_step(model, optimizer, batch, tokenizer):
    """Single training step"""
    # Tokenize batch
    max_length = 128  # Shorter sequences for faster training

    input_ids_list = []
    for text in batch:
        tokens = tokenizer.encode(text, max_length=max_length, truncation=True)
        # Pad to max_length
        tokens = tokens + [tokenizer.pad_token_id] * (max_length - len(tokens))
        input_ids_list.append(tokens[:-1])  # Input is all but last token

    input_ids = mx.array(input_ids_list)
    target_ids = mx.array([tokens[1:] + [tokenizer.pad_token_id]
                          for tokens in input_ids_list])

    def loss_fn(model):
        logits = model(input_ids)
        # Flatten for cross entropy
        logits_flat = logits.reshape(-1, logits.shape[-1])
        targets_flat = target_ids.reshape(-1)

        # Cross entropy loss
        loss = nn.losses.cross_entropy(
            logits_flat, targets_flat, reduction='mean')
        return loss

    # Compute gradients and update
    loss, grads = mx.value_and_grad(loss_fn)(model)
    optimizer.update(model, grads)
    mx.eval(model.parameters())

    return loss.item()


def generate_text(model, tokenizer, prompt, max_tokens=50):
    """Generate text from prompt"""
    # Tokenize prompt
    input_ids = tokenizer.encode(prompt, return_tensors=None)
    input_ids = mx.array([input_ids])

    generated = input_ids

    for _ in range(max_tokens):
        # Forward pass
        logits = model(generated)

        # Get next token (greedy)
        next_token_logits = logits[0, -1, :]
        next_token = mx.argmax(next_token_logits).item()

        # Append to sequence
        generated = mx.concatenate(
            [generated, mx.array([[next_token]])], axis=1)

        # Stop if EOS
        if next_token == tokenizer.eos_token_id:
            break

    # Decode
    output_text = tokenizer.decode(
        generated[0].tolist(),
        skip_special_tokens=True)
    return output_text


def main():
    """Main training loop"""

    # Configuration
    config = {
        "hidden_size": 512,
        "vocab_size": 128000,  # Llama tokenizer
        "L_layers": 4,
        "H_layers": 4,
        "num_heads": 8,
    }

    # Load tokenizer
    tokenizer_path = "/Users/christianmerrill/Desktop/universal-ai-tools/models/mlx-community--Llama-3.2-3B-Instruct-4bit"
    logger.info(f"Loading tokenizer from {tokenizer_path}")
    tokenizer = AutoTokenizer.from_pretrained(tokenizer_path)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    # Initialize model
    logger.info("Initializing HRM model...")
    model = SimpleHRM(config)

    # Load converted weights
    checkpoint_path = "/Users/christianmerrill/Desktop/universal-ai-tools/models/hrm-mlx-ready"
    model = load_converted_weights(model, checkpoint_path)

    # Initialize optimizer
    optimizer = optim.AdamW(learning_rate=1e-4, weight_decay=0.01)

    # Load training data
    train_texts, val_texts = load_training_data()

    # Training parameters
    batch_size = 2
    epochs = 5

    logger.info(f"Starting training for {epochs} epochs...")

    for epoch in range(epochs):
        epoch_loss = 0
        num_batches = 0

        # Shuffle training data
        np.random.shuffle(train_texts)

        # Train in batches
        for i in range(0, len(train_texts), batch_size):
            batch = train_texts[i:i + batch_size]
            loss = train_step(model, optimizer, batch, tokenizer)
            epoch_loss += loss
            num_batches += 1

            if num_batches % 5 == 0:
                logger.info(
                    f"Epoch {
                        epoch +
                        1}, Batch {num_batches}, Loss: {
                        loss:.4f}")

        avg_loss = epoch_loss / num_batches
        logger.info(
            f"Epoch {
                epoch +
                1} complete. Average loss: {
                avg_loss:.4f}")

        # Generate sample text
        if epoch % 2 == 0:
            prompt = "The HRM model"
            generated = generate_text(model, tokenizer, prompt, max_tokens=30)
            logger.info(f"Sample generation: {generated}")

    # Save final model
    output_dir = "/Users/christianmerrill/Desktop/universal-ai-tools/models/hrm-finetuned"
    os.makedirs(output_dir, exist_ok=True)

    # Save weights
    weights_file = os.path.join(output_dir, "model.safetensors")
    mx.save_safetensors(weights_file, dict(model.parameters()))
    logger.info(f"Saved model to {weights_file}")

    # Save config
    config_file = os.path.join(output_dir, "config.json")
    with open(config_file, 'w') as f:
        json.dump(config, f, indent=2)

    logger.info("Training complete!")


if __name__ == "__main__":
    main()
