// Supabase Edge Function for File Processing
// Handles AI processing of uploaded files

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Configuration, OpenAIApi } from 'https://esm.sh/openai@3.2.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessingOptions {
  extractText?: boolean;
  generateEmbeddings?: boolean;
  detectObjects?: boolean;
  extractMetadata?: boolean;
  generateSummary?: boolean;
  classifyContent?: boolean;
  extractEntities?: boolean;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { fileId, processingType, options } = await req.json();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Initialize OpenAI
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
    const configuration = new Configuration({ apiKey: openaiApiKey });
    const openai = new OpenAIApi(configuration);

    // Get file metadata
    const { data: fileData, error: fileError } = await supabase
      .from('file_metadata')
      .select('*')
      .eq('id', fileId)
      .single();

    if (fileError || !fileData) {
      throw new Error('File not found');
    }

    // Download file from storage
    const { data: fileContent, error: downloadError } = await supabase.storage
      .from(fileData.bucket)
      .download(fileData.path);

    if (downloadError) {
      throw new Error('Failed to download file');
    }

    // Process based on options
    const results: any = {
      fileId,
      processingType,
      results: {}
    };

    // Extract text content
    if (options?.extractText) {
      // For demo, we'll use a simple text extraction
      // In production, use specialized libraries for PDFs, images, etc.
      const text = await fileContent.text();
      results.results.text = text;
    }

    // Generate embeddings
    if (options?.generateEmbeddings && results.results.text) {
      const embeddingResponse = await openai.createEmbedding({
        model: 'text-embedding-ada-002',
        input: results.results.text,
      });

      const embedding = embeddingResponse.data.data[0].embedding;
      
      // Store embedding in database
      await supabase.from('document_embeddings').insert({
        file_id: fileId,
        content: results.results.text,
        embedding,
        metadata: { processingType }
      });

      results.results.embeddingGenerated = true;
    }

    // Generate summary
    if (options?.generateSummary && results.results.text) {
      const summaryResponse = await openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that creates concise summaries.'
          },
          {
            role: 'user',
            content: `Please summarize the following text:\n\n${results.results.text}`
          }
        ],
        max_tokens: 500
      });

      results.results.summary = summaryResponse.data.choices[0].message?.content;
    }

    // Extract entities
    if (options?.extractEntities && results.results.text) {
      const entityResponse = await openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Extract named entities (people, organizations, locations, dates) from the text and return as JSON.'
          },
          {
            role: 'user',
            content: results.results.text
          }
        ],
        max_tokens: 1000
      });

      try {
        results.results.entities = JSON.parse(entityResponse.data.choices[0].message?.content || '{}');
      } catch {
        results.results.entities = { error: 'Failed to parse entities' };
      }
    }

    // Classify content
    if (options?.classifyContent && results.results.text) {
      const classificationResponse = await openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Classify the document into categories and provide confidence scores. Return as JSON with categories and scores.'
          },
          {
            role: 'user',
            content: results.results.text
          }
        ],
        max_tokens: 500
      });

      try {
        results.results.classification = JSON.parse(classificationResponse.data.choices[0].message?.content || '{}');
      } catch {
        results.results.classification = { error: 'Failed to parse classification' };
      }
    }

    // Store processing results
    await supabase.from('ai_processing_results').insert({
      file_id: fileId,
      processing_type: processingType,
      results: results.results,
      model_used: 'gpt-3.5-turbo',
      processing_time_ms: Date.now() - new Date(fileData.created_at).getTime()
    });

    // Update file metadata
    await supabase
      .from('file_metadata')
      .update({
        processing_status: 'completed',
        processed_data: results.results
      })
      .eq('id', fileId);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error processing file:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});