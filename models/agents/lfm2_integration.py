
# Direct LFM2 Integration for DSPy

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
import os

class LFM2Model:
    """Direct integration of LFM2-1.2B model"""
    
    def __init__(self, model_path="/Users/christianmerrill/Desktop/universal-ai-tools/models/agents/LFM2-1.2B-bf16"):
        self.model_path = model_path
        self.device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
        self.model = None
        self.tokenizer = None
        
    def load(self):
        """Load the model and tokenizer"""
        print(f"Loading LFM2 from {self.model_path}...")
        
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
        print(f"✅ LFM2 loaded on {self.device}")
        
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
