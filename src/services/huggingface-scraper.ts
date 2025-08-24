/**
 * HuggingFace Document Scraper Service
 * Advanced scraping for HuggingFace model cards, datasets, and documentation
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../utils/enhanced-logger.js';
import { chunkingService } from './chunking/chunking-service.js';

export interface HFModelCard {
  id: string;
  name: string;
  description: string;
  tags: string[];
  pipeline_tag?: string;
  library_name?: string;
  parameters?: {
    total: number;
    architecture: string;
  };
  metrics?: {
    [key: string]: {
      value: number;
      dataset: string;
    };
  };
  usage_examples?: string[];
  limitations?: string[];
  bias_analysis?: string;
  training_data?: string;
  license?: string;
  readme_content?: string;
  created_at?: string;
  updated_at?: string;
  downloads?: number;
  likes?: number;
}

export interface HFDataset {
  id: string;
  name: string;
  description: string;
  tags: string[];
  size?: string;
  format?: string[];
  languages?: string[];
  license?: string;
  citation?: string;
  features?: Record<string, any>;
  splits?: Record<string, any>;
  readme_content?: string;
  downloads?: number;
  likes?: number;
}

export interface ScrapingResult {
  success: boolean;
  data?: HFModelCard | HFDataset;
  error?: string;
  chunks?: any[];
  processing_time_ms: number;
}

export class HuggingFaceScraperService {
  private readonly baseUrl = 'https://huggingface.co';
  private readonly apiUrl = 'https://huggingface.co/api';
  private readonly timeout = 30000; // 30 seconds

  constructor() {
    logger.info('HuggingFace Scraper Service initialized');
  }

  /**
   * Scrape a HuggingFace model card with full metadata
   */
  async scrapeModelCard(modelId: string): Promise<ScrapingResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Scraping HuggingFace model: ${modelId}`);

      // Get model metadata from API
      const apiData = await this.fetchModelAPI(modelId);
      
      // Scrape the model page for additional content
      const pageData = await this.scrapeModelPage(modelId);

      // Combine API and scraped data
      const modelCard: HFModelCard = {
        id: modelId,
        name: apiData.modelId || modelId,
        description: pageData.description || apiData.description || '',
        tags: [...(apiData.tags || []), ...(pageData.tags || [])],
        pipeline_tag: apiData.pipeline_tag,
        library_name: apiData.library_name,
        parameters: pageData.parameters || this.extractParameters(apiData),
        metrics: pageData.metrics || {},
        usage_examples: pageData.usage_examples || [],
        limitations: pageData.limitations || [],
        bias_analysis: pageData.bias_analysis,
        training_data: pageData.training_data,
        license: apiData.license || pageData.license,
        readme_content: pageData.readme_content,
        created_at: apiData.created_at,
        updated_at: apiData.lastModified,
        downloads: apiData.downloads,
        likes: apiData.likes
      };

      // Chunk the content for better processing
      const chunks = await this.chunkModelContent(modelCard);

      const processingTime = Date.now() - startTime;
      
      logger.info(`Successfully scraped model ${modelId} in ${processingTime}ms`);
      
      return {
        success: true,
        data: modelCard,
        chunks,
        processing_time_ms: processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error(`Failed to scrape model ${modelId}:`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processing_time_ms: processingTime
      };
    }
  }

  /**
   * Scrape a HuggingFace dataset
   */
  async scrapeDataset(datasetId: string): Promise<ScrapingResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Scraping HuggingFace dataset: ${datasetId}`);

      // Get dataset metadata from API
      const apiData = await this.fetchDatasetAPI(datasetId);
      
      // Scrape the dataset page
      const pageData = await this.scrapeDatasetPage(datasetId);

      const dataset: HFDataset = {
        id: datasetId,
        name: apiData.id || datasetId,
        description: pageData.description || apiData.description || '',
        tags: [...(apiData.tags || []), ...(pageData.tags || [])],
        size: pageData.size || this.formatSize(apiData.size),
        format: pageData.format || [],
        languages: pageData.languages || [],
        license: apiData.license || pageData.license,
        citation: pageData.citation,
        features: apiData.features,
        splits: apiData.splits,
        readme_content: pageData.readme_content,
        downloads: apiData.downloads,
        likes: apiData.likes
      };

      // Chunk the dataset content
      const chunks = await this.chunkDatasetContent(dataset);

      const processingTime = Date.now() - startTime;
      
      logger.info(`Successfully scraped dataset ${datasetId} in ${processingTime}ms`);
      
      return {
        success: true,
        data: dataset,
        chunks,
        processing_time_ms: processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error(`Failed to scrape dataset ${datasetId}:`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processing_time_ms: processingTime
      };
    }
  }

  /**
   * Batch scrape multiple models/datasets
   */
  async batchScrape(items: string[], type: 'model' | 'dataset' = 'model', concurrency = 3): Promise<ScrapingResult[]> {
    logger.info(`Starting batch scrape of ${items.length} ${type}s with concurrency ${concurrency}`);
    
    const results: ScrapingResult[] = [];
    
    // Process in batches to avoid overwhelming the API
    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency);
      
      const batchPromises = batch.map(item => 
        type === 'model' ? this.scrapeModelCard(item) : this.scrapeDataset(item)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            error: result.reason?.message || 'Batch processing failed',
            processing_time_ms: 0
          });
        }
      }
      
      // Rate limiting: wait between batches
      if (i + concurrency < items.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    logger.info(`Batch scrape completed: ${results.filter(r => r.success).length}/${items.length} successful`);
    return results;
  }

  private async fetchModelAPI(modelId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.apiUrl}/models/${modelId}`, {
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Universal-AI-Tools/1.0 (+https://github.com/your-repo)'
        }
      });
      return response.data;
    } catch (error) {
      logger.warn(`API fetch failed for model ${modelId}, will scrape page only`);
      return {};
    }
  }

  private async fetchDatasetAPI(datasetId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.apiUrl}/datasets/${datasetId}`, {
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Universal-AI-Tools/1.0 (+https://github.com/your-repo)'
        }
      });
      return response.data;
    } catch (error) {
      logger.warn(`API fetch failed for dataset ${datasetId}, will scrape page only`);
      return {};
    }
  }

  private async scrapeModelPage(modelId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/${modelId}`, {
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Universal-AI-Tools/1.0 (+https://github.com/your-repo)'
        }
      });

      const $ = cheerio.load(response.data);
      
      return {
        description: this.extractDescription($),
        tags: this.extractTags($),
        parameters: this.extractParametersFromPage($),
        metrics: this.extractMetrics($),
        usage_examples: this.extractUsageExamples($),
        limitations: this.extractLimitations($),
        bias_analysis: this.extractBiasAnalysis($),
        training_data: this.extractTrainingData($),
        license: this.extractLicense($),
        readme_content: this.extractReadmeContent($)
      };
    } catch (error) {
      logger.warn(`Page scraping failed for model ${modelId}:`, error);
      return {};
    }
  }

  private async scrapeDatasetPage(datasetId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/datasets/${datasetId}`, {
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Universal-AI-Tools/1.0 (+https://github.com/your-repo)'
        }
      });

      const $ = cheerio.load(response.data);
      
      return {
        description: this.extractDescription($),
        tags: this.extractTags($),
        size: this.extractDatasetSize($),
        format: this.extractDatasetFormat($),
        languages: this.extractLanguages($),
        license: this.extractLicense($),
        citation: this.extractCitation($),
        readme_content: this.extractReadmeContent($)
      };
    } catch (error) {
      logger.warn(`Page scraping failed for dataset ${datasetId}:`, error);
      return {};
    }
  }

  // Content extraction methods
  private extractDescription($: cheerio.CheerioAPI): string {
    return $('.prose .mb-2').first().text().trim() || 
           $('meta[name="description"]').attr('content') || '';
  }

  private extractTags($: cheerio.CheerioAPI): string[] {
    const tags: string[] = [];
    $('.tag').each((_, element) => {
      const tag = $(element).text().trim();
      if (tag) {tags.push(tag);}
    });
    return [...new Set(tags)];
  }

  private extractParametersFromPage($: cheerio.CheerioAPI): any {
    const paramText = $('.text-sm:contains("parameters")').text();
    const match = paramText.match(/([\d.]+)([BMK]?)\s*parameters/i);
    
    if (match) {
      const [, num, unit] = match;
      const multiplier = { 'B': 1e9, 'M': 1e6, 'K': 1e3 }[unit] || 1;
      return {
        total: parseFloat(num) * multiplier,
        architecture: this.extractArchitecture($)
      };
    }
    return undefined;
  }

  private extractArchitecture($: cheerio.CheerioAPI): string {
    return $('.text-sm:contains("architecture")').text().replace(/.*architecture:\s*/i, '').trim() ||
           $('.text-sm:contains("model_type")').text().replace(/.*model_type:\s*/i, '').trim() ||
           'unknown';
  }

  private extractMetrics($: cheerio.CheerioAPI): Record<string, any> {
    const metrics: Record<string, any> = {};
    
    $('.metric').each((_, element) => {
      const name = $(element).find('.metric-name').text().trim();
      const value = parseFloat($(element).find('.metric-value').text().trim());
      const dataset = $(element).find('.metric-dataset').text().trim();
      
      if (name && !isNaN(value)) {
        metrics[name] = { value, dataset };
      }
    });
    
    return metrics;
  }

  private extractUsageExamples($: cheerio.CheerioAPI): string[] {
    const examples: string[] = [];
    
    $('code').each((_, element) => {
      const code = $(element).text().trim();
      if (code.length > 50 && (code.includes('transformers') || code.includes('pipeline'))) {
        examples.push(code);
      }
    });
    
    return examples;
  }

  private extractLimitations($: cheerio.CheerioAPI): string[] {
    const limitations: string[] = [];
    
    $('h2:contains("Limitations"), h3:contains("Limitations")').next().find('li').each((_, element) => {
      const limitation = $(element).text().trim();
      if (limitation) {limitations.push(limitation);}
    });
    
    return limitations;
  }

  private extractBiasAnalysis($: cheerio.CheerioAPI): string {
    return $('h2:contains("Bias"), h3:contains("Bias")').next().text().trim() || '';
  }

  private extractTrainingData($: cheerio.CheerioAPI): string {
    return $('h2:contains("Training"), h3:contains("Training")').next().text().trim() || '';
  }

  private extractLicense($: cheerio.CheerioAPI): string {
    return $('.license').text().trim() || 
           $(':contains("License:")').next().text().trim() || '';
  }

  private extractReadmeContent($: cheerio.CheerioAPI): string {
    return $('.prose').html() || $('.readme').html() || '';
  }

  private extractDatasetSize($: cheerio.CheerioAPI): string {
    return $('.text-sm:contains("size")').text().replace(/.*size:\s*/i, '').trim() || '';
  }

  private extractDatasetFormat($: cheerio.CheerioAPI): string[] {
    const formats: string[] = [];
    $('.text-sm:contains("format")').each((_, element) => {
      const format = $(element).text().replace(/.*format:\s*/i, '').trim();
      if (format) {formats.push(format);}
    });
    return formats;
  }

  private extractLanguages($: cheerio.CheerioAPI): string[] {
    const languages: string[] = [];
    $('.language-tag').each((_, element) => {
      const lang = $(element).text().trim();
      if (lang) {languages.push(lang);}
    });
    return languages;
  }

  private extractCitation($: cheerio.CheerioAPI): string {
    return $('h2:contains("Citation"), h3:contains("Citation")').next().text().trim() || '';
  }

  private extractParameters(apiData: any): any {
    if (apiData.config?.parameters) {
      return {
        total: apiData.config.parameters,
        architecture: apiData.config.model_type || 'unknown'
      };
    }
    return undefined;
  }

  private formatSize(bytes: number): string {
    if (!bytes) {return '';}
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  private async chunkModelContent(modelCard: HFModelCard): Promise<any[]> {
    const content = [
      modelCard.description,
      modelCard.readme_content,
      modelCard.limitations?.join('\n'),
      modelCard.bias_analysis,
      modelCard.training_data
    ].filter(Boolean).join('\n\n');

    if (!content) {return [];}

    const result = await chunkingService.chunkText(content, {
      maxChunkSize: 1000,
      overlap: 100,
      splitOn: 'paragraph'
    });

    return result.chunks.map(chunk => ({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        source: 'huggingface_model',
        model_id: modelCard.id,
        type: 'model_documentation'
      }
    }));
  }

  private async chunkDatasetContent(dataset: HFDataset): Promise<any[]> {
    const content = [
      dataset.description,
      dataset.readme_content,
      dataset.citation
    ].filter(Boolean).join('\n\n');

    if (!content) {return [];}

    const result = await chunkingService.chunkText(content, {
      maxChunkSize: 1000,
      overlap: 100,
      splitOn: 'paragraph'
    });

    return result.chunks.map(chunk => ({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        source: 'huggingface_dataset',
        dataset_id: dataset.id,
        type: 'dataset_documentation'
      }
    }));
  }
}

export const huggingFaceScraperService = new HuggingFaceScraperService();