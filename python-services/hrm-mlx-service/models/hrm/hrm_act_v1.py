"""
Hierarchical Reasoning Model with ACT (Adaptive Computation Time)
MLX implementation - exact match to original HRM/models/hrm/hrm_act_v1.py
"""

from typing import Tuple, Dict, Optional
from dataclasses import dataclass
import math

import mlx.core as mx
import mlx.nn as nn

from ..common import trunc_normal_init_
from ..layers import (
    rms_norm, SwiGLU, Attention, RotaryEmbedding,
    CastedEmbedding, CastedLinear
)
from ..sparse_embedding import CastedSparseEmbedding


@dataclass
class HRMInnerCarry:
    """Inner carry state for HRM - matches HierarchicalReasoningModel_ACTV1InnerCarry"""
    z_H: mx.array
    z_L: mx.array


@dataclass 
class HRMCarry:
    """Complete carry state - matches HierarchicalReasoningModel_ACTV1Carry"""
    inner_carry: HRMInnerCarry
    steps: mx.array
    halted: mx.array
    current_data: Dict[str, mx.array]


class HRMTransformerBlock(nn.Module):
    """HRM Transformer block - matches HierarchicalReasoningModel_ACTV1Block"""
    
    def __init__(self, d_model: int, n_heads: int, expansion: float = 2.0, rms_norm_eps: float = 1e-5):
        super().__init__()
        
        self.d_model = d_model
        self.n_heads = n_heads
        self.rms_norm_eps = rms_norm_eps
        
        # EXACT match to original attention
        self.self_attn = Attention(
            hidden_size=d_model,
            head_dim=d_model // n_heads,
            num_heads=n_heads,
            num_key_value_heads=n_heads,
            causal=False
        )
        
        # SwiGLU MLP as in official
        self.mlp = SwiGLU(d_model, expansion)
    
    def __call__(self, hidden_states: mx.array, cos_sin: Optional[Tuple[mx.array, mx.array]] = None, **kwargs) -> mx.array:
        # POST-NORM as in official (add then norm) - EXACT match to lines 80-82
        # Self Attention
        hidden_states = rms_norm(hidden_states + self.self_attn(cos_sin=cos_sin, hidden_states=hidden_states), variance_epsilon=self.rms_norm_eps)
        # Fully Connected
        hidden_states = rms_norm(hidden_states + self.mlp(hidden_states), variance_epsilon=self.rms_norm_eps)
        return hidden_states


class HRMReasoningModule(nn.Module):
    """Reasoning module - matches HierarchicalReasoningModel_ACTV1ReasoningModule"""
    
    def __init__(self, n_layers: int, d_model: int, n_heads: int, expansion: float = 2.0):
        super().__init__()
        # In MLX, we need to register layers as attributes for parameter tracking
        for i in range(n_layers):
            setattr(self, f'layer_{i}', HRMTransformerBlock(d_model, n_heads, expansion, rms_norm_eps=1e-5))
        self.n_layers = n_layers
    
    def __call__(self, hidden_states: mx.array, input_injection: mx.array, **kwargs) -> mx.array:
        # Input injection (add) - EXACT match to original line 94
        hidden_states = hidden_states + input_injection
        
        # Layers - EXACT match to original lines 96-97
        for i in range(self.n_layers):
            layer = getattr(self, f'layer_{i}')
            hidden_states = layer(hidden_states=hidden_states, **kwargs)
        
        return hidden_states


class HierarchicalReasoningModel_Inner(nn.Module):
    """Inner HRM model - matches HierarchicalReasoningModel_ACTV1_Inner"""
    
    def __init__(
        self,
        vocab_size: int = 11,
        d_model: int = 512,
        n_heads: int = 8,
        H_cycles: int = 2,
        L_cycles: int = 2,
        H_layers: int = 4,
        L_layers: int = 4,
        expansion: float = 2.0,
        rms_norm_eps: float = 1e-5,
        seq_len: int = 81,
        puzzle_emb_ndim: int = 0,
        num_puzzle_identifiers: int = 1,
        pos_encodings: str = "learned",
        rope_theta: float = 10000.0,
    ):
        super().__init__()
        
        self.vocab_size = vocab_size
        self.d_model = d_model
        self.H_cycles = H_cycles
        self.L_cycles = L_cycles
        self.seq_len = seq_len
        self.puzzle_emb_ndim = puzzle_emb_ndim
        self.pos_encodings = pos_encodings
        
        # I/O - EXACT match to original lines 109-114
        self.embed_scale = math.sqrt(self.d_model)
        embed_init_std = 1.0 / self.embed_scale
        
        self.embed_tokens = CastedEmbedding(self.vocab_size, self.d_model, init_std=embed_init_std, cast_to=mx.float32)
        self.lm_head = CastedLinear(self.d_model, self.vocab_size, bias=False)
        self.q_head = CastedLinear(self.d_model, 2, bias=True)
        
        # Puzzle embeddings - EXACT match to original lines 116-120
        self.puzzle_emb_len = -(self.puzzle_emb_ndim // -self.d_model)  # ceil div
        if self.puzzle_emb_ndim > 0:
            # Zero init puzzle embeddings
            self.puzzle_emb = CastedSparseEmbedding(num_puzzle_identifiers, self.puzzle_emb_ndim, 
                                                   batch_size=32, init_std=0.0)  # batch_size placeholder
        
        # Position encodings - EXACT match to original lines 123-130
        if self.pos_encodings == "rope":
            self.rotary_emb = RotaryEmbedding(
                dim=self.d_model // n_heads,
                max_position_embeddings=self.seq_len + self.puzzle_emb_len,
                base=rope_theta
            )
        elif self.pos_encodings == "learned":
            self.embed_pos = CastedEmbedding(self.seq_len + self.puzzle_emb_len, self.d_model, init_std=embed_init_std, cast_to=mx.float32)
        else:
            raise NotImplementedError()
        
        # Reasoning modules - EXACT match to original lines 133-134
        self.H_level = HRMReasoningModule(H_layers, d_model, n_heads, expansion)
        self.L_level = HRMReasoningModule(L_layers, d_model, n_heads, expansion)
        
        # Initial states - EXACT match to original lines 137-138
        self.H_init = trunc_normal_init_(shape=(d_model,), std=1.0)
        self.L_init = trunc_normal_init_(shape=(d_model,), std=1.0)
        
        # Q head special init - EXACT match to original lines 142-144
        self._init_q_head()
    
    def _init_q_head(self):
        """Initialize Q-head exactly as in official code"""
        # Init Q to (almost) zero for faster learning during bootstrapping
        self.q_head.weight = mx.zeros_like(self.q_head.weight)
        self.q_head.bias = mx.array([-5.0, -5.0])  # EXACT match to original line 144
    
    def _input_embeddings(self, input: mx.array, puzzle_identifiers: mx.array) -> mx.array:
        """Input embeddings - EXACT match to original lines 146-166"""
        # Token embedding - EXACT match to line 148
        embedding = self.embed_tokens(input.astype(mx.int32))
        
        # Puzzle embeddings - EXACT match to lines 151-158
        if self.puzzle_emb_ndim > 0:
            puzzle_embedding = self.puzzle_emb(puzzle_identifiers)
            
            # EXACT match to line 154
            pad_count = self.puzzle_emb_len * self.d_model - puzzle_embedding.shape[-1]
            if pad_count > 0:
                # EXACT match to line 156: F.pad(puzzle_embedding, (0, pad_count))
                puzzle_embedding = mx.pad(puzzle_embedding, [(0, 0), (0, 0), (0, pad_count)])
            
            # EXACT match to line 158
            puzzle_embedding_reshaped = puzzle_embedding.reshape(-1, self.puzzle_emb_len, self.d_model)
            embedding = mx.concatenate((puzzle_embedding_reshaped, embedding), axis=-2)
        
        # Position embeddings - EXACT match to lines 161-163
        if self.pos_encodings == "learned":
            # scale by 1/sqrt(2) to maintain forward variance
            embedding = 0.707106781 * (embedding + self.embed_pos.embedding_weight.astype(mx.float32))
        
        # Scale - EXACT match to line 166
        return self.embed_scale * embedding
    
    def empty_carry(self, batch_size: int) -> HRMInnerCarry:
        """Create empty inner carry - EXACT match to original lines 168-172"""
        return HRMInnerCarry(
            z_H=mx.zeros((batch_size, self.seq_len + self.puzzle_emb_len, self.d_model)),
            z_L=mx.zeros((batch_size, self.seq_len + self.puzzle_emb_len, self.d_model))
        )
    
    def reset_carry(self, reset_flag: mx.array, carry: HRMInnerCarry) -> HRMInnerCarry:
        """Reset carry - EXACT match to original lines 174-178"""
        return HRMInnerCarry(
            z_H=mx.where(reset_flag[..., None, None], self.H_init, carry.z_H),
            z_L=mx.where(reset_flag[..., None, None], self.L_init, carry.z_L)
        )
    
    def __call__(self, carry: HRMInnerCarry, batch: Dict[str, mx.array]) -> Tuple[HRMInnerCarry, mx.array, Tuple[mx.array, mx.array]]:
        """Forward pass - EXACTLY matching original lines 180-213"""
        
        # Sequence info for RoPE - EXACT match to original lines 181-183
        cos_sin = None
        if hasattr(self, "rotary_emb"):
            cos_sin = self.rotary_emb()
        
        # Input encoding - EXACT match to original line 186
        puzzle_identifiers = batch.get("puzzle_identifiers", mx.zeros((batch["inputs"].shape[0],), dtype=mx.int32))
        input_embeddings = self._input_embeddings(batch["inputs"], puzzle_identifiers)
        
        # Forward iterations - EXACT match to original lines 189-199
        # with torch.no_grad(): (simulated by stop_gradient)
        z_H, z_L = carry.z_H, carry.z_L
        
        for _H_step in range(self.H_cycles):
            for _L_step in range(self.L_cycles):
                if not ((_H_step == self.H_cycles - 1) and (_L_step == self.L_cycles - 1)):
                    z_L = mx.stop_gradient(self.L_level(z_L, z_H + input_embeddings, cos_sin=cos_sin))
            
            if not (_H_step == self.H_cycles - 1):
                z_H = mx.stop_gradient(self.H_level(z_H, z_L, cos_sin=cos_sin))
        
        # 1-step grad - EXACT match to original lines 203-204
        z_L = self.L_level(z_L, z_H + input_embeddings, cos_sin=cos_sin)
        z_H = self.H_level(z_H, z_L, cos_sin=cos_sin)
        
        # LM Outputs - EXACT match to original lines 207-208
        new_carry = HRMInnerCarry(z_H=mx.stop_gradient(z_H), z_L=mx.stop_gradient(z_L))
        output = self.lm_head(z_H)[:, self.puzzle_emb_len:]  # Remove puzzle embedding positions
        
        # Q head - EXACT match to original line 211
        q_logits = self.q_head(z_H[:, 0]).astype(mx.float32)
        
        return new_carry, output, (q_logits[..., 0], q_logits[..., 1])


class HierarchicalReasoningModel(nn.Module):
    """Complete HRM with ACT wrapper - matches HierarchicalReasoningModel_ACTV1"""
    
    def __init__(
        self,
        vocab_size: int = 11,
        d_model: int = 512,
        n_heads: int = 8,
        H_cycles: int = 2,
        L_cycles: int = 2,
        H_layers: int = 4,
        L_layers: int = 4,
        halt_max_steps: int = 16,
        halt_exploration_prob: float = 0.1,
        expansion: float = 2.0,
        seq_len: int = 81,
        puzzle_emb_ndim: int = 0,
        num_puzzle_identifiers: int = 1,
        pos_encodings: str = "learned",
        rope_theta: float = 10000.0,
    ):
        super().__init__()
        
        self.halt_max_steps = halt_max_steps
        self.halt_exploration_prob = halt_exploration_prob
        self._is_training = True  # Track training mode with internal variable
        
        self.inner = HierarchicalReasoningModel_Inner(
            vocab_size=vocab_size,
            d_model=d_model,
            n_heads=n_heads,
            H_cycles=H_cycles,
            L_cycles=L_cycles,
            H_layers=H_layers,
            L_layers=L_layers,
            expansion=expansion,
            seq_len=seq_len,
            puzzle_emb_ndim=puzzle_emb_ndim,
            num_puzzle_identifiers=num_puzzle_identifiers,
            pos_encodings=pos_encodings,
            rope_theta=rope_theta,
        )
    
    def train(self):
        """Set model to training mode"""
        self._is_training = True
        return self
    
    def eval(self):
        """Set model to evaluation mode"""
        self._is_training = False
        return self
    
    def initial_carry(self, batch: Dict[str, mx.array]) -> HRMCarry:
        """Initialize carry state - matches original lines 228-238"""
        batch_size = batch["inputs"].shape[0]
        
        return HRMCarry(
            inner_carry=self.inner.empty_carry(batch_size),  # EXACT match to line 232
            steps=mx.zeros((batch_size,), dtype=mx.int32),
            halted=mx.ones((batch_size,), dtype=mx.bool_),  # Default to halted - line 235
            current_data={k: mx.zeros_like(v) for k, v in batch.items()}
        )
    
    def __call__(self, carry: HRMCarry, batch: Dict[str, mx.array]) -> Tuple[HRMCarry, Dict[str, mx.array]]:
        """Forward pass with ACT - matches original lines 240-283"""
        
        # Update data, carry (removing halted sequences) - EXACTLY as in official
        new_inner_carry = self.inner.reset_carry(carry.halted, carry.inner_carry)
        new_steps = mx.where(carry.halted, 0, carry.steps)
        
        # Update current data for halted sequences - EXACT match to original line 246
        new_current_data = {}
        for k, v in carry.current_data.items():
            # EXACT match: carry.halted.view((-1, ) + (1, ) * (batch[k].ndim - 1))
            halted_shape = (-1,) + (1,) * (batch[k].ndim - 1)
            halted_expanded = carry.halted.reshape(halted_shape)
            new_current_data[k] = mx.where(halted_expanded, batch[k], v)
        
        # Forward inner model
        new_inner_carry, logits, (q_halt_logits, q_continue_logits) = self.inner(new_inner_carry, new_current_data)
        
        outputs = {
            "logits": logits,
            "q_halt_logits": q_halt_logits,
            "q_continue_logits": q_continue_logits
        }
        
        # Step and halting logic - EXACTLY as in original lines 257-282
        # Step - EXACT match to lines 258-260
        new_steps = new_steps + 1
        is_last_step = new_steps >= self.halt_max_steps
        
        halted = is_last_step
        
        # if training, and ACT is enabled - EXACT match to line 265
        if self._is_training and (self.halt_max_steps > 1):
            # Halt signal - EXACT match to line 268
            halted = halted | (q_halt_logits > q_continue_logits)
            
            # Exploration - EXACT match to line 271
            exploration_mask = mx.random.uniform(shape=q_halt_logits.shape) < self.halt_exploration_prob
            random_steps = mx.random.randint(2, self.halt_max_steps + 1, shape=new_steps.shape)
            min_halt_steps = exploration_mask.astype(mx.int32) * random_steps
            
            halted = halted & (new_steps >= min_halt_steps)
            
            # Compute target Q - EXACT match to lines 279-281
            next_q_halt_logits, next_q_continue_logits = self.inner(new_inner_carry, new_current_data)[-1]
            
            outputs["target_q_continue"] = mx.sigmoid(mx.where(is_last_step, next_q_halt_logits, mx.maximum(next_q_halt_logits, next_q_continue_logits)))
        
        return HRMCarry(new_inner_carry, new_steps, halted, new_current_data), outputs