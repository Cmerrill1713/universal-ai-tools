"""
HRM Layer implementations in MLX
Exact match to original HRM/models/layers.py
"""

from typing import Tuple, Optional
import math
import mlx.core as mx
import mlx.nn as nn

from .common import trunc_normal_init_, _find_multiple


def rms_norm(hidden_states: mx.array, variance_epsilon: float) -> mx.array:
    """RMS normalization - EXACT match to original layers.py lines 152-158"""
    input_dtype = hidden_states.dtype
    hidden_states = hidden_states.astype(mx.float32)
    
    # EXACT match to line 156
    variance = mx.mean(hidden_states ** 2, axis=-1, keepdims=True)
    # EXACT match to line 157 (rsqrt = 1/sqrt)
    hidden_states = hidden_states * (1.0 / mx.sqrt(variance + variance_epsilon))
    return hidden_states.astype(input_dtype)


def rotate_half(x: mx.array) -> mx.array:
    """Rotates half the hidden dims of the input."""
    x1 = x[..., : x.shape[-1] // 2]
    x2 = x[..., x.shape[-1] // 2 :]
    return mx.concatenate((-x2, x1), axis=-1)


def apply_rotary_pos_emb(q: mx.array, k: mx.array, cos: mx.array, sin: mx.array) -> Tuple[mx.array, mx.array]:
    """Apply rotary position embeddings - EXACT match to original layers.py lines 30-40"""
    # q, k: [bs, seq_len, num_heads, head_dim]
    # cos, sin: [seq_len, head_dim]
    orig_dtype = q.dtype
    q = q.astype(cos.dtype)
    k = k.astype(cos.dtype)
    
    # EXACT match to lines 37-38 
    q_embed = (q * cos[None, :, None, :]) + (rotate_half(q) * sin[None, :, None, :])
    k_embed = (k * cos[None, :, None, :]) + (rotate_half(k) * sin[None, :, None, :])
    
    return q_embed.astype(orig_dtype), k_embed.astype(orig_dtype)


class CastedLinear(nn.Module):
    """Linear layer with dtype casting - EXACT match to original"""
    
    def __init__(self, in_features: int, out_features: int, bias: bool = True):
        super().__init__()
        
        # Truncated LeCun normal init - EXACT match to original lines 50-51
        std = 1.0 / (in_features ** 0.5)
        self.weight = trunc_normal_init_(shape=(out_features, in_features), std=std)
        
        self.bias = None
        if bias:
            # Zero init bias - EXACT match to original line 56
            self.bias = mx.zeros((out_features,))
    
    def __call__(self, x: mx.array) -> mx.array:
        # EXACT match to original line 59: F.linear(input, self.weight.to(input.dtype), bias=...)
        weight = self.weight.astype(x.dtype)
        output = x @ weight.T
        if self.bias is not None:
            bias = self.bias.astype(x.dtype)
            output = output + bias
        return output


class CastedEmbedding(nn.Module):
    """Embedding layer with dtype casting - EXACT match to original"""
    
    def __init__(self, num_embeddings: int, embedding_dim: int, init_std: float, cast_to: mx.Dtype = mx.float32):
        super().__init__()
        self.cast_to = cast_to
        
        # Truncated LeCun normal init - EXACT match to original lines 72-74
        self.embedding_weight = trunc_normal_init_(shape=(num_embeddings, embedding_dim), std=init_std)
    
    def __call__(self, input: mx.array) -> mx.array:
        # EXACT match to original line 77: F.embedding(input, self.embedding_weight.to(self.cast_to))
        return self.embedding_weight[input].astype(self.cast_to)


class RotaryEmbedding(nn.Module):
    """Rotary Position Embedding - EXACT match to original"""
    
    def __init__(self, dim: int, max_position_embeddings: int, base: float = 10000.0):
        super().__init__()
        
        # RoPE - EXACT match to original lines 85-92
        inv_freq = 1.0 / (base ** (mx.arange(0, dim, 2, dtype=mx.float32) / dim))
        t = mx.arange(max_position_embeddings, dtype=mx.float32)
        freqs = mx.outer(t, inv_freq)
        
        # Different from paper, but it uses a different permutation in order to obtain the same calculation
        emb = mx.concatenate((freqs, freqs), axis=-1)
        # Store as frozen parameters (equivalent to nn.Buffer with persistent=False)
        self.cos_cached = mx.stop_gradient(emb.cos())
        self.sin_cached = mx.stop_gradient(emb.sin())
    
    def __call__(self) -> Tuple[mx.array, mx.array]:
        return self.cos_cached, self.sin_cached


class Attention(nn.Module):
    """Attention module - adapted for MLX (no FlashAttention)"""
    
    def __init__(self, hidden_size: int, head_dim: int, num_heads: int, num_key_value_heads: int, causal: bool = False):
        super().__init__()
        
        self.hidden_size = hidden_size
        self.head_dim = head_dim
        self.output_size = head_dim * num_heads
        self.num_heads = num_heads
        self.num_key_value_heads = num_key_value_heads
        self.causal = causal
        
        # EXACT match to original lines 109-110
        self.qkv_proj = CastedLinear(self.hidden_size, (self.num_heads + 2 * self.num_key_value_heads) * self.head_dim, bias=False)
        self.o_proj = CastedLinear(self.output_size, self.hidden_size, bias=False)
    
    def __call__(self, cos_sin: Optional[Tuple[mx.array, mx.array]], hidden_states: mx.array) -> mx.array:
        batch_size, seq_len, _ = hidden_states.shape
        
        # EXACT match to original lines 116-122
        qkv = self.qkv_proj(hidden_states)
        
        # Split head - EXACT match to line 119
        qkv = qkv.reshape(batch_size, seq_len, self.num_heads + 2 * self.num_key_value_heads, self.head_dim)
        query = qkv[:, :, :self.num_heads]
        key = qkv[:, :, self.num_heads: self.num_heads + self.num_key_value_heads]
        value = qkv[:, :, self.num_heads + self.num_key_value_heads:]
        
        # RoPE - EXACT match to original lines 125-127
        if cos_sin is not None:
            cos, sin = cos_sin
            query, key = apply_rotary_pos_emb(query, key, cos, sin)
        
        # MLX attention implementation (flash attn not available)
        # Reshape for attention: [batch, seq, heads, head_dim] -> [batch, heads, seq, head_dim]
        query = query.transpose(0, 2, 1, 3)
        key = key.transpose(0, 2, 1, 3)
        value = value.transpose(0, 2, 1, 3)
        
        scale = 1.0 / math.sqrt(self.head_dim)
        scores = (query @ key.transpose(0, 1, 3, 2)) * scale
        
        if self.causal:
            mask = mx.triu(mx.ones((seq_len, seq_len)), k=1) * -1e9
            scores = scores + mask
        
        attn_weights = mx.softmax(scores, axis=-1)
        attn_output = attn_weights @ value
        
        # EXACT match to original line 135: attn_output.view(batch_size, seq_len, self.output_size)
        attn_output = attn_output.transpose(0, 2, 1, 3).reshape(batch_size, seq_len, self.output_size)
        return self.o_proj(attn_output)


class SwiGLU(nn.Module):
    """SwiGLU activation - EXACT match to original lines 139-149"""
    
    def __init__(self, hidden_size: int, expansion: float):
        super().__init__()
        # EXACT match to line 142
        inter = _find_multiple(round(expansion * hidden_size * 2 / 3), 256)
        
        # EXACT match to lines 144-145
        self.gate_up_proj = CastedLinear(hidden_size, inter * 2, bias=False)
        self.down_proj = CastedLinear(inter, hidden_size, bias=False)
    
    def __call__(self, x: mx.array) -> mx.array:
        # EXACT match to lines 148-149
        gate, up = mx.split(self.gate_up_proj(x), 2, axis=-1)
        return self.down_proj(nn.silu(gate) * up)