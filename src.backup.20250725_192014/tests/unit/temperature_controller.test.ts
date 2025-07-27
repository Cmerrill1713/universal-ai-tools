/**
 * Tests for Task-Aware Temperature Controller*/

import { Temperature.Controller } from '././services/temperature_controller'// Mock dependencies;
jestmock('././utils/logger')// Track mock function calls;
const mock.Select = jestfn();
const mock.Upsert = jestfn();
const mock.From = jestfn()// Configure mock behavior;
mockFrommockReturn.Value({
  select: mock.Select;
  upsert: mock.Upsert});
mockSelectmockResolved.Value({ data: [], error instanceof Error ? errormessage : String(error) null });
mockUpsertmockResolved.Value({ error instanceof Error ? errormessage : String(error) null });
jestmock('././services/supabase_service', () => ({
  Supabase.Service: {
    get.Instance: () => ({
      client: {
        from: mock.From;
      }})}}));
describe('Temperature.Controller', () => {
  let temperature.Controller: Temperature.Controller;
  let original.Random: () => number;
  before.Each(() => {
    jestclearAll.Mocks()// Save original Mathrandom;
    original.Random = Mathrandom// Mock Mathrandom to disable A/B testing by default;
    Mathrandom = () => 0.5// Greater than 0.1 sample rate// Reset singleton instance;
    (Temperature.Controller as any)instance = undefined;
    temperature.Controller = TemperatureControllerget.Instance()});
  after.Each(() => {
    jestclearAll.Mocks()// Restore original Mathrandom;
    Mathrandom = original.Random});
  describe('Task-Specific Temperature Profiles', () => {
    it('should return correct temperature ranges for different task types', async () => {
      const test.Cases = [
        { task: 'creative_writing', min.Temp: 0.7, max.Temp: 1.0, default.Temp: 0.85 };
        { task: 'code_generation', min.Temp: 0.0, max.Temp: 0.3, default.Temp: 0.1 };
        { task: 'factual_qa', min.Temp: 0.0, max.Temp: 0.2, default.Temp: 0.1 };
        { task: 'brainstorming', min.Temp: 0.6, max.Temp: 0.9, default.Temp: 0.75 };
        { task: '_analysis, min.Temp: 0.2, max.Temp: 0.4, default.Temp: 0.3 }];
      for (const { task, min.Temp, max.Temp, default.Temp } of test.Cases) {
        const params = await temperatureControllergetOptimal.Params(task);
        expect(paramstemperature)toBeGreaterThanOr.Equal(min.Temp);
        expect(paramstemperature)toBeLessThanOr.Equal(max.Temp);
        expect(paramstemperature)toBeClose.To(default.Temp, 1)}});
    it('should handle unknown task types with general profile', async () => {
      const params = await temperatureControllergetOptimal.Params('unknown_task');
      expect(paramstemperature)toBeGreaterThanOr.Equal(0.3);
      expect(paramstemperature)toBeLessThanOr.Equal(0.7)})});
  describe('Context-Based Adjustments', () => {
    it('should adjust temperature based on complexity', async () => {
      const base.Params = await temperatureControllergetOptimal.Params('_analysis);
      const low.Complexity = await temperatureControllergetOptimal.Params('_analysis, {
        complexity: 'low'});
      const high.Complexity = await temperatureControllergetOptimal.Params('_analysis, {
        complexity: 'high'})// For _analysistasks, low complexity reduces temperature, high complexity increases it;
      expect(low.Complexitytemperature)toBeLess.Than(base.Paramstemperature);
      expect(high.Complexitytemperature)toBeGreater.Than(base.Paramstemperature)});
    it('should respect user preferences within bounds', async () => {
      const params = await temperatureControllergetOptimal.Params('code_generation', {
        user.Preference: 0.5})// Should clamp to max allowed for code generation (0.3);
      expect(paramstemperature)toBeLessThanOr.Equal(0.3)});
    it('should increase temperature for retry attempts', async () => {
      const first.Attempt = await temperatureControllergetOptimal.Params('general');
      const second.Attempt = await temperatureControllergetOptimal.Params('general', {
        previous.Attempts: 1});
      const third.Attempt = await temperatureControllergetOptimal.Params('general', {
        previous.Attempts: 2});
      expect(second.Attempttemperature)toBeGreater.Than(first.Attempttemperature);
      expect(third.Attempttemperature)toBeGreater.Than(second.Attempttemperature)});
    it('should adjust for quality requirements', async () => {
      const speed = await temperatureControllergetOptimal.Params('general', {
        quality.Requirement: 'speed'});
      const balanced = await temperatureControllergetOptimal.Params('general', {
        quality.Requirement: 'balanced'});
      const quality = await temperatureControllergetOptimal.Params('general', {
        quality.Requirement: 'quality'});
      expect(speedtemperature)toBeLess.Than(balancedtemperature);
      expect(qualitytemperature)toBeGreater.Than(balancedtemperature)})});
  describe('Complementary Parameters', () => {
    it('should calculate appropriate complementary parameters', async () => {
      const creative.Params = await temperatureControllergetOptimal.Params('creative_writing');
      const code.Params = await temperatureControllergetOptimal.Params('code_generation')// Creative writing should have higher top-k and repetition penalty;
      expect(creativeParamstop.K)toBeGreater.Than(codeParamstop.K!);
      expect(creativeParamsrepetition.Penalty)toBeGreater.Than(codeParamsrepetition.Penalty!)// Code generation should have no repetition penalty;
      expect(codeParamsrepetition.Penalty)to.Be(1.0)// Both should have top-p values;
      expect(creativeParamstop.P)toBe.Defined();
      expect(codeParamstop.P)toBe.Defined()});
    it('should set presence/frequency penalties for high temperatures', async () => {
      const highTemp.Params = await temperatureControllergetOptimal.Params('creative_writing');
      const lowTemp.Params = await temperatureControllergetOptimal.Params('code_generation');
      expect(highTempParamspresence.Penalty)toBe.Defined();
      expect(highTempParamsfrequency.Penalty)toBe.Defined();
      expect(lowTempParamspresence.Penalty)toBe.Undefined();
      expect(lowTempParamsfrequency.Penalty)toBe.Undefined()})});
  describe('Learning and Optimization', () => {
    it('should record results for future optimization', async () => {
      await temperatureControllerrecord.Result('code_generation', 0.1, true, 0.9);
      await temperatureControllerrecord.Result('code_generation', 0.2, false, 0.3);
      await temperatureControllerrecord.Result('code_generation', 0.15, true, 0.95)// Get recommendations to see if learning was applied;
      const recommendations = temperatureControllerget.Recommendations();
      const code.Rec = recommendationsfind((r) => rtask.Type === 'code_generation');
      expect(code.Rec?performance)toBe.Defined();
      expect(code.Rec?performance?success.Rate)toBeGreater.Than(0);
      expect(code.Rec?performance?total.Generations)to.Be(3)})});
  describe('Recommendations', () => {
    it('should provide comprehensive recommendations for all task types', () => {
      const recommendations = temperatureControllerget.Recommendations();
      expect(recommendationslength)toBeGreater.Than(5);
      recommendationsfor.Each((rec) => {
        expect(rectask.Type)toBe.Defined();
        expect(recdescription)toBe.Defined();
        expect(recrecommended)toBeGreater.Than(0);
        expect(recrangemin)toBeLessThanOr.Equal(recrangemax);
        expect(recrecommended)toBeGreaterThanOr.Equal(recrangemin);
        expect(recrecommended)toBeLessThanOr.Equal(recrangemax)})});
    it('should include learned temperatures when available', async () => {
      // Record multiple successful results;
      for (let i = 0; i < 15; i++) {
        await temperatureControllerrecord.Result('code_generation', 0.15, true, 0.9)};

      const recommendations = temperatureControllerget.Recommendations();
      const code.Rec = recommendationsfind((r) => rtask.Type === 'code_generation');
      expect(code.Rec?learned)toBe.Defined();
      expect(code.Rec?learned)toBeGreater.Than(0)})});
  describe('Edge Cases and Error Handling', () => {
    it('should handle unknown task types gracefully', async () => {
      const params = await temperatureControllergetOptimal.Params('completely_unknown_task')// Should default to general profile;
      expect(paramstemperature)toBeGreaterThanOr.Equal(0.3);
      expect(paramstemperature)toBeLessThanOr.Equal(0.7)});
    it('should handle partial task type matches', async () => {
      const params1 = await temperatureControllergetOptimal.Params('code');
      const params2 = await temperatureControllergetOptimal.Params('creative')// Should match code_generation and creative_writing profiles respectively;
      expect(params1temperature)toBeLessThanOr.Equal(0.3);
      expect(params2temperature)toBeGreaterThanOr.Equal(0.7)});
    it('should handle extreme user preferences', async () => {
      const params1 = await temperatureControllergetOptimal.Params('code_generation', {
        user.Preference: 10.0, // Way too high});
      const params2 = await temperatureControllergetOptimal.Params('code_generation', {
        user.Preference: -5.0, // Negative})// Should clamp to profile bounds;
      expect(params1temperature)to.Be(0.3)// Max for code_generation;
      expect(params2temperature)to.Be(0.0)// Min for code_generation});
    it('should handle excessive retry attempts', async () => {
      const params = await temperatureControllergetOptimal.Params('general', {
        previous.Attempts: 100})// Should cap the adjustment;
      const base.Params = await temperatureControllergetOptimal.Params('general');
      expect(paramstemperature - base.Paramstemperature)toBeLessThanOr.Equal(0.1)});
    it('should handle null quality scores in record.Result', async () => {
      // Should not throw;
      await expect(temperatureControllerrecord.Result('general', 0.5, true))resolvesnotto.Throw();
      await expect(
        temperatureControllerrecord.Result('general', 0.5, false))resolvesnotto.Throw()});
    it('should handle database errors gracefully', async () => {
      mockFrommockReturnValue.Once({
        select: jestfn()mockResolved.Value({ data: null, error instanceof Error ? errormessage : String(error) new Error('D.B Error') })})// Should not throw when loading metrics fails;
      const new.Controller = TemperatureControllerget.Instance();
      expect(new.Controller)toBe.Defined()})});
  describe('A/B Testing', () => {
    it('should occasionally apply A/B test variations', async () => {
      // Mock Mathrandom to control A/B testing;
      let random.Value = 0;
      Mathrandom = () => random.Value// Force A/B test to be applied;
      random.Value = 0.05// Less than 0.1 sample rate;
      const params1 = await temperatureControllergetOptimal.Params('general')// Force A/B test to not be applied;
      random.Value = 0.15// Greater than 0.1 sample rate;
      const params2 = await temperatureControllergetOptimal.Params('general')// One should have variation applied;
      expect(params1temperature)notto.Be(params2temperature)});
    it('should keep A/B test variations within profile bounds', async () => {
      Mathrandom = () => 0.05// Force A/B test;
      const params = await temperatureControllergetOptimal.Params('code_generation')// Should still be within code_generation bounds;
      expect(paramstemperature)toBeGreaterThanOr.Equal(0.0);
      expect(paramstemperature)toBeLessThanOr.Equal(0.3)})});
  describe('Persistence and Loading', () => {
    it('should load existing metrics on initialization', async () => {
      const mock.Data = [
        {
          task_type: 'code_generation';
          success_count: 50;
          failure_count: 5;
          avg_quality_score: 0.85;
          optimal_temp: 0.12;
          last_updated: new Date()toISO.String();
        }];
      mockSelectmockResolvedValue.Once({ data: mock.Data, error instanceof Error ? errormessage : String(error) null })// Create new instance to trigger loading;
      (Temperature.Controller as any)instance = undefined;
      const controller = TemperatureControllerget.Instance()// Wait for async loading;
      await new Promise((resolve) => set.Timeout(resolve, 10));
      const recommendations = controllerget.Recommendations();
      const code.Rec = recommendationsfind((r) => rtask.Type === 'code_generation');
      expect(code.Rec?performance?success.Rate)toBeClose.To(50 / 55, 2);
      expect(code.Rec?learned)to.Be(0.12)});
    it('should save metrics after recording results', async () => {
      await temperatureControllerrecord.Result('general', 0.5, true, 0.8)// Wait for async save;
      await new Promise((resolve) => set.Timeout(resolve, 10));
      expect(mock.From)toHaveBeenCalled.With('temperature_metrics');
      expect(mock.Upsert)toHaveBeen.Called();
      const upsert.Call = mock.Upsertmockcalls[0];
      expect(upsert.Call[0])to.Equal(
        expectarray.Containing([
          expectobject.Containing({
            task_type: 'general';
            success_count: 1;
            failure_count: 0})]))});
    it('should handle save errors gracefully', async () => {
      mockUpsertmockResolvedValue.Once({ error instanceof Error ? errormessage : String(error) new Error('Save failed') })// Should not throw;
      await expect(
        temperatureControllerrecord.Result('general', 0.5, true, 0.8))resolvesnotto.Throw()})});
  describe('Singleton Pattern', () => {
    it('should always return the same instance', () => {
      const instance1 = TemperatureControllerget.Instance();
      const instance2 = TemperatureControllerget.Instance();
      expect(instance1)to.Be(instance2)});
    it('should maintain state across get.Instance calls', async () => {
      const instance1 = TemperatureControllerget.Instance();
      await instance1record.Result('general', 0.5, true, 0.9);
      const instance2 = TemperatureControllerget.Instance();
      const recommendations = instance2get.Recommendations();
      const general.Rec = recommendationsfind((r) => rtask.Type === 'general');
      expect(general.Rec?performance?total.Generations)to.Be(1)})});
  describe('Parameter Calculation', () => {
    it('should calculate all complementary parameters correctly', async () => {
      const params = await temperatureControllergetOptimal.Params('creative_writing');
      expect(paramstemperature)toBe.Defined();
      expect(paramstop.P)toBe.Defined();
      expect(paramstop.K)toBe.Defined();
      expect(paramsrepetition.Penalty)toBe.Defined();
      expect(paramspresence.Penalty)toBe.Defined();
      expect(paramsfrequency.Penalty)toBe.Defined()});
    it('should calculate top-p inversely to temperature', async () => {
      const lowTemp.Params = await temperatureControllergetOptimal.Params('code_generation');
      const highTemp.Params = await temperatureControllergetOptimal.Params('creative_writing');
      expect(lowTempParamstop.P!)toBeGreater.Than(highTempParamstop.P!)});
    it('should not set presence/frequency penalties for low temperatures', async () => {
      const params = await temperatureControllergetOptimal.Params('code_generation');
      expect(paramspresence.Penalty)toBe.Undefined();
      expect(paramsfrequency.Penalty)toBe.Undefined()});
    it('should handle all task types in profiles', async () => {
      const task.Types = [
        'creative_writing';
        'code_generation';
        'factual_qa';
        'brainstorming';
        '_analysis;
        'translation';
        'summarization';
        'conversation';
        'technical_documentation';
        'general'];
      for (const task.Type of task.Types) {
        const params = await temperatureControllergetOptimal.Params(task.Type);
        expect(paramstemperature)toBeGreater.Than(0);
        expect(paramstemperature)toBeLessThanOr.Equal(1.0)}})});
  describe('Complex Context Handling', () => {
    it('should handle multiple context factors simultaneously', async () => {
      const params = await temperatureControllergetOptimal.Params('_analysis, {
        complexity: 'high';
        user.Preference: 0.35;
        previous.Attempts: 2;
        quality.Requirement: 'quality'})// Should be within _analysisbounds but adjusted;
      expect(paramstemperature)toBeGreaterThanOr.Equal(0.2);
      expect(paramstemperature)toBeLessThanOr.Equal(0.4);
      expect(paramstemperature)notto.Be(0.3)// Should differ from default});
    it('should prioritize user preference over other adjustments', async () => {
      const params = await temperatureControllergetOptimal.Params('general', {
        complexity: 'high';
        user.Preference: 0.4;
        previous.Attempts: 5;
        quality.Requirement: 'speed'})// User preference should override other adjustments;
      expect(paramstemperature)toBeClose.To(0.4, 1)})});
  describe('Learning and Optimization', () => {
    it('should update optimal temperature using gradient descent', async () => {
      // Record initial results;
      for (let i = 0; i < 20; i++) {
        await temperatureControllerrecord.Result('general', 0.45, true, 0.7)};

      const rec1 = temperatureControllerget.Recommendations()find((r) => rtask.Type === 'general');
      const learned1 = rec1?learned!// Record better results with different temperature;
      for (let i = 0; i < 20; i++) {
        await temperatureControllerrecord.Result('general', 0.55, true, 0.9)};

      const rec2 = temperatureControllerget.Recommendations()find((r) => rtask.Type === 'general');
      const learned2 = rec2?learned!// Should have adjusted toward better temperature;
      expect(learned2)notto.Be(learned1);
      expect(learned2)toBeGreater.Than(learned1)});
    it('should maintain quality score with exponential moving average', async () => {
      await temperatureControllerrecord.Result('general', 0.5, true, 0.9);
      await temperatureControllerrecord.Result('general', 0.5, true, 0.8);
      await temperatureControllerrecord.Result('general', 0.5, true, 0.7);
      const rec = temperatureControllerget.Recommendations()find((r) => rtask.Type === 'general')// Should be weighted average, not simple average;
      expect(rec?performance?avg.Quality)toBeGreater.Than(0.7);
      expect(rec?performance?avg.Quality)toBeLess.Than(0.9)});
    it('should not apply learning with insufficient data', async () => {
      // Record only a few results;
      for (let i = 0; i < 5; i++) {
        await temperatureControllerrecord.Result('general', 0.6, true, 0.9)};

      const params = await temperatureControllergetOptimal.Params('general')// Should use default, not learned temperature;
      expect(paramstemperature)toBeClose.To(0.5, 1)// Default for general})})});