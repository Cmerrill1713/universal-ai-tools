#!/usr/bin/env python3
"""
HRM Training Script for MLX
Based on the original HRM pretrain.py
"""

import argparse
import time
import numpy as np
import os
import pickle
import glob
import re
from typing import Tuple, List, Dict, Optional

import mlx.core as mx
import mlx.nn as nn
import mlx.optimizers as optim
from mlx_adam_atan2 import AdamATan2, AdamATan2Scaled
from mlx_adam_atan2_exact import AdamATan2Exact
from dual_optimizer import DualAdamATan2
from lr_scheduler import CosineScheduleWithWarmup
import mlx.utils

# Import model components from the new structure
from models.hrm import HierarchicalReasoningModel, HRMCarry
from models.losses import compute_act_loss


def load_sudoku_data(data_path: str, split: str = "train", max_samples: int = 1000, min_difficulty: int = 0):
    """Load official Sudoku-Extreme data and add special tokens"""

    from load_official_sudoku import load_official_sudoku_data

    csv_file = f"{data_path}/sudoku-extreme/{split}.csv"

    print(f"Loading official Sudoku-Extreme data from {csv_file}")

    puzzles, solutions = load_official_sudoku_data(
        csv_file,
        max_samples=max_samples,
        min_difficulty=min_difficulty,
        shuffle_augment=True,
        num_augmentations=1 if split == "train" else 0
    )

    # Add special tokens to make sequence length 83 (81 + 2 special tokens)
    # Use token 10 for both start and end (vocab_size=11 means tokens 0-10)
    START_TOKEN = 10
    END_TOKEN = 10  # Same token for start and end

    processed_puzzles = []
    processed_solutions = []

    for puzzle, solution in zip(puzzles, solutions):
        # Convert to list if numpy array
        if hasattr(puzzle, 'tolist'):
            puzzle = puzzle.tolist()
        if hasattr(solution, 'tolist'):
            solution = solution.tolist()

        # Add start token at beginning and end token at end
        puzzle_with_tokens = [START_TOKEN] + puzzle + [END_TOKEN]
        solution_with_tokens = [START_TOKEN] + solution + [END_TOKEN]

        processed_puzzles.append(puzzle_with_tokens)
        processed_solutions.append(solution_with_tokens)

    return processed_puzzles, processed_solutions


class HRMTrainer:
    """Trainer for HRM model"""

    def __init__(
        self,
        model: HierarchicalReasoningModel,
        train_data: Tuple[List, List],
        val_data: Tuple[List, List],
        learning_rate: float = 1e-4,
        weight_decay: float = 1.0,
        batch_size: int = 16,
        max_epochs: int = 20000,
        eval_interval: int = 2000,
        warmup_steps: int = 2000,
        min_lr_ratio: float = 0.1,
        embedding_lr: float = None,  # If None, use same as base lr
        gradient_accumulation_steps: int = 1,  # For gradient accumulation
    ):
        self.model = model
        self.train_puzzles, self.train_solutions = train_data
        self.val_puzzles, self.val_solutions = val_data
        self.batch_size = batch_size
        self.max_epochs = max_epochs
        self.eval_interval = eval_interval
        self.gradient_accumulation_steps = gradient_accumulation_steps

        # Use AdamATan2 optimizer (matches original HRM implementation)
        # This handles high weight decay (1.0) much better than standard AdamW
        
        # Set embedding learning rate
        if embedding_lr is None:
            embedding_lr = learning_rate  # Use same LR if not specified
        self.embedding_lr = embedding_lr
        
        # Use dual optimizer if embedding LR is different from base LR
        if abs(embedding_lr - learning_rate) > 1e-8:
            print("🔧 Using dual optimizer setup (different embedding LR)")
            self.optimizer = DualAdamATan2(
                base_lr=learning_rate,
                embedding_lr=embedding_lr,
                weight_decay=weight_decay,
                embedding_weight_decay=weight_decay,  # Use same weight decay for now
                betas=(0.9, 0.95),
                a=1.27,
                b=1.0
            )
            self.use_dual_optimizer = True
        else:
            print("🔧 Using single optimizer setup (same LR for all parameters)")
            self.optimizer = AdamATan2Exact(
                learning_rate=learning_rate,
                weight_decay=weight_decay,
                betas=(0.9, 0.95),  # PyTorch AdamATan2 defaults
                a=1.27,  # PyTorch default scaling
                b=1.0    # PyTorch default
            )
            self.use_dual_optimizer = False
        
        # Initialize optimizer with model parameters
        self.optimizer.init(self.model.trainable_parameters())
        
        # Calculate total training steps for LR scheduler
        steps_per_epoch = len(self.train_puzzles) // self.batch_size
        total_steps = self.max_epochs * steps_per_epoch
        
        # Initialize learning rate scheduler (matches original HRM)
        self.lr_scheduler = CosineScheduleWithWarmup(
            base_lr=learning_rate,
            warmup_steps=warmup_steps,
            total_steps=total_steps,
            min_lr_ratio=min_lr_ratio
        )
        
        print(f"📊 Base learning rate: {learning_rate}")
        print(f"📊 Embedding learning rate: {self.embedding_lr} (for embed_tokens)")
        print(f"📊 LR scheduler: {warmup_steps} warmup steps, {total_steps} total steps")
        print(f"📊 Min LR ratio: {min_lr_ratio} (min_lr = {learning_rate * min_lr_ratio})")
        
        self.grad_clip_norm = 1.0

        self.step = 0
        self.best_val_accuracy = 0.0

        # Create checkpoints directory
        self.checkpoint_dir = "checkpoints"
        os.makedirs(self.checkpoint_dir, exist_ok=True)

        # Keep track of recent checkpoints for cleanup
        self.recent_checkpoints = []

    def create_batch(self, indices: np.ndarray) -> Dict[str, mx.array]:
        """Create a batch from indices"""
        batch_puzzles = mx.array([self.train_puzzles[i].tolist() if hasattr(self.train_puzzles[i], 'tolist')
                                 else self.train_puzzles[i] for i in indices])
        batch_solutions = mx.array([self.train_solutions[i].tolist() if hasattr(self.train_solutions[i], 'tolist')
                                   else self.train_solutions[i] for i in indices])

        # Add puzzle identifiers (all zeros for now, as in simplified case)
        batch_size = len(indices)
        puzzle_identifiers = mx.zeros((batch_size,), dtype=mx.int32)

        return {
            "inputs": batch_puzzles,
            "labels": batch_solutions,
            "puzzle_identifiers": puzzle_identifiers
        }

    def evaluate(self, n_batches: int = 10) -> Dict[str, float]:
        """Evaluate model"""
        total_accuracy = 0.0
        total_exact_accuracy = 0.0
        n_samples = 0

        # Set model to eval mode
        self.model.eval()

        for i in range(n_batches):
            # Random validation batch
            val_indices = np.random.choice(
                len(self.val_puzzles),
                size=min(self.batch_size, len(self.val_puzzles)),
                replace=False
            )

            batch = {
                "inputs": mx.array([self.val_puzzles[i].tolist() if hasattr(self.val_puzzles[i], 'tolist')
                                   else self.val_puzzles[i] for i in val_indices]),
                "labels": mx.array([self.val_solutions[i].tolist() if hasattr(self.val_solutions[i], 'tolist')
                                   else self.val_solutions[i] for i in val_indices]),
                "puzzle_identifiers": mx.zeros((len(val_indices),), dtype=mx.int32)
            }

            # Initialize carry and run model
            carry = self.model.initial_carry(batch)

            # Run until all sequences halt
            all_halted = False
            step_count = 0
            while not all_halted and step_count < self.model.halt_max_steps:
                carry, outputs = self.model(carry, batch)
                all_halted = carry.halted.all()
                step_count += 1

            # Compute metrics
            _, metrics = compute_act_loss(outputs, batch["labels"])

            total_accuracy += float(metrics["accuracy"])
            total_exact_accuracy += float(metrics["exact_accuracy"])
            n_samples += 1

        # Set model back to train mode
        self.model.train()

        return {
            'val_accuracy': total_accuracy / n_samples,
            'val_exact_accuracy': total_exact_accuracy / n_samples,
        }

    def train(self):
        """Main training loop with gradient accumulation support"""
        print(f"🚀 Starting HRM Training...")
        print(f"📊 Training samples: {len(self.train_puzzles):,}")
        print(f"📊 Validation samples: {len(self.val_puzzles):,}")
        print(f"🔧 Model: {self.model.inner.d_model}d, {self.model.inner.H_cycles}×{self.model.inner.L_cycles} reasoning")
        print(f"🎯 Architecture: MLX implementation of official HRM")
        
        # Gradient accumulation settings
        grad_accum_steps = getattr(self, 'gradient_accumulation_steps', 1)
        effective_batch_size = self.batch_size * grad_accum_steps
        print(f"🔄 Gradient accumulation: {grad_accum_steps} steps (effective batch size: {effective_batch_size})")

        # Calculate total steps for progress tracking
        steps_per_epoch = len(self.train_puzzles) // effective_batch_size
        total_steps = self.max_epochs * steps_per_epoch

        # Initialize accumulated gradients
        accumulated_grads = None

        for epoch in range(self.max_epochs):
            # Shuffle training data
            train_indices = np.random.permutation(len(self.train_puzzles))
            n_batches = len(train_indices) // self.batch_size

            for batch_idx in range(n_batches):
                batch_start = time.time()

                # Create batch
                batch_indices = train_indices[
                    batch_idx * self.batch_size:(batch_idx + 1) * self.batch_size
                ]
                batch = self.create_batch(batch_indices)

                # Forward pass with ACT (optimized)
                def loss_fn(model):
                    carry = model.initial_carry(batch)

                    total_loss = mx.array(0.0)
                    step_count = 0
                    last_metrics = None

                    # Unroll ACT loop for better performance
                    for step_count in range(model.halt_max_steps):
                        carry, outputs = model(carry, batch)
                        loss, metrics = compute_act_loss(outputs, batch["labels"])
                        total_loss = total_loss + loss
                        last_metrics = metrics  # Save metrics from last step

                        # Early stopping if all halted (but keep loop unrolled)
                        if carry.halted.all():
                            break

                    # Scale loss by accumulation steps for proper averaging
                    return total_loss / grad_accum_steps, (step_count + 1, last_metrics)

                loss_and_grad_fn = nn.value_and_grad(self.model, loss_fn)
                (loss, (step_count, metrics)), grads = loss_and_grad_fn(self.model)

                # Gradient clipping (restored proper implementation)
                def clip_grads(grads, max_norm=1.0):
                    total_norm = 0.0

                    def compute_norm(g):
                        nonlocal total_norm
                        if g is not None:
                            total_norm += mx.sum(g ** 2)
                        return g

                    nn.utils.tree_map(compute_norm, grads)
                    total_norm = mx.sqrt(total_norm)

                    clip_coef = max_norm / (total_norm + 1e-6)
                    clip_coef = mx.minimum(clip_coef, 1.0)

                    def clip_grad(g):
                        return g * clip_coef if g is not None else g

                    return nn.utils.tree_map(clip_grad, grads)

                grads = clip_grads(grads, self.grad_clip_norm)

                # Accumulate gradients
                if accumulated_grads is None:
                    accumulated_grads = grads
                else:
                    # Add gradients element-wise
                    def add_grads(acc_g, new_g):
                        if acc_g is None or new_g is None:
                            return new_g if acc_g is None else acc_g
                        return acc_g + new_g
                    
                    accumulated_grads = nn.utils.tree_map(add_grads, accumulated_grads, grads)

                # Check if we should update parameters (every grad_accum_steps)
                is_accumulation_step = (batch_idx + 1) % grad_accum_steps == 0
                is_last_batch = batch_idx == n_batches - 1
                
                if is_accumulation_step or is_last_batch:
                    # Update learning rate with scheduler (matches original HRM)
                    if self.use_dual_optimizer:
                        # For dual optimizer, update main optimizer's LR
                        current_lr = self.lr_scheduler.get_lr(self.step)
                        self.optimizer.update_learning_rate(current_lr)
                    else:
                        # For single optimizer, use standard update
                        current_lr = self.lr_scheduler.update_optimizer_lr(self.optimizer, self.step)

                    # Update with accumulated gradients
                    self.optimizer.update(self.model, accumulated_grads)
                    mx.eval(self.model.parameters(), self.optimizer.state)
                    
                    # Reset accumulated gradients
                    accumulated_grads = None

                # More aggressive memory cleanup
                if self.step % 50 == 0:  # More frequent
                    mx.eval(mx.zeros(1))  # Force cleanup of computation graph
                    # Also clear Python's garbage collector
                    import gc
                    gc.collect()

                # Metrics were already computed during loss calculation
                # No need for another forward pass!

                batch_time = time.time() - batch_start
                samples_per_sec = self.batch_size / batch_time

                # Logging
                if self.step % 10 == 0:
                    progress_pct = (self.step / total_steps) * 100
                    print(f"Step {self.step:6d}/{total_steps} ({progress_pct:5.1f}%) | "
                          f"Epoch {epoch+1:2d} | "
                          f"Loss: {float(loss):.4f} | "
                          f"Acc: {float(metrics['accuracy']):.3f} | "
                          f"LR: {float(self.optimizer.learning_rate):.2e} | "
                          f"Speed: {samples_per_sec:.0f} smp/s | "
                          f"Steps: {step_count:.1f}")

                # Periodic checkpoint saving (every 10 steps, keep only last 2)
                # Also save at step 0 to test checkpoint system
                if self.step % 10 == 0:
                    self.save_checkpoint(f"checkpoint_step_{self.step}.npz", cleanup_old=True)

                # Evaluation
                if self.step % self.eval_interval == 0 and self.step > 0:
                    val_metrics = self.evaluate()

                    print(f"\n{'='*60}")
                    print(f"📈 VALIDATION (Step {self.step})")
                    print(f"{'='*60}")
                    print(f"Val Accuracy: {val_metrics['val_accuracy']:.3f}")
                    print(f"Val Exact:    {val_metrics['val_exact_accuracy']:.3f}")
                    print(f"{'='*60}\n")

                    if val_metrics['val_accuracy'] > self.best_val_accuracy:
                        self.best_val_accuracy = val_metrics['val_accuracy']
                        # Save best model
                        self.save_checkpoint(f"best_model_step_{self.step}.npz", is_best=True)

                    # Save regular checkpoint
                    self.save_checkpoint(f"checkpoint_step_{self.step}.npz")

                self.step += 1

        # Save final checkpoint
        self.save_checkpoint("final_model.npz")

    def save_checkpoint(self, filename: str, is_best: bool = False, cleanup_old: bool = False):
        """Save model checkpoint"""
        checkpoint_path = os.path.join(self.checkpoint_dir, filename)

        # Save model weights using MLX's built-in method
        try:
            # Use MLX's save_weights method (handles .npz automatically)
            self.model.save_weights(checkpoint_path)
        except Exception as e:
            print(f"❌ Model save failed: {e}")
            return

        # Save training state
        state_path = checkpoint_path.replace('.npz', '_state.pkl')
        try:
            training_state = {
                'step': self.step,
                'best_val_accuracy': self.best_val_accuracy,
                # Skip optimizer state for now (can cause serialization issues)
                # 'optimizer_state': self.optimizer.state,
            }

            with open(state_path, 'wb') as f:
                pickle.dump(training_state, f)
        except Exception as e:
            print(f"⚠️  Warning: Could not save training state: {e}")



        # Cleanup old checkpoints (keep only last 2 regular checkpoints)
        if cleanup_old and not is_best:
            self.recent_checkpoints.append((checkpoint_path, state_path))

            # Keep only last 2 checkpoints
            while len(self.recent_checkpoints) > 2:
                old_checkpoint, old_state = self.recent_checkpoints.pop(0)
                try:
                    if os.path.exists(old_checkpoint):
                        os.remove(old_checkpoint)
                    if os.path.exists(old_state):
                        os.remove(old_state)

                except OSError:
                    pass  # Ignore if file doesn't exist

    def load_checkpoint(self, checkpoint_path: str):
        """Load model checkpoint"""
        try:
            # Load model weights using MLX's built-in method
            self.model.load_weights(checkpoint_path)

            # Load training state
            state_path = checkpoint_path.replace('.npz', '_state.pkl')
            if os.path.exists(state_path):
                with open(state_path, 'rb') as f:
                    training_state = pickle.load(f)

                self.step = training_state['step']
                self.best_val_accuracy = training_state['best_val_accuracy']

                print(f"📂 Loaded checkpoint: {checkpoint_path}")
                print(f"   Step: {self.step}, Best Val Acc: {self.best_val_accuracy:.3f}")

        except Exception as e:
            print(f"❌ Error loading checkpoint: {e}")
            print("Continuing with fresh model...")


def find_latest_checkpoint(checkpoint_dir: str) -> Optional[str]:
    """Find the latest checkpoint in the directory"""
    if not os.path.exists(checkpoint_dir):
        return None

    # Look for checkpoint files with step numbers
    checkpoint_pattern = os.path.join(checkpoint_dir, "checkpoint_step_*.npz")
    checkpoint_files = glob.glob(checkpoint_pattern)

    if not checkpoint_files:
        return None

    # Extract step numbers and find the latest
    latest_step = -1
    latest_checkpoint = None

    for checkpoint_file in checkpoint_files:
        # Extract step number from filename
        match = re.search(r'checkpoint_step_(\d+)\.npz', checkpoint_file)
        if match:
            step = int(match.group(1))
            if step > latest_step:
                latest_step = step
                latest_checkpoint = checkpoint_file

    return latest_checkpoint


def main():
    parser = argparse.ArgumentParser(description="HRM Training on MLX")
    parser.add_argument("--d_model", type=int, default=512, help="Model dimension")
    parser.add_argument("--H_cycles", type=int, default=2, help="High-level cycles")
    parser.add_argument("--L_cycles", type=int, default=2, help="Low-level cycles")
    parser.add_argument("--H_layers", type=int, default=4, help="High-level layers")
    parser.add_argument("--L_layers", type=int, default=4, help="Low-level layers")
    parser.add_argument("--batch_size", type=int, default=16, help="Batch size")
    parser.add_argument("--learning_rate", type=float, default=1e-4, help="Learning rate")
    parser.add_argument("--max_epochs", type=int, default=20000, help="Maximum epochs")
    parser.add_argument("--train_samples", type=int, default=1000, help="Training samples")
    parser.add_argument("--val_samples", type=int, default=200, help="Validation samples")
    parser.add_argument("--min_difficulty", type=int, default=20, help="Minimum puzzle difficulty")
    parser.add_argument("--data_path", type=str, default="data", help="Path to data directory")
    parser.add_argument("--checkpoint_dir", type=str, default="checkpoints", help="Checkpoint directory")
    parser.add_argument("--load_checkpoint", type=str, default=None, help="Path to checkpoint to load")
    parser.add_argument("--save_every", type=int, default=2000, help="Save checkpoint every N steps")
    parser.add_argument("--halt_max_steps", type=int, default=16, help="Maximum ACT steps")
    parser.add_argument("--halt_exploration_prob", type=float, default=0.1, help="Q-learning exploration probability")
    parser.add_argument("--weight_decay", type=float, default=0.1, help="Weight decay for optimizer")
    parser.add_argument("--warmup_steps", type=int, default=2000, help="Learning rate warmup steps")
    parser.add_argument("--min_lr_ratio", type=float, default=0.1, help="Minimum LR ratio for cosine schedule")
    parser.add_argument("--embedding_lr", type=float, default=None, help="Separate learning rate for embeddings (default: same as main LR)")
    parser.add_argument("--no_auto_resume", action="store_true", help="Disable automatic checkpoint resuming")

    args = parser.parse_args()

    print("🧩 HRM Training (MLX Implementation)")
    print("=" * 60)
    print("🔧 Based on github.com/sapientinc/HRM")
    print("💾 Complete implementation with ACT and Q-learning")
    print("🎯 Exact mathematical match to original PyTorch version")
    print()

    # Load data
    print("📊 Loading official Sudoku-Extreme datasets...")
    train_puzzles, train_solutions = load_sudoku_data(
        args.data_path, "train", args.train_samples, args.min_difficulty
    )
    val_puzzles, val_solutions = load_sudoku_data(
        args.data_path, "test", args.val_samples, args.min_difficulty
    )

    print(f"✅ Train samples: {len(train_puzzles):,}")
    print(f"✅ Val samples: {len(val_puzzles):,}")
    print()

    # Create model
    print("🤖 Creating HRM model...")
    model = HierarchicalReasoningModel(
        vocab_size=11,
        d_model=args.d_model,
        H_cycles=args.H_cycles,
        L_cycles=args.L_cycles,
        H_layers=args.H_layers,
        L_layers=args.L_layers,
        halt_max_steps=args.halt_max_steps,
        halt_exploration_prob=args.halt_exploration_prob,
    )

    # Count parameters - use mlx.utils.tree_flatten not nn.utils
    total_params = sum(v.size for _, v in mlx.utils.tree_flatten(model.parameters()))
    print(f"✅ Model parameters: {total_params:,}")
    print(f"✅ Architecture: {args.H_cycles}×{args.L_cycles} cycles, {args.H_layers}+{args.L_layers} layers")
    print()

    # Create trainer
    print("🏋️ Creating Trainer...")
    trainer = HRMTrainer(
        model=model,
        train_data=(train_puzzles, train_solutions),
        val_data=(val_puzzles, val_solutions),
        learning_rate=args.learning_rate,
        weight_decay=args.weight_decay,  # Critical for stability
        batch_size=args.batch_size,
        max_epochs=args.max_epochs,
        warmup_steps=args.warmup_steps,
        min_lr_ratio=args.min_lr_ratio,
        embedding_lr=args.embedding_lr,
    )

    # Set checkpoint directory
    trainer.checkpoint_dir = args.checkpoint_dir
    os.makedirs(trainer.checkpoint_dir, exist_ok=True)

    # Auto-resume from latest checkpoint or load specified checkpoint
    checkpoint_to_load = None

    if args.load_checkpoint:
        # Explicit checkpoint specified
        checkpoint_to_load = args.load_checkpoint
        print(f"📂 Loading specified checkpoint: {checkpoint_to_load}")
    elif not args.no_auto_resume:
        # Auto-resume from latest checkpoint
        latest_checkpoint = find_latest_checkpoint(args.checkpoint_dir)
        if latest_checkpoint:
            checkpoint_to_load = latest_checkpoint
            print(f"🔄 Auto-resuming from latest checkpoint: {os.path.basename(latest_checkpoint)}")
        else:
            print("🆕 No existing checkpoints found, starting fresh training")
    else:
        print("🆕 Auto-resume disabled, starting fresh training")

    if checkpoint_to_load:
        trainer.load_checkpoint(checkpoint_to_load)

    print()
    print("=" * 60)
    print("🚀 STARTING HRM TRAINING")
    print("=" * 60)

    # Train
    trainer.train()

    print()
    print("=" * 60)
    print("✅ TRAINING COMPLETE!")
    print("=" * 60)
    print(f"📊 Best Validation Accuracy: {trainer.best_val_accuracy:.3f}")


if __name__ == "__main__":
    main()
