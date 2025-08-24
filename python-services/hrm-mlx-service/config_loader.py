"""
Configuration loader for HRM training
Supports YAML configuration files like the original PyTorch implementation
"""

import yaml
import argparse
from pathlib import Path
from typing import Any, Dict, Optional
from dataclasses import dataclass, fields


@dataclass
class HRMConfig:
    """Configuration dataclass for HRM training"""
    
    # Core hyperparameters
    learning_rate: float = 1e-4
    embedding_lr: Optional[float] = None  # If None, use same as learning_rate
    weight_decay: float = 0.1
    embedding_weight_decay: float = 0.1
    batch_size: int = 32
    gradient_accumulation_steps: int = 1  # For gradient accumulation
    max_epochs: int = 20000
    
    # Learning rate scheduling
    warmup_steps: int = 2000
    min_lr_ratio: float = 0.1
    
    # AdamATan2 parameters
    beta1: float = 0.9
    beta2: float = 0.95
    
    # Model architecture
    d_model: int = 512
    H_cycles: int = 2
    L_cycles: int = 2
    H_layers: int = 4
    L_layers: int = 4
    expansion: float = 2.0
    
    # ACT and Q-learning
    halt_max_steps: int = 16
    halt_exploration_prob: float = 0.1
    
    # Data
    train_samples: int = 1000
    val_samples: int = 200
    min_difficulty: int = 20
    data_path: str = "data"
    
    # Training
    eval_interval: int = 2000
    save_every: int = 2000
    checkpoint_dir: str = "checkpoints"
    load_checkpoint: Optional[str] = None
    no_auto_resume: bool = False
    
    # Monitoring
    project_name: str = "hrm-mlx"
    run_name: Optional[str] = None
    
    @classmethod
    def from_yaml(cls, yaml_path: str) -> 'HRMConfig':
        """Load configuration from YAML file"""
        with open(yaml_path, 'r') as f:
            yaml_data = yaml.safe_load(f)
        
        # Filter only valid fields
        valid_fields = {f.name for f in fields(cls)}
        filtered_data = {k: v for k, v in yaml_data.items() if k in valid_fields}
        
        return cls(**filtered_data)
    
    @classmethod
    def from_args(cls, args: argparse.Namespace) -> 'HRMConfig':
        """Create configuration from command line arguments"""
        config_dict = {}
        
        # Map argparse attributes to config fields
        valid_fields = {f.name for f in fields(cls)}
        for field_name in valid_fields:
            if hasattr(args, field_name):
                value = getattr(args, field_name)
                if value is not None:  # Only set non-None values
                    config_dict[field_name] = value
        
        return cls(**config_dict)
    
    def update_from_args(self, args: argparse.Namespace) -> 'HRMConfig':
        """Update configuration with command line arguments (args override config)"""
        valid_fields = {f.name for f in fields(self)}
        
        for field_name in valid_fields:
            if hasattr(args, field_name):
                value = getattr(args, field_name)
                if value is not None:  # Only override with non-None values
                    setattr(self, field_name, value)
        
        return self
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {f.name: getattr(self, f.name) for f in fields(self)}
    
    def save_yaml(self, yaml_path: str):
        """Save configuration to YAML file"""
        with open(yaml_path, 'w') as f:
            yaml.dump(self.to_dict(), f, default_flow_style=False, indent=2)


def load_config(config_path: Optional[str] = None, args: Optional[argparse.Namespace] = None) -> HRMConfig:
    """
    Load configuration with priority: command line args > YAML config > defaults
    
    Args:
        config_path: Path to YAML configuration file
        args: Command line arguments (will override config file)
    
    Returns:
        HRMConfig object
    """
    if config_path and Path(config_path).exists():
        print(f"📋 Loading configuration from: {config_path}")
        config = HRMConfig.from_yaml(config_path)
    else:
        print("📋 Using default configuration")
        config = HRMConfig()
    
    # Override with command line arguments if provided
    if args is not None:
        config = config.update_from_args(args)
    
    return config