import React, { useState } from 'react';
import { api } from '../lib/api';

const OllamaTest: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    setIsLoading(true);
    setResponse('');
    
    try {
      const result = await api.ollama.generate({
        prompt: prompt.trim(),
        model: 'llama3.2:3b',
        temperature: 0.7,
        max_tokens: 500
      });
      
      setResponse(result.response);
    } catch (error) {
      console.error('Error:', error);
      setResponse(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateStream = async () => {
    if (!prompt.trim()) return;
    
    setIsStreaming(true);
    setResponse('');
    
    try {
      for await (const chunk of api.ollama.generateStream({
        prompt: prompt.trim(),
        model: 'llama3.2:3b',
        temperature: 0.7,
        max_tokens: 500
      })) {
        setResponse(prev => prev + chunk);
      }
    } catch (error) {
      console.error('Streaming error:', error);
      setResponse(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleHealthCheck = async () => {
    setIsLoading(true);
    try {
      const isHealthy = await api.ollama.healthCheck();
      setResponse(`Health check: ${isHealthy ? 'PASSED ✅' : 'FAILED ❌'}`);
    } catch (error) {
      setResponse(`Health check error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Ollama Integration Test</h2>
      
      <div className="space-y-4">
        {/* Input */}
        <div>
          <label htmlFor="prompt" className="block text-sm font-medium mb-2">
            Prompt:
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your prompt here..."
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={handleGenerate}
            disabled={isLoading || isStreaming || !prompt.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Generating...' : 'Generate'}
          </button>
          
          <button
            onClick={handleGenerateStream}
            disabled={isLoading || isStreaming || !prompt.trim()}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isStreaming ? 'Streaming...' : 'Generate (Stream)'}
          </button>
          
          <button
            onClick={handleHealthCheck}
            disabled={isLoading || isStreaming}
            className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Health Check
          </button>
        </div>

        {/* Response */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Response:
          </label>
          <div className="w-full p-3 border border-gray-300 rounded-md bg-gray-50 min-h-[200px] whitespace-pre-wrap">
            {response || 'Response will appear here...'}
          </div>
        </div>

        {/* Status */}
        {(isLoading || isStreaming) && (
          <div className="text-center py-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="mt-2 text-sm text-gray-600">
              {isLoading ? 'Generating response...' : 'Streaming response...'}
            </p>
          </div>
        )}
      </div>
      
      {/* Instructions */}
      <div className="mt-8 p-4 bg-blue-50 rounded-md">
        <h3 className="font-semibold mb-2">How to test:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>First, run a health check to ensure Ollama is connected</li>
          <li>Enter a prompt (e.g., "Explain what TypeScript is")</li>
          <li>Try both "Generate" (single response) and "Generate (Stream)" (real-time streaming)</li>
          <li>Check browser console for any errors</li>
        </ol>
      </div>
    </div>
  );
};

export default OllamaTest;