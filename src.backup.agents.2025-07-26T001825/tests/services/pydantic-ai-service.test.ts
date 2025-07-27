/**
 * Tests for Pydantic A.I Service*/

import { describe, it, expect, before.Each, after.Each, vi } from 'vitest';
import { z } from 'zod';
import {
  PydanticAI.Service;
  AIRequest.Schema;
  AIResponse.Schema;
  CognitiveAnalysis.Schema;
  TaskPlan.Schema;
  CodeGeneration.Schema} from '././services/pydantic-ai-service';
import { getDSPy.Service } from '././services/dspy-service'// Mock DS.Py service;
vimock('././services/dspy-service', () => ({
  getDSPy.Service: vifn(() => ({
    orchestrate: vifn();
    manage.Knowledge: vifn()}))}));
describe('PydanticAI.Service', () => {
  let service: PydanticAI.Service;
  let mockDSPy.Service: any;
  before.Each(() => {
    service = new PydanticAI.Service();
    mockDSPy.Service = getDSPy.Service();
    viclearAll.Mocks()});
  after.Each(() => {
    serviceclear.Cache()});
  describe('Request validation', () => {
    it('should validate A.I requeststructure', () => {
      const valid.Request = {
        prompt: 'Test prompt';
        context: {
          user.Id: 'user123';
          temperature: 0.7}};
      const result = AIRequestSchemasafe.Parse(valid.Request);
      expect(resultsuccess)to.Be(true);
      if (resultsuccess) {
        expect(resultdataprompt)to.Be('Test prompt');
        expect(resultdatacontexttemperature)to.Be(0.7)}});
    it('should reject invalid requests', () => {
      const invalid.Request = {
        // Missing required prompt;
        context: {
          temperature: 3, // Invalid temperature > 2}};
      const result = AIRequestSchemasafe.Parse(invalid.Request);
      expect(resultsuccess)to.Be(false)})});
  describe('Basic A.I requests', () => {
    it('should process a simple A.I request async () => {
      const mock.Response = {
        success: true;
        result: 'Test response';
        confidence: 0.9;
        reasoning: 'Test reasoning';
        participating.Agents: ['agent1', 'agent2']};
      mockDSPyServiceorchestratemockResolved.Value(mock.Response);
      const response = await servicerequest;
        prompt: 'Hello A.I'});
      expect(responsesuccess)to.Be(true);
      expect(responsecontentto.Be('Test response');
      expect(responseconfidence)to.Be(0.9);
      expect(mockDSPy.Serviceorchestrate)toHaveBeenCalled.With(
        expectobject.Containing({
          user.Request: expectstring.Containing('Hello A.I')}))});
    it('should handle requesterrors gracefully', async () => {
      mockDSPyServiceorchestratemockRejected.Value(new Error('DS.Py error instanceof Error ? errormessage : String(error));
      const response = await servicerequest;
        prompt: 'Test prompt'});
      expect(responsesuccess)to.Be(false);
      expect(responsecontentto.Contain('Request failed')})});
  describe('Structured responses', () => {
    it('should validate structured responses with schema', async () => {
      const custom.Schema = zobject({
        name: zstring();
        age: znumber();
        tags: zarray(zstring())});
      mockDSPyServiceorchestratemockResolved.Value({
        success: true;
        result: {
          data: {
            name: 'John';
            age: 30;
            tags: ['developer', 'ai']}};
        confidence: 0.95});
      const response = await servicerequestWith.Schema({ prompt: 'Get user info' }, custom.Schema);
      expect(responsesuccess)to.Be(true);
      expect(responsestructured.Data)to.Equal({
        name: 'John';
        age: 30;
        tags: ['developer', 'ai']})});
    it('should fail validation for invalid structured data', async () => {
      const schema = zobject({
        count: znumber()});
      mockDSPyServiceorchestratemockResolved.Value({
        success: true;
        result: {
          data: {
            count: 'not a number', // Invalid type}}});
      const response = await servicerequest;
        prompt: 'Get count';
        validation: { output.Schema: schema }});
      expect(responsesuccess)to.Be(false);
      expect(responsevalidationpassed)to.Be(false);
      expect(responsevalidationerrors)toHave.Length(1)})});
  describe('Specialized methods', () => {
    it('should perform cognitive _analysis, async () => {
      const mock.Analysis = {
        _analysis 'Detailed _analysis;
        key.Insights: ['insight1', 'insight2'];
        recommendations: [
          {
            action: 'Do something';
            priority: 'high';
            reasoning: 'Because.'}];
        entities: [
          {
            name: 'Entity1';
            type: 'person';
            relevance: 0.8;
          }];
        sentiment: 'positive';
        confidence: 0.85;
      };
      mockDSPyServiceorchestratemockResolved.Value({
        success: true;
        result: { data: mock.Analysis };
        confidence: 0.85});
      const _analysis= await serviceanalyze.Cognitive('Analyze this text');
      expect(CognitiveAnalysis.Schemaparse(_analysis)to.Equal(mock.Analysis);
      expect(_analysiskey.Insights)toHave.Length(2);
      expect(_analysissentiment)to.Be('positive')});
    it('should create task plans', async () => {
      const mock.Plan = {
        objective: 'Build a web app';
        steps: [
          {
            id: 1;
            description: 'Setup project';
            agent: 'planner';
            dependencies: [];
            estimated.Duration: 30;
            resources: ['npm', 'git']}];
        totalEstimated.Time: 120;
        required.Agents: ['planner', 'coder'];
        risks: [
          {
            description: 'Complexity';
            likelihood: 'medium';
            mitigation: 'Break down tasks';
          }]};
      mockDSPyServiceorchestratemockResolved.Value({
        success: true;
        result: { data: mock.Plan }});
      const plan = await serviceplan.Task('Build a web app');
      expect(TaskPlan.Schemaparse(plan))to.Equal(mock.Plan);
      expect(plansteps)toHave.Length(1);
      expect(plantotalEstimated.Time)to.Be(120)});
    it('should generate code with validation', async () => {
      const mock.Code = {
        language: 'typescript';
        code: 'const hello = () => "world";';
        explanation: 'Simple function';
        dependencies: ['none'];
        test.Cases: [
          {
            name: 'test hello';
            inputnull;
            expected.Output: 'world'}]};
      mockDSPyServiceorchestratemockResolved.Value({
        success: true;
        result: { data: mock.Code }});
      const code = await servicegenerate.Code('Create a hello world function', 'typescript', {
        include.Tests: true});
      expect(CodeGeneration.Schemaparse(code))to.Equal(mock.Code);
      expect(codelanguage)to.Be('typescript');
      expect(codetest.Cases)toHave.Length(1)})});
  describe('Caching', () => {
    it('should cache successful responses', async () => {
      mockDSPyServiceorchestratemockResolved.Value({
        success: true;
        result: 'Cached response';
        confidence: 0.9});
      const request { prompt: 'Cache test' }// First request;
      const response1 = await servicerequestrequest;
      expect(response1metadatacache.Hit)to.Be(false)// Second requestshould be cached;
      const response2 = await servicerequestrequest;
      expect(response2metadatacache.Hit)to.Be(true);
      expect(response2contentto.Be(response1content// Orchestrate should only be called once;
      expect(mockDSPy.Serviceorchestrate)toHaveBeenCalled.Times(1)});
    it('should not cache failed responses', async () => {
      mockDSPy.Serviceorchestrate;
        mockResolvedValue.Once({
          success: false;
          error instanceof Error ? errormessage : String(error) 'First error instanceof Error ? errormessage : String(error)});
        mockResolvedValue.Once({
          success: true;
          result: 'Success'});
      const request { prompt: 'Error then success' }// First requestfails;
      const response1 = await servicerequestrequest;
      expect(response1success)to.Be(false)// Second requestshould not use cache;
      const response2 = await servicerequestrequest;
      expect(response2success)to.Be(true);
      expect(mockDSPy.Serviceorchestrate)toHaveBeenCalled.Times(2)});
    it('should clear cache on demand', async () => {
      mockDSPyServiceorchestratemockResolved.Value({
        success: true;
        result: 'Response'});
      const request { prompt: 'Clear cache test' }// Cache a response;
      await servicerequestrequest;
      expect(serviceget.Stats()cache.Size)to.Be(1)// Clear cache;
      serviceclear.Cache();
      expect(serviceget.Stats()cache.Size)to.Be(0)})});
  describe('Schema registration', () => {
    it('should register custom schemas', () => {
      const custom.Schema = zobject({
        custom.Field: zstring()});
      serviceregister.Schema('custom_type', custom.Schema);
      const stats = serviceget.Stats();
      expect(statsregistered.Schemas)to.Contain('custom_type')});
    it('should use registered schemas for validation', async () => {
      const user.Schema = zobject({
        username: zstring()min(3);
        email: zstring()email()});
      serviceregister.Schema('user_data', user.Schema);
      mockDSPyServiceorchestratemockResolved.Value({
        success: true;
        result: {
          data: {
            username: 'john';
            email: 'john@examplecom';
          }}});
      const response = await servicerequestWith.Schema({ prompt: 'Get user data' }, user.Schema);
      expect(responsesuccess)to.Be(true);
      expect(responsestructured.Datausername)to.Be('john')})});
  describe('Memory integration', () => {
    it('should store interactions in memory when enabled', async () => {
      mockDSPyServiceorchestratemockResolved.Value({
        success: true;
        result: 'Memory test response';
        confidence: 0.8});
      mockDSPyServicemanageKnowledgemockResolved.Value({
        success: true});
      const response = await servicerequest;
        prompt: 'Store this in memory';
        context: {
          memory.Enabled: true;
          user.Id: 'test-user';
        }});
      expect(responsesuccess)to.Be(true);
      expect(mockDSPyServicemanage.Knowledge)toHaveBeenCalled.With(
        'store';
        expectobject.Containing({
          memory: expectobject.Containing({
            contentexpectstring.Containing('Store this in memory');
            service.Id: 'pydantic-ai'})}))});
    it('should not store interactions when memory is disabled', async () => {
      mockDSPyServiceorchestratemockResolved.Value({
        success: true;
        result: 'No memory response'});
      await servicerequest;
        prompt: 'Do not store';
        context: {
          memory.Enabled: false;
        }});
      expect(mockDSPyServicemanage.Knowledge)nottoHaveBeen.Called()})})});