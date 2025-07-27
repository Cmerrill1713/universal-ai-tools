import { Router } from 'express';
import type { Supabase.Client } from '@supabase/supabase-js';
import { z } from 'zod';
import { logger } from './utils/logger';
import { validate.Request } from './schemas/api-schemas'// Request schemas;
const Search.Docs.Schema = zobject({
  query: zstring()min(1)max(500),
  category: zstring()optional(),
  language: zstring()optional(),
  tags: zarray(zstring())optional(),
  limit: znumber()min(1)max(50)default(10)}),
const GetFeature.Docs.Schema = zobject({
  category: zstring()optional(),
  include.Examples: zboolean()default(true)}),
const GetIntegration.Patterns.Schema = zobject({
  language: zstring()optional(),
  framework: zstring()optional(),
  features: zarray(zstring())optional()}),
export function Documentation.Router(supabase: Supabase.Client) {
  const router = Router()// Search code snippets;
  routerpost('/search/snippets', validate.Request(Search.Docs.Schema), async (req: any, res) => {
    try {
      const { query, category, language, tags, limit } = reqvalidated.Data;
      const { data, error } = await supabaserpc('search_code_snippets', {
        search_query: query,
        filter_language: language,
        filter_category: category,
        filter_tags: tags,
        limit_count: limit}),
      if (error) throw error// Increment usage count for returned snippets;
      if (data && datalength > 0) {
        await Promiseall(
          datamap((snippet: any) =>
            supabaserpc('increment_snippet_usage', { snippet_id: snippetid }))),

      resjson({
        success: true,
        data: {
          snippets: data || [],
          query;
          count: data?length || 0,
}        metadata: {
          api.Version: 'v1',
          timestamp: new Date()toIS.O.String(),
        }})} catch (error instanceof Error ? errormessage : String(error) any) {
      loggererror('Error searching code snippets:', error);
      resstatus(500)json({
        success: false,
        error instanceof Error ? errormessage : String(error) {
          code: 'SEARCH_ERR.O.R',
          message: 'Failed to search code snippets',
          details: errormessage,
        }})}})// Get Supabase feature documentation;
  routerget('/supabase/features', validate.Request(GetFeature.Docs.Schema), async (req: any, res) => {
    try {
      const { category, include.Examples } = reqvalidated.Data;
      const { data, error } = await supabaserpc('get_supabase_feature_docs', {
        feature_category: category,
        include_examples: include.Examples}),
      if (error) throw error;
      resjson({
        success: true,
        data: {
          features: data || [],
          category;
          count: data?length || 0,
}        metadata: {
          api.Version: 'v1',
          timestamp: new Date()toIS.O.String(),
        }})} catch (error instanceof Error ? errormessage : String(error) any) {
      loggererror('Error fetching Supabase features:', error);
      resstatus(500)json({
        success: false,
        error instanceof Error ? errormessage : String(error) {
          code: 'FETCH_ERR.O.R',
          message: 'Failed to fetch Supabase feature documentation',
          details: errormessage,
        }})}})// Get integration patterns;
  routerget(
    '/integration-patterns';
    validate.Request(GetIntegration.Patterns.Schema);
    async (req: any, res) => {
      try {
        const { language, framework, features } = reqvalidated.Data;
        const { data, error } = await supabaserpc('get_integration_patterns', {
          filter_language: language,
          filter_framework: framework,
          filter_features: features}),
        if (error) throw error;
        resjson({
          success: true,
          data: {
            patterns: data || [],
            filters: { language, framework, features ;
            count: data?length || 0,
}          metadata: {
            api.Version: 'v1',
            timestamp: new Date()toIS.O.String(),
          }})} catch (error instanceof Error ? errormessage : String(error) any) {
        loggererror('Error fetching integration patterns:', error);
        resstatus(500)json({
          success: false,
          error instanceof Error ? errormessage : String(error) {
            code: 'FETCH_ERR.O.R',
            message: 'Failed to fetch integration patterns',
            details: errormessage,
          }})}})// Get all available categories;
  routerget('/categories', async (req, res) => {
    try {
      const { data: features, error instanceof Error ? errormessage : String(error) features.Error } = await supabase;
        from('supabase_features');
        select('category');
        order('category');
      if (features.Error) throw features.Error;
      const categories = [.new Set(features?map((f) => fcategory) || [])];
      const { data: languages, error instanceof Error ? errormessage : String(error) lang.Error } = await supabase;
        from('ai_code_snippets');
        select('language');
        order('language');
      if (lang.Error) throw lang.Error;
      const unique.Languages = [.new Set(languages?map((l) => llanguage) || [])];
      resjson({
        success: true,
        data: {
          categories;
          languages: unique.Languages,
          frameworks: [
            'React';
            'Vue';
            'Angular';
            'Nextjs';
            'Nuxt';
            'Svelte.Kit';
            'Flutter';
            'React Native'];
}        metadata: {
          api.Version: 'v1',
          timestamp: new Date()toIS.O.String(),
        }})} catch (error instanceof Error ? errormessage : String(error) any) {
      loggererror('Error fetching categories:', error);
      resstatus(500)json({
        success: false,
        error instanceof Error ? errormessage : String(error) {
          code: 'FETCH_ERR.O.R',
          message: 'Failed to fetch categories',
          details: errormessage,
        }})}})// Get specific code example;
  routerget('/examples/:id', async (req, res) => {
    try {
      const { id } = reqparams;
      const { data, error } = await supabase;
        from('ai_code_examples');
        select('*');
        eq('id', id);
        single();
      if (error) {
        if (errorcode === 'PGR.S.T116') {
          return resstatus(404)json({
            success: false,
            error instanceof Error ? errormessage : String(error) {
              code: 'NOT_FOU.N.D',
              message: 'Code example not found',
            }});
        throw error;

      resjson({
        success: true,
        data: { example: data ,
        metadata: {
          api.Version: 'v1',
          timestamp: new Date()toIS.O.String(),
        }})} catch (error instanceof Error ? errormessage : String(error) any) {
      loggererror('Error fetching code example:', error);
      resstatus(500)json({
        success: false,
        error instanceof Error ? errormessage : String(error) {
          code: 'FETCH_ERR.O.R',
          message: 'Failed to fetch code example',
          details: errormessage,
        }})}})// Get popular snippets;
  routerget('/snippets/popular', async (req, res) => {
    try {
      const limit = parse.Int(reqquerylimit as string, 10) || 10;
      const category = reqquerycategory as string;
      let query = supabase;
        from('ai_code_snippets');
        select('*');
        order('usage_count', { ascending: false }),
        limit(limit);
      if (category) {
        query = queryeq('category', category);

      const { data, error } = await query;
      if (error) throw error;
      resjson({
        success: true,
        data: {
          snippets: data || [],
          count: data?length || 0,
}        metadata: {
          api.Version: 'v1',
          timestamp: new Date()toIS.O.String(),
        }})} catch (error instanceof Error ? errormessage : String(error) any) {
      loggererror('Error fetching popular snippets:', error);
      resstatus(500)json({
        success: false,
        error instanceof Error ? errormessage : String(error) {
          code: 'FETCH_ERR.O.R',
          message: 'Failed to fetch popular snippets',
          details: errormessage,
        }})}})// Submit new code snippet;
  routerpost('/snippets', async (req: any, res) => {
    try {
      const schema = zobject({
        title: zstring()min(1)max(255),
        description: zstring()optional(),
        language: zstring()min(1)max(50),
        code: zstring()min(1),
        category: zstring()optional(),
        subcategory: zstring()optional(),
        tags: zarray(zstring())optional()}),
      const data = schemaparse(reqbody);
      const { data: snippet, error } = await supabase;
        from('ai_code_snippets');
        insert({
          .data;
          metadata: {
            source: 'user_submission',
            submitted_by: reqai.Service.Id,
            submitted_at: new Date()toIS.O.String(),
          }});
        select();
        single();
      if (error) throw error;
      resjson({
        success: true,
        data: { snippet ,
        metadata: {
          api.Version: 'v1',
          timestamp: new Date()toIS.O.String(),
        }})} catch (error instanceof Error ? errormessage : String(error) any) {
      loggererror('Error creating code snippet:', error);
      resstatus(500)json({
        success: false,
        error instanceof Error ? errormessage : String(error) {
          code: 'CREATE_ERR.O.R',
          message: 'Failed to create code snippet',
          details: errormessage,
        }})}})// Get Supabase quick start guide;
  routerget('/quickstart/:feature', async (req, res) => {
    try {
      const { feature } = reqparams;
      const { framework } = reqquery// Get feature documentation;
      const { data: feature.Docs, error instanceof Error ? errormessage : String(error) feature.Error } = await supabase;
        from('supabase_features');
        select('*');
        eq('feature_name', feature);
        single();
      if (feature.Error) {
        if (feature.Errorcode === 'PGR.S.T116') {
          return resstatus(404)json({
            success: false,
            error instanceof Error ? errormessage : String(error) {
              code: 'NOT_FOU.N.D',
              message: `Feature '${feature}' not found`}}),
        throw feature.Error}// Get relevant code snippets;
      const { data: snippets } = await supabase,
        from('ai_code_snippets');
        select('*');
        eq('category', feature);
        limit(5)// Get integration pattern if framework specified;
      let pattern = null;
      if (framework) {
        const { data: patterns } = await supabase,
          from('supabase_integration_patterns');
          select('*');
          contains('frameworks', [framework as string]);
          contains('features_used', [feature]);
          limit(1);
        pattern = patterns?.[0] || null;

      resjson({
        success: true,
        data: {
          feature: feature.Docs,
          snippets: snippets || [],
          pattern;
          quickstart: {
            steps: feature.Docssetup_instructions,
            prerequisites: feature.Docsprerequisites,
            best.Practices: feature.Docsbest_practices,
          };
        metadata: {
          api.Version: 'v1',
          timestamp: new Date()toIS.O.String(),
        }})} catch (error instanceof Error ? errormessage : String(error) any) {
      loggererror('Error fetching quickstart guide:', error);
      resstatus(500)json({
        success: false,
        error instanceof Error ? errormessage : String(error) {
          code: 'FETCH_ERR.O.R',
          message: 'Failed to fetch quickstart guide',
          details: errormessage,
        }})}});
  return router;
