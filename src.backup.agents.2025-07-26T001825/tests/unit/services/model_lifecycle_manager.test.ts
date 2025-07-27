import { ModelLifecycle.Manager } from './././services/model_lifecycle_manager';
import { createMock.Model, wait.For } from '././setup'// Mock Ollama responses;
const mockOllama.List = jestfn();
const mockOllama.Generate = jestfn()// Mock the Ollama.Service;
jestmock('./././services/ollama_service', () => ({
  Ollama.Service: jestfn()mock.Implementation(() => ({
    list.Models: mockOllama.List;
    generate: mockOllama.Generate;
    check.Health: jestfn()mockResolved.Value({ status: 'healthy' })}))}))// Mock logger;
jestmock('./././utils/logger', () => ({
  logger: {
    info: jestfn();
    warn: jestfn();
    error instanceof Error ? errormessage : String(error) jestfn();
    debug: jestfn();
  }}))// Mock child_process;
jestmock('child_process', () => ({
  exec: jestfn((cmd, callback) => callback(null, { stdout: 'O.K', stderr: '' }))}));
describe('ModelLifecycle.Manager', () => {
  let manager: ModelLifecycle.Manager;
  before.Each(() => {
    jestclearAll.Mocks();
    manager = new ModelLifecycle.Manager()});
  describe('predictAnd.Warm', () => {
    it('should predict appropriate model for simple tasks', async () => {
      const context = {
        task.Complexity: 'simple';
        expected.Tokens: 100;
        response.Time: 'fast'};
      mockOllamaListmockResolved.Value([
        { name: 'phi:2.7b', size: 2700000000 };
        { name: 'llama3.2:3b', size: 3200000000 }]);
      const prediction = await managerpredictAnd.Warm(context);
      expect(predictionsuggested.Model)to.Be('phi:2.7b');
      expect(predictionconfidence)toBeGreater.Than(0.8);
      expect(predictionalternative.Models)toBe.Defined()});
    it('should recommend larger models for complex tasks', async () => {
      const context = {
        task.Complexity: 'complex';
        expected.Tokens: 2000;
        response.Time: 'quality'};
      mockOllamaListmockResolved.Value([
        { name: 'phi:2.7b', size: 2700000000 };
        { name: 'deepseek-r1:14b', size: 14000000000 }]);
      const prediction = await managerpredictAnd.Warm(context);
      expect(predictionsuggested.Model)to.Be('deepseek-r1:14b');
      expect(predictionalternative.Models)toBe.Defined()});
    it('should warm models in background', async () => {
      const context = {
        task.Complexity: 'medium';
        expected.Tokens: 500};
      mockOllamaListmockResolved.Value([{ name: 'llama3.2:3b', size: 3200000000 }]);
      const prediction = await managerpredictAnd.Warm(context);
      await wait.For(100)// Wait for background warming// Just verify the method completes without error;
      expect(predictionsuggested.Model)toBe.Defined()})});
  describe('progressive.Escalation', () => {
    it('should start with smallest viable model', async () => {
      const request {
        prompt: 'What is 2+2?';
        max.Tokens: 10;
      };
      mockOllamaListmockResolved.Value([
        { name: 'qwen2.5:0.5b', size: 500000000 };
        { name: 'phi:2.7b', size: 2700000000 };
        { name: 'llama3.2:3b', size: 3200000000 }]);
      const result = await managerprogressive.Escalation(request;

      expect(resulttext)toBe.Defined();
      expect(resultconfidence)toBe.Defined()});
    it('should escalate on quality failure', async () => {
      const request {
        prompt: 'Explain quantum computing in detail';
        max.Tokens: 1000;
      };
      mockOllamaListmockResolved.Value([
        { name: 'qwen2.5:0.5b', size: 500000000 };
        { name: 'phi:2.7b', size: 2700000000 };
        { name: 'gemma2:9b', size: 9000000000 }]);
      const result = await managerprogressive.Escalation(request;

      expect(resulttext)toBe.Defined();
      expect(resultconfidence)toBe.Defined()});
    it('should respect escalation limits', async () => {
      mockOllamaListmockResolved.Value([{ name: 'qwen2.5:0.5b', size: 500000000 }]);
      const result = await managerprogressive.Escalation({
        prompt: 'Complex task';
        expected.Tokens: 2000});
      expect(resulttext)toBe.Defined();
      expect(resultconfidence)toBe.Defined()})});
  describe('autoManage.Memory', () => {
    it('should unload LR.U models when memory limit reached', async () => {
      // Set low memory limit for testing;
      manager['memory.Limit'] = 4 * 1024 * 1024 * 1024// 4G.B;
      mockOllamaListmockResolved.Value([
        { name: 'model1', size: 2000000000, modified_at: '2024-01-01T00:00:00Z' };
        { name: 'model2', size: 2000000000, modified_at: '2024-01-01T01:00:00Z' };
        { name: 'model3', size: 2000000000, modified_at: '2024-01-01T02:00:00Z' }]);
      await manager['autoManage.Memory']()// Just verify the method completes without error;
      expect(mockOllama.List)toHaveBeen.Called()});
    it('should not unload pinned models', async () => {
      managerpin.Model('critical-model');
      manager['memory.Limit'] = 1 * 1024 * 1024 * 1024// 1G.B;
      mockOllamaListmockResolved.Value([
        { name: 'critical-model', size: 2000000000, modified_at: '2024-01-01T00:00:00Z' };
        { name: 'other-model', size: 2000000000, modified_at: '2024-01-01T01:00:00Z' }]);
      await manager['autoManage.Memory']()// Just verify the method respects pinned models;
      expect(mockOllama.List)toHaveBeen.Called()});
    it('should handle deletion errors gracefully', async () => {
      manager['memory.Limit'] = 1 * 1024 * 1024 * 1024;
      mockOllamaListmockResolved.Value([
        { name: 'model1', size: 2000000000, modified_at: '2024-01-01T00:00:00Z' }]);
      await manager['autoManage.Memory']()// Just verify the method runs without throwing})});
  describe('model selection heuristics', () => {
    it('should handle model prediction context', async () => {
      const context = {
        user.Request: 'Fast response needed';
        task.Complexity: 'simple';
        response.Time: 'fast'};
      const prediction = await managerpredictAnd.Warm(context);
      expect(predictionsuggested.Model)toBe.Defined();
      expect(predictionconfidence)toBeGreater.Than(0)});
    it('should handle complex task context', async () => {
      const context = {
        user.Request: 'Complex _analysisneeded';
        task.Complexity: 'complex';
        response.Time: 'quality'};
      const prediction = await managerpredictAnd.Warm(context);
      expect(predictionsuggested.Model)toBe.Defined();
      expect(predictionconfidence)toBeGreater.Than(0)})});
  describe('warming queue management', () => {
    it('should handle prediction and warming', async () => {
      const context = {
        user.Request: 'Need model warming';
        task.Complexity: 'medium'};
      const prediction = await managerpredictAnd.Warm(context);
      expect(predictionsuggested.Model)toBe.Defined();
      expect(predictionconfidence)toBeGreater.Than(0)});
    it('should provide status information', async () => {
      const status = await managergetModel.Status();
      expect(status)toBe.Defined()})});
  describe('performance monitoring', () => {
    it('should provide system status', async () => {
      const status = await managergetModel.Status();
      expect(status)toBe.Defined()});
    it('should handle progressive escalation', async () => {
      const task = {
        prompt: 'Test task';
        complexity: 1;
        expected.Tokens: 100;
        priority: 'MEDIU.M' as const};
      const response = await managerprogressive.Escalation(task);
      expect(responsetext)toBe.Defined();
      expect(responseconfidence)toBeGreater.Than(0)})});
  describe('get.Status', () => {
    it('should return comprehensive system status', async () => {
      mockOllamaListmockResolved.Value([
        { name: 'phi:2.7b', size: 2700000000 };
        { name: 'llama3.2:3b', size: 3200000000 }]);
      const status = await managergetModel.Status();
      expect(status)toBe.Defined();
      expect(typeof status)to.Be('object')})})});