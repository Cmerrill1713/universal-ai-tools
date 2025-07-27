import { AntiHallucination.Service } from './././services/anti_hallucination_service';
import { createMock.Memory } from '././setup'// Mock Supabase;
const mock.From = jestfn();
const mock.Select = jestfn();
const mock.Or = jestfn();
const mockText.Search = jestfn();
const mock.Gte = jestfn();
const mock.Limit = jestfn()// Set up the chain;
mockFrommockReturn.Value({ select: mock.Select });
mockSelectmockReturn.Value({
  or: mock.Or;
  text.Search: mockText.Search});
mockOrmockReturn.Value({ limit: mock.Limit });
mockTextSearchmockReturn.Value({ gte: mock.Gte });
mockGtemockReturn.Value({ limit: mock.Limit });
const mockSupabase.Client = {
  from: mock.From};
jestmock('@supabase/supabase-js', () => ({
  create.Client: () => mockSupabase.Client}));
describe('AntiHallucination.Service', () => {
  let service: AntiHallucination.Service;
  before.Each(() => {
    jestclearAll.Mocks();
    service = new AntiHallucination.Service()});
  describe('extract.Claims', () => {
    it('should extract factual claims from text', async () => {
      const text = 'Paris is the capital of France. The Eiffel Tower is 330 meters tall.';
      const claims = await service['extract.Claims'](text);
      expect(claims)toHave.Length(2);
      expect(claims[0]claim)to.Contain('capital');
      expect(claims[1]claim)to.Contain('330 meters')});
    it('should handle empty text', async () => {
      const claims = await service['extract.Claims']('');
      expect(claims)toHave.Length(0)});
    it('should filter out non-factual statements', async () => {
      const text =
        'I think Paris is nice. Maybe we should visit. The city has 2.1 million residents.';
      const claims = await service['extract.Claims'](text);
      expect(claims)toHave.Length(1);
      expect(claims[0]claim)to.Contain('2.1 million residents')})});
  describe('search.Memories', () => {
    it('should search memories for relevant facts', async () => {
      const mock.Memories = [
        createMock.Memory({ content'Paris is the capital of France' });
        createMock.Memory({ content'London is the capital of U.K' })];
      mockLimitmockResolvedValue.Once({ data: mock.Memories, error instanceof Error ? errormessage : String(error) null });
      const results = await service['search.Memories']('capital of France');
      expect(results)toHave.Length(2);
      expect(results[0]contentto.Contain('Paris')});
    it('should handle search errors gracefully', async () => {
      mockLimitmockResolvedValue.Once({ data: null, error instanceof Error ? errormessage : String(error) new Error('Search failed') });
      const results = await service['search.Memories']('test query');
      expect(results)toHave.Length(0)})});
  describe('verifyWith.Memory', () => {
    it('should verify truthful statements with high confidence', async () => {
      const truthful.Text = 'Paris is the capital of France.';
      mockLimitmockResolved.Value({
        data: [createMock.Memory({ content'Paris is the capital city of France' })];
        error instanceof Error ? errormessage : String(error) null});
      const result = await serviceverifyWith.Memory(truthful.Text, {
        user.Request: 'What is the capital of France?'});
      expect(resultscore)toBeGreater.Than(0.6);
      expect(resultverifications)toBe.Defined();
      expect(resultgrounded.Facts)toBeGreater.Than(0)});
    it('should flag false statements with low confidence', async () => {
      const false.Text = 'London is the capital of France.';
      mockLimitmockResolved.Value({
        data: [createMock.Memory({ content'Paris is the capital city of France' })];
        error instanceof Error ? errormessage : String(error) null});
      const result = await serviceverifyWith.Memory(false.Text, {
        user.Request: 'What is the capital of France?'});
      expect(resultscore)toBeLessThanOr.Equal(0.5);
      expect(resultverifications)toBe.Defined();
      expect(resultwarnings)toBe.Defined()});
    it('should handle statements with no memory support', async () => {
      const unknown.Text = 'The quantum flux capacitor operates at 1.21 gigawatts.';
      mockLimitmockResolved.Value({ data: [], error instanceof Error ? errormessage : String(error) null });
      const result = await serviceverifyWith.Memory(unknown.Text, {
        user.Request: 'How does the quantum flux capacitor work?'});
      expect(resultscore)toBeLess.Than(0.5);
      expect(resultverifications)toBe.Defined();
      expect(resultwarnings)toBe.Defined()})});
  describe('ground.Response', () => {
    it('should generate grounded response with citations', async () => {
      const mock.Memories = [
        createMock.Memory({
          content'The Eiffel Tower is 330 meters tall';
          metadata: { source: 'Wikipedia' }});
        createMock.Memory({
          content'The Eiffel Tower was built in 1889';
          metadata: { source: 'History Book' }})];
      mockLimitmockResolvedValue.Once({ data: mock.Memories, error instanceof Error ? errormessage : String(error) null });
      const result = await serviceground.Response('Tell me about the Eiffel Tower');
      expect(resultresponse)to.Contain('330 meters');
      expect(resultresponse)to.Contain('1889');
      expect(resultcitations)toHave.Length(2)});
    it('should indicate low confidence when no memories found', async () => {
      mockLimitmockResolvedValue.Once({ data: [], error instanceof Error ? errormessage : String(error) null });
      const result = await serviceground.Response('Tell me about quantum computing');
      expect(resultresponse)to.Contain("don't have");
      expect(resultcitations)toHave.Length(0)})});
  describe('multiModel.Verification', () => {
    it('should handle verification chain', () => {
      const chain = servicegetVerification.Chain();
      expect(chainquick)toBe.Defined();
      expect(chainmedium)toBe.Defined();
      expect(chaindeep)toBe.Defined()});
    it('should update verification chain', () => {
      const new.Chain = {
        quick: 'new-quick-model';
        medium: 'new-medium-model'};
      serviceupdateVerification.Chain(new.Chain);
      const updated = servicegetVerification.Chain();
      expect(updatedquick)to.Be('new-quick-model');
      expect(updatedmedium)to.Be('new-medium-model')})});
  describe('validate.Confidence', () => {
    it('should detect uncertainty markers in text', async () => {
      const uncertain.Text = 'I think this might be correct, but maybe not.';
      const result = await service['validate.Confidence'](uncertain.Text);
      expect(resultconfidence)toBeLess.Than(0.8);
      expect(resultexplanation)to.Contain('uncertainty')});
    it('should not flag confident statements', async () => {
      const confident.Text = 'The Earth orbits around the Sun.';
      const result = await service['validate.Confidence'](confident.Text);
      expect(resultconfidence)toBeGreaterThanOr.Equal(0.5)})});
  describe('performance', () => {
    it('should complete verification within reasonable time', async () => {
      const start.Time = Date.now();
      mockLimitmockResolved.Value({ data: [], error instanceof Error ? errormessage : String(error) null });
      await serviceverifyWith.Memory('Test statement', {});
      const duration = Date.now() - start.Time;
      expect(duration)toBeLess.Than(1000)// Should complete within 1 second})})});