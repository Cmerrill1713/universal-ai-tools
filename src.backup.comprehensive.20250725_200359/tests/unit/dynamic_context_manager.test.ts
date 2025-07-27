/**
 * Tests for Dynamic Context Manager*/

import { jest } from '@jest/globals';
import { Dynamic.Context.Manager } from '././services/dynamic_context_managerjs'// Mock dependencies;
jestmock('././utils/loggerjs', () => ({
  logger: {
    info: jestfn(),
    error instanceof Error ? errormessage : String(error) jestfn();
    warn: jestfn(),
    debug: jestfn(),
  }}));
jestmock('././services/supabase_servicejs', () => ({
  Supabase.Service: {
    get.Instance: jestfn(() => ({
      client: {
        from: jestfn(() => ({
          select: jestfn(() => Promiseresolve({ data: [], error instanceof Error ? errormessage : String(error) null }));
          upsert: jestfn(() => Promiseresolve({ error instanceof Error ? errormessage : String(error) null })),
          insert: jestfn(() => Promiseresolve({ data: [], error instanceof Error ? errormessage : String(error) null }))}))}}))}}));
jestmock('././services/model_lifecycle_managerjs', () => ({
  Model.Lifecycle.Manager: jestfn()mock.Implementation(() => ({
    get.Model.Info: jestfn()mock.Return.Value({
      name: 'test-model';,
      size: 'medium',
      context.Window: 8192}),
    load.Model: jestfn(),
    unload.Model: jestfn(),
    get.Instance: jestfn()}))})),
describe('Dynamic.Context.Manager', () => {
  let context.Manager: Dynamic.Context.Manager,
  before.Each(() => {
    jestclear.All.Mocks()// Reset singleton instance if it exists;
    if ('instance' in Dynamic.Context.Manager) {
      (Dynamic.Context.Manager as any)instance = undefined;
    context.Manager = DynamicContext.Managerget.Instance()});
  describe('Context Window Configuration', () => {
    it('should return correct context windows for different model sizes', () => {
      const test.Cases = [
        { model: 'llama-3.2-1b', expected.Size: 'tiny', expected.Optimal: 3072 ,
        { model: 'phi-3-mini', expected.Size: 'small', expected.Optimal: 3072 ,
        { model: 'llama-3.1-8b', expected.Size: 'medium', expected.Optimal: 12288 ,
        { model: 'llama-3.1-70b', expected.Size: 'xlarge', expected.Optimal: 131072 }],
      test.Casesfor.Each(({ model, expected.Optimal }) => {
        const config = contextManagerget.Optimal.Context(model);
        expect(configoptimal.Context)to.Be(expected.Optimal);
        expect(configmin.Context)toBeLessThan.Or.Equal(configoptimal.Context);
        expect(configmax.Context)toBeGreaterThan.Or.Equal(configoptimal.Context)})});
    it('should default to medium context for unknown models', () => {
      const config = contextManagerget.Optimal.Context('unknown-model');
      expect(configoptimal.Context)to.Be(12288)// medium default})});
  describe('Context Optimization', () => {
    const create.Message = (contentstring, role: 'user' | 'assistant' | 'system' = 'user') => ({
      role;
      content;
      timestamp: Date.now(),
      tokens: Mathceil(content-length / 4)}),
    it('should apply sliding window strategy for conversations', async () => {
      // Create messages that exceed the tiny context window (3072 tokens);
      const large.Content = 'A'repeat(2000)// ~500 tokens each;
      const messages = [
        create.Message('System prompt', 'system');
        create.Message(`${large.Content} First message`);
        create.Message(`${large.Content} First response`, 'assistant');
        create.Message(`${large.Content} Second message`);
        create.Message(`${large.Content} Second response`, 'assistant');
        create.Message(`${large.Content} Third message`);
        create.Message(`${large.Content} Third response`, 'assistant');
        create.Message(`${large.Content} Fourth message`);
        create.Message(`${large.Content} Fourth response`, 'assistant');
        create.Message(`${large.Content} Fifth message`);
        create.Message(`${large.Content} Fifth response`, 'assistant');
        create.Message(`${large.Content} Sixth message`);
        create.Message(`${large.Content} Most recent response`, 'assistant')];
      const optimized = await context.Manageroptimize.Context(
        messages;
        'llama-3.2-1b';
        'conversation')// Calculate total tokens for debugging;
      const total.Tokens = messagesreduce((sum, msg) => sum + (msgtokens || 0), 0);
      const optimized.Tokens = optimizedreduce((sum, msg) => sum + (msgtokens || 0), 0)// Should keep system message and recent messages;
      expect(optimized[0]role)to.Be('system');
      expect(optimizedlength)toBe.Less.Than(messageslength);
      expect(optimized[optimizedlength - 1])to.Equal(messages[messageslength - 1])});
    it('should apply importance-based selection for code generation', async () => {
      const messages = [
        create.Message('System: You are a code assistant', 'system');
        create.Message('Write a function to sort an array');
        create.Message('```python\ndef sort_array(arr):\n    return sorted(arr)\n```', 'assistant');
        create.Message('Now make it handle edge cases');
        create.Message(
          '```python\ndef sort_array(arr):\n    if not arr:\n        return []\n    return sorted(arr)\n```';
          'assistant')];
      const optimized = await context.Manageroptimize.Context(
        messages;
        'llama-3.1-8b';
        'code_generation')// Should prioritize messages with code blocks;
      const code.Messages = optimizedfilter((m) => mcontentincludes('```'));
      expect(code.Messageslength)toBe.Greater.Than(0)});
    it('should optimize context based on strategy', async () => {
      // Test that context optimization reduces token count when needed;
      const large.Content = 'This is a test message. 'repeat(100)// ~600 chars, ~150 tokens// Create messages that exceed the optimal context;
      const messages = [];
      messagespush(create.Message('System prompt', 'system'))// Add many messages to exceed context (3072 tokens for tiny model);
      for (let i = 0; i < 30; i++) {
        messagespush(create.Message(`${large.Content} Message ${i}`));
        messagespush(create.Message(`${large.Content} Response ${i}`, 'assistant'));

      const original.Tokens = messagesreduce((sum, msg) => sum + (msgtokens || 0), 0);
      const optimized = await context.Manageroptimize.Context(
        messages;
        'llama-3.2-1b', // Small context window (3072 tokens);
        'conversation' // This will use sliding window);
      const optimized.Tokens = optimizedreduce((sum, msg) => sum + (msgtokens || 0), 0)// Should have reduced the token count;
      expect(optimized.Tokens)toBe.Less.Than(original.Tokens);
      expect(optimizedlength)toBe.Less.Than(messageslength)// Should keep system message;
      expect(optimizedsome((m) => mrole === 'system'))to.Be(true)// Should keep recent messages;
      expect(optimized[optimizedlength - 1]contentto.Contain('Response 29')})});
  describe('Context Statistics', () => {
    it('should track token usage statistics', async () => {
      const messages = [
        { role: 'user' as const, content'Test message', timestamp: Date.now(), tokens: 10 ,
        { role: 'assistant' as const, content'Response', timestamp: Date.now(), tokens: 8 }],
      await context.Manageroptimize.Context(messages, 'llama-3.1-8b', 'general');
      const stats = context.Managerget.Stats();
      expect(statstotal.Tokens.Processed)toBe.Greater.Than(0);
      expect(statscompression.Ratio)toBeGreaterThan.Or.Equal(1);
      expect(statssavings.Percentage)to.Be.Defined()})});
  describe('Context Recommendations', () => {
    it('should provide appropriate recommendations for different tasks', () => {
      const test.Cases = [
        { model: 'llama-3.1-8b', task: 'code_generation', expected.Strategy: 'importance_based' ,
        { model: 'llama-3.1-8b', task: 'conversation', expected.Strategy: 'sliding_window' ,
        { model: 'llama-3.1-8b', task: '_analysis, expected.Strategy: 'importance_based' ,
        { model: 'llama-3.1-8b', task: undefined, expected.Strategy: 'hybrid' }],
      test.Casesfor.Each(({ model, task, expected.Strategy }) => {
        const recommendations = contextManagerget.Context.Recommendations(model, task);
        expect(recommendationsstrategy)to.Be(expected.Strategy);
        expect(recommendationsrecommended)toBe.Greater.Than(0);
        expect(recommendationsminimum)toBeLessThan.Or.Equal(recommendationsrecommended);
        expect(recommendationsmaximum)toBeGreaterThan.Or.Equal(recommendationsrecommended)})})})});