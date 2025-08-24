import React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PhotoIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  SparklesIcon,
  ClockIcon,
  ArrowPathIcon,
  HeartIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';
import { useStore } from '../store/useStore';
import {
  unifiedAgentDecisionService,
  _DecisionType,
  TaskExecutionRequest,
} from '../services/unifiedAgentDecisionService';
import { useIntelligentTaskExecution } from '../hooks/useIntelligentTaskExecution';

import Logger from '../utils/logger';
interface GenerationOptions {
  prompt: string;
  style:
    | 'realistic'
    | 'artistic'
    | 'cartoon'
    | 'abstract'
    | 'photographic'
    | 'digital-art'
    | 'concept-art'
    | 'anime';
  size: '512x512' | '1024x1024' | '1024x768' | '768x1024' | '1536x1024' | '1024x1536';
  steps: number;
  cfgScale: number;
  seed?: number;
  negativePrompt: string;
}

interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  style: string;
  size: string;
  backend: string;
  description?: string;
  createdAt: Date;
  isFavorite?: boolean;
  generationTime?: number;
}

interface BackendStatus {
  comfyui: 'online' | 'offline' | 'unknown';
  stableDiffusion: 'online' | 'offline' | 'unknown';
  ollama: 'online' | 'offline' | 'unknown';
}

export const ImageGeneration: React.ComponentType = () => {
  const { apiEndpoint, activeProfile, addNotification } = useStore();
  const { executeTask: _executeTask, isExecuting } = useIntelligentTaskExecution();

  const [options, setOptions] = useState<GenerationOptions>({
    prompt: '',
    style: 'realistic',
    size: '1024x1024',
    steps: 50,
    cfgScale: 7,
    negativePrompt: 'blurry, low quality, distorted, ugly, bad anatomy, watermark',
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>({
    comfyui: 'unknown',
    stableDiffusion: 'unknown',
    ollama: 'unknown',
  });
  const [generationHistory, setGenerationHistory] = useState<GeneratedImage[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);

  const loadGenerationHistory = useCallback(async () => {
    try {
      const response = await fetch(`${apiEndpoint}/api/image-generation/history`);
      if (response.ok) {
        const history = await response.json();
        setGenerationHistory(
          history.map((img: unknown) => ({
            ...img,
            createdAt: new Date(img.createdAt),
            isFavorite: localStorage.getItem(`favorite_${img.id}`) === 'true',
          }))
        );
      }
    } catch (_error) {
      if (process.env.NODE_ENV === 'development') {
        Logger.error('Failed to load generation history:', _error);
      }
    }
  }, [apiEndpoint]);

  const checkBackendStatus = useCallback(async () => {
    // Check each backend status
    const statuses: Partial<BackendStatus> = {};

    try {
      const _comfyResponse = await fetch('http://localhost:8188/system_stats', {
        method: 'GET',
        mode: 'no-cors',
        signal: AbortSignal.timeout(2000),
      });
      statuses.comfyui = 'online';
    } catch {
      statuses.comfyui = 'offline';
    }

    try {
      const _sdResponse = await fetch('http://localhost:7860/sdapi/v1/options', {
        method: 'GET',
        mode: 'no-cors',
        signal: AbortSignal.timeout(2000),
      });
      statuses.stableDiffusion = 'online';
    } catch {
      statuses.stableDiffusion = 'offline';
    }

    try {
      const _ollamaResponse = await fetch('http://localhost:11434/api/tags', {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      statuses.ollama = 'online';
    } catch {
      statuses.ollama = 'offline';
    }

    setBackendStatus(statuses as BackendStatus);
  }, []);

  // Load generation history on component mount
  useEffect(() => {
    loadGenerationHistory();
    checkBackendStatus();
  }, [loadGenerationHistory, checkBackendStatus]);

  const handleGenerate = async () => {
    if (!options.prompt.trim()) return;

    setIsGenerating(true);
    const startTime = Date.now();

    try {
      // Use HRM agent system for intelligent prompt enhancement
      const enhancedPrompt = await enhancePromptWithHRM(options.prompt, options.style);

      const response = await fetch(`${apiEndpoint}/api/image-generation/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: enhancedPrompt,
          style: options.style,
          width: parseInt(options.size.split('x')[0]),
          height: parseInt(options.size.split('x')[1]),
          steps: options.steps,
          cfg_scale: options.cfgScale,
          negative_prompt: options.negativePrompt,
          seed: options.seed,
        }),
      });

      if (!response.ok) {
        throw new Error(`Generation failed: ${response.statusText}`);
      }

      const result = await response.json();
      const generationTime = Date.now() - startTime;

      const newImage: GeneratedImage = {
        id: result.id || Date.now().toString(),
        url: result.url,
        prompt: options.prompt,
        style: options.style,
        size: options.size,
        backend: result.backend || 'unknown',
        description: result.description,
        createdAt: new Date(),
        generationTime,
        isFavorite: false,
      };

      setGeneratedImages(prev => [newImage, ...prev]);
      setGenerationHistory(prev => [newImage, ...prev]);
    } catch (_error) {
      Logger.error('Image generation _error:', _error);
      addNotification({
        type: 'error',
        title: 'Image Generation Failed',
        message:
          _error instanceof Error ? _error.message : 'Failed to generate image. Please try again.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const enhancePromptWithHRM = async (prompt: string, style: string): Promise<string> => {
    try {
      const taskRequest: TaskExecutionRequest = {
        task_type: 'ui-ux-designer',
        complexity: 'moderate',
        task_description: `Enhance this image generation prompt for ${style} style: "${prompt}"`,
        user_context: {
          profile_id: activeProfile?.name || 'default',
          preferences: { style_preference: style },
          experience_level: 'intermediate',
          frontend_framework: 'react',
        },
        execution_constraints: {
          max_time_ms: 5000,
        },
        parameters: { original_prompt: prompt, target_style: style },
      };

      const result = await unifiedAgentDecisionService.executeTask(taskRequest);

      if (result.success && result.final_result?.enhanced_prompt) {
        return result.final_result.enhanced_prompt;
      }

      return prompt; // Fallback to original
    } catch (_error) {
      Logger.error('HRM prompt enhancement failed:', _error);
      return prompt; // Fallback to original
    }
  };

  const handleDownload = (image: GeneratedImage) => {
    const link = document.createElement('a');
    link.href = image.url;
    link.download = `generated-image-${image.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleFavorite = (image: GeneratedImage) => {
    const newFavoriteStatus = !image.isFavorite;

    // Update localStorage
    if (newFavoriteStatus) {
      localStorage.setItem(`favorite_${image.id}`, 'true');
    } else {
      localStorage.removeItem(`favorite_${image.id}`);
    }

    // Update state
    setGeneratedImages(prev =>
      prev.map(img => (img.id === image.id ? { ...img, isFavorite: newFavoriteStatus } : img))
    );
    setGenerationHistory(prev =>
      prev.map(img => (img.id === image.id ? { ...img, isFavorite: newFavoriteStatus } : img))
    );
  };

  const getStylePresets = () => [
    { id: 'realistic', name: 'Realistic', description: 'Photo-realistic images' },
    { id: 'artistic', name: 'Artistic', description: 'Artistic interpretation' },
    { id: 'cartoon', name: 'Cartoon', description: 'Cartoon-style illustrations' },
    { id: 'abstract', name: 'Abstract', description: 'Abstract art style' },
    { id: 'photographic', name: 'Photographic', description: 'Professional photography' },
    { id: 'digital-art', name: 'Digital Art', description: 'Modern digital artwork' },
    { id: 'concept-art', name: 'Concept Art', description: 'Concept design style' },
    { id: 'anime', name: 'Anime', description: 'Japanese anime style' },
  ];

  const getFilteredImages = () => {
    const images = generatedImages.length > 0 ? generatedImages : generationHistory;
    return showFavorites ? images.filter(img => img.isFavorite) : images;
  };

  const getBackendStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'text-green-400';
      case 'offline':
        return 'text-red-400';
      default:
        return 'text-yellow-400';
    }
  };

  return (
    <div className='flex-1 overflow-hidden'>
      <div className='h-full flex flex-col lg:flex-row'>
        {/* Generation Panel */}
        <div className='lg:w-1/3 border-r border-white/10 bg-black/20 backdrop-blur-xl'>
          <div className='p-6 space-y-6'>
            <div>
              <div className='flex items-center justify-between mb-2'>
                <h1 className='text-2xl font-bold text-white'>Image Generation</h1>
                <motion.button
                  onClick={checkBackendStatus}
                  className='p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg'
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <ArrowPathIcon className='w-4 h-4' />
                </motion.button>
              </div>
              <p className='text-gray-400 text-sm mb-3'>
                Create AI-generated images with HRM intelligence
              </p>

              {/* Backend Status */}
              <div className='grid grid-cols-3 gap-2 mb-4'>
                <div
                  className={`text-xs p-2 rounded bg-white/10 text-center ${getBackendStatusColor(backendStatus.comfyui)}`}
                >
                  ComfyUI: {backendStatus.comfyui}
                </div>
                <div
                  className={`text-xs p-2 rounded bg-white/10 text-center ${getBackendStatusColor(backendStatus.stableDiffusion)}`}
                >
                  Stable Diffusion: {backendStatus.stableDiffusion}
                </div>
                <div
                  className={`text-xs p-2 rounded bg-white/10 text-center ${getBackendStatusColor(backendStatus.ollama)}`}
                >
                  Ollama: {backendStatus.ollama}
                </div>
              </div>
            </div>

            {/* Prompt Input */}
            <div>
              <div className='flex items-center justify-between mb-2'>
                <label className='block text-sm font-medium text-gray-300'>Prompt</label>
                {isExecuting && (
                  <span className='text-xs text-blue-400 flex items-center space-x-1'>
                    <SparklesIcon className='w-3 h-3' />
                    <span>HRM Enhancing...</span>
                  </span>
                )}
              </div>
              <textarea
                value={options.prompt}
                onChange={_e => setOptions({ ...options, prompt: _e.target.value })}
                placeholder='Describe the image you want to generate...'
                className='w-full h-24 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none'
              />
            </div>

            {/* Style Selection */}
            <div>
              <label className='block text-sm font-medium text-gray-300 mb-3'>Style</label>
              <div className='grid grid-cols-2 gap-2'>
                {getStylePresets().map(preset => (
                  <motion.button
                    key={preset.id}
                    onClick={() =>
                      setOptions({ ...options, style: preset.id as GenerationOptions['style'] })
                    }
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all text-center ${
                      options.style === preset.id
                        ? 'bg-blue-500 text-white'
                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    title={preset.description}
                  >
                    {preset.name}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Advanced Settings */}
            <div className='space-y-4'>
              <div>
                <label className='block text-sm font-medium text-gray-300 mb-2'>
                  Negative Prompt
                </label>
                <textarea
                  value={options.negativePrompt}
                  onChange={_e => setOptions({ ...options, negativePrompt: _e.target.value })}
                  placeholder="What you don't want in the image..."
                  className='w-full h-16 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm'
                />
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-medium text-gray-300 mb-2'>
                    Steps: {options.steps}
                  </label>
                  <input
                    type='range'
                    min='20'
                    max='150'
                    value={options.steps}
                    onChange={_e => setOptions({ ...options, steps: parseInt(_e.target.value) })}
                    className='w-full accent-blue-500'
                  />
                </div>

                <div>
                  <label className='block text-sm font-medium text-gray-300 mb-2'>
                    CFG Scale: {options.cfgScale}
                  </label>
                  <input
                    type='range'
                    min='1'
                    max='20'
                    step='0.5'
                    value={options.cfgScale}
                    onChange={_e =>
                      setOptions({ ...options, cfgScale: parseFloat(_e.target.value) })
                    }
                    className='w-full accent-blue-500'
                  />
                </div>
              </div>
            </div>

            {/* Size Selection */}
            <div>
              <label className='block text-sm font-medium text-gray-300 mb-2'>Size</label>
              <select
                value={options.size}
                onChange={e =>
                  setOptions({ ...options, size: e.target.value as GenerationOptions['size'] })
                }
                className='w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                <option value='512x512'>512 × 512 (Square)</option>
                <option value='1024x1024'>1024 × 1024 (Large Square)</option>
                <option value='1024x768'>1024 × 768 (Landscape)</option>
                <option value='768x1024'>768 × 1024 (Portrait)</option>
                <option value='1536x1024'>1536 × 1024 (Wide Landscape)</option>
                <option value='1024x1536'>1024 × 1536 (Tall Portrait)</option>
              </select>
            </div>

            {/* Generate Button */}
            <motion.button
              onClick={handleGenerate}
              disabled={!options.prompt.trim() || isGenerating}
              className='w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed'
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isGenerating ? (
                <div className='flex items-center justify-center space-x-2'>
                  <div className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin' />
                  <span>Generating...</span>
                </div>
              ) : (
                <div className='flex items-center justify-center space-x-2'>
                  <PhotoIcon className='w-5 h-5' />
                  <span>Generate Image</span>
                </div>
              )}
            </motion.button>
          </div>
        </div>

        {/* Gallery */}
        <div className='flex-1 p-6'>
          <AnimatePresence>
            {getFilteredImages().length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className='flex flex-col items-center justify-center h-full text-gray-400'
              >
                <PhotoIcon className='w-16 h-16 mb-4' />
                <h3 className='text-xl font-medium mb-2'>
                  {showFavorites ? 'No favorite images yet' : 'No images generated yet'}
                </h3>
                <p className='text-center'>
                  {showFavorites
                    ? 'Mark images as favorites to see them here'
                    : 'Enter a prompt and click Generate to create your first image'}
                </p>
              </motion.div>
            ) : (
              <div>
                <div className='flex items-center justify-between mb-6'>
                  <div className='flex items-center space-x-4'>
                    <h2 className='text-xl font-bold text-white'>
                      {showFavorites ? 'Favorite Images' : 'Generated Images'}
                    </h2>
                    <div className='flex items-center space-x-2'>
                      <motion.button
                        onClick={() => setShowFavorites(!showFavorites)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium ${
                          showFavorites
                            ? 'bg-red-500 text-white'
                            : 'bg-white/10 text-gray-300 hover:bg-white/20'
                        }`}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {showFavorites ? (
                          <>
                            <HeartSolid className='w-4 h-4 inline mr-1' />
                            Favorites
                          </>
                        ) : (
                          <>
                            <HeartIcon className='w-4 h-4 inline mr-1' />
                            All
                          </>
                        )}
                      </motion.button>
                      <motion.button
                        onClick={loadGenerationHistory}
                        className='p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg'
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        title='Reload history'
                      >
                        <ArrowPathIcon className='w-4 h-4' />
                      </motion.button>
                    </div>
                  </div>
                  <span className='text-sm text-gray-400'>
                    {getFilteredImages().length} image(s)
                  </span>
                </div>

                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
                  {getFilteredImages().map(image => (
                    <motion.div
                      key={image.id}
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className='group relative bg-white/10 backdrop-blur-sm rounded-lg overflow-hidden hover:bg-white/20 transition-all'
                    >
                      <div className='aspect-square'>
                        <img
                          src={image.url}
                          alt={image.prompt}
                          className='w-full h-full object-cover cursor-pointer'
                          onClick={() => setSelectedImage(image)}
                          loading='lazy'
                        />
                      </div>

                      {/* Backend badge */}
                      <div className='absolute top-2 right-2'>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            image.backend === 'comfyui'
                              ? 'bg-green-500/20 text-green-400'
                              : image.backend === 'stable-diffusion'
                                ? 'bg-blue-500/20 text-blue-400'
                                : image.backend === 'ollama-enhanced'
                                  ? 'bg-purple-500/20 text-purple-400'
                                  : 'bg-gray-500/20 text-gray-400'
                          }`}
                        >
                          {image.backend}
                        </span>
                      </div>

                      <div className='absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2'>
                        <motion.button
                          onClick={_e => {
                            _e.stopPropagation();
                            toggleFavorite(image);
                          }}
                          className={`p-2 rounded-lg text-white ${
                            image.isFavorite
                              ? 'bg-red-500/20 hover:bg-red-500/30'
                              : 'bg-white/20 hover:bg-white/30'
                          }`}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          title={image.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          {image.isFavorite ? (
                            <HeartSolid className='w-5 h-5 text-red-400' />
                          ) : (
                            <HeartIcon className='w-5 h-5' />
                          )}
                        </motion.button>
                        <motion.button
                          onClick={_e => {
                            _e.stopPropagation();
                            handleDownload(image);
                          }}
                          className='p-2 bg-white/20 rounded-lg text-white hover:bg-white/30'
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          title='Download image'
                        >
                          <ArrowDownTrayIcon className='w-5 h-5' />
                        </motion.button>
                        <motion.button
                          onClick={() => setSelectedImage(image)}
                          className='p-2 bg-white/20 rounded-lg text-white hover:bg-white/30'
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          title='View full size'
                        >
                          <PhotoIcon className='w-5 h-5' />
                        </motion.button>
                      </div>

                      <div className='p-3'>
                        <p className='text-sm text-white truncate' title={image.prompt}>
                          {image.prompt}
                        </p>
                        <div className='flex items-center justify-between mt-2 text-xs text-gray-400'>
                          <span>{image.style}</span>
                          <div className='flex items-center space-x-2'>
                            <span>{image.size}</span>
                            {image.generationTime && (
                              <span className='flex items-center space-x-1'>
                                <ClockIcon className='w-3 h-3' />
                                <span>{(image.generationTime / 1000).toFixed(1)}s</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Image Modal */}
      <AnimatePresence>
        {selectedImage && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className='fixed inset-0 bg-black/80 backdrop-blur-sm z-50'
              onClick={() => setSelectedImage(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className='fixed inset-8 bg-black/90 backdrop-blur-xl rounded-xl z-50 flex flex-col'
            >
              <div className='flex items-center justify-between p-4 border-b border-white/10'>
                <h3 className='text-lg font-medium text-white'>Generated Image</h3>
                <motion.button
                  onClick={() => setSelectedImage(null)}
                  className='p-2 hover:bg-white/10 rounded-lg text-white'
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <XMarkIcon className='w-5 h-5' />
                </motion.button>
              </div>

              <div className='flex-1 p-4 flex items-center justify-center'>
                <img
                  src={selectedImage.url}
                  alt={selectedImage.prompt}
                  className='max-w-full max-h-full object-contain rounded-lg'
                />
              </div>

              <div className='p-4 border-t border-white/10'>
                <div className='flex items-start justify-between mb-3'>
                  <div className='flex-1'>
                    <p className='text-white mb-2'>{selectedImage.prompt}</p>
                    {selectedImage.description && (
                      <p className='text-sm text-gray-400 mb-2 italic'>
                        {selectedImage.description}
                      </p>
                    )}
                  </div>
                  <motion.button
                    onClick={() => toggleFavorite(selectedImage)}
                    className={`ml-4 p-2 rounded-lg ${
                      selectedImage.isFavorite
                        ? 'bg-red-500/20 hover:bg-red-500/30'
                        : 'bg-white/10 hover:bg-white/20'
                    }`}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    {selectedImage.isFavorite ? (
                      <HeartSolid className='w-5 h-5 text-red-400' />
                    ) : (
                      <HeartIcon className='w-5 h-5 text-gray-400' />
                    )}
                  </motion.button>
                </div>

                <div className='grid grid-cols-2 gap-4 text-sm text-gray-400 mb-4'>
                  <div>
                    <span className='font-medium'>Style:</span> {selectedImage.style}
                  </div>
                  <div>
                    <span className='font-medium'>Size:</span> {selectedImage.size}
                  </div>
                  <div>
                    <span className='font-medium'>Backend:</span>
                    <span
                      className={`ml-1 ${
                        selectedImage.backend === 'comfyui'
                          ? 'text-green-400'
                          : selectedImage.backend === 'stable-diffusion'
                            ? 'text-blue-400'
                            : selectedImage.backend === 'ollama-enhanced'
                              ? 'text-purple-400'
                              : 'text-gray-400'
                      }`}
                    >
                      {selectedImage.backend}
                    </span>
                  </div>
                  <div>
                    <span className='font-medium'>Created:</span>{' '}
                    {selectedImage.createdAt.toLocaleString()}
                  </div>
                  {selectedImage.generationTime && (
                    <div>
                      <span className='font-medium'>Generation Time:</span>{' '}
                      {(selectedImage.generationTime / 1000).toFixed(1)}s
                    </div>
                  )}
                </div>

                <div className='flex items-center space-x-3'>
                  <motion.button
                    onClick={() => handleDownload(selectedImage)}
                    className='flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600'
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <ArrowDownTrayIcon className='w-4 h-4' />
                    <span>Download</span>
                  </motion.button>

                  <motion.button
                    onClick={() => {
                      setOptions({
                        ...options,
                        prompt: selectedImage.prompt,
                        style: selectedImage.style as GenerationOptions['style'],
                        size: selectedImage.size as GenerationOptions['size'],
                      });
                      setSelectedImage(null);
                    }}
                    className='flex items-center space-x-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600'
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <ArrowPathIcon className='w-4 h-4' />
                    <span>Regenerate</span>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
