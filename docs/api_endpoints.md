# Universal AI Tools - API Endpoint Inventory

## a2a-collaboration

22:router.post('/collaboration/request', async (req, res) => {
75:router.post('/knowledge/share', async (req, res) => {
134:router.get('/agents/optimal', async (req, res) => {
196:router.get('/agents/team', async (req, res) => {
252:router.get('/mesh/status', async (req, res) => {
310:router.post('/message/send', async (req, res) => {
363:router.post('/demo/collaborative-task', async (req, res) => {

## ab-mcts

58:router.post('/orchestrate', async (req: Request, res: Response, next: NextFunction) => {
121:router.post('/orchestrate/batch', async (req: Request, res: Response, next: NextFunction) => {
188:router.post('/feedback', async (req: Request, res: Response, next: NextFunction) => {
223:router.get('/metrics', async (req: Request, res: Response, next: NextFunction) => {
268:router.get('/models', async (req: Request, res: Response, next: NextFunction) => {
309:router.get(
335:router.get('/report', async (req: Request, res: Response, next: NextFunction) => {
352:router.post('/reset', async (req: Request, res: Response, next: NextFunction) => {
377:router.get('/health', async (req: Request, res: Response) => {

## agent-orchestration

300:router.get('/status', authenticate, async (req: Request, res: Response) => {
360:router.get('/topology', authenticate, async (req: Request, res: Response) => {
381:router.get('/metrics', authenticate, async (req: Request, res: Response) => {
424:router.post('/tasks', authenticate, async (req: Request, res: Response) => {
477:router.get('/tasks', authenticate, async (req: Request, res: Response) => {
529:router.post('/collaborate', authenticate, async (req: Request, res: Response) => {
575:router.get('/communications', authenticate, async (req: Request, res: Response) => {
619:router.get('/resources', authenticate, async (req: Request, res: Response) => {
679:router.post('/orchestrate', authenticate, async (req: Request, res: Response) => {

## agents

15:router.get('/health', async (req: Request, res: Response): Promise<Response> => {
157:router.get('/', authenticate, async (req: Request, res: Response) => {
265:router.post('/detect', async (req: Request, res: Response) => {
369:router.post('/discover-features', authenticate, async (req: Request, res: Response) => {

## assistant

40:router.get('/status', (req, res) => {
48:router.post(

## athena

11:router.get('/status', (req, res) => {

## auth

36:router.get('/', async (req: Request, res: Response) => {
70:router.post(
201:router.post('/validate', async (req: Request, res: Response) => {
276:router.get('/info', async (req: Request, res: Response) => {
358:router.get('/demo', async (req: Request, res: Response) => {
404:router.post('/login', async (req: Request, res: Response) => {
474:router.post('/test-chat', async (req: Request, res: Response) => {

## autocodebench-reasonrank-router

87:router.get('/health', (req, res) => {
105:router.post('/generate-problem', async (req, res) => {
146:router.post('/solve-problem', async (req, res) => {
202:router.post('/execute-code', async (req, res) => {
256:router.get('/problems', (req, res) => {
286:router.get('/problems/:id', (req, res) => {
325:router.get('/metrics', (req, res) => {
356:router.post('/rank-passages', async (req, res) => {
426:router.post('/generate-training-data', async (req, res) => {
502:router.get('/training-data', (req, res) => {

## autonomous-actions

23:router.get('/status', async (req: Request, res: Response) => {
62:router.get('/history', async (req: Request, res: Response) => {
100:router.post('/pause', async (req: Request, res: Response) => {
128:router.post('/resume', async (req: Request, res: Response) => {
156:router.get('/insights', async (req: Request, res: Response) => {
194:router.post('/manual-trigger', async (req: Request, res: Response) => {
228:router.get('/policy', async (req: Request, res: Response) => {
264:router.get('/metrics', async (req: Request, res: Response) => {

## calendar

16:router.get('/status', authenticate, async (req, res) => {
47:router.get('/events', authenticate, async (req, res) => {
75:router.post('/events', authenticate, async (req, res) => {
97:router.get('/availability', authenticate, async (req, res) => {
130:router.post('/schedule', authenticate, async (req, res) => {
167:router.post('/providers', authenticate, async (req, res) => {
203:router.post('/sync', authenticate, async (req, res) => {
225:router.get('/providers', authenticate, async (req, res) => {
247:router.get('/upcoming', authenticate, async (req, res) => {
272:router.get('/events/:id', authenticate, async (req, res) => {

## chat

107:router.get('/conversations', authenticate, async (req: Request, res: Response) => {
153:router.get(
213:router.post(
284:router.post(
649:router.post(
969:router.post(
1035:router.delete(

## claude-knowledge

14:router.get('/mcp-status', async (req, res) => {
33:router.post('/mcp-status', async (req, res) => {
52:router.get('/search', async (req, res) => {
88:router.post('/context', async (req, res) => {
107:router.get('/context/:category', async (req, res) => {
132:router.post('/swift-expertise', async (req, res) => {
151:router.post('/memory', async (req, res) => {
178:router.get('/stats', async (req, res) => {
196:router.post('/initialize', async (req, res) => {
214:router.get('/id/:knowledgeId', async (req, res) => {

## codebase-optimizer

23:router.post('/analyze', async (req, res) => {
125:router.post('/optimize', async (req, res) => {
224:router.post('/performance', async (req, res) => {
332:router.post('/security', async (req, res) => {
440:router.get('/status', async (_req, res) => {

## context-analytics

16:router.get('/status', authenticate, async (req, res) => {
37:router.get('/metrics', authenticate, async (req, res) => {
58:router.get('/user/:userId', authenticate, async (req, res) => {
88:router.get('/compression', authenticate, async (req, res) => {
109:router.get('/patterns', authenticate, async (req, res) => {
132:router.post('/optimize', authenticate, async (req, res) => {
155:router.get('/health', async (req, res) => {

## context-management

219:router.post('/store', 
307:router.post('/search',
394:router.post('/clusters',
493:router.post('/flow',
541:router.get('/:contextId/similar',
611:router.get('/analytics',
656:router.get('/templates',
688:router.post('/templates',
747:router.get('/realtime/status',
782:router.put('/:contextId',

## context

32:router.post('/semantic-search', async (req, res) => {
86:router.post('/:userId/backfill-embeddings', async (req, res) => {
116:router.get('/:userId', async (req, res) => {
167:router.get('/:userId/stats', async (req, res) => {
202:router.post('/:userId/search', async (req, res) => {
272:router.post('/:userId', async (req, res) => {
341:router.post('/messages', async (req, res) => {
394:router.get('/enhanced/:sessionId/:userId', async (req, res) => {
439:router.post('/semantic-search', async (req, res) => {
492:router.get('/analytics/metrics', async (req, res) => {

## conversation-context

23:router.post('/save', async (req, res) => {
93:router.get('/list', async (req, res) => {
128:router.get('/:id', async (req, res) => {

## correlation-metrics

18:router.get(
57:router.post(
95:router.put(
125:router.get(
171:router.get(

## crawl4ai

16:router.get('/health', async (req: Request, res: Response): Promise<Response> => {
46:router.post('/crawl', async (req: Request, res: Response): Promise<Response> => {
94:router.post('/batch', async (req: Request, res: Response): Promise<Response> => {
162:router.get('/batch/:jobId', async (req: Request, res: Response): Promise<Response> => {
208:router.post('/website', async (req: Request, res: Response): Promise<Response> => {
291:router.post('/extract', async (req: Request, res: Response): Promise<Response> => {
353:router.post('/monitor', async (req: Request, res: Response): Promise<Response> => {
415:router.get('/stats', async (req: Request, res: Response): Promise<Response> => {
440:router.post('/cleanup', async (req: Request, res: Response): Promise<Response> => {

## database-health

21:router.get('/health', async (req: Request, res: Response) => {
47:router.get('/metrics', async (req: Request, res: Response) => {
83:router.post('/refresh', async (req: Request, res: Response) => {
129:router.post('/test', async (req: Request, res: Response) => {
273:router.get('/status', async (req: Request, res: Response) => {
315:router.post('/emergency-recovery', async (req: Request, res: Response) => {

## device-auth

134:router.post(
241:router.post(
346:router.get('/devices', authenticate, async (req: Request, res: Response) => {
391:router.post(
496:router.post(
640:router.post(

## environmental-awareness

16:router.get('/status', authenticate, async (req, res) => {
37:router.get('/context', authenticate, async (req, res) => {
58:router.get('/time-context', authenticate, async (req, res) => {
79:router.get('/location', authenticate, async (req, res) => {
100:router.get('/device', authenticate, async (req, res) => {
121:router.post('/activity', authenticate, async (req, res) => {
143:router.get('/recommendations', authenticate, async (req, res) => {
164:router.get('/health', async (req, res) => {

## error-monitoring

21:router.get('/health', (req: Request, res: Response) => {
75:router.get('/metrics', authenticate, (req: Request, res: Response) => {
107:router.get('/errors', authenticate, requireAdmin, (req: Request, res: Response) => {
142:router.get('/trends', authenticate, requireAdmin, (req: Request, res: Response) => {
172:router.post('/alerts/config', authenticate, requireAdmin, (req: Request, res: Response) => {
226:router.post('/reset', authenticate, requireAdmin, (req: Request, res: Response) => {
254:router.get('/dashboard', authenticate, (req: Request, res: Response) => {

## errors

14:router.get(
46:router.get(
89:router.post(

## example-standardized-router

40:router.post('/chat',
91:router.get('/agents/:id',

## external-apis

14:router.get('/', async (req, res) => {
40:router.get('/:id', async (req, res) => {
78:router.post('/', async (req, res) => {
122:router.put('/:id', async (req, res) => {
158:router.delete('/:id', async (req, res) => {
192:router.post('/:id/toggle', async (req, res) => {
236:router.post('/:id/request', async (req, res) => {
279:router.get('/type/:type', async (req, res) => {
309:router.get('/capability/:capability', async (req, res) => {
339:router.get('/:id/status', async (req, res) => {

## fast-coordinator

20:router.post('/routing-decision', async (req, res): Promise<any> => {
75:router.post('/execute', async (req, res): Promise<any> => {
128:router.post('/coordinate-agents', async (req, res): Promise<any> => {
181:router.post('/lfm2/quick', async (req, res): Promise<any> => {
227:router.post('/optimize', async (req, res): Promise<any> => {
270:router.post('/benchmark', async (req, res): Promise<any> => {
312:router.get('/status', async (req, res): Promise<any> => {
349:router.post('/auto-tune', async (req, res): Promise<any> => {
379:router.get('/health', async (req, res): Promise<any> => {

## feature-discovery

19:router.post('/discover', authenticate, async (req, res) => {
86:router.get('/search', authenticate, async (req, res) => {
142:router.get('/recommendations', authenticate, async (req, res) => {
178:router.get('/categories', authenticate, async (req, res) => {
201:router.get('/categories/:categoryId', authenticate, async (req, res) => {
236:router.post('/usage/:featureId', authenticate, async (req, res) => {
277:router.get('/analytics', authenticate, async (req, res) => {
305:router.get('/help', async (req, res) => {
381:router.post('/guided-discovery', authenticate, async (req, res) => {

## feedback

32:router.post('/submit', async (req: Request, res: Response) => {
142:router.get('/history', async (req: Request, res: Response) => {
182:router.get('/analytics', async (req: Request, res: Response) => {
228:router.put('/:feedbackId/status', async (req: Request, res: Response) => {
271:router.get('/issues', async (req: Request, res: Response) => {
298:router.get('/suggestions', async (req: Request, res: Response) => {
325:router.post('/rating', async (req: Request, res: Response) => {
388:router.post('/bug', async (req: Request, res: Response) => {
465:router.post('/feature', async (req: Request, res: Response) => {

## flash-attention

46:router.post('/optimize', validateRequestBody(flashAttentionOptimizeSchema), async (req: Request, res: Response) => {
111:router.get('/capabilities', async (req: Request, res: Response) => {
127:router.get('/metrics', async (req: Request, res: Response) => {
143:router.put('/config', validateRequestBody(flashAttentionConfigSchema), async (req: Request, res: Response) => {
171:router.delete('/cache', async (req: Request, res: Response) => {
191:router.get('/health', async (req: Request, res: Response) => {
211:router.post('/benchmark', async (req: Request, res: Response) => {
323:router.post('/recommendations', async (req: Request, res: Response) => {

## framework-inventory

56:router.get('/', async (req, res): Promise<void> => {
136:router.get('/categories', async (req, res): Promise<void> => {
163:router.get('/:id', async (req, res): Promise<void> => {
215:router.get('/:id/graph', async (req, res): Promise<void> => {
343:router.get('/search/:term', async (req, res): Promise<void> => {
372:router.get('/network/overview', async (req, res): Promise<void> => {

## frontend-fixer

36:router.get('/status', (req: Request, res: Response) => {
57:router.post('/analyze', async (req: Request, res: Response) => {
104:router.post('/fix', async (req: Request, res: Response) => {
189:router.post('/validate', async (req: Request, res: Response) => {

## graph-sync

12:router.post('/conversations', async (req, res) => {
61:router.get('/status', async (req, res) => {
83:router.post('/query', async (req, res) => {
117:router.post('/paths', async (req, res) => {

## graphrag

59:router.post(
180:router.post(
227:router.post(
269:router.get('/metrics', async (req, res) => {
292:router.get('/visualize', async (req, res) => {
333:router.get('/health', async (req, res) => {

## hardware-auth

22:router.post('/proximity', async (req: Request, res: Response) => {
58:router.get('/profiles', authenticate, async (req: Request, res: Response) => {
89:router.post('/profiles', authenticate, async (req: Request, res: Response) => {
139:router.post('/profiles/:profileId/devices', authenticate, async (req: Request, res: Response) => {
193:router.put('/devices/:deviceId/trust', authenticate, async (req: Request, res: Response) => {
232:router.get('/sessions', authenticate, async (req: Request, res: Response) => {
252:router.get('/events', authenticate, async (req: Request, res: Response) => {
273:router.post('/setup-family', authenticate, async (req: Request, res: Response) => {
323:router.get('/status', async (req: Request, res: Response) => {

## huggingface

48:router.get('/health', async (req, res) => {
78:router.get('/metrics', async (req, res) => {
109:router.get('/models', async (req, res) => {
133:router.post(
191:router.post('/embeddings', async (req, res) => {
233:router.post(
281:router.post('/summarize', async (req, res) => {
324:router.post('/sentiment', async (req, res) => {
363:router.post('/batch', async (req, res) => {

## knowledge-acquisition

59:router.post('/acquire', async (req: Request, res: Response): Promise<Response> => {
128:router.post('/search-chunks', async (req: Request, res: Response): Promise<Response> => {
166:router.post('/export-chunks', async (req: Request, res: Response): Promise<Response> => {
212:router.get('/health', async (req: Request, res: Response): Promise<Response> => {
249:router.delete('/cache', async (req: Request, res: Response): Promise<Response> => {

## knowledge-graph

240:router.get('/overview',
273:router.get('/visualization',
336:router.post('/ingest',
446:router.post('/entities',
489:router.get('/entities/:id',
520:router.post('/relationships',
566:router.post('/search',
622:router.post('/traverse',
681:router.post('/communities/detect',
739:router.get('/analytics',

## knowledge-ingestion

20:router.post(
99:router.post(
145:router.post(
194:router.post(
234:router.get('/stats', async (req, res) => {
263:router.post('/test', async (req, res) => {
297:router.delete('/clear', async (req, res) => {

## knowledge-scraper

38:router.post('/scrape', async (req: Request, res: Response, next: NextFunction) => {
85:router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
121:router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
138:router.get('/sources', async (req: Request, res: Response) => {
201:router.get('/categories', async (req: Request, res: Response) => {
226:router.post('/sources/:sourceName/toggle', async (req: Request, res: Response) => {
248:router.get('/health', async (req: Request, res: Response) => {
267:router.get('/reranking/stats', async (req: Request, res: Response, next: NextFunction) => {

## llm-stream

12:router.get('/status/:sessionId', (req, res) => {
61:router.get('/current/:sessionId', (req, res) => {
76:router.post('/test', async (req, res) => {

## local-llm

45:router.get('/health', async (req: Request, res: Response) => {
70:router.get('/models', async (req: Request, res: Response) => {
125:router.post(
345:router.post(
409:router.post(
472:router.post(

## local

15:router.get('/health', async (req, res) => {
53:router.get('/models', async (req, res) => {
94:router.post('/chat', async (req, res): Promise<void> => {

## mcp-agent

15:router.get('/status', async (req, res) => {
50:router.get('/resources', async (req, res) => {
103:router.get('/resources/:uri', async (req, res) => {
155:router.get('/tools', async (req, res) => {
249:router.post('/tools/call', async (req, res) => {
289:router.get('/prompts', async (req, res) => {
328:router.post('/prompts/get', async (req, res) => {

## memory-optimization

19:router.get('/status', authenticate, async (req, res) => {
58:router.post('/optimize', authenticate, async (req, res) => {
92:router.get('/analytics', authenticate, async (req, res) => {
116:router.post('/gc', authenticate, async (req, res) => {
161:router.get('/config', authenticate, async (req, res) => {
204:router.post('/thresholds', authenticate, async (req, res) => {

## memory

44:router.get(
107:router.get(
161:router.post(
221:router.put(
276:router.delete(
318:router.post(
357:router.post(

## metrics

14:router.post('/feedback', (req, res) => {
22:router.get('/summary', (req, res) => {
27:router.get('/lfm2', (req, res) => {
37:router.post('/lfm2/limits', (req, res) => {
54:router.get('/memory/stats', async (req, res) => {
60:router.post('/memory/summarize', async (req, res) => {

## mlx-fine-tuning

136:router.post('/datasets', upload.single('dataset'), async (req: Request, res: Response) => {
217:router.get('/datasets', async (req: Request, res: Response) => {
238:router.post('/jobs', async (req: Request, res: Response) => {
329:router.post('/jobs/:jobId/start', async (req: Request, res: Response) => {
353:router.post('/jobs/:jobId/pause', async (req: Request, res: Response) => {
376:router.post('/jobs/:jobId/resume', async (req: Request, res: Response) => {
399:router.post('/jobs/:jobId/cancel', async (req: Request, res: Response) => {
422:router.get('/jobs', async (req: Request, res: Response) => {
440:router.get('/jobs/:jobId', async (req: Request, res: Response) => {
461:router.delete('/jobs/:jobId', async (req: Request, res: Response) => {

## mlx

128:router.get(
174:router.get(
219:router.get(
275:router.post(
364:router.post(
471:router.get(
525:router.post(
583:router.delete(
631:router.get(

## mobile-orchestration

11:router.get('/status', (req, res) => {

## models

20:router.get('/discover', async (req, res) => {
77:router.get('/list', (req, res) => {
101:router.post('/route', async (req, res) => {
140:router.get('/performance', (req, res) => {
158:router.post('/test', async (req, res) => {
204:router.get('/capabilities', (req, res) => {
230:router.post('/reset-performance', (req, res) => {

## monitoring-dashboard

37:router.get('/overview', authenticate, requireAdmin, async (req, res) => {
92:router.get('/metrics/realtime', authenticate, requireAdmin, (req, res) => {
119:router.get('/metrics/history', authenticate, requireAdmin, (req, res) => {
158:router.get('/traces', authenticate, requireAdmin, (req, res) => {
207:router.get('/traces/:traceId', (req, res) => {
246:router.get('/traces/slow', (req, res) => {
281:router.get('/traces/errors', (req, res) => {
315:router.get('/logs', authenticate, requireAdmin, (req, res) => {
351:router.get('/logs/analytics', (req, res) => {
386:router.get('/logs/export', (req, res) => {

## monitoring

47:router.get('/health/detailed', async (req, res) => {
142:router.get('/circuit-breakers', (req, res) => {
156:router.post('/circuit-breakers/:name/reset', (req, res) => {
176:router.get('/models/performance', async (req, res) => {
209:router.get('/metrics/stream', (req, res) => {
249:router.get('/health/automated', async (req, res) => {
269:router.post('/health/check-all', async (req, res) => {
290:router.get('/health/service/:serviceName', async (req, res) => {
319:router.get('/diagnostics', async (req, res) => {
396:router.get('/metrics', async (req, res) => {

## optimized-collaboration

14:router.get('/stats', async (req, res) => {
32:router.post('/session', async (req, res) => {
69:router.post('/session/:sessionId/decision', async (req, res) => {
107:router.get('/session/:sessionId', async (req, res) => {
153:router.get('/sessions/active', async (req, res) => {
178:router.post('/optimize', async (req, res) => {
223:router.post('/heal', async (req, res) => {

## orchestration

9:router.get('/status', async (_req, res) => {
21:router.post('/orchestrate', async (req, res) => {
40:router.post('/optimize/prompts', async (req, res) => {
55:router.post('/knowledge', async (req, res) => {

## parameters

39:router.get('/', async (req: Request, res: Response) => {
73:router.post(
124:router.get('/presets', authenticate, async (req: Request, res: Response) => {
203:router.get('/analytics', authenticate, async (req: Request, res: Response) => {
243:router.get('/models', authenticate, async (req: Request, res: Response) => {

## performance-analytics

557:router.get('/metrics/realtime', authenticate, async (req, res) => {
596:router.get('/memory/timeline', authenticate, async (req, res) => {
655:router.get('/attention/heatmap', authenticate, async (req, res) => {
737:router.get('/bottlenecks', authenticate, async (req, res) => {
799:router.get('/health/trending', authenticate, async (req, res) => {
865:router.get('/optimization/suggestions', authenticate, requireAdmin, async (req, res) => {
952:router.get('/historical', authenticate, async (req, res) => {
1015:router.get('/stream', (req, res) => {
1069:router.post('/gc', authenticate, requireAdmin, async (req, res) => {
1121:router.post('/optimize', authenticate, requireAdmin, async (req, res) => {

## performance

41:router.get('/metrics', async (req, res) => {
98:router.post('/gc', async (req, res) => {
147:router.get('/object-pools', async (req, res) => {
173:router.post('/clear-pools', async (req, res) => {

## proactive-tasks

16:router.get('/status', authenticate, async (req, res) => {
37:router.get('/', authenticate, async (req, res) => {
59:router.post('/', authenticate, async (req, res) => {
96:router.put('/:taskId', authenticate, async (req, res) => {
128:router.delete('/:taskId', authenticate, async (req, res) => {
159:router.post('/:taskId/execute', authenticate, async (req, res) => {
190:router.get('/suggestions', authenticate, async (req, res) => {

## programming-languages

18:router.post('/initialize', async (req, res) => {
41:router.get('/', async (req, res) => {
63:router.get('/search', async (req, res) => {
95:router.get('/:name', async (req, res) => {
125:router.get('/category/:category', async (req, res) => {
150:router.post('/compare', async (req, res) => {
181:router.get('/:name/examples', async (req, res) => {
206:router.post('/:name/examples', async (req, res) => {
245:router.post('/analyze-commonalities', async (req, res) => {
275:router.get('/use-case/:useCase', async (req, res) => {

## repository-ml

85:router.post(
121:router.post(
162:router.post(
216:router.post(
255:router.post(
304:router.post(
344:router.post(
394:router.get('/metrics', async (req: Request, res: Response) => {
422:router.post(
476:router.get('/stream', (req: Request, res: Response) => {

## secrets

22:router.get('/services', async (req: Request, res: Response, next: NextFunction) => {
86:router.post('/store', async (req: Request, res: Response, next: NextFunction) => {
121:router.delete('/delete/:service', async (req: Request, res: Response, next: NextFunction) => {
169:router.post('/migrate', async (req: Request, res: Response, next: NextFunction) => {
209:router.get('/health', async (req: Request, res: Response, next: NextFunction) => {
250:router.post('/get', async (req: Request, res: Response, next: NextFunction) => {
301:router.post('/client/store', async (req: Request, res: Response, next: NextFunction) => {
352:router.delete('/client/delete', async (req: Request, res: Response, next: NextFunction) => {
414:router.post('/sync', async (req: Request, res: Response, next: NextFunction) => {
509:router.get('/status', async (req: Request, res: Response, next: NextFunction) => {

## self-optimization

14:router.get('/status', async (req, res) => {
46:router.post('/start', async (req, res) => {
70:router.post('/stop', async (req, res) => {
93:router.get('/metrics', async (req, res) => {
124:router.get('/actions', async (req, res) => {
155:router.post('/trigger', async (req, res) => {
183:router.get('/health', async (req, res) => {
251:router.get('/config', async (req, res) => {

## smart-context

22:router.get('/recent-work', async (req, res) => {
54:router.get('/connection', async (req, res) => {
99:router.get('/solution', async (req, res) => {
142:router.get('/status', async (req, res) => {
178:router.post('/query', async (req, res) => {
219:router.post('/breadcrumb', async (req, res) => {
260:router.get('/related-components', async (req, res) => {
304:router.post('/learn-connection', async (req, res) => {
342:router.get('/connection-stats', async (req, res) => {
369:router.get('/diagnostic', async (req, res) => {

## speculative-decoding

16:router.get('/status', authenticate, async (req, res) => {
37:router.post('/generate', authenticate, async (req, res) => {
63:router.get('/performance', authenticate, async (req, res) => {
84:router.post('/optimize', authenticate, async (req, res) => {
114:router.get('/pairs', authenticate, async (req, res) => {
135:router.post('/benchmark', authenticate, async (req, res) => {

## speech

39:router.get('/voices', authenticate, async (req: Request, res: Response) => {
66:router.post('/synthesize', 
109:router.post('/transcribe',
151:router.post('/command',
197:router.get('/status', async (req: Request, res: Response) => {

## status

19:router.get('/health', async (req, res) => {
56:router.get('/errors', async (req, res) => {
98:router.get('/patterns', async (req, res) => {
141:router.get('/metrics', async (req, res) => {
184:router.get('/', async (req, res) => {
230:router.get('/recovery', async (req, res) => {
274:router.get('/ping', (req, res) => {

## swift-docs

13:router.post('/initialize', asyncHandler(async (req: Request, res: Response) => {
27:router.post('/scrape', asyncHandler(async (req: Request, res: Response) => {
46:router.get('/query', asyncHandler(async (req: Request, res: Response) => {
71:router.get('/component/:name', asyncHandler(async (req: Request, res: Response) => {
92:router.get('/window-implementation', asyncHandler(async (req: Request, res: Response) => {

## system-metrics

51:router.get('/metrics', async (req: Request, res: Response, next: NextFunction) => {
136:router.get('/performance', async (req: Request, res: Response, next: NextFunction) => {
211:router.get('/agents/performance', async (req: Request, res: Response, next: NextFunction) => {
262:router.get('/health', async (req: Request, res: Response) => {

## training

24:router.get('/status', authenticate, (req, res) => {
58:router.post('/evaluate', authenticate, async (req, res) => {
79:router.post(
112:router.put(
152:router.post(
206:router.get('/evolution/history', authenticate, (req, res) => {
235:router.post(
291:router.get('/speculative/pairs', authenticate, (req, res) => {
320:router.get('/speculative/stats', authenticate, (req, res) => {
341:router.get('/mlx/models', authenticate, async (req, res) => {

## user-preferences

40:router.post('/recommendations', async (req: Request, res: Response) => {
89:router.post('/select-model', async (req: Request, res: Response) => {
145:router.post('/interactions', async (req: Request, res: Response) => {
226:router.post('/feedback', async (req: Request, res: Response) => {
268:router.get('/insights', async (req: Request, res: Response) => {
292:router.get('/models', async (req: Request, res: Response) => {
329:router.get('/tasks', async (req: Request, res: Response) => {
355:router.put('/general', async (req: Request, res: Response) => {
453:router.get('/analytics', async (req: Request, res: Response) => {
492:router.get('/health', (req: Request, res: Response) => {

## verified-facts

7:router.get('/search', async (req, res) => {
20:router.post('/', async (req, res) => {

## vision-debug-simple

28:router.get('/health', (req, res) => {
64:router.get('/status', (req, res) => {
94:router.get('/analyses', (req, res) => {
129:router.post('/capture-now', async (req, res) => {
160:router.post('/start', async (req, res) => {
187:router.post('/stop', (req, res) => {

## vision-debug

85:router.get('/status', (req: Request, res: Response) => {
105:router.post('/start', async (req: Request, res: Response) => {
125:router.post('/stop', (req: Request, res: Response) => {
145:router.post(
217:router.get(
247:router.post('/capture-now', async (req: Request, res: Response) => {
270:router.post(
388:router.get('/screenshots', (req: Request, res: Response) => {
451:router.delete(
567:router.get('/health', (req: Request, res: Response) => {

## vision

136:router.post(
229:router.post(
337:router.post(
392:router.post(
442:router.post(
489:router.post(
542:router.get('/status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
574:router.post(
604:router.get('/health', async (req: Request, res: Response) => {
643:router.get('/', async (req: Request, res: Response) => {

## voice

531:router.post('/chat', async (req, res) => {
657:router.post('/command', async (req, res) => {
723:router.post('/synthesize', async (req, res) => {
839:router.post('/transcribe', upload.single('audio'), async (req, res) => {
949:router.get('/audio/:id', async (req, res) => {
978:router.get('/conversations/:id', async (req, res) => {
1028:router.get('/cache', async (req, res) => {
1071:router.post('/cache/clear', async (req, res) => {
1130:router.post('/session/create', async (req, res) => {
1174:router.get('/session/:sessionId', async (req, res) => {

## webhooks

53:router.post('/appflowy/task-updated', verifyWebhookSignature(process.env.APPFLOWY_WEBHOOK_SECRET), async (req, res) => {
134:router.post('/git/commit', verifyWebhookSignature(process.env.GIT_WEBHOOK_SECRET), async (req, res) => {
212:router.post('/ci/build-status', verifyWebhookSignature(process.env.CI_WEBHOOK_SECRET), async (req, res) => {
281:router.post('/error/detected', async (req, res) => {
347:router.post('/file/activity', async (req, res) => {
418:router.get('/health', (req, res) => {

## workflows

1134:router.post('/',
1155:router.get('/',
1172:router.get('/:id',
1188:router.put('/:id',
1212:router.delete('/:id',
1232:router.post('/:id/execute',
1258:router.get('/:id/executions',
1283:router.get('/executions/:id',
1302:router.post('/executions/:id/pause',
1318:router.post('/executions/:id/resume',

