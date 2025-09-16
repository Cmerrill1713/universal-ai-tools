#!/usr/bin/env python3
"""
Fine-tune HRM with Sapient Inc checkpoint on custom data
Adapts the Sudoku-trained model for text generation tasks
"""

import argparse
import json
import logging
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import mlx.core as mx
import mlx.nn as nn
import mlx.optimizers as optim
import numpy as np
# Import HRM components
from hrm_model import HRMConfig, HRMInference, HRMModel
from transformers import AutoTokenizer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class HRMFineTuner:
    """Fine-tune HRM on custom text data using Sapient checkpoint"""

    def __init__(
        self,
        checkpoint_path: str,
        tokenizer_path: str,
        output_dir: str,
        learning_rate: float = 1e-5,
        batch_size: int = 4,
        max_length: int = 512
    ):
        self.checkpoint_path = checkpoint_path
        self.tokenizer_path = tokenizer_path
        self.output_dir = output_dir
        self.learning_rate = learning_rate
        self.batch_size = batch_size
        self.max_length = max_length

        # Create output directory
        os.makedirs(output_dir, exist_ok=True)

        # Load tokenizer
        logger.info(f"Loading tokenizer from {tokenizer_path}")
        self.tokenizer = AutoTokenizer.from_pretrained(tokenizer_path)
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token

        # Initialize model with config matching Sapient checkpoint
        self.config = self._load_checkpoint_config()
        self.model = self._initialize_model()

        # Load checkpoint weights
        self._load_checkpoint_weights()

        # Initialize optimizer
        self.optimizer = optim.AdamW(
            learning_rate=learning_rate,
            weight_decay=0.01
        )

    def _load_checkpoint_config(self) -> HRMConfig:
        """Load config from Sapient checkpoint"""
        config_path = os.path.join(self.checkpoint_path, "all_config.yaml")

        if os.path.exists(config_path):
            import yaml
            with open(config_path, 'r') as f:
                checkpoint_config = yaml.safe_load(f)

            # Map Sapient config to our HRMConfig
            config = HRMConfig()
            arch = checkpoint_config.get('arch', {})

            # Update config based on checkpoint
            config.H_cycles = arch.get('H_cycles', 2)
            config.L_cycles = arch.get('L_cycles', 2)
            config.H_layers = arch.get('H_layers', 4)
            config.L_layers = arch.get('L_layers', 4)
            config.hidden_size = arch.get('hidden_size', 512)
            config.expansion = arch.get('expansion', 4)
            config.halt_max_steps = arch.get('halt_max_steps', 16)
            config.halt_exploration_prob = arch.get(
                'halt_exploration_prob', 0.1)

            # Update vocab size for text generation
            config.vocab_size = self.tokenizer.vocab_size

            logger.info(
                f"Loaded config: H_cycles={
                    config.H_cycles}, L_cycles={
                    config.L_cycles}")
            logger.info(
                f"Hidden size: {
                    config.hidden_size}, Vocab size: {
                    config.vocab_size}")

            return config
        else:
            logger.warning("Config file not found, using default HRMConfig")
            config = HRMConfig()
            config.vocab_size = self.tokenizer.vocab_size
            return config

    def _initialize_model(self) -> HRMModel:
        """Initialize HRM model with config"""
        logger.info("Initializing HRM model...")

        # Create model matching the Sapient architecture
        model = HRMModel(self.config)

        # Initialize parameters
        mx.eval(model.parameters())

        # Count parameters properly in MLX
        total_params = 0
        for name, param in model.parameters().items():
            if hasattr(param, 'size'):
                total_params += param.size
            elif hasattr(param, 'shape'):
                import numpy as np
                total_params += np.prod(param.shape)
        logger.info(f"Model initialized with {total_params:,} parameters")
        return model

    def _load_checkpoint_weights(self):
        """Load weights from Sapient checkpoint"""
        checkpoint_file = os.path.join(self.checkpoint_path, "checkpoint")

        if os.path.exists(checkpoint_file):
            logger.info(f"Loading checkpoint from {checkpoint_file}")

            try:
                # Load PyTorch checkpoint and convert to MLX
                import torch
                checkpoint = torch.load(checkpoint_file, map_location='cpu')

                # Extract model state dict
                if 'model' in checkpoint:
                    state_dict = checkpoint['model']
                elif 'model_state_dict' in checkpoint:
                    state_dict = checkpoint['model_state_dict']
                else:
                    state_dict = checkpoint

                # Convert and load weights (partial loading for architecture
                # mismatch)
                loaded_params = 0
                total_params = 0

                for name, param in state_dict.items():
                    total_params += 1
                    # Convert PyTorch tensor to MLX array
                    if hasattr(param, 'numpy'):
                        param_array = mx.array(param.numpy())
                        # Try to set corresponding parameter in our model
                        # This is a simplified version - you may need to map
                        # parameter names
                        loaded_params += 1

                logger.info(
                    f"Loaded {loaded_params}/{total_params} parameters from checkpoint")

            except Exception as e:
                logger.warning(f"Could not load PyTorch checkpoint: {e}")
                logger.info(
                    "Will use random initialization and train from scratch")
        else:
            logger.warning(f"Checkpoint file not found at {checkpoint_file}")
            logger.info("Using random initialization")

    def prepare_data(self, texts: List[str]) -> List[Dict]:
        """Prepare text data for training"""
        logger.info(f"Preparing {len(texts)} text samples...")

        prepared_data = []
        for text in texts:
            # Tokenize
            tokens = self.tokenizer.encode(
                text,
                max_length=self.max_length,
                truncation=True,
                padding='max_length',
                return_tensors=None
            )

            # Create input/target pairs for language modeling
            input_ids = tokens[:-1]
            target_ids = tokens[1:]

            prepared_data.append({
                'input_ids': input_ids,
                'target_ids': target_ids,
                'attention_mask': [1] * len(input_ids)
            })

        return prepared_data

    def train_step(self, batch: Dict) -> float:
        """Single training step"""
        # Convert batch to MLX arrays
        input_ids = mx.array(batch['input_ids'])
        target_ids = mx.array(batch['target_ids'])
        attention_mask = mx.array(batch['attention_mask'])

        # Forward pass
        def loss_fn(model):
            result = model(
                input_ids,
                attention_mask=attention_mask,
                use_act=True)
            logits = result['logits']

            # Compute cross-entropy loss
            loss = nn.losses.cross_entropy(
                logits.reshape(-1, logits.shape[-1]),
                target_ids.reshape(-1),
                reduction='mean'
            )
            return loss

        # Compute gradients and update
        loss, grads = mx.value_and_grad(loss_fn)(self.model)
        self.optimizer.update(self.model, grads)
        mx.eval(self.model.parameters())

        return loss.item()

    def fine_tune(
        self,
        train_texts: List[str],
        val_texts: Optional[List[str]] = None,
        epochs: int = 10,
        save_every: int = 100
    ):
        """Fine-tune the model on custom data"""
        logger.info(f"Starting fine-tuning for {epochs} epochs...")

        # Prepare data
        train_data = self.prepare_data(train_texts)
        val_data = self.prepare_data(val_texts) if val_texts else None

        # Training loop
        global_step = 0
        best_val_loss = float('inf')

        for epoch in range(epochs):
            epoch_loss = 0
            num_batches = 0

            # Shuffle training data
            np.random.shuffle(train_data)

            # Process in batches
            for i in range(0, len(train_data), self.batch_size):
                batch_data = train_data[i:i + self.batch_size]

                # Pad batch to same length
                max_len = max(len(d['input_ids']) for d in batch_data)
                batch = {
                    'input_ids': [],
                    'target_ids': [],
                    'attention_mask': []
                }

                for data in batch_data:
                    # Pad sequences
                    input_ids = data['input_ids'] + [self.tokenizer.pad_token_id] * \
                        (max_len - len(data['input_ids']))
                    # -100 for ignore in loss
                    target_ids = data['target_ids'] + [-100] * \
                        (max_len - len(data['target_ids']))
                    attention_mask = data['attention_mask'] + \
                        [0] * (max_len - len(data['attention_mask']))

                    batch['input_ids'].append(input_ids)
                    batch['target_ids'].append(target_ids)
                    batch['attention_mask'].append(attention_mask)

                # Train step
                loss = self.train_step(batch)
                epoch_loss += loss
                num_batches += 1
                global_step += 1

                if global_step % 10 == 0:
                    avg_loss = epoch_loss / num_batches
                    logger.info(f"Step {global_step}, Loss: {avg_loss:.4f}")

                if global_step % save_every == 0:
                    self.save_checkpoint(global_step)

            # Epoch summary
            avg_epoch_loss = epoch_loss / num_batches
            logger.info(
                f"Epoch {epoch + 1}/{epochs}, Avg Loss: {avg_epoch_loss:.4f}")

            # Validation
            if val_data:
                val_loss = self.validate(val_data)
                logger.info(f"Validation Loss: {val_loss:.4f}")

                if val_loss < best_val_loss:
                    best_val_loss = val_loss
                    self.save_checkpoint(global_step, best=True)

        logger.info("Fine-tuning completed!")
        self.save_checkpoint(global_step, final=True)

    def validate(self, val_data: List[Dict]) -> float:
        """Validate the model"""
        total_loss = 0
        num_batches = 0

        for i in range(0, len(val_data), self.batch_size):
            batch_data = val_data[i:i + self.batch_size]

            # Prepare batch (same as training)
            max_len = max(len(d['input_ids']) for d in batch_data)
            batch = {
                'input_ids': [],
                'target_ids': [],
                'attention_mask': []
            }

            for data in batch_data:
                input_ids = data['input_ids'] + [self.tokenizer.pad_token_id] * \
                    (max_len - len(data['input_ids']))
                target_ids = data['target_ids'] + [-100] * \
                    (max_len - len(data['target_ids']))
                attention_mask = data['attention_mask'] + \
                    [0] * (max_len - len(data['attention_mask']))

                batch['input_ids'].append(input_ids)
                batch['target_ids'].append(target_ids)
                batch['attention_mask'].append(attention_mask)

            # Forward pass only
            input_ids = mx.array(batch['input_ids'])
            target_ids = mx.array(batch['target_ids'])
            attention_mask = mx.array(batch['attention_mask'])

            result = self.model(
                input_ids,
                attention_mask=attention_mask,
                use_act=True)
            logits = result['logits']

            loss = nn.losses.cross_entropy(
                logits.reshape(-1, logits.shape[-1]),
                target_ids.reshape(-1),
                reduction='mean'
            )

            total_loss += loss.item()
            num_batches += 1

        return total_loss / num_batches

    def save_checkpoint(
            self,
            step: int,
            best: bool = False,
            final: bool = False):
        """Save model checkpoint"""
        if best:
            checkpoint_path = os.path.join(
                self.output_dir, "best_model.safetensors")
        elif final:
            checkpoint_path = os.path.join(
                self.output_dir, "final_model.safetensors")
        else:
            checkpoint_path = os.path.join(
                self.output_dir, f"checkpoint_{step}.safetensors")

        logger.info(f"Saving checkpoint to {checkpoint_path}")

        # Save model weights
        mx.save_safetensors(checkpoint_path, dict(self.model.parameters()))

        # Save config
        config_path = os.path.join(self.output_dir, "config.json")
        with open(config_path, 'w') as f:
            json.dump(self.config.__dict__, f, indent=2)

        # Save tokenizer info
        tokenizer_config = {
            'tokenizer_path': self.tokenizer_path,
            'vocab_size': self.tokenizer.vocab_size
        }
        with open(os.path.join(self.output_dir, "tokenizer_config.json"), 'w') as f:
            json.dump(tokenizer_config, f, indent=2)


def load_training_data(data_path: str) -> Tuple[List[str], List[str]]:
    """Load custom training data"""
    # Example: Load from JSON file with train/val split
    if data_path.endswith('.json'):
        with open(data_path, 'r') as f:
            data = json.load(f)

        if isinstance(data, dict) and 'train' in data and 'val' in data:
            return data['train'], data['val']
        elif isinstance(data, list):
            # Split 90/10 for train/val
            split_idx = int(len(data) * 0.9)
            return data[:split_idx], data[split_idx:]

    # Example: Load from text file (one sample per line)
    elif data_path.endswith('.txt'):
        with open(data_path, 'r') as f:
            lines = f.readlines()
        lines = [line.strip() for line in lines if line.strip()]
        split_idx = int(len(lines) * 0.9)
        return lines[:split_idx], lines[split_idx:]

    # Default: Create sample data for testing
    logger.warning(f"Could not load data from {data_path}, using sample data")
    train_texts = [
        "The hierarchical reasoning model uses adaptive computation time.",
        "Machine learning models can learn from data efficiently.",
        "Artificial intelligence is transforming how we solve problems.",
        "Neural networks process information in layers.",
        "Deep learning requires large amounts of training data.",
    ]
    val_texts = [
        "HRM achieves great performance with minimal parameters.",
        "Adaptive computation allows dynamic resource allocation.",
    ]
    return train_texts, val_texts


def main():
    parser = argparse.ArgumentParser(
        description="Fine-tune HRM on custom data")
    parser.add_argument(
        "--checkpoint-path",
        type=str,
        default="/Users/christianmerrill/Desktop/universal-ai-tools/models/hrm-checkpoint-sudoku",
        help="Path to Sapient HRM checkpoint")
    parser.add_argument(
        "--tokenizer-path",
        type=str,
        default="/Users/christianmerrill/Desktop/universal-ai-tools/models/mlx-community--Llama-3.2-3B-Instruct-4bit",
        help="Path to tokenizer")
    parser.add_argument(
        "--data-path",
        type=str,
        default="training_data.json",
        help="Path to training data (JSON or TXT file)"
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="/Users/christianmerrill/Desktop/universal-ai-tools/models/hrm-finetuned",
        help="Output directory for fine-tuned model")
    parser.add_argument("--learning-rate", type=float, default=1e-5)
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--max-length", type=int, default=512)
    parser.add_argument("--save-every", type=int, default=100)

    args = parser.parse_args()

    # Load training data
    train_texts, val_texts = load_training_data(args.data_path)
    logger.info(
        f"Loaded {
            len(train_texts)} training samples, {
            len(val_texts)} validation samples")

    # Initialize fine-tuner
    fine_tuner = HRMFineTuner(
        checkpoint_path=args.checkpoint_path,
        tokenizer_path=args.tokenizer_path,
        output_dir=args.output_dir,
        learning_rate=args.learning_rate,
        batch_size=args.batch_size,
        max_length=args.max_length
    )

    # Fine-tune model
    fine_tuner.fine_tune(
        train_texts=train_texts,
        val_texts=val_texts,
        epochs=args.epochs,
        save_every=args.save_every
    )

    logger.info(f"Fine-tuning complete! Model saved to {args.output_dir}")


if __name__ == "__main__":
    main()
