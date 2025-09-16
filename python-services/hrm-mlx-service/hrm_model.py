#!/usr/bin/env python3
"""
HRM MLX Model Implementation
Hierarchical Reasoning Model with Adaptive Computation Time (ACT)
Real MLX model loading and inference for competitive advantage
"""

import json
import logging
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import mlx
import mlx.core as mx
import mlx.nn as nn
import mlx.optimizers as optim
import numpy as np
from transformers import AutoTokenizer

logger = logging.getLogger(__name__)


@dataclass
class HRMConfig:
    """Configuration for HRM model"""
    vocab_size: int = 32000
    hidden_size: int = 1024
    intermediate_size: int = 2816
    n_layers: int = 16
    n_heads: int = 16
    head_dim: int = 64
    max_position_embeddings: int = 8192
    rms_norm_eps: float = 1e-5
    rope_theta: float = 10000.0
    # HRM specific
    h_layers: int = 8  # High-level reasoning layers
    l_layers: int = 8  # Low-level pattern layers
    max_act_steps: int = 16  # Maximum adaptive computation steps
    halt_threshold: float = 0.01
    min_confidence: float = 0.85
    use_flash_attention: bool = True


class AdaptiveComputationUnit(nn.Module):
    """ACT unit for dynamic reasoning depth"""

    def __init__(self, hidden_size: int):
        super().__init__()
        self.hidden_size = hidden_size

        # Halt probability predictor
        self.halt_fc = nn.Sequential(
            nn.Linear(hidden_size, hidden_size // 2),
            nn.ReLU(),
            nn.Linear(hidden_size // 2, 1),
            nn.Sigmoid()
        )

        # Confidence predictor
        self.confidence_fc = nn.Sequential(
            nn.Linear(hidden_size, hidden_size // 2),
            nn.ReLU(),
            nn.Linear(hidden_size // 2, 1),
            nn.Sigmoid()
        )

    def __call__(self, hidden_state: mx.array) -> Tuple[mx.array, mx.array]:
        """
        Compute halt probability and confidence
        Returns: (halt_prob, confidence)
        """
        halt_prob = self.halt_fc(hidden_state)
        confidence = self.confidence_fc(hidden_state)
        return halt_prob.squeeze(-1), confidence.squeeze(-1)


class HierarchicalReasoningLayer(nn.Module):
    """Single layer of hierarchical reasoning"""

    def __init__(self, config: HRMConfig, layer_type: str = 'h'):
        super().__init__()
        self.layer_type = layer_type  # 'h' for high-level, 'l' for low-level
        self.hidden_size = config.hidden_size

        # Multi-head attention
        self.self_attn = nn.MultiHeadAttention(
            dims=config.hidden_size,
            num_heads=config.n_heads,
            bias=False
        )

        # Feed-forward network
        self.ffn = nn.Sequential(
            nn.Linear(
                config.hidden_size,
                config.intermediate_size,
                bias=False),
            nn.GELU(),
            nn.Linear(
                config.intermediate_size,
                config.hidden_size,
                bias=False))

        # Layer norms
        self.ln1 = nn.RMSNorm(config.hidden_size, eps=config.rms_norm_eps)
        self.ln2 = nn.RMSNorm(config.hidden_size, eps=config.rms_norm_eps)

        # Cross-attention for H-L interaction
        if layer_type == 'h':
            self.cross_attn = nn.MultiHeadAttention(
                dims=config.hidden_size,
                num_heads=config.n_heads,
                bias=False
            )
            self.ln_cross = nn.RMSNorm(
                config.hidden_size, eps=config.rms_norm_eps)

    def __call__(
        self,
        x: mx.array,
        mask: Optional[mx.array] = None,
        l_state: Optional[mx.array] = None
    ) -> mx.array:
        """Forward pass with optional L-level state for H-level layers"""

        # Self-attention
        residual = x
        x = self.ln1(x)
        x = self.self_attn(x, x, x, mask=mask)
        x = residual + x

        # Cross-attention for H-level layers
        if self.layer_type == 'h' and l_state is not None:
            residual = x
            x = self.ln_cross(x)
            x = self.cross_attn(x, l_state, l_state, mask=mask)
            x = residual + x

        # Feed-forward
        residual = x
        x = self.ln2(x)
        x = self.ffn(x)
        x = residual + x

        return x


class HRMModel(nn.Module):
    """Hierarchical Reasoning Model with Adaptive Computation Time"""

    def __init__(self, config: HRMConfig):
        super().__init__()
        self.config = config

        # Token embeddings
        self.token_embedding = nn.Embedding(
            config.vocab_size, config.hidden_size)

        # Position embeddings with RoPE
        self.position_embedding = nn.Embedding(
            config.max_position_embeddings,
            config.hidden_size
        )

        # L-level layers (low-level pattern recognition)
        self.l_layers = [
            HierarchicalReasoningLayer(config, layer_type='l')
            for _ in range(config.l_layers)
        ]

        # H-level layers (high-level strategic reasoning)
        self.h_layers = [
            HierarchicalReasoningLayer(config, layer_type='h')
            for _ in range(config.h_layers)
        ]

        # ACT units for each reasoning step
        self.act_units = [
            AdaptiveComputationUnit(config.hidden_size)
            for _ in range(config.max_act_steps)
        ]

        # Output projection
        self.lm_head = nn.Linear(
            config.hidden_size,
            config.vocab_size,
            bias=False)

        # Final layer norm
        self.ln_f = nn.RMSNorm(config.hidden_size, eps=config.rms_norm_eps)

    def embed_tokens(self, input_ids: mx.array) -> mx.array:
        """Embed input tokens with position encoding"""
        seq_len = input_ids.shape[1]

        # Token embeddings
        token_embeds = self.token_embedding(input_ids)

        # Position embeddings
        position_ids = mx.arange(seq_len)
        position_embeds = self.position_embedding(position_ids)

        return token_embeds + position_embeds[None, :, :]

    def l_level_processing(
        self,
        hidden_states: mx.array,
        attention_mask: Optional[mx.array] = None
    ) -> mx.array:
        """Low-level pattern recognition and immediate analysis"""
        for layer in self.l_layers:
            hidden_states = layer(hidden_states, mask=attention_mask)
        return hidden_states

    def h_level_processing(
        self,
        hidden_states: mx.array,
        l_states: mx.array,
        attention_mask: Optional[mx.array] = None
    ) -> mx.array:
        """High-level strategic reasoning with L-level integration"""
        for layer in self.h_layers:
            hidden_states = layer(
                hidden_states,
                mask=attention_mask,
                l_state=l_states
            )
        return hidden_states

    def adaptive_reasoning(
        self,
        input_embeds: mx.array,
        attention_mask: Optional[mx.array] = None,
        max_steps: Optional[int] = None,
        min_confidence: float = 0.85
    ) -> Dict[str, Any]:
        """
        Perform adaptive computation with dynamic reasoning depth
        Returns dict with output, steps used, confidence, and reasoning chain
        """
        if max_steps is None:
            max_steps = self.config.max_act_steps

        batch_size, seq_len = input_embeds.shape[:2]
        hidden_states = input_embeds

        reasoning_chain = []
        cumulative_halt_prob = mx.zeros(batch_size)
        step_outputs = []

        for step in range(max_steps):
            # L-level processing (pattern recognition)
            l_states = self.l_level_processing(hidden_states, attention_mask)

            # H-level processing (strategic reasoning)
            h_states = self.h_level_processing(
                hidden_states, l_states, attention_mask)

            # Merge L and H level insights
            hidden_states = 0.5 * l_states + 0.5 * h_states

            # ACT decision
            halt_prob, confidence = self.act_units[step](
                hidden_states.mean(axis=1))

            reasoning_chain.append({
                'step': step + 1,
                'confidence': float(confidence.mean().item()),
                'halt_probability': float(halt_prob.mean().item()),
                'l_level_norm': float(mx.linalg.norm(l_states).item()),
                'h_level_norm': float(mx.linalg.norm(h_states).item())
            })

            # Store output for this step
            step_output = self.ln_f(hidden_states)
            step_outputs.append(step_output)

            # Update cumulative halt probability
            cumulative_halt_prob = cumulative_halt_prob + \
                (1 - cumulative_halt_prob) * halt_prob

            # Check if we should halt (adaptive computation)
            mean_confidence = confidence.mean().item()
            mean_halt = cumulative_halt_prob.mean().item()

            if mean_confidence >= min_confidence and mean_halt >= self.config.halt_threshold:
                logger.info(
                    f"ACT halted at step {step + 1}, confidence: {mean_confidence:.3f}")
                break

        # Weighted average of step outputs based on confidence
        if step_outputs:
            weights = mx.array([s['confidence'] for s in reasoning_chain])
            weights = weights / weights.sum()

            final_hidden = mx.zeros_like(step_outputs[0])
            for i, output in enumerate(step_outputs):
                final_hidden = final_hidden + weights[i] * output
        else:
            final_hidden = hidden_states

        return {
            'hidden_states': final_hidden,
            'steps_used': len(reasoning_chain),
            'final_confidence': reasoning_chain[-1]['confidence'] if reasoning_chain else 0.0,
            'reasoning_chain': reasoning_chain,
            'efficiency': (len(reasoning_chain) / max_steps) * 100
        }

    def __call__(
        self,
        input_ids: mx.array,
        attention_mask: Optional[mx.array] = None,
        use_act: bool = True,
        max_steps: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Forward pass with optional adaptive computation
        """
        # Embed inputs
        hidden_states = self.embed_tokens(input_ids)

        if use_act:
            # Adaptive computation time
            result = self.adaptive_reasoning(
                hidden_states,
                attention_mask,
                max_steps=max_steps,
                min_confidence=self.config.min_confidence
            )
            hidden_states = result['hidden_states']
        else:
            # Standard forward pass without ACT
            l_states = self.l_level_processing(hidden_states, attention_mask)
            h_states = self.h_level_processing(
                hidden_states, l_states, attention_mask)
            hidden_states = 0.5 * l_states + 0.5 * h_states
            hidden_states = self.ln_f(hidden_states)

            result = {
                'hidden_states': hidden_states,
                'steps_used': self.config.h_layers,
                'final_confidence': 1.0,
                'reasoning_chain': [],
                'efficiency': 100.0
            }

        # Project to vocabulary
        logits = self.lm_head(hidden_states)
        result['logits'] = logits

        return result


class HRMInference:
    """High-level inference wrapper for HRM model"""

    def __init__(
            self,
            model_path: Optional[str] = None,
            tokenizer_path: Optional[str] = None):
        self.config = HRMConfig()
        self.model = HRMModel(self.config)
        self.tokenizer = None

        # Load tokenizer if path provided
        if tokenizer_path:
            self._load_tokenizer(tokenizer_path)
        else:
            # Try to load from default location
            default_tokenizer_path = "/Users/christianmerrill/Desktop/universal-ai-tools/models/tokenizer_cache/microsoft_DialoGPT-small"
            if Path(default_tokenizer_path).exists():
                self._load_tokenizer(default_tokenizer_path)
            else:
                # Fallback to any available tokenizer
                tokenizer_cache = Path(
                    "/Users/christianmerrill/Desktop/universal-ai-tools/models/tokenizer_cache")
                if tokenizer_cache.exists():
                    for item in tokenizer_cache.iterdir():
                        if item.is_dir():
                            self._load_tokenizer(str(item))
                            break

        if model_path:
            self.load_model(model_path)
        else:
            self._initialize_random_weights()

    def _load_tokenizer(self, tokenizer_path: str):
        """Load tokenizer from specified path"""
        try:
            logger.info(f"Loading tokenizer from {tokenizer_path}")
            self.tokenizer = AutoTokenizer.from_pretrained(tokenizer_path)
            # Set padding token if not already set
            if self.tokenizer.pad_token is None:
                self.tokenizer.pad_token = self.tokenizer.eos_token
            logger.info(
                f"Tokenizer loaded successfully, vocab size: {self.tokenizer.vocab_size}")
            # Update model config vocab size to match tokenizer
            self.config.vocab_size = self.tokenizer.vocab_size
        except Exception as e:
            logger.warning(
                f"Failed to load tokenizer from {tokenizer_path}: {e}")
            logger.info("Will use simplified tokenization as fallback")

    def _initialize_random_weights(self):
        """Initialize model with random weights for testing"""
        logger.info(
            "Initializing HRM with random weights (no pretrained model loaded)")
        # MLX handles weight initialization automatically
        mx.eval(self.model.parameters())

    def load_model(self, model_path: str):
        """Load pretrained HRM model weights"""
        path = Path(model_path)
        if path.exists():
            logger.info(f"Loading HRM model from {model_path}")
            weights = mx.load(str(path / "model.safetensors"))
            self.model.load_weights(weights)

            # Load config if available
            config_path = path / "config.json"
            if config_path.exists():
                with open(config_path, 'r') as f:
                    config_dict = json.load(f)
                    # Update config with loaded values
                    for key, value in config_dict.items():
                        if hasattr(self.config, key):
                            setattr(self.config, key, value)
        else:
            logger.warning(
                f"Model path {model_path} not found, using random initialization")
            self._initialize_random_weights()

    def generate(
        self,
        prompt: str,
        max_length: int = 512,
        temperature: float = 0.7,
        top_p: float = 0.9,
        use_act: bool = True,
        max_act_steps: Optional[int] = None,
        task_complexity: str = 'auto'
    ) -> Dict[str, Any]:
        """
        Generate text with HRM using adaptive computation
        """
        start_time = time.time()

        # Determine ACT parameters based on complexity
        if task_complexity != 'auto':
            complexity_steps = {
                'simple': 2,
                'medium': 6,
                'complex': 12,
                'expert': 16
            }
            max_act_steps = complexity_steps.get(task_complexity, 8)

        # Tokenize input (simplified for demo)
        input_ids = self._simple_tokenize(prompt)
        input_array = mx.array(input_ids).reshape(1, -1)

        # Run model with ACT
        result = self.model(
            input_array,
            use_act=use_act,
            max_steps=max_act_steps
        )

        # Generate tokens
        generated_tokens = []
        for _ in range(max_length):
            logits = result['logits'][0, -1, :]  # Get last token logits

            # Apply temperature
            if temperature > 0:
                logits = logits / temperature

            # Apply top-p sampling
            probs = mx.softmax(logits)
            if top_p < 1.0:
                sorted_probs = mx.sort(probs)[::-1]
                cumsum = mx.cumsum(sorted_probs)
                mask = cumsum <= top_p
                probs = probs * mask
                probs = probs / probs.sum()

            # Sample token
            next_token = mx.random.categorical(mx.log(probs))
            generated_tokens.append(int(next_token.item()))

            # Check for end token
            eos_token_id = self.tokenizer.eos_token_id if self.tokenizer else 2
            if next_token == eos_token_id:
                break

            # Update input for next iteration
            input_array = mx.concatenate([
                input_array,
                next_token.reshape(1, 1)
            ], axis=1)

            # Run model for next token (with reduced ACT steps for efficiency)
            result = self.model(
                input_array,
                use_act=use_act,
                max_steps=min(4, max_act_steps) if max_act_steps else 4
            )

        # Decode tokens (simplified)
        generated_text = self._simple_decode(generated_tokens)

        generation_time = time.time() - start_time
        tokens_per_second = len(generated_tokens) / \
            generation_time if generation_time > 0 else 0

        return {
            'generated_text': generated_text,
            'tokens_generated': len(generated_tokens),
            'generation_time': generation_time,
            'tokens_per_second': tokens_per_second,
            'reasoning_steps': result.get('steps_used', 0),
            'final_confidence': result.get('final_confidence', 0.0),
            'reasoning_chain': result.get('reasoning_chain', []),
            'efficiency_percentage': result.get('efficiency', 0.0)
        }

    def _simple_tokenize(self, text: str) -> List[int]:
        """Tokenize text using the loaded tokenizer or fallback to simple tokenization"""
        if self.tokenizer:
            # Use the proper tokenizer
            encoded = self.tokenizer.encode(text, add_special_tokens=True)
            return encoded
        else:
            # Fallback to simple tokenization for testing
            tokens = []
            for char in text.lower():
                tokens.append(ord(char) % self.config.vocab_size)
            return tokens

    def _simple_decode(self, tokens: List[int]) -> str:
        """Decode tokens using the loaded tokenizer or fallback to simple decoding"""
        if self.tokenizer:
            # Use the proper tokenizer for decoding
            try:
                # Skip special tokens in decoding
                text = self.tokenizer.decode(tokens, skip_special_tokens=True)
                return text
            except Exception as e:
                logger.warning(f"Error decoding tokens: {e}")
                # Fallback to simple decoding on error

        # Fallback to simple decoding for testing
        chars = []
        for token in tokens:
            if token < 128:  # ASCII range
                chars.append(chr(token))
            else:
                chars.append(f"<{token}>")
        return ''.join(chars)


# Export main components
__all__ = ['HRMModel', 'HRMConfig', 'HRMInference']
