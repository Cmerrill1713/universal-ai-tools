import { Anti.Hallucination.Service } from './././services/anti_hallucination_service';
import { create.Mock.Memory } from '././setup'// Mock Supabase;
const mock.From = jestfn();
const mock.Select = jestfn();
const mock.Or = jestfn();
const mock.Text.Search = jestfn();
const mock.Gte = jestfn();
const mock.Limit = jestfn()// Set up the chain;
mockFrommock.Return.Value({ select: mock.Select }),
mockSelectmock.Return.Value({
  or: mock.Or,
  text.Search: mock.Text.Search}),
mockOrmock.Return.Value({ limit: mock.Limit }),
mockTextSearchmock.Return.Value({ gte: mock.Gte }),
mockGtemock.Return.Value({ limit: mock.Limit }),
const mock.Supabase.Client = {
  from: mock.From,
jestmock('@supabase/supabase-js', () => ({
  create.Client: () => mock.Supabase.Client})),
describe('Anti.Hallucination.Service', () => {
  let service: Anti.Hallucination.Service,
  before.Each(() => {
    jestclear.All.Mocks();
    service = new Anti.Hallucination.Service()});
  describe('extract.Claims', () => {
    it('should extract factual claims from text', async () => {
      const text = 'Paris is the capital of France. The Eiffel Tower is 330 meters tall.';
      const claims = await service['extract.Claims'](text);
      expect(claims)to.Have.Length(2);
      expect(claims[0]claim)to.Contain('capital');
      expect(claims[1]claim)to.Contain('330 meters')});
    it('should handle empty text', async () => {
      const claims = await service['extract.Claims']('');
      expect(claims)to.Have.Length(0)});
    it('should filter out non-factual statements', async () => {
      const text =
        'I think Paris is nice. Maybe we should visit. The city has 2.1 million residents.';
      const claims = await service['extract.Claims'](text);
      expect(claims)to.Have.Length(1);
      expect(claims[0]claim)to.Contain('2.1 million residents')})});
  describe('search.Memories', () => {
    it('should search memories for relevant facts', async () => {
      const mock.Memories = [
        create.Mock.Memory({ content'Paris is the capital of France' });
        create.Mock.Memory({ content'London is the capital of U.K' })];
      mockLimitmockResolved.Value.Once({ data: mock.Memories, error instanceof Error ? errormessage : String(error) null });
      const results = await service['search.Memories']('capital of France');
      expect(results)to.Have.Length(2);
      expect(results[0]contentto.Contain('Paris')});
    it('should handle search errors gracefully', async () => {
      mockLimitmockResolved.Value.Once({ data: null, error instanceof Error ? errormessage : String(error) new Error('Search failed') });
      const results = await service['search.Memories']('test query');
      expect(results)to.Have.Length(0)})});
  describe('verify.With.Memory', () => {
    it('should verify truthful statements with high confidence', async () => {
      const truthful.Text = 'Paris is the capital of France.';
      mockLimitmock.Resolved.Value({
        data: [create.Mock.Memory({ content'Paris is the capital city of France' })],
        error instanceof Error ? errormessage : String(error) null});
      const result = await serviceverify.With.Memory(truthful.Text, {
        user.Request: 'What is the capital of France?'}),
      expect(resultscore)toBe.Greater.Than(0.6);
      expect(resultverifications)to.Be.Defined();
      expect(resultgrounded.Facts)toBe.Greater.Than(0)});
    it('should flag false statements with low confidence', async () => {
      const false.Text = 'London is the capital of France.';
      mockLimitmock.Resolved.Value({
        data: [create.Mock.Memory({ content'Paris is the capital city of France' })],
        error instanceof Error ? errormessage : String(error) null});
      const result = await serviceverify.With.Memory(false.Text, {
        user.Request: 'What is the capital of France?'}),
      expect(resultscore)toBeLessThan.Or.Equal(0.5);
      expect(resultverifications)to.Be.Defined();
      expect(resultwarnings)to.Be.Defined()});
    it('should handle statements with no memory support', async () => {
      const unknown.Text = 'The quantum flux capacitor operates at 1.21 gigawatts.';
      mockLimitmock.Resolved.Value({ data: [], error instanceof Error ? errormessage : String(error) null });
      const result = await serviceverify.With.Memory(unknown.Text, {
        user.Request: 'How does the quantum flux capacitor work?'}),
      expect(resultscore)toBe.Less.Than(0.5);
      expect(resultverifications)to.Be.Defined();
      expect(resultwarnings)to.Be.Defined()})});
  describe('ground.Response', () => {
    it('should generate grounded response with citations', async () => {
      const mock.Memories = [
        create.Mock.Memory({
          content'The Eiffel Tower is 330 meters tall';
          metadata: { source: 'Wikipedia' }}),
        create.Mock.Memory({
          content'The Eiffel Tower was built in 1889';
          metadata: { source: 'History Book' }})],
      mockLimitmockResolved.Value.Once({ data: mock.Memories, error instanceof Error ? errormessage : String(error) null });
      const result = await serviceground.Response('Tell me about the Eiffel Tower');
      expect(resultresponse)to.Contain('330 meters');
      expect(resultresponse)to.Contain('1889');
      expect(resultcitations)to.Have.Length(2)});
    it('should indicate low confidence when no memories found', async () => {
      mockLimitmockResolved.Value.Once({ data: [], error instanceof Error ? errormessage : String(error) null });
      const result = await serviceground.Response('Tell me about quantum computing');
      expect(resultresponse)to.Contain("don't have");
      expect(resultcitations)to.Have.Length(0)})});
  describe('multi.Model.Verification', () => {
    it('should handle verification chain', () => {
      const chain = serviceget.Verification.Chain();
      expect(chainquick)to.Be.Defined();
      expect(chainmedium)to.Be.Defined();
      expect(chaindeep)to.Be.Defined()});
    it('should update verification chain', () => {
      const new.Chain = {
        quick: 'new-quick-model',
        medium: 'new-medium-model',
      serviceupdate.Verification.Chain(new.Chain);
      const updated = serviceget.Verification.Chain();
      expect(updatedquick)to.Be('new-quick-model');
      expect(updatedmedium)to.Be('new-medium-model')})});
  describe('validate.Confidence', () => {
    it('should detect uncertainty markers in text', async () => {
      const uncertain.Text = 'I think this might be correct, but maybe not.';
      const result = await service['validate.Confidence'](uncertain.Text);
      expect(resultconfidence)toBe.Less.Than(0.8);
      expect(resultexplanation)to.Contain('uncertainty')});
    it('should not flag confident statements', async () => {
      const confident.Text = 'The Earth orbits around the Sun.';
      const result = await service['validate.Confidence'](confident.Text);
      expect(resultconfidence)toBeGreaterThan.Or.Equal(0.5)})});
  describe('performance', () => {
    it('should complete verification within reasonable time', async () => {
      const start.Time = Date.now();
      mockLimitmock.Resolved.Value({ data: [], error instanceof Error ? errormessage : String(error) null });
      await serviceverify.With.Memory('Test statement', {});
      const duration = Date.now() - start.Time;
      expect(duration)toBe.Less.Than(1000)// Should complete within 1 second})})});