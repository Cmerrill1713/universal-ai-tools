
import torch
import torch.nn.functional as F
import json
import sys
import time
import traceback
from typing import Optional, Tuple
import numpy as np

# Try to import flash_attn
try:
    from flash_attn import flash_attn_func
    FLASH_ATTN_AVAILABLE = True
except ImportError:
    FLASH_ATTN_AVAILABLE = False
    print("Warning: flash_attn not available, using standard attention", file=sys.stderr)

class FlashAttentionOptimizer:
    def __init__(self, config):
        self.config = config
        self.device = torch.device(f"cuda:{config.get('deviceIds', [0])[0]}" if config.get('enableGPU') and torch.cuda.is_available() else "cpu")
        self.dtype = torch.float16 if config.get('enableGPU') and torch.cuda.is_available() else torch.float32
        
    def optimize_attention(self, query, key, value, attention_mask=None):
        """
        Optimized attention computation using FlashAttention or optimized standard attention
        """
        start_time = time.time()
        
        try:
            if FLASH_ATTN_AVAILABLE and self.config.get('enableGPU') and query.device.type == 'cuda':
                # Use FlashAttention
                output = self._flash_attention(query, key, value, attention_mask)
                optimization_used = "flash_attention"
            else:
                # Use optimized standard attention
                output = self._optimized_standard_attention(query, key, value, attention_mask)
                optimization_used = "optimized_standard"
                
            execution_time = (time.time() - start_time) * 1000
            
            return {
                "output": output.cpu().numpy().tolist(),
                "execution_time_ms": execution_time,
                "optimization_used": optimization_used,
                "memory_usage_mb": self._get_memory_usage(),
                "device": str(self.device)
            }
            
        except Exception as e:
            return {
                "error": str(e),
                "traceback": traceback.format_exc()
            }
    
    def _flash_attention(self, query, key, value, attention_mask=None):
        """
        Use FlashAttention for memory-efficient computation
        """
        # Reshape for FlashAttention format: (batch, seqlen, nheads, headdim)
        batch_size, num_heads, seq_len, head_dim = query.shape
        
        q = query.transpose(1, 2).contiguous()  # (batch, seqlen, nheads, headdim)
        k = key.transpose(1, 2).contiguous()
        v = value.transpose(1, 2).contiguous()
        
        # FlashAttention
        output = flash_attn_func(q, k, v, dropout_p=0.0, softmax_scale=None, causal=False)
        
        # Reshape back: (batch, nheads, seqlen, headdim)
        output = output.transpose(1, 2).contiguous()
        
        return output
    
    def _optimized_standard_attention(self, query, key, value, attention_mask=None):
        """
        Memory-optimized standard attention with chunking
        """
        batch_size, num_heads, seq_len, head_dim = query.shape
        scale = head_dim ** -0.5
        
        # Use chunking for large sequences
        chunk_size = min(self.config.get('blockSize', 64), seq_len)
        
        if seq_len <= chunk_size:
            # Standard attention for small sequences
            scores = torch.matmul(query, key.transpose(-2, -1)) * scale
            
            if attention_mask is not None:
                scores = scores.masked_fill(attention_mask == 0, float('-inf'))
            
            attn_weights = F.softmax(scores, dim=-1)
            output = torch.matmul(attn_weights, value)
        else:
            # Chunked attention for large sequences
            output = torch.zeros_like(query)
            
            for i in range(0, seq_len, chunk_size):
                end_i = min(i + chunk_size, seq_len)
                
                q_chunk = query[:, :, i:end_i, :]
                scores_chunk = torch.matmul(q_chunk, key.transpose(-2, -1)) * scale
                
                if attention_mask is not None:
                    mask_chunk = attention_mask[:, :, i:end_i, :]
                    scores_chunk = scores_chunk.masked_fill(mask_chunk == 0, float('-inf'))
                
                attn_weights_chunk = F.softmax(scores_chunk, dim=-1)
                output_chunk = torch.matmul(attn_weights_chunk, value)
                output[:, :, i:end_i, :] = output_chunk
        
        return output
    
    def _get_memory_usage(self):
        """Get current memory usage in MB"""
        if torch.cuda.is_available() and self.device.type == 'cuda':
            return torch.cuda.memory_allocated(self.device) / 1024 / 1024
        else:
            # Approximate CPU memory usage
            return 0

def process_request():
    """Process a single attention computation request"""
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        
        config = input_data.get('config', {})
        optimizer = FlashAttentionOptimizer(config)
        
        # Parse tensors
        query_data = input_data['query']
        key_data = input_data['key'] 
        value_data = input_data['value']
        
        # Convert to tensors
        query = torch.tensor(query_data, dtype=optimizer.dtype, device=optimizer.device)
        key = torch.tensor(key_data, dtype=optimizer.dtype, device=optimizer.device)
        value = torch.tensor(value_data, dtype=optimizer.dtype, device=optimizer.device)
        
        attention_mask = None
        if 'attention_mask' in input_data:
            attention_mask = torch.tensor(input_data['attention_mask'], device=optimizer.device)
        
        # Process
        result = optimizer.optimize_attention(query, key, value, attention_mask)
        
        # Output result
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            "error": str(e),
            "traceback": traceback.format_exc()
        }
        print(json.dumps(error_result))

if __name__ == "__main__":
    process_request()
