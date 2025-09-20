import torch
import torch.nn.functional as F
import numpy as np
from typing import Dict, List, Tuple, Optional
import logging

logger = logging.getLogger(__name__)

class EntropyRegularizer:
    """
    Entropy Regularization Service for AI Systems
    Based on Generalized Entropy Regularization framework
    """
    
    def __init__(self, alpha: float = 0.5, beta: float = 0.7, use_uniform: bool = True):
        """
        Initialize entropy regularizer
        
        Args:
            alpha: Mixing parameter for distribution combination (0 < alpha < 1)
            beta: Weight of entropy penalty
            use_uniform: Whether to use uniform distribution as baseline
        """
        self.alpha = alpha
        self.beta = beta
        self.use_uniform = use_uniform
        
        # Validate parameters
        assert 0 < self.alpha < 1, "Alpha must be between 0 and 1"
        assert self.beta >= 0, "Beta must be non-negative"
        
        logger.info(f"EntropyRegularizer initialized: alpha={alpha}, beta={beta}, uniform={use_uniform}")
    
    def compute_entropy_penalty(self, logits: torch.Tensor, target: torch.Tensor, 
                               vocab_size: int, ignore_index: int = -100) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Compute entropy regularization penalty
        
        Args:
            logits: Model output logits [batch_size, seq_len, vocab_size]
            target: Target tokens [batch_size, seq_len]
            vocab_size: Vocabulary size
            ignore_index: Index to ignore in loss computation
            
        Returns:
            Tuple of (total_loss, entropy_penalty)
        """
        # Convert logits to probabilities
        probs = F.softmax(logits, dim=-1)
        log_probs = F.log_softmax(logits, dim=-1)
        
        # Standard cross-entropy loss
        ce_loss = F.cross_entropy(logits.view(-1, vocab_size), target.view(-1), 
                                 ignore_index=ignore_index, reduction='none')
        
        # Create baseline distribution
        if self.use_uniform:
            baseline_dist = torch.ones(vocab_size, device=logits.device) / vocab_size
        else:
            # Use unigram distribution (simplified)
            baseline_dist = torch.ones(vocab_size, device=logits.device) / vocab_size
        
        # Compute entropy penalty
        entropy_penalty = self._compute_jensen_divergence(probs, baseline_dist, target, ignore_index)
        
        # Combine losses
        total_loss = ce_loss + self.beta * entropy_penalty
        
        return total_loss, entropy_penalty
    
    def _compute_jensen_divergence(self, probs: torch.Tensor, baseline_dist: torch.Tensor, 
                                  target: torch.Tensor, ignore_index: int) -> torch.Tensor:
        """
        Compute Jensen divergence for entropy regularization
        """
        batch_size, seq_len, vocab_size = probs.shape
        
        # Reshape for computation
        probs_flat = probs.view(-1, vocab_size)
        
        # Create mixed distribution
        baseline_expanded = baseline_dist.unsqueeze(0).expand(probs_flat.shape[0], -1)
        mixed_dist = self.alpha * probs_flat + (1 - self.alpha) * baseline_expanded
        
        # Compute KL divergence components
        kl_probs = torch.sum(probs_flat * torch.log(probs_flat + 1e-8), dim=-1)
        kl_mixed = torch.sum(mixed_dist * torch.log(mixed_dist + 1e-8), dim=-1)
        
        # Jensen divergence
        divergence = (1 / (self.alpha * (1 - self.alpha))) * (kl_mixed - self.alpha * kl_probs)
        
        # Reshape back
        divergence = divergence.view(batch_size, seq_len)
        
        # Apply ignore mask
        if ignore_index != -100:
            mask = target != ignore_index
            divergence = divergence * mask.float()
        
        return divergence
    
    def compute_confidence_score(self, logits: torch.Tensor) -> torch.Tensor:
        """
        Compute confidence score based on entropy
        
        Args:
            logits: Model output logits
            
        Returns:
            Confidence scores (higher = more confident)
        """
        probs = F.softmax(logits, dim=-1)
        entropy = -torch.sum(probs * torch.log(probs + 1e-8), dim=-1)
        
        # Convert entropy to confidence (lower entropy = higher confidence)
        max_entropy = torch.log(torch.tensor(logits.shape[-1], dtype=torch.float))
        confidence = 1.0 - (entropy / max_entropy)
        
        return confidence
    
    def regularize_response(self, response: str, confidence_threshold: float = 0.7) -> Dict[str, any]:
        """
        Apply entropy regularization to text response
        
        Args:
            response: Text response to analyze
            confidence_threshold: Minimum confidence threshold
            
        Returns:
            Dictionary with regularized response and metadata
        """
        # Simple tokenization for demonstration
        tokens = response.split()
        vocab_size = len(set(tokens))
        
        # Create dummy logits (in real implementation, this would come from model)
        logits = torch.randn(len(tokens), vocab_size)
        
        # Compute confidence
        confidence = self.compute_confidence_score(logits)
        avg_confidence = torch.mean(confidence).item()
        
        # Apply regularization based on confidence
        if avg_confidence < confidence_threshold:
            # Low confidence - add uncertainty indicators
            regularized_response = f"[UNCERTAIN] {response}"
            metadata = {
                "confidence": avg_confidence,
                "regularized": True,
                "reason": "low_confidence"
            }
        else:
            # High confidence - response is reliable
            regularized_response = response
            metadata = {
                "confidence": avg_confidence,
                "regularized": False,
                "reason": "high_confidence"
            }
        
        return {
            "response": regularized_response,
            "metadata": metadata
        }

