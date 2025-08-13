import { createClient } from '@supabase/supabase-js';
import { config } from '@/config/environment';
import { log, LogContext } from '@/utils/logger';
export class HuggingFaceIngestionService {
    supabase;
    baseUrl = 'https://huggingface.co/api';
    hubUrl = 'https://huggingface.co';
    papersUrl = 'https://huggingface.co/api/papers';
    constructor() {
        this.supabase = createClient(process.env.SUPABASE_URL || 'http://127.0.0.1:54321', process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '');
    }
    async ingestHuggingFaceData(options = {}) {
        if (config.offlineMode || config.disableExternalCalls) {
            return {
                modelsProcessed: 0,
                datasetsProcessed: 0,
                papersProcessed: 0,
                errors: ['External ingestion disabled in offline mode'],
                startTime: new Date(),
                endTime: new Date(),
            };
        }
        const stats = {
            modelsProcessed: 0,
            datasetsProcessed: 0,
            papersProcessed: 0,
            errors: [],
            startTime: new Date(),
        };
        const { includeModels = true, includeDatasets = true, includePapers = true, modelLimit = 1000, datasetLimit = 500, paperLimit = 200, popularOnly = true, } = options;
        try {
            log.info('🤗 Starting Hugging Face data ingestion', LogContext.AI, {
                includeModels,
                includeDatasets,
                includePapers,
                modelLimit,
                datasetLimit,
                paperLimit,
            });
            if (includeModels) {
                await this.ingestModels(modelLimit, popularOnly, stats);
            }
            if (includeDatasets) {
                await this.ingestDatasets(datasetLimit, popularOnly, stats);
            }
            if (includePapers) {
                await this.ingestPapers(paperLimit, stats);
            }
            stats.endTime = new Date();
            const duration = (stats.endTime.getTime() - stats.startTime.getTime()) / 1000;
            log.info('✅ Hugging Face ingestion completed', LogContext.AI, {
                duration: `${duration}s`,
                modelsProcessed: stats.modelsProcessed,
                datasetsProcessed: stats.datasetsProcessed,
                papersProcessed: stats.papersProcessed,
                errors: stats.errors.length,
            });
        }
        catch (error) {
            stats.errors.push(`Ingestion failed: ${error instanceof Error ? error.message : String(error)}`);
            log.error('❌ Hugging Face ingestion failed', LogContext.AI, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        return stats;
    }
    async ingestModels(limit, popularOnly, stats) {
        if (config.offlineMode || config.disableExternalCalls) {
            return;
        }
        try {
            log.info('📦 Fetching Hugging Face models', LogContext.AI, { limit, popularOnly });
            const sortOptions = popularOnly
                ? ['downloads', 'likes', 'trending']
                : ['downloads', 'likes', 'trending', 'createdAt'];
            for (const sort of sortOptions) {
                const modelsPerPage = Math.min(100, Math.ceil(limit / sortOptions.length));
                try {
                    const url = `${this.baseUrl}/models?limit=${modelsPerPage}&sort=${sort}&direction=-1`;
                    const response = await fetch(url, {
                        headers: {
                            'User-Agent': 'Universal-AI-Tools/1.0',
                        },
                    });
                    if (!response.ok) {
                        stats.errors.push(`Failed to fetch models (${sort}): ${response.status}`);
                        continue;
                    }
                    const models = await response.json();
                    for (const model of models) {
                        try {
                            await this.storeModel(model);
                            stats.modelsProcessed++;
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        catch (error) {
                            stats.errors.push(`Failed to store model ${model.id}: ${error instanceof Error ? error.message : String(error)}`);
                        }
                    }
                    log.info(`✅ Processed ${models.length} models (${sort})`, LogContext.AI);
                }
                catch (error) {
                    stats.errors.push(`Failed to fetch models with sort ${sort}: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        }
        catch (error) {
            stats.errors.push(`Model ingestion failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async ingestDatasets(limit, popularOnly, stats) {
        if (config.offlineMode || config.disableExternalCalls) {
            return;
        }
        try {
            log.info('📊 Fetching Hugging Face datasets', LogContext.AI, { limit, popularOnly });
            const sortOptions = popularOnly
                ? ['downloads', 'likes']
                : ['downloads', 'likes', 'createdAt'];
            for (const sort of sortOptions) {
                const datasetsPerPage = Math.min(100, Math.ceil(limit / sortOptions.length));
                try {
                    const url = `${this.baseUrl}/datasets?limit=${datasetsPerPage}&sort=${sort}&direction=-1`;
                    const response = await fetch(url, {
                        headers: {
                            'User-Agent': 'Universal-AI-Tools/1.0',
                        },
                    });
                    if (!response.ok) {
                        stats.errors.push(`Failed to fetch datasets (${sort}): ${response.status}`);
                        continue;
                    }
                    const datasets = await response.json();
                    for (const dataset of datasets) {
                        try {
                            await this.storeDataset(dataset);
                            stats.datasetsProcessed++;
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        catch (error) {
                            stats.errors.push(`Failed to store dataset ${dataset.id}: ${error instanceof Error ? error.message : String(error)}`);
                        }
                    }
                    log.info(`✅ Processed ${datasets.length} datasets (${sort})`, LogContext.AI);
                }
                catch (error) {
                    stats.errors.push(`Failed to fetch datasets with sort ${sort}: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        }
        catch (error) {
            stats.errors.push(`Dataset ingestion failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async ingestPapers(limit, stats) {
        if (config.offlineMode || config.disableExternalCalls) {
            return;
        }
        try {
            log.info('📚 Fetching Hugging Face papers', LogContext.AI, { limit });
            const response = await fetch(`${this.papersUrl}?limit=${limit}`, {
                headers: {
                    'User-Agent': 'Universal-AI-Tools/1.0',
                },
            });
            if (!response.ok) {
                stats.errors.push(`Failed to fetch papers: ${response.status}`);
                return;
            }
            const papers = await response.json();
            for (const paper of papers) {
                try {
                    await this.storePaper(paper);
                    stats.papersProcessed++;
                    await new Promise((resolve) => setTimeout(resolve, 150));
                }
                catch (error) {
                    stats.errors.push(`Failed to store paper ${paper.id}: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
            log.info(`✅ Processed ${papers.length} papers`, LogContext.AI);
        }
        catch (error) {
            stats.errors.push(`Paper ingestion failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async storeModel(model) {
        const modelDescription = this.buildModelDescription(model);
        const embedding = await this.generateEmbedding(modelDescription);
        const modelData = {
            id: `hf-model-${model.id.replace('/', '-')}`,
            source: 'huggingface-models',
            title: model.id,
            content: modelDescription,
            summary: this.generateModelSummary(model),
            url: `${this.hubUrl}/${model.id}`,
            type: 'ai-model',
            tags: [
                'huggingface',
                'ai-model',
                model.pipeline_tag || 'unknown',
                ...(model.tags || []),
                ...(model.languages || []),
                model.library_name || 'unknown',
            ].filter(Boolean),
            metadata: {
                huggingface_id: model.id,
                author: model.author,
                pipeline_tag: model.pipeline_tag,
                library_name: model.library_name,
                downloads: model.downloads || 0,
                likes: model.likes || 0,
                license: model.license,
                languages: model.languages,
                datasets: model.datasets,
                last_modified: model.lastModified,
                private: model.private || false,
                gated: model.gated || false,
                transformers_info: model.transformersInfo,
                card_data: model.cardData,
                config: model.config,
            },
            embedding,
            created_at: new Date().toISOString(),
        };
        const { error } = await this.supabase.from('knowledge_sources').upsert(modelData, {
            onConflict: 'id',
        });
        if (error) {
            throw new Error(`Failed to store model: ${error.message}`);
        }
    }
    async storeDataset(dataset) {
        const datasetDescription = this.buildDatasetDescription(dataset);
        const embedding = await this.generateEmbedding(datasetDescription);
        const datasetData = {
            id: `hf-dataset-${dataset.id.replace('/', '-')}`,
            source: 'huggingface-datasets',
            title: dataset.id,
            content: datasetDescription,
            summary: this.generateDatasetSummary(dataset),
            url: `${this.hubUrl}/datasets/${dataset.id}`,
            type: 'dataset',
            tags: [
                'huggingface',
                'dataset',
                ...(dataset.tags || []),
                ...(dataset.cardData?.task_categories || []),
                ...(dataset.cardData?.language
                    ? Array.isArray(dataset.cardData.language)
                        ? dataset.cardData.language
                        : [dataset.cardData.language]
                    : []),
                ...(dataset.cardData?.size_categories || []),
            ].filter(Boolean),
            metadata: {
                huggingface_id: dataset.id,
                author: dataset.author,
                downloads: dataset.downloads || 0,
                likes: dataset.likes || 0,
                last_modified: dataset.lastModified,
                private: dataset.private || false,
                gated: dataset.gated || false,
                card_data: dataset.cardData,
                task_categories: dataset.cardData?.task_categories,
                languages: dataset.cardData?.language,
                size_categories: dataset.cardData?.size_categories,
                license: dataset.cardData?.license,
            },
            embedding,
            created_at: new Date().toISOString(),
        };
        const { error } = await this.supabase.from('knowledge_sources').upsert(datasetData, {
            onConflict: 'id',
        });
        if (error) {
            throw new Error(`Failed to store dataset: ${error.message}`);
        }
    }
    async storePaper(paper) {
        const paperContent = this.buildPaperContent(paper);
        const embedding = await this.generateEmbedding(paperContent);
        const paperData = {
            id: `hf-paper-${paper.id}`,
            source: 'huggingface-papers',
            title: paper.title,
            content: paperContent,
            summary: paper.summary || this.generatePaperSummary(paper),
            url: paper.url || `${this.hubUrl}/papers/${paper.id}`,
            type: 'research-paper',
            tags: [
                'huggingface',
                'research-paper',
                'ai-research',
                ...(paper.authors || []).map((author) => `author:${author}`),
                ...(paper.tags || []),
            ].filter(Boolean),
            metadata: {
                huggingface_id: paper.id,
                authors: paper.authors,
                published: paper.published,
                arxiv_id: paper.arxiv_id,
                github: paper.github,
                huggingface: paper.huggingface,
                tags: paper.tags,
            },
            embedding,
            created_at: new Date().toISOString(),
        };
        const { error } = await this.supabase.from('knowledge_sources').upsert(paperData, {
            onConflict: 'id',
        });
        if (error) {
            throw new Error(`Failed to store paper: ${error.message}`);
        }
    }
    async generateEmbedding(text) {
        try {
            const response = await fetch('http://127.0.0.1:54321/functions/v1/ollama-embeddings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({
                    text: text.substring(0, 2000),
                    model: 'all-minilm:latest',
                    userId: 'system',
                }),
            });
            if (response.ok) {
                const { embedding } = await response.json();
                return embedding;
            }
        }
        catch (error) {
            log.warn('Embedding generation failed, using null embedding', LogContext.AI, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        return new Array(1536).fill(0);
    }
    buildModelDescription(model) {
        const parts = [
            `Hugging Face Model: ${model.id}`,
            model.author ? `Author: ${model.author}` : '',
            model.pipeline_tag ? `Pipeline: ${model.pipeline_tag}` : '',
            model.library_name ? `Library: ${model.library_name}` : '',
            model.languages?.length ? `Languages: ${model.languages.join(', ')}` : '',
            model.license ? `License: ${model.license}` : '',
            model.tags?.length ? `Tags: ${model.tags.join(', ')}` : '',
            model.datasets?.length ? `Trained on: ${model.datasets.join(', ')}` : '',
            model.cardData?.model_type ? `Model Type: ${model.cardData.model_type}` : '',
            model.cardData?.base_model
                ? `Base Model: ${Array.isArray(model.cardData.base_model) ? model.cardData.base_model.join(', ') : model.cardData.base_model}`
                : '',
            `Downloads: ${model.downloads || 0}`,
            `Likes: ${model.likes || 0}`,
        ].filter(Boolean);
        return parts.join('\n');
    }
    buildDatasetDescription(dataset) {
        const parts = [
            `Hugging Face Dataset: ${dataset.id}`,
            dataset.author ? `Author: ${dataset.author}` : '',
            dataset.cardData?.pretty_name ? `Name: ${dataset.cardData.pretty_name}` : '',
            dataset.cardData?.task_categories?.length
                ? `Tasks: ${dataset.cardData.task_categories.join(', ')}`
                : '',
            dataset.cardData?.language
                ? `Languages: ${Array.isArray(dataset.cardData.language) ? dataset.cardData.language.join(', ') : dataset.cardData.language}`
                : '',
            dataset.cardData?.size_categories?.length
                ? `Size: ${dataset.cardData.size_categories.join(', ')}`
                : '',
            dataset.cardData?.license ? `License: ${dataset.cardData.license}` : '',
            dataset.tags?.length ? `Tags: ${dataset.tags.join(', ')}` : '',
            `Downloads: ${dataset.downloads || 0}`,
            `Likes: ${dataset.likes || 0}`,
        ].filter(Boolean);
        return parts.join('\n');
    }
    buildPaperContent(paper) {
        const parts = [
            `Research Paper: ${paper.title}`,
            paper.authors?.length ? `Authors: ${paper.authors.join(', ')}` : '',
            paper.published ? `Published: ${paper.published}` : '',
            paper.summary || '',
            paper.arxiv_id ? `ArXiv: ${paper.arxiv_id}` : '',
            paper.github ? `GitHub: ${paper.github}` : '',
            paper.tags?.length ? `Tags: ${paper.tags.join(', ')}` : '',
        ].filter(Boolean);
        return parts.join('\n');
    }
    generateModelSummary(model) {
        const taskType = model.pipeline_tag || 'AI model';
        const author = model.author || 'Unknown';
        const downloads = model.downloads || 0;
        return `${taskType} by ${author} with ${downloads} downloads. ${model.languages?.length ? `Supports ${model.languages.join(', ')}.` : ''} ${model.license ? `Licensed under ${model.license}.` : ''}`.trim();
    }
    generateDatasetSummary(dataset) {
        const name = dataset.cardData?.pretty_name || dataset.id;
        const tasks = dataset.cardData?.task_categories?.join(', ') || 'Various tasks';
        const downloads = dataset.downloads || 0;
        return `${name} dataset for ${tasks} with ${downloads} downloads. ${dataset.cardData?.language ? `Available in ${Array.isArray(dataset.cardData.language) ? dataset.cardData.language.join(', ') : dataset.cardData.language}.` : ''}`.trim();
    }
    generatePaperSummary(paper) {
        const authors = paper.authors?.slice(0, 3).join(', ') || 'Unknown authors';
        const year = paper.published ? new Date(paper.published).getFullYear() : 'Recent';
        return `Research paper by ${authors} (${year}). ${paper.summary?.substring(0, 200) || 'AI/ML research paper from Hugging Face Papers.'}${paper.summary && paper.summary.length > 200 ? '...' : ''}`;
    }
    async getIngestionStats() {
        try {
            const { data: models } = await this.supabase
                .from('knowledge_sources')
                .select('id', { count: 'exact' })
                .eq('source', 'huggingface-models');
            const { data: datasets } = await this.supabase
                .from('knowledge_sources')
                .select('id', { count: 'exact' })
                .eq('source', 'huggingface-datasets');
            const { data: papers } = await this.supabase
                .from('knowledge_sources')
                .select('id', { count: 'exact' })
                .eq('source', 'huggingface-papers');
            const { data: lastIngestion } = await this.supabase
                .from('knowledge_sources')
                .select('created_at')
                .like('source', 'huggingface%')
                .order('created_at', { ascending: false })
                .limit(1);
            const { data: categories } = await this.supabase
                .from('knowledge_sources')
                .select('tags')
                .like('source', 'huggingface%')
                .limit(1000);
            const tagCounts = {};
            categories?.forEach((item) => {
                item.tags?.forEach((tag) => {
                    if (!tag.startsWith('author:') && tag !== 'huggingface') {
                        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                    }
                });
            });
            const topCategories = Object.entries(tagCounts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
                .map(([category, count]) => ({ category, count }));
            return {
                totalModels: models?.length || 0,
                totalDatasets: datasets?.length || 0,
                totalPapers: papers?.length || 0,
                lastIngestion: lastIngestion?.[0]?.created_at
                    ? new Date(lastIngestion[0].created_at)
                    : undefined,
                topCategories,
            };
        }
        catch (error) {
            log.error('Failed to get ingestion stats', LogContext.AI, {
                error: error instanceof Error ? error.message : String(error),
            });
            return {
                totalModels: 0,
                totalDatasets: 0,
                totalPapers: 0,
                topCategories: [],
            };
        }
    }
}
export const huggingFaceIngestionService = new HuggingFaceIngestionService();
export default huggingFaceIngestionService;
//# sourceMappingURL=huggingface-ingestion-service.js.map