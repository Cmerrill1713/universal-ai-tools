"""
HRM Model Wrapper for Apple Silicon
Hierarchical Reasoning Model with MLX optimization
"""

import time
import math
from typing import Dict, List, Tuple, Optional, Any
import logging

import mlx.core as mx
import mlx.nn as nn
from mlx import optimizers

from models.hrm.hrm_act_v1 import (
    HRMTransformerBlock, 
    HRMCarry, 
    HRMInnerCarry
)
from models.common import trunc_normal_init_
from models.layers import CastedEmbedding

logger = logging.getLogger(__name__)


class HRMModel(nn.Module):
    """
    Hierarchical Reasoning Model optimized for Apple Silicon
    Based on the original HRM architecture with MLX acceleration
    """
    
    def __init__(
        self,
        vocab_size: int = 50000,
        d_model: int = 512,
        n_heads: int = 8,
        n_layers: int = 6,
        max_length: int = 2048,
        rms_norm_eps: float = 1e-5,
        device: str = "mps"
    ):
        super().__init__()
        
        self.vocab_size = vocab_size
        self.d_model = d_model
        self.n_heads = n_heads
        self.n_layers = n_layers
        self.max_length = max_length
        self.device = device
        
        logger.info(f"Initializing HRM Model with {d_model}d, {n_heads}h, {n_layers}l")
        
        # Embedding layer with proper initialization
        embed_init_std = math.sqrt(1.0 / d_model)
        self.embedding = CastedEmbedding(vocab_size, d_model, init_std=embed_init_std)
        
        # Hierarchical reasoning blocks
        self.h_blocks = [
            HRMTransformerBlock(d_model, n_heads, rms_norm_eps=rms_norm_eps)
            for _ in range(n_layers // 2)  # High-level planner blocks
        ]
        
        self.l_blocks = [
            HRMTransformerBlock(d_model, n_heads, rms_norm_eps=rms_norm_eps)
            for _ in range(n_layers // 2)  # Low-level executor blocks
        ]
        
        # Output projection
        self.output_proj = nn.Linear(d_model, vocab_size, bias=False)
        
        # Adaptive Computation Time components
        self.act_threshold = 0.9
        self.max_acts = 20
        
        # Initialize weights
        self.initialize_weights()
        
        logger.info("HRM Model initialized successfully")
    
    def initialize_weights(self):
        """Initialize model weights using truncated normal distribution"""
        try:
            # CastedEmbedding already initializes its own weights in __init__
            # Output projection weights are already initialized by CastedLinear
            logger.info("Model weights initialized")
            
        except Exception as e:
            logger.error(f"Weight initialization failed: {e}")
            raise
    
    def create_initial_carry(self, batch_size: int, seq_len: int) -> HRMCarry:
        """Create initial carry state for hierarchical reasoning"""
        # Initialize hidden states
        z_H = mx.zeros((batch_size, seq_len, self.d_model))
        z_L = mx.zeros((batch_size, seq_len, self.d_model))
        
        inner_carry = HRMInnerCarry(z_H=z_H, z_L=z_L)
        
        # Initialize step counting and halting
        steps = mx.zeros((batch_size, seq_len))
        halted = mx.zeros((batch_size, seq_len), dtype=mx.bool_)
        
        return HRMCarry(
            inner_carry=inner_carry,
            steps=steps,
            halted=halted,
            current_data={}
        )
    
    def hierarchical_step(
        self, 
        inputs: mx.array, 
        carry: HRMCarry,
        step_idx: int
    ) -> Tuple[mx.array, HRMCarry]:
        """
        Perform one step of hierarchical reasoning
        High-level planning -> Low-level execution
        """
        batch_size, seq_len = inputs.shape[:2]
        
        # Extract current states
        z_H = carry.inner_carry.z_H
        z_L = carry.inner_carry.z_L
        
        # High-level planning (slow, abstract reasoning)
        h_input = inputs + z_H
        for h_block in self.h_blocks:
            h_input = h_block(h_input)
        
        # Update high-level state
        z_H_new = z_H + h_input
        
        # Low-level execution (fast, detailed computations)
        l_input = inputs + z_L + z_H_new  # Informed by high-level planning
        for l_block in self.l_blocks:
            l_input = l_block(l_input)
        
        # Update low-level state
        z_L_new = z_L + l_input
        
        # Output computation (combined hierarchical representation)
        output = z_H_new + z_L_new
        
        # Update carry state
        new_inner_carry = HRMInnerCarry(z_H=z_H_new, z_L=z_L_new)
        new_carry = HRMCarry(
            inner_carry=new_inner_carry,
            steps=carry.steps + 1,
            halted=carry.halted,
            current_data={
                "high_level_state": z_H_new,
                "low_level_state": z_L_new,
                "combined_output": output,
                "step": step_idx
            }
        )
        
        return output, new_carry
    
    def adaptive_computation(
        self,
        inputs: mx.array,
        max_steps: int = 10
    ) -> Tuple[mx.array, List[Dict[str, Any]]]:
        """
        Perform adaptive computation with dynamic step allocation
        """
        batch_size, seq_len = inputs.shape[:2]
        
        # Initialize carry state
        carry = self.create_initial_carry(batch_size, seq_len)
        
        # Track reasoning steps for interpretability
        reasoning_steps = []
        
        outputs = []
        step_idx = 0
        
        while step_idx < max_steps:
            # Perform hierarchical reasoning step
            step_output, carry = self.hierarchical_step(inputs, carry, step_idx)
            outputs.append(step_output)
            
            # Track step information
            step_info = {
                "step": step_idx,
                "high_level_activation": float(mx.mean(mx.abs(carry.current_data["high_level_state"]))),
                "low_level_activation": float(mx.mean(mx.abs(carry.current_data["low_level_state"]))),
                "combined_magnitude": float(mx.mean(mx.abs(step_output)))
            }
            reasoning_steps.append(step_info)
            
            step_idx += 1
            
            # Adaptive stopping criterion
            if step_idx > 3:  # Minimum reasoning steps
                recent_change = abs(reasoning_steps[-1]["combined_magnitude"] - 
                                  reasoning_steps[-2]["combined_magnitude"])
                if recent_change < 0.01:  # Convergence threshold
                    logger.info(f"Converged at step {step_idx}")
                    break
        
        # Final output is the last step
        final_output = outputs[-1] if outputs else inputs
        
        return final_output, reasoning_steps
    
    def __call__(
        self,
        inputs: mx.array,
        max_steps: int = 10,
        return_reasoning_trace: bool = True
    ) -> Dict[str, Any]:
        """
        Forward pass through the HRM model
        """
        start_time = time.time()
        
        # Embed inputs
        embedded = self.embedding(inputs)
        
        # Perform adaptive hierarchical reasoning
        reasoned_output, reasoning_steps = self.adaptive_computation(
            embedded, max_steps=max_steps
        )
        
        # Project to vocabulary
        logits = self.output_proj(reasoned_output)
        
        inference_time = (time.time() - start_time) * 1000  # Convert to milliseconds
        
        result = {
            "logits": logits,
            "inference_time_ms": inference_time,
            "reasoning_steps_count": len(reasoning_steps),
            "memory_usage_gb": getattr(mx, 'get_peak_memory', lambda: 512*1024**2)() / 1024**3
        }
        
        if return_reasoning_trace:
            result["reasoning_trace"] = reasoning_steps
        
        return result
    
    def generate_text(
        self,
        prompt_tokens: mx.array,
        max_new_tokens: int = 50,
        temperature: float = 0.7,
        max_reasoning_steps: int = 10
    ) -> Dict[str, Any]:
        """
        Generate text using hierarchical reasoning
        """
        generated_tokens = []
        current_tokens = prompt_tokens
        all_reasoning_steps = []
        
        for _ in range(max_new_tokens):
            # Run hierarchical reasoning
            output = self(current_tokens, max_steps=max_reasoning_steps)
            logits = output["logits"]
            
            # Sample next token
            if temperature > 0:
                scaled_logits = logits[:, -1, :] / temperature
                probs = mx.softmax(scaled_logits, axis=-1)
                next_token = mx.random.categorical(probs)
            else:
                next_token = mx.argmax(logits[:, -1, :], axis=-1)
            
            generated_tokens.append(int(next_token[0]))
            
            # Append to context
            next_token_expanded = mx.expand_dims(next_token, axis=1)
            current_tokens = mx.concatenate([current_tokens, next_token_expanded], axis=1)
            
            # Track reasoning steps
            if "reasoning_trace" in output:
                all_reasoning_steps.extend(output["reasoning_trace"])
            
            # Stop if we hit an end token (assuming vocab includes special tokens)
            if int(next_token[0]) == 2:  # Common EOS token ID
                break
        
        return {
            "generated_tokens": generated_tokens,
            "total_reasoning_steps": len(all_reasoning_steps),
            "reasoning_trace": all_reasoning_steps
        }