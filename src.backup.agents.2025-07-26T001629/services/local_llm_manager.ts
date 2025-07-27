import { Ollama.Service } from './ollama_service';
import { LMStudio.Service } from './lm_studio_service';
import { logger } from './utils/logger'/**
 * Local LL.M Manager* Manages both Ollama and L.M Studio for local LL.M inference* Automatically selects the best available local option*/
export class LocalLLM.Manager {
  private ollama: Ollama.Service;
  private lm.Studio: LMStudio.Service;
  private preferred.Service: 'ollama' | 'lm-studio' | null = null;
  constructor() {
    thisollama = new Ollama.Service();
    thislm.Studio = new LMStudio.Service();
    thisinitialize();
  };

  private async initialize() {
    // Check which services are available;
    const [ollama.Health, lmStudio.Health] = await Promiseall([
      thisollamahealth.Check()catch(() => ({ status: 'unhealthy' }));
      thislmStudiohealth.Check()catch(() => ({ status: 'unhealthy' }))]);
    loggerinfo('🖥️ Local LL.M Status:');
    loggerinfo(`  - Ollama: ${ollama.Healthstatus}`);
    loggerinfo(`  - L.M Studio: ${lmStudio.Healthstatus}`)// Set preferred service based on availability;
    if (lmStudio.Healthstatus === 'healthy') {
      thispreferred.Service = 'lm-studio';
      loggerinfo('  ✓ Using L.M Studio as primary local LL.M')} else if (ollama.Healthstatus === 'healthy') {
      thispreferred.Service = 'ollama';
      loggerinfo('  ✓ Using Ollama as primary local LL.M')} else {
      loggerwarn('  ⚠️ No local LL.M services available')}}/**
   * Get available local models from all services*/
  async getAvailable.Models(): Promise<
    Array<{
      id: string;
      name: string;
      service: 'ollama' | 'lm-studio';
      size?: string;
      quantization?: string}>
  > {
    const models: any[] = []// Get Ollama models;
    try {
      const ollama.Models = await thisollamalist.Models();
      modelspush(
        .ollama.Modelsmap((m) => ({
          id: `ollama:${mname}`;
          name: mname;
          service: 'ollama' as const;
          size: msize;
          quantization: mdetails?quantization_level})))} catch (error) {
      loggerdebug(
        'Could not fetch Ollama models: ';
        error instanceof Error ? errormessage : String(error);
    }// Get L.M Studio models;
    try {
      const lmStudio.Models = await thislmStudioget.Models();
      modelspush(
        .lmStudio.Modelsmap((m) => ({
          id: `lm-studio:${m}`;
          name: m;
          service: 'lm-studio' as const})))} catch (error) {
      loggerdebug(
        'Could not fetch L.M Studio models: ';
        error instanceof Error ? errormessage : String(error);
    };

    return models}/**
   * Generate completion using the best available local service*/
  async generate(params: {
    prompt?: string;
    messages?: Array<{ role: string, contentstring }>
    model?: string;
    temperature?: number;
    max_tokens?: number;
    service?: 'ollama' | 'lm-studio';
    fallback?: boolean}): Promise<{
    contentstring;
    model: string;
    service: 'ollama' | 'lm-studio';
    usage?: any}> {
    // Determine which service to use;
    let service = paramsservice || thispreferred.Service;
    if (!service) {
      throw new Error('No local LL.M service available')}// Extract model name if service prefix is included;
    let model.Name = paramsmodel;
    if (model.Name?includes(':')) {
      const [service.Prefix, name] = model.Namesplit(':');
      if (service.Prefix === 'ollama' || service.Prefix === 'lm-studio') {
        service = service.Prefix as 'ollama' | 'lm-studio';
        model.Name = name}};

    try {
      if (service === 'lm-studio') {
        const result = await thislmStudiogenerate.Completion({
          .params;
          model: model.Name});
        return {
          .result;
          service: 'lm-studio';
        }} else {
        const result = await thisollamagenerate({
          model: model.Name || 'llama2';
          prompt: paramsprompt;
          messages: paramsmessages;
          options: {
            temperature: paramstemperature;
            num_predict: paramsmax_tokens;
          }});
        return {
          contentresultresponse;
          model: resultmodel;
          service: 'ollama';
          usage: {
            prompt_tokens: resultprompt_eval_count;
            completion_tokens: resulteval_count;
            total_tokens: (resultprompt_eval_count || 0) + (resulteval_count || 0);
          }}}} catch (error) {
      loggererror`${service} generation failed:`, error instanceof Error ? errormessage : String(error)// Try fallback if enabled;
      if (paramsfallback && !paramsservice) {
        const fallback.Service = service === 'ollama' ? 'lm-studio' : 'ollama';
        loggerinfo(`Attempting fallback to ${fallback.Service}`);
        return thisgenerate({
          .params;
          service: fallback.Service;
          fallback: false, // Prevent infinite recursion})};

      throw error instanceof Error ? errormessage : String(error)}}/**
   * Stream completion from local LL.M*/
  async stream(params: {
    prompt?: string;
    messages?: Array<{ role: string, contentstring }>
    model?: string;
    temperature?: number;
    max_tokens?: number;
    service?: 'ollama' | 'lm-studio';
    on.Token?: (token: string) => void;
    on.Complete?: (full: string) => void}): Promise<void> {
    const service = paramsservice || thispreferred.Service;
    if (!service) {
      throw new Error('No local LL.M service available')};

    if (service === 'lm-studio') {
      await thislmStudiostream.Completion(params)} else {
      // Implement Ollama streaming;
      let full.Response = '';
      await thisollamagenerate(
        {
          model: paramsmodel || 'llama2';
          prompt: paramsprompt;
          messages: paramsmessages;
          stream: true;
          options: {
            temperature: paramstemperature;
            num_predict: paramsmax_tokens;
          }};
        (chunk) => {
          if (paramson.Token) {
            paramson.Token(chunkresponse)};
          full.Response += chunkresponse;
          if (chunkdone && paramson.Complete) {
            paramson.Complete(full.Response)}})}}/**
   * Generate embeddings using local models*/
  async generate.Embedding(
    inputstring | string[];
    service?: 'ollama' | 'lm-studio'): Promise<number[][]> {
    const selected.Service = service || thispreferred.Service;
    if (!selected.Service) {
      throw new Error('No local LL.M service available')};

    if (selected.Service === 'lm-studio') {
      return thislmStudiogenerate.Embedding(input} else {
      // Ollama embedding support;
      const model = 'nomic-embed-text', // Or another embedding model;
      const inputs = Array.is.Array(input? input [input;

      const embeddings = await Promiseall(
        inputsmap(async (text) => {
          const result = await thisollamaembeddings({
            model;
            prompt: text});
          return resultembedding}));
      return embeddings}}/**
   * Check health of all local services*/
  async check.Health(): Promise<{
    ollama: any;
    lm.Studio: any;
    preferred: string | null;
    recommendations: string[]}> {
    const [ollama.Health, lmStudio.Health] = await Promiseall([
      thisollamahealth.Check()catch((err) => ({
        status: 'error instanceof Error ? errormessage : String(error);
        error instanceof Error ? errormessage : String(error) errmessage}));
      thislmStudiohealth.Check()catch((err) => ({
        status: 'error instanceof Error ? errormessage : String(error);
        error instanceof Error ? errormessage : String(error) errmessage}))]);
    const recommendations: string[] = [];
    if (ollama.Healthstatus !== 'healthy' && lmStudio.Healthstatus !== 'healthy') {
      recommendationspush('No local LL.M services running. Start Ollama or L.M Studio.')} else if (ollama.Healthstatus === 'healthy' && lmStudio.Healthstatus === 'healthy') {
      recommendationspush('Both services running. Consider stopping one to save resources.')};

    if (
      lmStudio.Healthstatus === 'healthy' && 'models' in lmStudio.Health && lmStudio.Healthmodelslength === 0) {
      recommendationspush('L.M Studio running but no models loaded. Load a model in L.M Studio.')};
;
    return {
      ollama: ollama.Health;
      lm.Studio: lmStudio.Health;
      preferred: thispreferred.Service;
      recommendations;
    }}/**
   * Get service-specific features*/
  getService.Capabilities(): {
    ollama: string[];
    lm.Studio: string[]} {
    return {
      ollama: [
        'Multiple model formats (GGU.F, GGM.L)';
        'Built-in model library';
        'Model customization via Modelfile';
        'Automatic model management';
        'CL.I integration'];
      lm.Studio: [
        'User-friendly GU.I';
        'OpenA.I-compatible AP.I';
        'Easy model discovery and download';
        'Hardware acceleration settings';
        'Chat interface for testing'];
    }}}// Export singleton;
export const localLLM.Manager = new LocalLLM.Manager();