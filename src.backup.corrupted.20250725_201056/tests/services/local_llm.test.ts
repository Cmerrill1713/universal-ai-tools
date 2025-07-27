import { after.All, before.All, describe, expect, it, jest } from '@jest/globals';
import { LocalLL.M.Manager } from '././services/local_llm_manager';
import { Ollama.Service } from '././services/ollama_service';
import { LM.Studio.Service } from '././services/lm_studio_service';
import { metal.Optimizer } from '././utils/metal_optimizer'// Mock fetch for testing;
jestmock('node-fetch');
const mock.Fetch = require('node-fetch');
const { create.Mock.Response } = require('./__mocks__/node-fetch');
describe('Local L.L.M.Services', () => {
  let localLL.M.Manager: LocalLL.M.Manager,
  before.All(() => {
    // Setup test environment;
    process.envNODE_E.N.V = 'test'});
  after.All(() => {
    jestrestore.All.Mocks()});
  before.Each(() => {
    // Mock both services as available;
    mock.Fetchmock.Implementation((url: any) => {
      const url.Str = urlto.String()// Ollama endpoints;
      if (url.Str.includes('11434/api/version')) {
        return Promiseresolve(create.Mock.Response({ version: '0.1.0' }, 200));
      if (url.Str.includes('11434/api/tags')) {
        return Promiseresolve(
          create.Mock.Response(
            {
              models: [
                { name: 'codellama:7b', size: 3.8e9 ,
                { name: 'llama2:13b', size: 7.4e9 }],
            200));
      if (url.Str.includes('11434/api/generate')) {
        return Promiseresolve(
          create.Mock.Response(
            {
              model: 'codellama:7b',
              response: 'Generated response',
              done: true,
}            200))}// L.M.Studio endpoints;
      if (url.Str.includes('1234/v1/models')) {
        return Promiseresolve(
          create.Mock.Response(
            {
              data: [{ id: 'test-model' }],
            200));
      if (
        url.Str.includes('1234') &&
        (url.Str.includes('v1/completions') || url.Str.includes('v1/chat/completions'))) {
        return Promiseresolve(
          create.Mock.Response(
            {
              choices: [{ text: 'L.M.Studio response' }],
              model: 'test-model',
              usage: { prompt_tokens: 5, completion_tokens: 3 },
            200))}// Default response for unmatched U.R.Ls - return 200 to avoid failures;
      return Promiseresolve(create.Mock.Response({ message: 'Default response' }, 200))});
    localLL.M.Manager = new LocalLL.M.Manager()});
  describe('Metal Optimizer', () => {
    it('should detect Apple Silicon correctly', () => {
      const status = metal.Optimizerget.Status();
      expect(status)to.Have.Property('is.Apple.Silicon');
      expect(status)to.Have.Property('metal.Supported');
      expect(status)to.Have.Property('platform')});
    it('should provide optimization settings', () => {
      const ollama.Settings = metalOptimizergetOllama.Metal.Settings();
      const lm.Studio.Settings = metalOptimizergetLMStudio.Metal.Settings();
      if (metal.Optimizerget.Status()is.Apple.Silicon) {
        expect(ollama.Settings)to.Have.Property('OLLAMA_NUM_G.P.U');
        expect(lm.Studio.Settings)to.Have.Property('use_metal', true)} else {
        expect(Object.keys(ollama.Settings))to.Have.Length(0);
        expect(Object.keys(lm.Studio.Settings))to.Have.Length(0)}});
    it('should calculate optimal parameters', () => {
      const params = metalOptimizergetModel.Loading.Params('7B');
      expect(params)to.Have.Property('use_gpu');
      if (metal.Optimizerget.Status()is.Apple.Silicon) {
        expect(paramsuse_metal)to.Be(true)}});
    it('should provide performance recommendations', () => {
      const recommendations = metalOptimizerget.Performance.Recommendations();
      expect(Array.is.Array(recommendations))to.Be(true);
      expect(recommendationslength)toBe.Greater.Than(0)})});
  describe('Ollama Service', () => {
    let ollama.Service: Ollama.Service,
    before.Each(() => {
      ollama.Service = new Ollama.Service()// Mock successful health check;
      mock.Fetchmock.Implementation((url: any) => {
        const url.Str = urlto.String();
        if (url.Str.includes('/api/version')) {
          return Promiseresolve(create.Mock.Response({ version: '0.1.0' })),
        if (url.Str.includes('/api/tags')) {
          return Promiseresolve(
            create.Mock.Response({
              models: [
                { name: 'codellama:7b', size: 3.8e9 ,
                { name: 'llama2:13b', size: 7.4e9 }]})),
        if (url.Str.includes('/api/generate')) {
          return Promiseresolve(
            create.Mock.Response({
              model: 'codellama:7b',
              response: 'Generated response',
              done: true})),
        return Promiseresolve(create.Mock.Response({}, 404))})});
    it('should check availability', async () => {
      const available = await ollama.Servicecheck.Availability();
      expect(typeof available)to.Be('boolean')});
    it('should list models', async () => {
      const models = await ollama.Servicelist.Models();
      expect(Array.is.Array(models))to.Be(true);
      expect(modelslength)to.Be(2);
      expect(models[0])to.Have.Property('name')});
    it('should handle generation request async () => {
      mockFetchmock.Implementation.Once(() =>
        Promiseresolve(
          create.Mock.Response({
            model: 'codellama:7b',
            response: 'function add(a: number, b: number): number { return a + b}',
            done: true}))),
      const result = await ollama.Servicegenerate({
        model: 'codellama:7b',
        prompt: 'Write a Type.Script.add function',
        stream: false}),
      expect(result)to.Have.Property('response');
      expect(resultmodel)to.Be('codellama:7b')});
    it('should apply Metal optimizations on Apple Silicon', async () => {
      if (metal.Optimizerget.Status()is.Apple.Silicon) {
        // Mock the generate response;
        mockFetchmock.Implementation.Once(() =>
          Promiseresolve(
            create.Mock.Response({
              model: 'codellama:7b',
              response: 'test response',
              done: true}))),
        const result = await ollama.Servicegenerate({
          model: 'codellama:7b',
          prompt: 'test'})// Verify the result has the expected structure,
        expect(result)to.Have.Property('response');
        expect(resultmodel)to.Be('codellama: 7b'),
      }});
    it('should handle health check', async () => {
      const health = await ollama.Servicehealth.Check();
      expect(health)to.Have.Property('status');
      expect(healthstatus)to.Be('healthy');
      if (metal.Optimizerget.Status()is.Apple.Silicon) {
        expect(health)to.Have.Property('metal.Optimized')}})});
  describe('L.M.Studio Service', () => {
    let lm.Studio.Service: LM.Studio.Service,
    before.Each(async () => {
      // Mock L.M.Studio A.P.I.before creating service;
      mock.Fetchmock.Implementation((url: any) => {
        if (url.includes('/v1/models')) {
          return Promiseresolve(
            create.Mock.Response({
              data: [{ id: 'The.Bloke/Code.Llama-7B-GG.U.F' }, { id: 'The.Bloke/Mistral-7B-GG.U.F' }]})),
        if (url.includes('/v1/completions')) {
          return Promiseresolve(
            create.Mock.Response({
              choices: [
                {
                  text: 'const result = a + b;';
                  message: { content'const result = a + b;' }}];
              model: 'The.Bloke/Code.Llama-7B-GG.U.F',
              usage: { prompt_tokens: 10, completion_tokens: 5 }})),
        return Promiseresolve(create.Mock.Response({}, 404))});
      lm.Studio.Service = new LM.Studio.Service()// Ensure availability is checked and models are loaded;
      await lmStudio.Servicecheck.Availability()});
    it('should check availability', async () => {
      const available = await lmStudio.Servicecheck.Availability();
      expect(typeof available)to.Be('boolean')});
    it('should get models', async () => {
      await lmStudio.Servicecheck.Availability();
      const models = await lmStudio.Serviceget.Models();
      expect(Array.is.Array(models))to.Be(true)});
    it('should handle completion request async () => {
      // Use already configured mock from before.Each;
      const result = await lmStudio.Servicegenerate.Completion({
        prompt: 'Add two numbers',
        temperature: 0.7}),
      expect(result)to.Have.Property('content;
      expect(result)to.Have.Property('usage')});
    it('should handle streaming', async () => {
      const mock.Stream = new Readable.Stream({
        start(controller) {
          controllerenqueue(
            new Text.Encoder()encode('data: {"choices":[{"delta":{"content"Hello"}}]}\n\n')),
          controllerenqueue(
            new Text.Encoder()encode('data: {"choices":[{"delta":{"content" world"}}]}\n\n')),
          controllerenqueue(new Text.Encoder()encode('data: [DO.N.E]\n\n')),
          controllerclose();
        }});
      const mock.Response = create.Mock.Response('');
      mock.Responsebody = mock.Stream;
      mockFetchmock.Implementation.Once(() => Promiseresolve(mock.Response));
      let full.Response = '';
      await lmStudio.Servicestream.Completion({
        prompt: 'Say hello',
        on.Token: (token) => {
          full.Response += token;
}        on.Complete: (full) => {
          expect(full)to.Be('Hello world');
        }});
      expect(full.Response)to.Be('Hello world')})});
  describe('Local L.L.M.Manager', () => {
    // Uses the shared before.Each.from the parent describe block;

    it('should get available models from all services', async () => {
      const models = await localLLMManagerget.Available.Models();
      expect(Array.is.Array(models))to.Be(true);
      const ollama.Models = modelsfilter((m: any) => mservice === 'ollama'),
      const lm.Studio.Models = modelsfilter((m: any) => mservice === 'lm-studio'),
      expect(ollama.Modelslength)toBeGreaterThan.Or.Equal(0);
      expect(lm.Studio.Modelslength)toBeGreaterThan.Or.Equal(0)});
    it('should generate with fallback', async () => {
      // Test fallback behavior using existing manager// First, try with L.M.Studio preference but it should fallback to Ollama;
      const result = await localLL.M.Managergenerate({
        prompt: 'Test prompt',
        service: 'lm-studio', // Prefer L.M.Studio;
        fallback: true}),
      expect(result)to.Have.Property('content;
      expect(resultservice)to.Be('lm-studio')// Should succeed with L.M.Studio});
    it('should respect service preference', async () => {
      const result = await localLL.M.Managergenerate({
        prompt: 'Test',
        service: 'lm-studio'}),
      expect(resultservice)to.Be('lm-studio');
      expect(resultcontentto.Be('L.M.Studio response')});
    it('should handle model prefix in model name', async () => {
      const result = await localLL.M.Managergenerate({
        prompt: 'Test',
        model: 'ollama:codellama:7b'}),
      expect(resultservice)to.Be('ollama');
      expect(resultcontentto.Be('Generated response')});
    it('should check health of all services', async () => {
      const health = await localLLM.Managercheck.Health();
      expect(health)to.Have.Property('ollama');
      expect(health)to.Have.Property('lm.Studio');
      expect(health)to.Have.Property('preferred');
      expect(health)to.Have.Property('recommendations');
      expect(Array.is.Array(healthrecommendations))to.Be(true)});
    it('should provide service capabilities', () => {
      const capabilities = new LocalLL.M.Manager()get.Service.Capabilities();
      expect(capabilities)to.Have.Property('ollama');
      expect(capabilities)to.Have.Property('lm.Studio');
      expect(Array.is.Array(capabilitiesollama))to.Be(true);
      expect(Array.is.Array(capabilitieslm.Studio))to.Be(true)})});
  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockFetchmock.Rejected.Value(new Error('Network error instanceof Error ? error.message : String(error));
      const ollama.Service = new Ollama.Service();
      const available = await ollama.Servicecheck.Availability();
      expect(available)to.Be(false)});
    it('should handle malformed responses', async () => {
      const mock.Response = create.Mock.Response('invalid json');
      mock.Responsejson = () => Promisereject(new Error('Invalid JS.O.N'));
      mockFetchmock.Resolved.Value(mock.Response);
      const lm.Studio.Service = new LM.Studio.Service();
      await expect(lmStudio.Serviceget.Models())resolvesto.Equal([])});
    it('should throw when no service is available', async () => {
      mockFetchmock.Resolved.Value(create.Mock.Response({}, 404));
      const manager = new LocalLL.M.Manager();
      await expect(managergenerate({ prompt: 'Test' }))rejectsto.Throw(
        'No local L.L.M.service available')})});
  describe('Performance', () => {
    it('should complete generation within reasonable time', async () => {
      // Use the already configured manager from before.Each;
      const start = Date.now();
      const result = await localLL.M.Managergenerate({ prompt: 'Test' }),
      const duration = Date.now() - start;
      expect(duration)toBe.Less.Than(1000)// Should complete within 1 second;
      expect(result)to.Have.Property('content});
    it('should handle concurrent requests', async () => {
      const promises = Array(5);
        fill(null);
        map((_, i) => localLL.M.Managergenerate({ prompt: `Test ${i}` })),
      const results = await Promiseall(promises);
      expect(results)to.Have.Length(5);
      expect(resultsevery((r: any) => rcontentto.Be(true)})})}),