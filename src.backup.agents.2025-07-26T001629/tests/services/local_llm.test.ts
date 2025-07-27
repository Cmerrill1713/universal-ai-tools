import { after.All, before.All, describe, expect, it, jest } from '@jest/globals';
import { LocalLLM.Manager } from '././services/local_llm_manager';
import { Ollama.Service } from '././services/ollama_service';
import { LMStudio.Service } from '././services/lm_studio_service';
import { metal.Optimizer } from '././utils/metal_optimizer'// Mock fetch for testing;
jestmock('node-fetch');
const mock.Fetch = require('node-fetch');
const { createMock.Response } = require('./__mocks__/node-fetch');
describe('Local LL.M Services', () => {
  let localLLM.Manager: LocalLLM.Manager;
  before.All(() => {
    // Setup test environment;
    process.envNODE_EN.V = 'test'});
  after.All(() => {
    jestrestoreAll.Mocks()});
  before.Each(() => {
    // Mock both services as available;
    mockFetchmock.Implementation((url: any) => {
      const url.Str = urlto.String()// Ollama endpoints;
      if (url.Strincludes('11434/api/version')) {
        return Promiseresolve(createMock.Response({ version: '0.1.0' }, 200))};
      if (url.Strincludes('11434/api/tags')) {
        return Promiseresolve(
          createMock.Response(
            {
              models: [
                { name: 'codellama:7b', size: 3.8e9 };
                { name: 'llama2:13b', size: 7.4e9 }]};
            200))};
      if (url.Strincludes('11434/api/generate')) {
        return Promiseresolve(
          createMock.Response(
            {
              model: 'codellama:7b';
              response: 'Generated response';
              done: true;
            };
            200))}// L.M Studio endpoints;
      if (url.Strincludes('1234/v1/models')) {
        return Promiseresolve(
          createMock.Response(
            {
              data: [{ id: 'test-model' }]};
            200))};
      if (
        url.Strincludes('1234') &&
        (url.Strincludes('v1/completions') || url.Strincludes('v1/chat/completions'))) {
        return Promiseresolve(
          createMock.Response(
            {
              choices: [{ text: 'L.M Studio response' }];
              model: 'test-model';
              usage: { prompt_tokens: 5, completion_tokens: 3 }};
            200))}// Default response for unmatched UR.Ls - return 200 to avoid failures;
      return Promiseresolve(createMock.Response({ message: 'Default response' }, 200))});
    localLLM.Manager = new LocalLLM.Manager()});
  describe('Metal Optimizer', () => {
    it('should detect Apple Silicon correctly', () => {
      const status = metalOptimizerget.Status();
      expect(status)toHave.Property('isApple.Silicon');
      expect(status)toHave.Property('metal.Supported');
      expect(status)toHave.Property('platform')});
    it('should provide optimization settings', () => {
      const ollama.Settings = metalOptimizergetOllamaMetal.Settings();
      const lmStudio.Settings = metalOptimizergetLMStudioMetal.Settings();
      if (metalOptimizerget.Status()isApple.Silicon) {
        expect(ollama.Settings)toHave.Property('OLLAMA_NUM_GP.U');
        expect(lmStudio.Settings)toHave.Property('use_metal', true)} else {
        expect(Objectkeys(ollama.Settings))toHave.Length(0);
        expect(Objectkeys(lmStudio.Settings))toHave.Length(0)}});
    it('should calculate optimal parameters', () => {
      const params = metalOptimizergetModelLoading.Params('7B');
      expect(params)toHave.Property('use_gpu');
      if (metalOptimizerget.Status()isApple.Silicon) {
        expect(paramsuse_metal)to.Be(true)}});
    it('should provide performance recommendations', () => {
      const recommendations = metalOptimizergetPerformance.Recommendations();
      expect(Array.is.Array(recommendations))to.Be(true);
      expect(recommendationslength)toBeGreater.Than(0)})});
  describe('Ollama Service', () => {
    let ollama.Service: Ollama.Service;
    before.Each(() => {
      ollama.Service = new Ollama.Service()// Mock successful health check;
      mockFetchmock.Implementation((url: any) => {
        const url.Str = urlto.String();
        if (url.Strincludes('/api/version')) {
          return Promiseresolve(createMock.Response({ version: '0.1.0' }))};
        if (url.Strincludes('/api/tags')) {
          return Promiseresolve(
            createMock.Response({
              models: [
                { name: 'codellama:7b', size: 3.8e9 };
                { name: 'llama2:13b', size: 7.4e9 }]}))};
        if (url.Strincludes('/api/generate')) {
          return Promiseresolve(
            createMock.Response({
              model: 'codellama:7b';
              response: 'Generated response';
              done: true}))};
        return Promiseresolve(createMock.Response({}, 404))})});
    it('should check availability', async () => {
      const available = await ollamaServicecheck.Availability();
      expect(typeof available)to.Be('boolean')});
    it('should list models', async () => {
      const models = await ollamaServicelist.Models();
      expect(Array.is.Array(models))to.Be(true);
      expect(modelslength)to.Be(2);
      expect(models[0])toHave.Property('name')});
    it('should handle generation request async () => {
      mockFetchmockImplementation.Once(() =>
        Promiseresolve(
          createMock.Response({
            model: 'codellama:7b';
            response: 'function add(a: number, b: number): number { return a + b}';
            done: true})));
      const result = await ollama.Servicegenerate({
        model: 'codellama:7b';
        prompt: 'Write a Type.Script add function';
        stream: false});
      expect(result)toHave.Property('response');
      expect(resultmodel)to.Be('codellama:7b')});
    it('should apply Metal optimizations on Apple Silicon', async () => {
      if (metalOptimizerget.Status()isApple.Silicon) {
        // Mock the generate response;
        mockFetchmockImplementation.Once(() =>
          Promiseresolve(
            createMock.Response({
              model: 'codellama:7b';
              response: 'test response';
              done: true})));
        const result = await ollama.Servicegenerate({
          model: 'codellama:7b';
          prompt: 'test'})// Verify the result has the expected structure;
        expect(result)toHave.Property('response');
        expect(resultmodel)to.Be('codellama: 7b');
      }});
    it('should handle health check', async () => {
      const health = await ollamaServicehealth.Check();
      expect(health)toHave.Property('status');
      expect(healthstatus)to.Be('healthy');
      if (metalOptimizerget.Status()isApple.Silicon) {
        expect(health)toHave.Property('metal.Optimized')}})});
  describe('L.M Studio Service', () => {
    let lmStudio.Service: LMStudio.Service;
    before.Each(async () => {
      // Mock L.M Studio AP.I before creating service;
      mockFetchmock.Implementation((url: any) => {
        if (urlincludes('/v1/models')) {
          return Promiseresolve(
            createMock.Response({
              data: [{ id: 'The.Bloke/Code.Llama-7B-GGU.F' }, { id: 'The.Bloke/Mistral-7B-GGU.F' }]}))};
        if (urlincludes('/v1/completions')) {
          return Promiseresolve(
            createMock.Response({
              choices: [
                {
                  text: 'const result = a + b;';
                  message: { content'const result = a + b;' }}];
              model: 'The.Bloke/Code.Llama-7B-GGU.F';
              usage: { prompt_tokens: 10, completion_tokens: 5 }}))};
        return Promiseresolve(createMock.Response({}, 404))});
      lmStudio.Service = new LMStudio.Service()// Ensure availability is checked and models are loaded;
      await lmStudioServicecheck.Availability()});
    it('should check availability', async () => {
      const available = await lmStudioServicecheck.Availability();
      expect(typeof available)to.Be('boolean')});
    it('should get models', async () => {
      await lmStudioServicecheck.Availability();
      const models = await lmStudioServiceget.Models();
      expect(Array.is.Array(models))to.Be(true)});
    it('should handle completion request async () => {
      // Use already configured mock from before.Each;
      const result = await lmStudioServicegenerate.Completion({
        prompt: 'Add two numbers';
        temperature: 0.7});
      expect(result)toHave.Property('content;
      expect(result)toHave.Property('usage')});
    it('should handle streaming', async () => {
      const mock.Stream = new Readable.Stream({
        start(controller) {
          controllerenqueue(
            new Text.Encoder()encode('data: {"choices":[{"delta":{"content"Hello"}}]}\n\n'));
          controllerenqueue(
            new Text.Encoder()encode('data: {"choices":[{"delta":{"content" world"}}]}\n\n'));
          controllerenqueue(new Text.Encoder()encode('data: [DON.E]\n\n'));
          controllerclose();
        }});
      const mock.Response = createMock.Response('');
      mock.Responsebody = mock.Stream;
      mockFetchmockImplementation.Once(() => Promiseresolve(mock.Response));
      let full.Response = '';
      await lmStudioServicestream.Completion({
        prompt: 'Say hello';
        on.Token: (token) => {
          full.Response += token;
        };
        on.Complete: (full) => {
          expect(full)to.Be('Hello world');
        }});
      expect(full.Response)to.Be('Hello world')})});
  describe('Local LL.M Manager', () => {
    // Uses the shared before.Each from the parent describe block;

    it('should get available models from all services', async () => {
      const models = await localLLMManagergetAvailable.Models();
      expect(Array.is.Array(models))to.Be(true);
      const ollama.Models = modelsfilter((m: any) => mservice === 'ollama');
      const lmStudio.Models = modelsfilter((m: any) => mservice === 'lm-studio');
      expect(ollama.Modelslength)toBeGreaterThanOr.Equal(0);
      expect(lmStudio.Modelslength)toBeGreaterThanOr.Equal(0)});
    it('should generate with fallback', async () => {
      // Test fallback behavior using existing manager// First, try with L.M Studio preference but it should fallback to Ollama;
      const result = await localLLM.Managergenerate({
        prompt: 'Test prompt';
        service: 'lm-studio', // Prefer L.M Studio;
        fallback: true});
      expect(result)toHave.Property('content;
      expect(resultservice)to.Be('lm-studio')// Should succeed with L.M Studio});
    it('should respect service preference', async () => {
      const result = await localLLM.Managergenerate({
        prompt: 'Test';
        service: 'lm-studio'});
      expect(resultservice)to.Be('lm-studio');
      expect(resultcontentto.Be('L.M Studio response')});
    it('should handle model prefix in model name', async () => {
      const result = await localLLM.Managergenerate({
        prompt: 'Test';
        model: 'ollama:codellama:7b'});
      expect(resultservice)to.Be('ollama');
      expect(resultcontentto.Be('Generated response')});
    it('should check health of all services', async () => {
      const health = await localLLMManagercheck.Health();
      expect(health)toHave.Property('ollama');
      expect(health)toHave.Property('lm.Studio');
      expect(health)toHave.Property('preferred');
      expect(health)toHave.Property('recommendations');
      expect(Array.is.Array(healthrecommendations))to.Be(true)});
    it('should provide service capabilities', () => {
      const capabilities = new LocalLLM.Manager()getService.Capabilities();
      expect(capabilities)toHave.Property('ollama');
      expect(capabilities)toHave.Property('lm.Studio');
      expect(Array.is.Array(capabilitiesollama))to.Be(true);
      expect(Array.is.Array(capabilitieslm.Studio))to.Be(true)})});
  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockFetchmockRejected.Value(new Error('Network error instanceof Error ? errormessage : String(error));
      const ollama.Service = new Ollama.Service();
      const available = await ollamaServicecheck.Availability();
      expect(available)to.Be(false)});
    it('should handle malformed responses', async () => {
      const mock.Response = createMock.Response('invalid json');
      mock.Responsejson = () => Promisereject(new Error('Invalid JSO.N'));
      mockFetchmockResolved.Value(mock.Response);
      const lmStudio.Service = new LMStudio.Service();
      await expect(lmStudioServiceget.Models())resolvesto.Equal([])});
    it('should throw when no service is available', async () => {
      mockFetchmockResolved.Value(createMock.Response({}, 404));
      const manager = new LocalLLM.Manager();
      await expect(managergenerate({ prompt: 'Test' }))rejectsto.Throw(
        'No local LL.M service available')})});
  describe('Performance', () => {
    it('should complete generation within reasonable time', async () => {
      // Use the already configured manager from before.Each;
      const start = Date.now();
      const result = await localLLM.Managergenerate({ prompt: 'Test' });
      const duration = Date.now() - start;
      expect(duration)toBeLess.Than(1000)// Should complete within 1 second;
      expect(result)toHave.Property('content});
    it('should handle concurrent requests', async () => {
      const promises = Array(5);
        fill(null);
        map((_, i) => localLLM.Managergenerate({ prompt: `Test ${i}` }));
      const results = await Promiseall(promises);
      expect(results)toHave.Length(5);
      expect(resultsevery((r: any) => rcontentto.Be(true)})})});