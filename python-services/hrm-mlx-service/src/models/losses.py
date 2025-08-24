"""
Loss functions for HRM
Exact match to original HRM/models/losses.py
"""

from typing import Dict, Tuple
import mlx.core as mx


IGNORE_LABEL_ID = -100


def s(x, epsilon=1e-30):
    """Stablemax s function - EXACT match to original"""
    return mx.where(
        x < 0,
        1 / (1 - x + epsilon),
        x + 1
    )


def log_stablemax(x, dim=-1):
    """Log stablemax - EXACT match to original"""
    s_x = s(x)
    return mx.log(s_x / mx.sum(s_x, axis=dim, keepdims=True))


def stablemax_cross_entropy(logits: mx.array, labels: mx.array, ignore_index: int = -100) -> mx.array:
    """Stablemax cross entropy - adapted for MLX"""
    # Use float32 (MLX limitation) but with original epsilon for numerical stability
    logits_f32 = logits.astype(mx.float32)
    
    # Stablemax function
    log_probs = log_stablemax(logits_f32, dim=-1)
    
    # Create valid mask
    valid_mask = labels != ignore_index
    transformed_labels = mx.where(valid_mask, labels, 0)
    
    # Gather log probabilities for target labels
    batch_size, seq_len = labels.shape
    batch_indices = mx.arange(batch_size)[:, None]
    seq_indices = mx.arange(seq_len)[None, :]
    target_log_probs = log_probs[batch_indices, seq_indices, transformed_labels]
    
    # Return negative log probs, masked
    return mx.where(valid_mask, -target_log_probs, 0.0)


def binary_cross_entropy_with_logits(logits: mx.array, targets: mx.array, reduction: str = "sum") -> mx.array:
    """Binary cross entropy with logits - numerically stable implementation"""
    # Numerically stable implementation
    max_val = mx.maximum(-logits, 0)
    loss = logits - logits * targets + max_val + mx.log(mx.exp(-max_val) + mx.exp(-logits - max_val))
    
    if reduction == "sum":
        return loss.sum()
    elif reduction == "mean":
        return loss.mean()
    else:
        return loss


def compute_act_loss(outputs: Dict[str, mx.array], labels: mx.array) -> Tuple[mx.array, Dict[str, mx.array]]:
    """
    Compute loss for ACT model - matches original ACTLossHead logic
    """
    # Correctness computation
    mask = labels != IGNORE_LABEL_ID
    loss_counts = mask.sum(axis=-1)
    loss_divisor = mx.maximum(loss_counts, 1)[..., None]  # Avoid NaNs in division
    
    is_correct = mask & (mx.argmax(outputs["logits"], axis=-1) == labels)
    seq_is_correct = is_correct.sum(axis=-1) == loss_counts
    
    # Losses
    lm_loss = (stablemax_cross_entropy(outputs["logits"], labels, ignore_index=IGNORE_LABEL_ID) / loss_divisor.astype(mx.float32)).sum()
    q_halt_loss = binary_cross_entropy_with_logits(outputs["q_halt_logits"], seq_is_correct.astype(outputs["q_halt_logits"].dtype), reduction="sum")
    
    # Q continue (bootstrapping target loss)
    q_continue_loss = mx.array(0.0)
    if "target_q_continue" in outputs:
        q_continue_loss = binary_cross_entropy_with_logits(outputs["q_continue_logits"], outputs["target_q_continue"], reduction="sum")
    
    # Total loss - EXACT match to original line 101
    total_loss = lm_loss + 0.5 * (q_halt_loss + q_continue_loss)
    
    # Metrics
    metrics = {
        "lm_loss": lm_loss,
        "q_halt_loss": q_halt_loss,
        "q_continue_loss": q_continue_loss,
        "accuracy": (is_correct.astype(mx.float32) / loss_divisor.astype(mx.float32)).sum() / loss_divisor.sum(),
        "exact_accuracy": seq_is_correct.astype(mx.float32).mean(),
    }
    
    return total_loss, metrics