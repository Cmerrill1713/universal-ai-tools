#!/usr/bin/env python3
"""
Integrate LFM2-1.2B model with Universal AI Tools
Supports both direct HuggingFace usage and Ollama conversion
"""

import os
import sys
import subprocess
import json
from pathlib import Path

# Model paths
MODEL_PATH = "/Users/christianmerrill/Desktop/universal-ai-tools/models/agents/LFM2-1.2B-bf16"
MODEL_NAME = "lfm2-1.2b"

def check_model_format():
    """Check the model format and available options"""
    print("🔍 Checking LFM2-1.2B model...")
    print(f"Path: {MODEL_PATH}")
    
    # Check files
    files = os.listdir(MODEL_PATH)
    print(f"\nFiles found: {', '.join(files)}")
    
    has_safetensors = "model.safetensors" in files
    has_gguf = any(f.endswith('.gguf') for f in files)
    
    print(f"\n✅ Safetensors format: {'Yes' if has_safetensors else 'No'}")
    print(f"✅ GGUF format: {'Yes' if has_gguf else 'No'}")
    
    return has_safetensors, has_gguf

def create_ollama_modelfile():
    """Create Modelfile for Ollama integration"""
    print("\n📝 Creating Ollama Modelfile...")
    
    # First, we need to convert to GGUF if not already
    modelfile_content = f"""# LFM2-1.2B Model
# Liquid Foundation Model 2 - 1.2B parameters

# Note: This model requires conversion to GGUF format first
# Use llama.cpp or similar tools to convert from safetensors

FROM ./lfm2-1.2b.gguf

# Model parameters
PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER repeat_penalty 1.1
PARAMETER stop "<|endoftext|>"
PARAMETER stop "<|end|>"

# Template based on the model's chat template
TEMPLATE "{{{{ if .System }}}}<|system|>
{{{{ .System }}}}<|end|>
{{{{ end }}}}{{{{ if .Prompt }}}}<|user|>
{{{{ .Prompt }}}}<|end|>
<|assistant|>{{{{ end }}}}"

# System prompt
SYSTEM "You are a helpful AI assistant powered by Liquid Foundation Model 2."
"""
    
    modelfile_path = os.path.join(os.path.dirname(MODEL_PATH), "Modelfile.lfm2")
    with open(modelfile_path, 'w') as f:
        f.write(modelfile_content)
    
    print(f"✅ Created Modelfile at: {modelfile_path}")
    return modelfile_path

def setup_python_integration():
    """Setup for direct Python/HuggingFace integration"""
    print("\n🐍 Setting up Python integration...")
    
    integration_code = f'''
# Direct LFM2 Integration for DSPy

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
import os

class LFM2Model:
    """Direct integration of LFM2-1.2B model"""
    
    def __init__(self, model_path="{MODEL_PATH}"):
        self.model_path = model_path
        self.device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
        self.model = None
        self.tokenizer = None
        
    def load(self):
        """Load the model and tokenizer"""
        print(f"Loading LFM2 from {{self.model_path}}...")
        
        # Load tokenizer
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_path)
        
        # Load model with appropriate dtype
        if self.device == "mps":
            # Apple Silicon optimization
            self.model = AutoModelForCausalLM.from_pretrained(
                self.model_path,
                torch_dtype=torch.float16,  # MPS prefers float16
                device_map="auto"
            )
        else:
            self.model = AutoModelForCausalLM.from_pretrained(
                self.model_path,
                torch_dtype=torch.bfloat16,
                device_map="auto"
            )
        
        self.model.eval()
        print(f"✅ LFM2 loaded on {{self.device}}")
        
    def generate(self, prompt, max_length=512, temperature=0.7):
        """Generate text from prompt"""
        inputs = self.tokenizer(prompt, return_tensors="pt").to(self.device)
        
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_length=max_length,
                temperature=temperature,
                do_sample=True,
                top_p=0.9,
                pad_token_id=self.tokenizer.pad_token_id
            )
        
        response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        return response[len(prompt):]

# Integration with DSPy
def create_lfm2_dspy_adapter():
    """Create adapter for DSPy to use LFM2"""
    import dspy
    
    class LFM2DSPyLM(dspy.LM):
        def __init__(self):
            self.model = LFM2Model()
            self.model.load()
            
        def __call__(self, prompt, **kwargs):
            return self.model.generate(prompt, **kwargs)
    
    return LFM2DSPyLM()
'''
    
    # Save integration code
    integration_path = os.path.join(os.path.dirname(MODEL_PATH), "lfm2_integration.py")
    with open(integration_path, 'w') as f:
        f.write(integration_code)
    
    print(f"✅ Created Python integration at: {integration_path}")
    return integration_path

def convert_to_gguf():
    """Instructions for converting to GGUF format"""
    print("\n🔧 Converting to GGUF format for Ollama...")
    print("\nTo use with Ollama, you need to convert the model to GGUF format:")
    print("\n1. Install llama.cpp:")
    print("   git clone https://github.com/ggerganov/llama.cpp")
    print("   cd llama.cpp && make")
    print("\n2. Convert the model:")
    print(f"   python convert.py {MODEL_PATH} --outtype f16")
    print(f"   ./quantize {MODEL_PATH}/ggml-model-f16.gguf {MODEL_PATH}/lfm2-1.2b.gguf Q4_K_M")
    print("\n3. Create in Ollama:")
    print(f"   ollama create {MODEL_NAME} -f Modelfile.lfm2")

def update_model_selector():
    """Update model selector to recognize LFM2"""
    print("\n📋 Updating model selector configuration...")
    
    selector_update = '''
# Add to model_selector.py MODEL_PROFILES:

r"lfm2.*1\.2b": {
    "size": "small", "params": 1.2, "speed": 0.92, "quality": 0.55,
    "capabilities": [ModelCapability.BASIC, ModelCapability.REASONING]
},
'''
    
    print("Add this pattern to model_selector.py:")
    print(selector_update)

def main():
    print("🌊 LFM2-1.2B Integration Setup")
    print("=" * 50)
    
    # Check model format
    has_safetensors, has_gguf = check_model_format()
    
    # Create integration files
    modelfile_path = create_ollama_modelfile()
    integration_path = setup_python_integration()
    
    # Provide instructions
    print("\n" + "=" * 50)
    print("📋 Integration Summary")
    print("=" * 50)
    
    print("\n✨ Option 1: Direct Python Usage (Recommended)")
    print(f"   - Use the integration at: {integration_path}")
    print("   - Works with DSPy directly")
    print("   - Optimized for Apple Silicon (MPS)")
    
    print("\n✨ Option 2: Ollama Integration")
    if not has_gguf:
        convert_to_gguf()
    else:
        print("   - GGUF file found! Create with:")
        print(f"     ollama create {MODEL_NAME} -f {modelfile_path}")
    
    print("\n✨ Option 3: Update Model Selector")
    update_model_selector()
    
    print("\n🎯 Quick Test:")
    print("   python -c \"from lfm2_integration import LFM2Model; m = LFM2Model(); m.load(); print(m.generate('Hello, I am'))\"")
    
    print("\n✅ Setup complete!")

if __name__ == "__main__":
    main()