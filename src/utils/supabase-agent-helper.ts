/**
 * Supabase Agent Helper Utility
 * Standardized interface for agent interactions with Supabase
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';

// Types
export interface SupabaseRecord {
    user_id: string;
    category: ValidCategory;
    source: string;
    content: string;
    metadata?: Record<string, any>;
    project_path?: string;
    created_at?: string;
}

export interface PatternData {
    name: string;
    description: string;
    content: string;
    type?: string;
    tools?: string[];
    keyConcepts?: string[];
    tags?: string[];
    complexity?: 'beginner' | 'intermediate' | 'advanced';
    year?: string;
    [key: string]: any;
}

export interface SearchOptions {
    limit?: number;
    offset?: number;
    orderBy?: string;
    ascending?: boolean;
}

export interface QueryResult<T = any> {
    success: boolean;
    data?: T;
    error?: any;
    count?: number;
}

// Valid categories from database constraint
export type ValidCategory = 
    | 'conversation'
    | 'project_info' 
    | 'error_analysis'
    | 'code_patterns'
    | 'test_results'
    | 'architecture_patterns';

/**
 * Standardized Supabase helper for agent interactions
 */
export class SupabaseAgentHelper {
    private supabase: SupabaseClient;
    private defaultSource: string;

    constructor(source: string, supabaseUrl?: string, supabaseKey?: string) {
        // Use provided credentials or defaults
        const url = supabaseUrl || process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
        const key = supabaseKey || process.env.SUPABASE_SERVICE_KEY || 
                   'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
        
        this.supabase = createClient(url, key);
        this.defaultSource = source;
    }

    /**
     * Validate record data before insertion
     */
    private validateRecord(record: Partial<SupabaseRecord>): string[] {
        const errors: string[] = [];
        const validCategories: ValidCategory[] = [
            'conversation', 'project_info', 'error_analysis', 
            'code_patterns', 'test_results', 'architecture_patterns'
        ];

        if (!record.user_id) {errors.push('user_id is required');}
        if (!record.category) {errors.push('category is required');}
        if (!record.source) {errors.push('source is required');}
        if (!record.content) {errors.push('content is required');}

        if (record.category && !validCategories.includes(record.category)) {
            errors.push(`Invalid category: ${record.category}. Must be one of: ${validCategories.join(', ')}`);
        }

        if (record.content && typeof record.content === 'string') {
            try {
                JSON.parse(record.content);
            } catch (err) {
                errors.push('content must be valid JSON string');
            }
        }

        return errors;
    }

    /**
     * Generate a standardized user_id based on pattern data
     */
    private generateUserId(patternName: string, category?: string): string {
        const prefix = category || this.defaultSource;
        const suffix = patternName.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '-')
            .substring(0, 50);
        
        return `${prefix}-${suffix}`;
    }

    /**
     * Store a knowledge pattern with standardized structure
     */
    async storePattern(
        patternData: PatternData,
        category: ValidCategory = 'code_patterns',
        customUserId?: string
    ): Promise<QueryResult> {
        try {
            const userId = customUserId || this.generateUserId(patternData.name, category);
            
            const contentObject = {
                ...patternData,
                type: patternData.type || `${this.defaultSource}-pattern`,
                tools: patternData.tools || [],
                key_concepts: patternData.keyConcepts || [],
                tags: patternData.tags || [],
                complexity: patternData.complexity || 'intermediate',
                year: patternData.year || '2025',
                source: this.defaultSource,
                stored_at: new Date().toISOString()
            };

            const record: SupabaseRecord = {
                user_id: userId,
                category,
                source: this.defaultSource,
                content: JSON.stringify(contentObject),
                metadata: {
                    type: contentObject.type,
                    tools: contentObject.tools,
                    tags: contentObject.tags,
                    complexity: contentObject.complexity
                },
                created_at: new Date().toISOString()
            };

            // Validate before insert
            const validationErrors = this.validateRecord(record);
            if (validationErrors.length > 0) {
                return {
                    success: false,
                    error: {
                        message: 'Validation failed',
                        details: validationErrors
                    }
                };
            }

            const { data, error } = await this.supabase
                .from('context_storage')
                .insert(record)
                .select();

            if (error) {
                return { success: false, error };
            }

            return { success: true, data };

        } catch (err) {
            return { success: false, error: err };
        }
    }

    /**
     * Store multiple patterns in batch
     */
    async storePatternsInBatch(
        patterns: PatternData[],
        category: ValidCategory = 'code_patterns'
    ): Promise<{
        total: number;
        successful: number;
        failed: number;
        failedPatterns: string[];
        results: QueryResult[];
    }> {
        const results: QueryResult[] = [];
        const failedPatterns: string[] = [];
        let successful = 0;
        let failed = 0;

        for (const pattern of patterns) {
            const result = await this.storePattern(pattern, category);
            results.push(result);

            if (result.success) {
                console.log(`✅ Successfully stored: ${pattern.name}`);
                successful++;
            } else {
                console.error(`❌ Failed to store ${pattern.name}:`, result.error);
                failedPatterns.push(pattern.name);
                failed++;
            }
        }

        return {
            total: patterns.length,
            successful,
            failed,
            failedPatterns,
            results
        };
    }

    /**
     * Test connection to Supabase
     */
    async testConnection(): Promise<QueryResult> {
        try {
            const { data, error } = await this.supabase
                .from('context_storage')
                .select('id')
                .limit(1);

            if (error) {
                return { success: false, error };
            }

            return { 
                success: true, 
                data: { message: 'Connection successful', recordsFound: data?.length || 0 }
            };

        } catch (err) {
            return { success: false, error: err };
        }
    }

    /**
     * Get statistics about stored data
     */
    async getStatistics(): Promise<QueryResult> {
        try {
            // Get total count
            const { count: totalCount } = await this.supabase
                .from('context_storage')
                .select('*', { count: 'exact', head: true });

            // Get count by category
            const { data: categoryData } = await this.supabase
                .from('context_storage')
                .select('category');

            const categoryCounts = categoryData?.reduce((acc: Record<string, number>, row: any) => {
                acc[row.category] = (acc[row.category] || 0) + 1;
                return acc;
            }, {}) || {};

            // Get count by source
            const { data: sourceData } = await this.supabase
                .from('context_storage')
                .select('source');

            const sourceCounts = sourceData?.reduce((acc: Record<string, number>, row: any) => {
                acc[row.source] = (acc[row.source] || 0) + 1;
                return acc;
            }, {}) || {};

            // Get recent records
            const { data: recentRecords } = await this.supabase
                .from('context_storage')
                .select('user_id, category, source, created_at')
                .order('created_at', { ascending: false })
                .limit(10);

            return {
                success: true,
                data: {
                    totalRecords: totalCount,
                    categoryCounts,
                    sourceCounts,
                    recentRecords: recentRecords || []
                }
            };

        } catch (err) {
            return { success: false, error: err };
        }
    }
}

/**
 * Create a helper instance with default configuration
 */
export function createSupabaseHelper(source: string): SupabaseAgentHelper {
    return new SupabaseAgentHelper(source);
}

/**
 * Utility function for quick pattern storage
 */
export async function quickStorePattern(
    source: string,
    pattern: PatternData,
    category: ValidCategory = 'code_patterns'
): Promise<QueryResult> {
    const helper = new SupabaseAgentHelper(source);
    return await helper.storePattern(pattern, category);
}