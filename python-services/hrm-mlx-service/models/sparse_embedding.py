"""
Sparse embedding implementation for MLX
Simplified version of original sparse_embedding.py
"""

import mlx.core as mx
import mlx.nn as nn


class CastedSparseEmbedding(nn.Module):
    """
    Sparse embedding for puzzle identifiers - simplified version
    In the original, this uses a specialized optimizer, but for MLX
    we use a simplified version that still maintains zero initialization
    """
    
    def __init__(self, num_embeddings: int, embedding_dim: int, batch_size: int, init_std: float = 0.0):
        super().__init__()
        self.embedding_dim = embedding_dim
        
        # Zero init as in original line 120
        self.embedding_weight = mx.zeros((num_embeddings, embedding_dim))
    
    def __call__(self, input: mx.array) -> mx.array:
        return self.embedding_weight[input]