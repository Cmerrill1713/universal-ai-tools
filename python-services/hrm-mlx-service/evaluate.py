#!/usr/bin/env python3
"""
Evaluation script for HRM MLX implementation
Based on the original HRM evaluate.py
"""

import argparse
import os
import yaml
import numpy as np
import pickle
from typing import Dict, List, Optional

import mlx.core as mx
import mlx.nn as nn

from models.hrm import HierarchicalReasoningModel, HRMCarry
from models.losses import compute_act_loss
from pretrain import load_sudoku_data


class HRMEvaluator:
    """Evaluator for HRM model"""
    
    def __init__(
        self,
        model: HierarchicalReasoningModel,
        checkpoint_path: str,
        save_outputs: List[str] = None
    ):
        self.model = model
        self.checkpoint_path = checkpoint_path
        self.save_outputs = save_outputs or ["inputs", "labels", "logits", "q_halt_logits", "q_continue_logits"]
        
        # Load checkpoint
        self.load_checkpoint(checkpoint_path)
    
    def load_checkpoint(self, checkpoint_path: str):
        """Load model checkpoint"""
        try:
            # Load model weights
            self.model.load_weights(checkpoint_path)
            print(f"✅ Loaded checkpoint: {checkpoint_path}")
            
            # Try to load training state for step info
            state_path = checkpoint_path.replace('.npz', '_state.pkl')
            if os.path.exists(state_path):
                with open(state_path, 'rb') as f:
                    training_state = pickle.load(f)
                    step = training_state.get('step', 0)
                    print(f"   Step: {step}")
        except Exception as e:
            print(f"❌ Error loading checkpoint: {e}")
            raise
    
    def evaluate(
        self,
        data: tuple,
        batch_size: int = 32,
        num_batches: Optional[int] = None
    ) -> Dict[str, float]:
        """Evaluate model on dataset"""
        
        puzzles, solutions = data
        n_samples = len(puzzles)
        
        # Calculate number of batches
        total_batches = (n_samples + batch_size - 1) // batch_size
        if num_batches is not None:
            total_batches = min(total_batches, num_batches)
        
        # Metrics
        total_loss = 0.0
        total_accuracy = 0.0
        total_exact_accuracy = 0.0
        total_q_halt_accuracy = 0.0
        total_steps = 0.0
        n_evaluated = 0
        
        # Storage for outputs if requested
        all_outputs = {key: [] for key in self.save_outputs}
        
        print(f"🔍 Evaluating on {total_batches} batches...")
        
        for batch_idx in range(total_batches):
            # Create batch
            start_idx = batch_idx * batch_size
            end_idx = min(start_idx + batch_size, n_samples)
            batch_indices = list(range(start_idx, end_idx))
            
            batch_puzzles = mx.array([puzzles[i].tolist() if hasattr(puzzles[i], 'tolist') 
                                     else puzzles[i] for i in batch_indices])
            batch_solutions = mx.array([solutions[i].tolist() if hasattr(solutions[i], 'tolist')
                                       else solutions[i] for i in batch_indices])
            
            actual_batch_size = len(batch_indices)
            puzzle_identifiers = mx.zeros((actual_batch_size,), dtype=mx.int32)
            
            batch = {
                "inputs": batch_puzzles,
                "labels": batch_solutions,
                "puzzle_identifiers": puzzle_identifiers
            }
            
            # Initialize carry
            carry = self.model.initial_carry(batch)
            
            # Run until all sequences halt
            step_count = 0
            while not carry.halted.all() and step_count < self.model.halt_max_steps:
                carry, outputs = self.model(carry, batch)
                step_count += 1
            
            # Compute metrics
            loss, metrics = compute_act_loss(outputs, batch["labels"])
            
            # Accumulate metrics
            total_loss += float(loss) * actual_batch_size
            total_accuracy += float(metrics["accuracy"]) * actual_batch_size
            total_exact_accuracy += float(metrics["exact_accuracy"]) * actual_batch_size
            
            # Q-halt accuracy
            mask = batch["labels"] != -100
            loss_counts = mask.sum(axis=-1)
            is_correct = mask & (mx.argmax(outputs["logits"], axis=-1) == batch["labels"])
            seq_is_correct = is_correct.sum(axis=-1) == loss_counts
            q_halt_accuracy = ((outputs["q_halt_logits"] >= 0) == seq_is_correct).astype(mx.float32).mean()
            total_q_halt_accuracy += float(q_halt_accuracy) * actual_batch_size
            
            total_steps += step_count * actual_batch_size
            n_evaluated += actual_batch_size
            
            # Store outputs if requested
            if self.save_outputs:
                for key in self.save_outputs:
                    if key in batch:
                        all_outputs[key].append(batch[key])
                    elif key in outputs:
                        all_outputs[key].append(outputs[key])
            
            # Progress
            if (batch_idx + 1) % 10 == 0:
                print(f"   Batch {batch_idx + 1}/{total_batches} - "
                      f"Acc: {total_accuracy/n_evaluated:.3f}, "
                      f"Exact: {total_exact_accuracy/n_evaluated:.3f}")
        
        # Final metrics
        metrics = {
            'loss': total_loss / n_evaluated,
            'accuracy': total_accuracy / n_evaluated,
            'exact_accuracy': total_exact_accuracy / n_evaluated,
            'q_halt_accuracy': total_q_halt_accuracy / n_evaluated,
            'avg_steps': total_steps / n_evaluated,
            'n_evaluated': n_evaluated
        }
        
        # Save outputs if requested
        if self.save_outputs and all_outputs:
            output_dir = os.path.dirname(self.checkpoint_path)
            output_file = os.path.join(output_dir, "eval_outputs.npz")
            
            # Convert lists to arrays
            save_dict = {}
            for key, values in all_outputs.items():
                if values:
                    save_dict[key] = mx.concatenate(values, axis=0)
            
            if save_dict:
                mx.savez(output_file, **save_dict)
                print(f"💾 Saved outputs to {output_file}")
        
        return metrics


def main():
    parser = argparse.ArgumentParser(description="Evaluate HRM Model")
    parser.add_argument("--checkpoint", type=str, required=True, help="Path to model checkpoint")
    parser.add_argument("--data_path", type=str, default="data", help="Path to data directory")
    parser.add_argument("--split", type=str, default="test", help="Dataset split to evaluate")
    parser.add_argument("--batch_size", type=int, default=32, help="Batch size for evaluation")
    parser.add_argument("--num_batches", type=int, default=None, help="Number of batches to evaluate (None for all)")
    parser.add_argument("--min_difficulty", type=int, default=20, help="Minimum puzzle difficulty")
    parser.add_argument("--save_outputs", nargs="+", default=None, help="Outputs to save")
    
    # Model architecture args (should match training)
    parser.add_argument("--d_model", type=int, default=512, help="Model dimension")
    parser.add_argument("--H_cycles", type=int, default=2, help="High-level cycles")
    parser.add_argument("--L_cycles", type=int, default=2, help="Low-level cycles")
    parser.add_argument("--H_layers", type=int, default=4, help="High-level layers")
    parser.add_argument("--L_layers", type=int, default=4, help="Low-level layers")
    parser.add_argument("--halt_max_steps", type=int, default=8, help="Maximum ACT steps")
    
    args = parser.parse_args()
    
    print("🧩 HRM Evaluation (MLX Implementation)")
    print("=" * 60)
    
    # Try to load config from checkpoint directory
    config_path = os.path.join(os.path.dirname(args.checkpoint), "config.yaml")
    if os.path.exists(config_path):
        print(f"📄 Loading config from {config_path}")
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)
            # Override args with config values
            for key, value in config.items():
                if hasattr(args, key):
                    setattr(args, key, value)
    
    # Load data
    print(f"📊 Loading {args.split} data...")
    puzzles, solutions = load_sudoku_data(
        args.data_path, 
        args.split, 
        max_samples=10000,  # Load more for evaluation
        min_difficulty=args.min_difficulty
    )
    print(f"✅ Loaded {len(puzzles)} samples")
    
    # Create model
    print("🤖 Creating model...")
    model = HierarchicalReasoningModel(
        vocab_size=11,
        d_model=args.d_model,
        H_cycles=args.H_cycles,
        L_cycles=args.L_cycles,
        H_layers=args.H_layers,
        L_layers=args.L_layers,
        halt_max_steps=args.halt_max_steps,
    )
    
    # Count parameters
    params = nn.utils.tree_flatten(model.parameters())[0]
    total_params = sum(x.size for x in params if hasattr(x, 'size'))
    print(f"✅ Model parameters: {total_params:,}")
    
    # Create evaluator
    evaluator = HRMEvaluator(
        model=model,
        checkpoint_path=args.checkpoint,
        save_outputs=args.save_outputs
    )
    
    # Evaluate
    print()
    print("=" * 60)
    print("🚀 Starting Evaluation")
    print("=" * 60)
    
    metrics = evaluator.evaluate(
        data=(puzzles, solutions),
        batch_size=args.batch_size,
        num_batches=args.num_batches
    )
    
    # Print results
    print()
    print("=" * 60)
    print("📊 Evaluation Results")
    print("=" * 60)
    print(f"Loss:            {metrics['loss']:.4f}")
    print(f"Accuracy:        {metrics['accuracy']:.3f}")
    print(f"Exact Accuracy:  {metrics['exact_accuracy']:.3f}")
    print(f"Q-Halt Accuracy: {metrics['q_halt_accuracy']:.3f}")
    print(f"Avg Steps:       {metrics['avg_steps']:.1f}")
    print(f"Samples:         {metrics['n_evaluated']:,}")
    print("=" * 60)
    
    # Save results
    results_path = os.path.join(os.path.dirname(args.checkpoint), "eval_results.yaml")
    with open(results_path, 'w') as f:
        yaml.dump(metrics, f)
    print(f"💾 Saved results to {results_path}")


if __name__ == "__main__":
    main()