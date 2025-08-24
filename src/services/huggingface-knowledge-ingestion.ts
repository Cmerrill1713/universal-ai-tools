/**
 * HuggingFace Knowledge Ingestion Service
 * Uses crawl4ai to scrape HuggingFace models and datasets for knowledge base
 */

import { createClient } from '@supabase/supabase-js';
import { WebSearchService } from './web-search-service.js';
import { chunkingService } from './chunking/chunking-service.js';
import { logger } from '../utils/enhanced-logger.js';

export interface HuggingFaceKnowledge {
  id: string;
  type: 'model' | 'dataset' | 'space' | 'paper';
  name: string;
  url: string;
  description: string;
  content: string;
  metadata: {
    author?: string;
    organization?: string;
    tags?: string[];
    license?: string;
    framework?: string;
    task?: string;
    language?: string[];
    metrics?: Record<string, number>;
    downloads?: number;
    likes?: number;
    updated_at?: string;
    parameters?: string;
    dataset_size?: string;
  };
  extracted_sections?: {
    model_card?: string;
    usage?: string;
    limitations?: string;
    training?: string;
    evaluation?: string;
    examples?: string[];
  };
  chunks?: any[];
  scraped_at: Date;
  processed: boolean;
}

export class HuggingFaceKnowledgeIngestionService {
  private supabase;
  private webSearchService: WebSearchService;
  private readonly baseUrl = 'https://huggingface.co';
  private readonly knowledgeTable = 'knowledge_base';
  
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    this.webSearchService = new WebSearchService();
    logger.info('🤗 HuggingFace Knowledge Ingestion Service initialized');
  }

  /**
   * Ingest a HuggingFace model into knowledge base
   */
  async ingestModel(modelId: string): Promise<{ success: boolean; knowledge?: HuggingFaceKnowledge; error?: string }> {
    try {
      logger.info(`📥 Ingesting HuggingFace model: ${modelId}`);
      
      const url = `${this.baseUrl}/${modelId}`;
      
      // Use crawl4ai to deeply crawl the model page
      const crawlResult = await this.webSearchService.crawlWithAI(url, {
        extractStructured: true,
        includeLinks: true,
        maxDepth: 1,
        waitTime: 3
      });

      if (!crawlResult.success || !crawlResult.content) {
        throw new Error('Failed to crawl model page');
      }

      // Parse the extracted data
      const knowledge = await this.parseModelContent(modelId, url, crawlResult);
      
      // Chunk the content for better retrieval
      const chunks = await this.createKnowledgeChunks(knowledge);
      knowledge.chunks = chunks;

      // Store in knowledge base
      await this.storeKnowledge(knowledge);

      logger.info(`✅ Successfully ingested model: ${modelId}`);
      return { success: true, knowledge };

    } catch (error) {
      logger.error(`Failed to ingest model ${modelId}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Ingest a HuggingFace dataset into knowledge base
   */
  async ingestDataset(datasetId: string): Promise<{ success: boolean; knowledge?: HuggingFaceKnowledge; error?: string }> {
    try {
      logger.info(`📥 Ingesting HuggingFace dataset: ${datasetId}`);
      
      const url = `${this.baseUrl}/datasets/${datasetId}`;
      
      // Use crawl4ai to crawl the dataset page
      const crawlResult = await this.webSearchService.crawlWithAI(url, {
        extractStructured: true,
        includeLinks: false,
        waitTime: 2
      });

      if (!crawlResult.success || !crawlResult.content) {
        throw new Error('Failed to crawl dataset page');
      }

      // Parse the extracted data
      const knowledge = await this.parseDatasetContent(datasetId, url, crawlResult);
      
      // Chunk the content
      const chunks = await this.createKnowledgeChunks(knowledge);
      knowledge.chunks = chunks;

      // Store in knowledge base
      await this.storeKnowledge(knowledge);

      logger.info(`✅ Successfully ingested dataset: ${datasetId}`);
      return { success: true, knowledge };

    } catch (error) {
      logger.error(`Failed to ingest dataset ${datasetId}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Batch ingest multiple models/datasets
   */
  async batchIngest(
    items: { id: string; type: 'model' | 'dataset' }[],
    options?: { concurrency?: number; skipExisting?: boolean }
  ): Promise<{ successful: number; failed: number; results: any[] }> {
    const concurrency = options?.concurrency || 2;
    const results: any[] = [];
    let successful = 0;
    let failed = 0;

    logger.info(`🔄 Starting batch ingestion of ${items.length} items`);

    // Process in batches
    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async item => {
        // Check if already exists
        if (options?.skipExisting) {
          const exists = await this.checkIfExists(item.id, item.type);
          if (exists) {
            logger.info(`⏭️ Skipping existing ${item.type}: ${item.id}`);
            return { id: item.id, type: item.type, status: 'skipped' };
          }
        }

        // Ingest based on type
        const result = item.type === 'model' 
          ? await this.ingestModel(item.id)
          : await this.ingestDataset(item.id);

        if (result.success) {
          successful++;
        } else {
          failed++;
        }

        return { id: item.id, type: item.type, ...result };
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          failed++;
          results.push({ 
            id: 'unknown', 
            type: 'unknown', 
            success: false, 
            error: result.reason 
          });
        }
      }

      // Rate limiting between batches
      if (i + concurrency < items.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    logger.info(`📊 Batch ingestion complete: ${successful} successful, ${failed} failed`);
    return { successful, failed, results };
  }

  /**
   * Search and ingest trending models/datasets
   */
  async ingestTrending(type: 'models' | 'datasets' = 'models', limit = 10): Promise<any> {
    try {
      logger.info(`🔥 Ingesting trending ${type}`);
      
      // Crawl the trending page
      const url = `${this.baseUrl}/${type}?sort=trending`;
      const crawlResult = await this.webSearchService.crawlWithAI(url, {
        extractStructured: true,
        includeLinks: true
      });

      if (!crawlResult.success) {
        throw new Error('Failed to crawl trending page');
      }

      // Extract model/dataset IDs from the page
      const ids = this.extractIdsFromTrendingPage(crawlResult.content, type);
      
      if (ids.length === 0) {
        return { success: false, error: 'No trending items found' };
      }

      // Limit to requested number
      const itemsToIngest = ids.slice(0, limit).map(id => ({
        id,
        type: type === 'models' ? 'model' as const : 'dataset' as const
      }));

      // Batch ingest
      const results = await this.batchIngest(itemsToIngest, { 
        concurrency: 2,
        skipExisting: true 
      });

      return { success: true, ...results };

    } catch (error) {
      logger.error(`Failed to ingest trending ${type}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  private async parseModelContent(modelId: string, url: string, crawlResult: any): Promise<HuggingFaceKnowledge> {
    const extractedData = crawlResult.extractedData || {};
    
    // Extract key information from the crawled content
    const content = crawlResult.content || '';
    const headings = extractedData.headings || [];
    const keyPoints = extractedData.keyPoints || [];
    
    // Parse specific sections
    const sections = this.extractModelSections(content);
    
    // Extract metadata
    const metadata = this.extractModelMetadata(content, extractedData);
    
    return {
      id: modelId,
      type: 'model',
      name: modelId.split('/').pop() || modelId,
      url,
      description: keyPoints[0] || this.extractDescription(content),
      content,
      metadata,
      extracted_sections: sections,
      scraped_at: new Date(),
      processed: true
    };
  }

  private async parseDatasetContent(datasetId: string, url: string, crawlResult: any): Promise<HuggingFaceKnowledge> {
    const extractedData = crawlResult.extractedData || {};
    const content = crawlResult.content || '';
    
    // Extract dataset-specific information
    const sections = this.extractDatasetSections(content);
    const metadata = this.extractDatasetMetadata(content, extractedData);
    
    return {
      id: datasetId,
      type: 'dataset',
      name: datasetId.split('/').pop() || datasetId,
      url,
      description: this.extractDescription(content),
      content,
      metadata,
      extracted_sections: sections,
      scraped_at: new Date(),
      processed: true
    };
  }

  private extractModelSections(content: string): any {
    const sections: any = {};
    
    // Extract model card
    const modelCardMatch = content.match(/#{1,3}\s*Model Card[\s\S]*?(?=#{1,3}|$)/i);
    if (modelCardMatch) sections.model_card = modelCardMatch[0];
    
    // Extract usage section
    const usageMatch = content.match(/#{1,3}\s*(?:Usage|How to use)[\s\S]*?(?=#{1,3}|$)/i);
    if (usageMatch) sections.usage = usageMatch[0];
    
    // Extract limitations
    const limitationsMatch = content.match(/#{1,3}\s*Limitations[\s\S]*?(?=#{1,3}|$)/i);
    if (limitationsMatch) sections.limitations = limitationsMatch[0];
    
    // Extract training details
    const trainingMatch = content.match(/#{1,3}\s*Training[\s\S]*?(?=#{1,3}|$)/i);
    if (trainingMatch) sections.training = trainingMatch[0];
    
    // Extract code examples
    const codeMatches = content.match(/```[\s\S]*?```/g);
    if (codeMatches) sections.examples = codeMatches;
    
    return sections;
  }

  private extractDatasetSections(content: string): any {
    const sections: any = {};
    
    // Extract dataset description
    const descMatch = content.match(/#{1,3}\s*Dataset Description[\s\S]*?(?=#{1,3}|$)/i);
    if (descMatch) sections.description = descMatch[0];
    
    // Extract dataset structure
    const structureMatch = content.match(/#{1,3}\s*(?:Dataset Structure|Data Fields)[\s\S]*?(?=#{1,3}|$)/i);
    if (structureMatch) sections.structure = structureMatch[0];
    
    // Extract usage
    const usageMatch = content.match(/#{1,3}\s*(?:Usage|How to use)[\s\S]*?(?=#{1,3}|$)/i);
    if (usageMatch) sections.usage = usageMatch[0];
    
    return sections;
  }

  private extractModelMetadata(content: string, extractedData: any): any {
    const metadata: any = {};
    
    // Extract tags
    const tagMatches = content.match(/(?:tags?|labels?):\s*([^\n]+)/i);
    if (tagMatches) {
      metadata.tags = tagMatches[1].split(',').map(t => t.trim());
    }
    
    // Extract license
    const licenseMatch = content.match(/license:\s*([^\n]+)/i);
    if (licenseMatch) {
      metadata.license = licenseMatch[1].trim();
    }
    
    // Extract framework
    const frameworkMatch = content.match(/(?:library|framework):\s*([^\n]+)/i);
    if (frameworkMatch) {
      metadata.framework = frameworkMatch[1].trim();
    }
    
    // Extract task
    const taskMatch = content.match(/(?:task|pipeline_tag):\s*([^\n]+)/i);
    if (taskMatch) {
      metadata.task = taskMatch[1].trim();
    }
    
    // Extract parameters
    const paramMatch = content.match(/([\d.]+)\s*(?:billion|million|[BMK])\s*parameters/i);
    if (paramMatch) {
      metadata.parameters = paramMatch[0];
    }
    
    // Add extracted metadata
    if (extractedData.metadata) {
      Object.assign(metadata, extractedData.metadata);
    }
    
    return metadata;
  }

  private extractDatasetMetadata(content: string, extractedData: any): any {
    const metadata: any = {};
    
    // Extract size
    const sizeMatch = content.match(/size:\s*([^\n]+)/i);
    if (sizeMatch) {
      metadata.dataset_size = sizeMatch[1].trim();
    }
    
    // Extract languages
    const langMatch = content.match(/languages?:\s*([^\n]+)/i);
    if (langMatch) {
      metadata.language = langMatch[1].split(',').map(l => l.trim());
    }
    
    // Extract license
    const licenseMatch = content.match(/license:\s*([^\n]+)/i);
    if (licenseMatch) {
      metadata.license = licenseMatch[1].trim();
    }
    
    // Add extracted metadata
    if (extractedData.metadata) {
      Object.assign(metadata, extractedData.metadata);
    }
    
    return metadata;
  }

  private extractDescription(content: string): string {
    // Try to extract first paragraph or summary
    const paragraphs = content.split('\n\n').filter(p => p.length > 50);
    if (paragraphs.length > 0) {
      return paragraphs[0].substring(0, 500);
    }
    return content.substring(0, 500);
  }

  private extractIdsFromTrendingPage(content: string, type: string): string[] {
    const ids: string[] = [];
    
    // Match HuggingFace model/dataset IDs (org/name format)
    const pattern = type === 'models' 
      ? /href="\/([^\/\s"]+\/[^\/\s"]+)"/g
      : /href="\/datasets\/([^\/\s"]+\/[^\/\s"]+)"/g;
    
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const id = match[1];
      if (!ids.includes(id) && !id.includes('?') && !id.includes('#')) {
        ids.push(id);
      }
    }
    
    return ids;
  }

  private async createKnowledgeChunks(knowledge: HuggingFaceKnowledge): Promise<any[]> {
    // Combine all content for chunking
    const fullContent = [
      knowledge.description,
      knowledge.content,
      knowledge.extracted_sections?.model_card,
      knowledge.extracted_sections?.usage,
      knowledge.extracted_sections?.limitations,
      knowledge.extracted_sections?.training
    ].filter(Boolean).join('\n\n');

    const chunkResult = await chunkingService.chunkText(fullContent, {
      maxChunkSize: 1500,
      overlap: 200,
      splitOn: 'paragraph'
    });

    return chunkResult.chunks.map(chunk => ({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        source: 'huggingface',
        source_id: knowledge.id,
        source_type: knowledge.type,
        source_url: knowledge.url
      }
    }));
  }

  private async storeKnowledge(knowledge: HuggingFaceKnowledge): Promise<void> {
    try {
      // Store main knowledge entry
      const { error: mainError } = await this.supabase
        .from(this.knowledgeTable)
        .upsert({
          source: 'huggingface',
          source_id: knowledge.id,
          category: knowledge.type,
          title: knowledge.name,
          content: knowledge.content,
          metadata: knowledge.metadata,
          url: knowledge.url,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'source,source_id'
        });

      if (mainError) {
        logger.error('Failed to store main knowledge entry:', mainError);
      }

      // Store chunks for vector search
      if (knowledge.chunks && knowledge.chunks.length > 0) {
        const chunkEntries = knowledge.chunks.map(chunk => ({
          source: 'huggingface',
          source_id: `${knowledge.id}_chunk_${chunk.index}`,
          category: `${knowledge.type}_chunk`,
          title: `${knowledge.name} - Chunk ${chunk.index}`,
          content: chunk.content,
          metadata: chunk.metadata,
          parent_id: knowledge.id,
          created_at: new Date().toISOString()
        }));

        const { error: chunksError } = await this.supabase
          .from(this.knowledgeTable)
          .insert(chunkEntries);

        if (chunksError) {
          logger.error('Failed to store knowledge chunks:', chunksError);
        }
      }

      logger.info(`💾 Stored knowledge for ${knowledge.type}: ${knowledge.id}`);
    } catch (error) {
      logger.error('Failed to store knowledge:', error);
      throw error;
    }
  }

  private async checkIfExists(id: string, type: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from(this.knowledgeTable)
        .select('source_id')
        .eq('source', 'huggingface')
        .eq('source_id', id)
        .single();

      return !error && !!data;
    } catch {
      return false;
    }
  }

  /**
   * Query ingested HuggingFace knowledge
   */
  async queryKnowledge(query: string, options?: {
    type?: 'model' | 'dataset';
    limit?: number;
    includeChunks?: boolean;
  }): Promise<any[]> {
    try {
      let queryBuilder = this.supabase
        .from(this.knowledgeTable)
        .select('*')
        .eq('source', 'huggingface');

      if (options?.type) {
        queryBuilder = queryBuilder.eq('category', options.type);
      }

      // Text search on content
      queryBuilder = queryBuilder.textSearch('content', query);

      if (options?.limit) {
        queryBuilder = queryBuilder.limit(options.limit);
      }

      const { data, error } = await queryBuilder;

      if (error) {
        logger.error('Failed to query knowledge:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Error querying knowledge:', error);
      return [];
    }
  }
}

export const huggingFaceKnowledgeIngestion = new HuggingFaceKnowledgeIngestionService();