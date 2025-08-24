"""
Common utilities for HRM implementation
Exact match to original HRM/models/common.py
"""

import math
import mlx.core as mx


def trunc_normal_init_(shape, std=1.0, lower=-2.0, upper=2.0):
    """
    Truncated normal initialization - EXACT match to original common.py:7-30
    
    NOTE: PyTorch nn.init.trunc_normal_ is not mathematically correct, 
    the std dev is not actually the std dev of initialized tensor.
    This function is a PyTorch version of jax truncated normal init 
    (default init method in flax).
    """
    if std == 0:
        return mx.zeros(shape)
    else:
        sqrt2 = math.sqrt(2)
        a = math.erf(lower / sqrt2)
        b = math.erf(upper / sqrt2)
        z = (b - a) / 2
        
        c = (2 * math.pi) ** -0.5
        pdf_u = c * math.exp(-0.5 * lower ** 2)
        pdf_l = c * math.exp(-0.5 * upper ** 2)
        comp_std = std / math.sqrt(1 - (upper * pdf_u - lower * pdf_l) / z - ((pdf_u - pdf_l) / z) ** 2)
        
        # EXACT match to original lines 27-30
        # tensor.uniform_(a, b)
        tensor = mx.random.uniform(low=a, high=b, shape=shape)
        # tensor.erfinv_()
        tensor = mx.erfinv(tensor)
        # tensor.mul_(sqrt2 * comp_std)
        tensor = tensor * (sqrt2 * comp_std)
        # tensor.clip_(lower * comp_std, upper * comp_std)
        tensor = mx.clip(tensor, lower * comp_std, upper * comp_std)
        
        return tensor


def _find_multiple(a: int, b: int) -> int:
    """Find multiple - EXACT match to original layers.py line 19-20"""
    return (-(a // -b)) * b