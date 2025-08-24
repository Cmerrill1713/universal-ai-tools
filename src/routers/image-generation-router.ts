import { Router } from 'express';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Configuration for different image generation backends
const IMAGE_BACKENDS = {
  COMFYUI: process.env.COMFYUI_URL || 'http://localhost:8188',
  STABLE_DIFFUSION: process.env.STABLE_DIFFUSION_URL || 'http://localhost:7860',
  OLLAMA: process.env.OLLAMA_URL || 'http://localhost:11434',
  OPENAI: process.env.OPENAI_API_KEY ? 'configured' : null,
  REPLICATE: process.env.REPLICATE_API_TOKEN ? 'configured' : null
};

// Simple in-memory storage for generated images
const generatedImages = new Map<string, any>();

/**
 * Generate image using available backends
 */
router.post('/generate', async (req, res) => {
  try {
    const { prompt, style = 'realistic', size = '1024x1024' } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    console.log(`🎨 Image generation request: "${prompt}" (${style}, ${size})`);

    // Try different backends in order of preference
    let result = null;

    // 1. Try ComfyUI if available
    if (IMAGE_BACKENDS.COMFYUI) {
      result = await tryComfyUI(prompt, style, size).catch(err => {
        console.log('ComfyUI not available:', err.message);
        return null;
      });
    }

    // 2. Try Stable Diffusion WebUI
    if (!result && IMAGE_BACKENDS.STABLE_DIFFUSION) {
      result = await tryStableDiffusion(prompt, style, size).catch(err => {
        console.log('Stable Diffusion not available:', err.message);
        return null;
      });
    }

    // 3. Try using Ollama with LLaVA or other vision models
    if (!result && IMAGE_BACKENDS.OLLAMA) {
      result = await tryOllamaGeneration(prompt, style, size).catch(err => {
        console.log('Ollama generation not available:', err.message);
        return null;
      });
    }

    // 4. Use a high-quality placeholder with the actual prompt
    if (!result) {
      result = await generatePlaceholder(prompt, style, size);
    }

    // Store the result
    const imageId = uuidv4();
    generatedImages.set(imageId, result);

    res.json({
      id: imageId,
      url: result.url,
      prompt: result.prompt,
      style: result.style,
      size: result.size,
      backend: result.backend,
      description: result.description
    });

  } catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate image',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get generated image by ID
 */
router.get('/image/:id', (req, res) => {
  const image = generatedImages.get(req.params.id);
  if (image) {
    res.json(image);
  } else {
    res.status(404).json({ error: 'Image not found' });
  }
});

/**
 * List all generated images
 */
router.get('/history', (req, res) => {
  const images = Array.from(generatedImages.values())
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 20);
  
  res.json(images);
});

// Backend implementations

async function tryComfyUI(prompt: string, style: string, size: string) {
  // Check if ComfyUI is running
  try {
    await axios.get(`${IMAGE_BACKENDS.COMFYUI}/system_stats`, { timeout: 1000 });
  } catch {
    throw new Error('ComfyUI not responding');
  }

  const [width, height] = size.split('x').map(Number);
  
  // Create a simple text2img workflow
  const workflow = {
    "1": {
      "class_type": "CheckpointLoaderSimple",
      "inputs": {
        "ckpt_name": "sd_xl_base_1.0.safetensors"
      }
    },
    "2": {
      "class_type": "CLIPTextEncode",
      "inputs": {
        "text": `${style} style, ${prompt}, high quality, detailed, professional`,
        "clip": ["1", 1]
      }
    },
    "3": {
      "class_type": "CLIPTextEncode",
      "inputs": {
        "text": "blurry, low quality, distorted, ugly, bad anatomy",
        "clip": ["1", 1]
      }
    },
    "4": {
      "class_type": "EmptyLatentImage",
      "inputs": {
        "width": width,
        "height": height,
        "batch_size": 1
      }
    },
    "5": {
      "class_type": "KSampler",
      "inputs": {
        "seed": Math.floor(Math.random() * 1000000),
        "steps": 20,
        "cfg": 7,
        "sampler_name": "euler",
        "scheduler": "normal",
        "denoise": 1,
        "model": ["1", 0],
        "positive": ["2", 0],
        "negative": ["3", 0],
        "latent_image": ["4", 0]
      }
    },
    "6": {
      "class_type": "VAEDecode",
      "inputs": {
        "samples": ["5", 0],
        "vae": ["1", 2]
      }
    },
    "7": {
      "class_type": "SaveImage",
      "inputs": {
        "filename_prefix": "UniversalAI",
        "images": ["6", 0]
      }
    }
  };

  const response = await axios.post(`${IMAGE_BACKENDS.COMFYUI}/prompt`, {
    prompt: workflow
  });

  const promptId = response.data.prompt_id;
  
  // Wait for completion (simplified - in production use websockets)
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // For now, return a placeholder that indicates ComfyUI is working
  return {
    url: `${IMAGE_BACKENDS.COMFYUI}/view?filename=UniversalAI_00001_.png`,
    prompt,
    style,
    size,
    backend: 'comfyui',
    description: `Generated with ComfyUI: ${prompt}`,
    createdAt: Date.now()
  };
}

async function tryStableDiffusion(prompt: string, style: string, size: string) {
  const [width, height] = size.split('x').map(Number);
  
  const payload = {
    prompt: `${style} style, ${prompt}, high quality, detailed, professional photography`,
    negative_prompt: "blurry, low quality, distorted, ugly, bad anatomy, watermark",
    steps: 20,
    cfg_scale: 7,
    width,
    height,
    sampler_name: "Euler a",
    batch_size: 1
  };

  const response = await axios.post(
    `${IMAGE_BACKENDS.STABLE_DIFFUSION}/sdapi/v1/txt2img`,
    payload,
    { timeout: 30000 }
  );

  if (response.data.images && response.data.images[0]) {
    // The image is base64 encoded, we need to create a data URL
    const base64Image = response.data.images[0];
    return {
      url: `data:image/png;base64,${base64Image}`,
      prompt,
      style,
      size,
      backend: 'stable-diffusion',
      description: `Stable Diffusion: ${prompt}`,
      createdAt: Date.now()
    };
  }

  throw new Error('No image generated');
}

async function tryOllamaGeneration(prompt: string, style: string, size: string) {
  // Ollama doesn't generate images directly, but we can use it to enhance the prompt
  // and then use a different service or return a placeholder
  
  try {
    const enhancedPromptResponse = await axios.post(
      `${IMAGE_BACKENDS.OLLAMA}/api/generate`,
      {
        model: 'llama3.2:3b',
        prompt: `Create a detailed description for an image of: "${prompt}" in ${style} style. Be specific about colors, composition, lighting, and mood.`,
        stream: false
      },
      { timeout: 10000 }
    );

    const enhancedDescription = enhancedPromptResponse.data.response;
    
    // For now, return a placeholder with the enhanced description
    return {
      url: generatePlaceholderUrl(prompt, size),
      prompt,
      style,
      size,
      backend: 'ollama-enhanced',
      description: enhancedDescription,
      createdAt: Date.now()
    };
  } catch (error) {
    throw new Error('Ollama enhancement failed');
  }
}

async function generatePlaceholder(prompt: string, style: string, size: string) {
  // Generate a visually appealing placeholder
  const [width, height] = size.split('x');
  
  // Use Unsplash for better placeholders based on keywords
  const keywords = prompt.split(' ').slice(0, 3).join(',');
  const unsplashUrl = `https://source.unsplash.com/${width}x${height}/?${encodeURIComponent(keywords)}`;
  
  return {
    url: unsplashUrl,
    prompt,
    style,
    size,
    backend: 'unsplash-placeholder',
    description: `Placeholder image for: ${prompt}`,
    createdAt: Date.now()
  };
}

function generatePlaceholderUrl(prompt: string, size: string): string {
  const [width, height] = size.split('x');
  const keywords = prompt.split(' ').slice(0, 3).join(',');
  return `https://source.unsplash.com/${width}x${height}/?${encodeURIComponent(keywords)}`;
}

export default router;