export const LM_STUDIO_MODELS = {
    tier1: [
        'llama-3.2-1b-instruct',
        'qwen2.5-0.5b-instruct-mlx',
        'deepseek-r1-0528-coder-draft-0.6b-v1.0'
    ],
    tier2: [
        'mistralai/mistral-small-3.2',
        'mistralai/devstral-small-2505',
        'google/gemma-3-4b'
    ],
    tier3: [
        'google/gemma-3-12b',
        'deepseek/deepseek-r1-0528-qwen3-8b',
        'qwen2.5-coder-14b-instruct-mlx'
    ],
    tier4: [
        'openai/gpt-oss-20b',
        'dolphin-mistral-24b-venice-edition-mlx',
        'qwen/qwen3-coder-30b'
    ],
    defaults: {
        tier1: 'llama-3.2-1b-instruct',
        tier2: 'mistralai/mistral-small-3.2',
        tier3: 'google/gemma-3-12b',
        tier4: 'openai/gpt-oss-20b'
    },
    embedding: 'text-embedding-nomic-embed-text-v1.5'
};
export const LM_STUDIO_CONFIG = {
    url: process.env.LM_STUDIO_URL || 'http://localhost:5901',
    apiVersion: 'v1',
    timeout: 30000,
    maxRetries: 3,
    headers: {
        'Content-Type': 'application/json'
    }
};
//# sourceMappingURL=lm-studio-models.js.map