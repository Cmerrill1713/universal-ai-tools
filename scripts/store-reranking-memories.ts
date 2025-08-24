import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

interface MemoryData {
  content: string;
  metadata: {
    type: string;
    category: string;
    importance: number;
    keywords: string[];
    related_concepts: string[];
    implementation_complexity: string;
    performance_impact: string;
  };
  tags: string[];
}

const rerankingMemories: MemoryData[] = [
  // Cross-Encoder Reranking Fundamentals
  {
    content: `Cross-Encoder Reranking Fundamentals:

## Two-Stage Retrieval Architecture
- **Stage 1 (Bi-encoder)**: Fast approximate search using embeddings
  - Generate dense vectors for queries and documents
  - Use vector similarity (cosine, dot product) for initial retrieval
  - Retrieve top-k candidates (typically 100-1000)
  
- **Stage 2 (Cross-encoder)**: Precise reranking of candidates
  - Concatenate query and document as single input
  - Model sees full interaction between query and document
  - Output single relevance score per pair

## Implementation Example:
\`\`\`python
from sentence_transformers import CrossEncoder
from typing import List, Tuple

class TwoStageRetriever:
    def __init__(self, bi_encoder, cross_encoder_model='cross-encoder/ms-marco-MiniLM-L-12-v2'):
        self.bi_encoder = bi_encoder
        self.cross_encoder = CrossEncoder(cross_encoder_model)
    
    def retrieve(self, query: str, documents: List[str], initial_k=100, final_k=10) -> List[Tuple[str, float]]:
        # Stage 1: Bi-encoder retrieval
        query_embedding = self.bi_encoder.encode(query)
        doc_embeddings = self.bi_encoder.encode(documents)
        
        # Fast similarity search
        similarities = cosine_similarity([query_embedding], doc_embeddings)[0]
        top_k_indices = similarities.argsort()[-initial_k:][::-1]
        
        # Stage 2: Cross-encoder reranking
        candidates = [(documents[i], i) for i in top_k_indices]
        pairs = [[query, doc] for doc, _ in candidates]
        
        scores = self.cross_encoder.predict(pairs)
        
        # Sort by cross-encoder scores
        reranked = sorted(zip(candidates, scores), key=lambda x: x[1], reverse=True)
        
        return [(doc, score) for (doc, _), score in reranked[:final_k]]
\`\`\`

## Cross-Encoder vs Bi-Encoder Trade-offs
- **Accuracy**: Cross-encoders > Bi-encoders (10-20% improvement typical)
- **Speed**: Bi-encoders > Cross-encoders (100-1000x faster)
- **Memory**: Bi-encoders require vector storage, Cross-encoders don't
- **Scalability**: Bi-encoders scale to millions of docs, Cross-encoders to thousands

## Model Selection (MTEB Leaderboard)
Top performing cross-encoder models:
1. **mixedbread-ai/mxbai-rerank-large-v1**: Best overall performance
2. **BAAI/bge-reranker-v2-m3**: Multilingual support
3. **cross-encoder/ms-marco-MiniLM-L-12-v2**: Good balance of speed/accuracy
4. **Cohere Rerank API**: Commercial solution with excellent performance

## Performance Optimization
\`\`\`python
# Batching for GPU efficiency
def batch_rerank(cross_encoder, query, documents, batch_size=32):
    all_scores = []
    for i in range(0, len(documents), batch_size):
        batch = documents[i:i+batch_size]
        pairs = [[query, doc] for doc in batch]
        scores = cross_encoder.predict(pairs)
        all_scores.extend(scores)
    return all_scores

# Async processing
async def async_rerank(cross_encoder, queries, documents):
    tasks = []
    for query in queries:
        task = asyncio.create_task(
            rerank_single(cross_encoder, query, documents)
        )
        tasks.append(task)
    return await asyncio.gather(*tasks)
\`\`\``,
    metadata: {
      type: 'technical_pattern',
      category: 'reranking_fundamentals',
      importance: 10,
      keywords: [
        'cross-encoder',
        'bi-encoder',
        'two-stage-retrieval',
        'reranking',
        'accuracy-speed-tradeoff',
      ],
      related_concepts: ['vector-search', 'semantic-search', 'information-retrieval'],
      implementation_complexity: 'medium',
      performance_impact: 'high',
    },
    tags: ['reranking', 'cross-encoder', 'retrieval', 'search', 'ai-patterns'],
  },

  // Advanced Reranking Strategies
  {
    content: `Advanced Reranking Strategies:

## 1. Hybrid Reranking Approaches
Combine multiple signals for optimal ranking:

\`\`\`python
class HybridReranker:
    def __init__(self, cross_encoder, feature_weights=None):
        self.cross_encoder = cross_encoder
        self.weights = feature_weights or {
            'semantic_score': 0.5,
            'keyword_match': 0.2,
            'recency': 0.15,
            'popularity': 0.15
        }
    
    def compute_features(self, query, document, metadata):
        features = {}
        
        # Semantic similarity from cross-encoder
        features['semantic_score'] = self.cross_encoder.predict([[query, document['text']]])[0]
        
        # Keyword matching (exact and fuzzy)
        query_terms = set(query.lower().split())
        doc_terms = set(document['text'].lower().split())
        features['keyword_match'] = len(query_terms & doc_terms) / len(query_terms)
        
        # Recency score (exponential decay)
        age_days = (datetime.now() - document['created_at']).days
        features['recency'] = np.exp(-age_days / 30)  # 30-day half-life
        
        # Popularity/engagement metrics
        features['popularity'] = np.log1p(metadata.get('views', 0) + metadata.get('likes', 0))
        
        return features
    
    def rerank(self, query, documents):
        scored_docs = []
        for doc in documents:
            features = self.compute_features(query, doc, doc.get('metadata', {}))
            
            # Weighted combination
            final_score = sum(
                self.weights[feat] * features[feat] 
                for feat in self.weights
            )
            
            scored_docs.append((doc, final_score, features))
        
        return sorted(scored_docs, key=lambda x: x[1], reverse=True)
\`\`\`

## 2. LLM-Based Reranking
Use language models for sophisticated relevance assessment:

\`\`\`python
class LLMReranker:
    def __init__(self, llm_client):
        self.llm = llm_client
        self.system_prompt = """You are a search relevance expert. 
        Score the relevance of documents to queries on a scale of 0-10.
        Consider: semantic match, completeness, accuracy, and usefulness."""
    
    def create_ranking_prompt(self, query, documents):
        prompt = f"Query: {query}\\n\\nRank these documents by relevance:\\n\\n"
        for i, doc in enumerate(documents):
            prompt += f"Document {i+1}:\\n{doc['text'][:500]}...\\n\\n"
        
        prompt += "Provide scores in JSON format: {\"doc_1\": score, \"doc_2\": score, ...}"
        return prompt
    
    async def rerank_with_reasoning(self, query, documents, top_k=5):
        # Advanced prompt with reasoning
        prompt = f"""Query: {query}

Analyze and rank these documents. For each, provide:
1. Relevance score (0-10)
2. Brief reasoning
3. Key matching aspects

Documents:
"""
        for i, doc in enumerate(documents[:20]):  # Limit for context window
            prompt += f"\\n[Doc {i+1}]\\n{doc['text'][:300]}...\\n"
        
        response = await self.llm.generate(
            system=self.system_prompt,
            prompt=prompt,
            temperature=0.1  # Low temperature for consistency
        )
        
        # Parse and apply scores
        rankings = self.parse_llm_rankings(response)
        return self.apply_rankings(documents, rankings)
\`\`\`

## 3. Feature-Based Reranking
Leverage document metadata and query analysis:

\`\`\`python
class FeatureReranker:
    def __init__(self):
        self.feature_extractors = {
            'query_coverage': self.calculate_query_coverage,
            'title_match': self.calculate_title_match,
            'snippet_quality': self.calculate_snippet_quality,
            'source_authority': self.calculate_source_authority,
            'freshness': self.calculate_freshness
        }
    
    def calculate_query_coverage(self, query, document):
        # What percentage of query terms are covered
        query_terms = set(self.extract_terms(query))
        doc_terms = set(self.extract_terms(document['text']))
        
        coverage = len(query_terms & doc_terms) / len(query_terms)
        
        # Boost for phrase matches
        if query.lower() in document['text'].lower():
            coverage *= 1.5
        
        return min(coverage, 1.0)
    
    def calculate_title_match(self, query, document):
        if 'title' not in document:
            return 0.0
        
        title = document['title'].lower()
        query_lower = query.lower()
        
        # Exact match
        if query_lower == title:
            return 1.0
        
        # Substring match
        if query_lower in title:
            return 0.8
        
        # Term overlap
        query_terms = set(query_lower.split())
        title_terms = set(title.split())
        
        return len(query_terms & title_terms) / max(len(query_terms), 1)
\`\`\`

## 4. Domain-Specific Fine-Tuning
Adapt reranking to specific domains:

\`\`\`python
# Legal document reranker
class LegalReranker(CrossEncoder):
    def __init__(self, base_model='cross-encoder/ms-marco-MiniLM-L-12-v2'):
        super().__init__(base_model)
        self.legal_terms_boost = self.load_legal_vocabulary()
    
    def preprocess_legal_query(self, query):
        # Expand legal abbreviations
        expansions = {
            'USC': 'United States Code',
            'CFR': 'Code of Federal Regulations',
            'FRCP': 'Federal Rules of Civil Procedure'
        }
        
        for abbr, expansion in expansions.items():
            query = query.replace(abbr, expansion)
        
        return query
    
    def rerank_with_citations(self, query, documents):
        processed_query = self.preprocess_legal_query(query)
        
        # Check for citation patterns
        citation_pattern = r'\\b\\d+\\s+U\\.S\\.C\\.\\s+§\\s+\\d+'
        has_citation = bool(re.search(citation_pattern, query))
        
        if has_citation:
            # Boost documents with matching citations
            return self.citation_focused_rerank(query, documents)
        else:
            # Standard semantic reranking with legal term weighting
            return self.semantic_rerank_with_boost(processed_query, documents)
\`\`\`

## 5. Evaluation Metrics
Measure reranking effectiveness:

\`\`\`python
def evaluate_reranker(reranker, test_queries, ground_truth):
    metrics = {
        'ndcg': [],
        'map': [],
        'mrr': [],
        'precision_at_k': {1: [], 3: [], 5: [], 10: []}
    }
    
    for query, relevant_docs in zip(test_queries, ground_truth):
        # Get reranked results
        reranked = reranker.rerank(query, candidate_docs)
        
        # Calculate NDCG
        relevance_scores = [1 if doc_id in relevant_docs else 0 
                           for doc_id, _ in reranked]
        metrics['ndcg'].append(ndcg_score([relevance_scores], [ideal_scores]))
        
        # Calculate MAP
        metrics['map'].append(average_precision(reranked, relevant_docs))
        
        # Calculate MRR
        first_relevant = next((i for i, (doc_id, _) in enumerate(reranked) 
                              if doc_id in relevant_docs), None)
        metrics['mrr'].append(1 / (first_relevant + 1) if first_relevant else 0)
        
        # Precision@K
        for k in [1, 3, 5, 10]:
            top_k = [doc_id for doc_id, _ in reranked[:k]]
            precision = len(set(top_k) & set(relevant_docs)) / k
            metrics['precision_at_k'][k].append(precision)
    
    # Average all metrics
    return {
        metric: np.mean(values) if isinstance(values, list) else 
                {k: np.mean(v) for k, v in values.items()}
        for metric, values in metrics.items()
    }
\`\`\``,
    metadata: {
      type: 'technical_pattern',
      category: 'advanced_reranking',
      importance: 10,
      keywords: [
        'hybrid-reranking',
        'llm-reranking',
        'feature-engineering',
        'domain-specific',
        'evaluation-metrics',
      ],
      related_concepts: ['machine-learning', 'nlp', 'information-retrieval', 'search-quality'],
      implementation_complexity: 'high',
      performance_impact: 'high',
    },
    tags: ['reranking', 'advanced-strategies', 'llm', 'feature-engineering', 'evaluation'],
  },

  // Production Implementation Patterns
  {
    content: `Production Implementation Patterns for Reranking Systems:

## 1. Caching Strategies
Optimize performance with intelligent caching:

\`\`\`python
import hashlib
from functools import lru_cache
import redis
import pickle

class RerankingCache:
    def __init__(self, redis_client, ttl=3600):
        self.redis = redis_client
        self.ttl = ttl
        self.local_cache = {}  # In-memory L1 cache
        
    def _generate_cache_key(self, query, doc_ids):
        # Create deterministic key from query and document set
        content = f"{query}::{':'.join(sorted(doc_ids))}"
        return f"rerank:{hashlib.md5(content.encode()).hexdigest()}"
    
    async def get_or_compute(self, query, documents, rerank_func):
        doc_ids = [doc['id'] for doc in documents]
        cache_key = self._generate_cache_key(query, doc_ids)
        
        # L1 cache check
        if cache_key in self.local_cache:
            return self.local_cache[cache_key]
        
        # L2 cache check (Redis)
        cached = await self.redis.get(cache_key)
        if cached:
            result = pickle.loads(cached)
            self.local_cache[cache_key] = result
            return result
        
        # Compute and cache
        result = await rerank_func(query, documents)
        
        # Store in both caches
        await self.redis.setex(
            cache_key, 
            self.ttl, 
            pickle.dumps(result)
        )
        self.local_cache[cache_key] = result
        
        return result
    
    def invalidate_pattern(self, pattern):
        # Invalidate cache entries matching pattern
        cursor = 0
        while True:
            cursor, keys = self.redis.scan(
                cursor, 
                match=f"rerank:{pattern}*"
            )
            if keys:
                self.redis.delete(*keys)
            if cursor == 0:
                break

# Query-aware caching
class SmartRerankingCache(RerankingCache):
    def should_cache(self, query, documents):
        # Don't cache personalized queries
        if any(term in query.lower() for term in ['my', 'mine', 'me']):
            return False
        
        # Don't cache time-sensitive queries
        if any(term in query.lower() for term in ['today', 'now', 'current']):
            return False
        
        # Cache popular queries longer
        query_frequency = self.get_query_frequency(query)
        if query_frequency > 100:
            return True, self.ttl * 4  # 4x TTL for popular queries
        
        return True, self.ttl
\`\`\`

## 2. Batch Processing Optimization
Maximize throughput with efficient batching:

\`\`\`python
import asyncio
from typing import List, Dict, Any
import numpy as np

class BatchedReranker:
    def __init__(self, cross_encoder, max_batch_size=32, max_wait_ms=100):
        self.cross_encoder = cross_encoder
        self.max_batch_size = max_batch_size
        self.max_wait_ms = max_wait_ms
        self.pending_requests = []
        self.processing = False
        
    async def rerank(self, query: str, documents: List[Dict]) -> List[tuple]:
        # Add to pending batch
        future = asyncio.Future()
        self.pending_requests.append({
            'query': query,
            'documents': documents,
            'future': future
        })
        
        # Process batch if full or start timer
        if len(self.pending_requests) >= self.max_batch_size:
            await self._process_batch()
        elif not self.processing:
            asyncio.create_task(self._wait_and_process())
        
        return await future
    
    async def _wait_and_process(self):
        self.processing = True
        await asyncio.sleep(self.max_wait_ms / 1000)
        await self._process_batch()
        self.processing = False
    
    async def _process_batch(self):
        if not self.pending_requests:
            return
        
        batch = self.pending_requests[:self.max_batch_size]
        self.pending_requests = self.pending_requests[self.max_batch_size:]
        
        # Prepare all query-document pairs
        all_pairs = []
        request_indices = []
        
        for i, request in enumerate(batch):
            query = request['query']
            for doc in request['documents']:
                all_pairs.append([query, doc['text']])
                request_indices.append(i)
        
        # Single batch prediction
        scores = self.cross_encoder.predict(all_pairs)
        
        # Distribute results back
        current_idx = 0
        for i, request in enumerate(batch):
            num_docs = len(request['documents'])
            doc_scores = scores[current_idx:current_idx + num_docs]
            current_idx += num_docs
            
            # Sort and return results
            ranked_docs = sorted(
                zip(request['documents'], doc_scores),
                key=lambda x: x[1],
                reverse=True
            )
            
            request['future'].set_result(ranked_docs)

# GPU-optimized batching
class GPUBatchedReranker(BatchedReranker):
    def __init__(self, model, device='cuda'):
        super().__init__(model)
        self.device = device
        self.model = model.to(device)
        
    async def _process_batch_gpu(self, batch):
        # Move to GPU in batches
        with torch.cuda.amp.autocast():  # Mixed precision
            embeddings = []
            
            for chunk in self._chunk_batch(batch, 128):
                chunk_embeddings = self.model.encode(
                    chunk,
                    convert_to_tensor=True,
                    device=self.device,
                    batch_size=128
                )
                embeddings.append(chunk_embeddings)
            
            # Concatenate and process
            all_embeddings = torch.cat(embeddings)
            scores = self.model.predict(all_embeddings)
            
        return scores.cpu().numpy()
\`\`\`

## 3. Cost vs Accuracy Optimization
Balance performance and cost:

\`\`\`python
class AdaptiveReranker:
    def __init__(self, light_model, heavy_model, cost_threshold=0.001):
        self.light_model = light_model  # Fast, cheap
        self.heavy_model = heavy_model  # Slow, accurate
        self.cost_threshold = cost_threshold
        self.performance_monitor = PerformanceMonitor()
        
    async def rerank_adaptive(self, query, documents, context=None):
        # Estimate query complexity
        complexity = self.estimate_complexity(query, documents)
        
        # Choose model based on complexity and constraints
        if complexity < 0.3:
            # Simple query - use light model
            return await self.light_rerank(query, documents)
        elif complexity > 0.7 or self.is_high_value_query(query, context):
            # Complex or high-value query - use heavy model
            return await self.heavy_rerank(query, documents)
        else:
            # Medium complexity - use cascade
            return await self.cascade_rerank(query, documents)
    
    def estimate_complexity(self, query, documents):
        factors = {
            'query_length': len(query.split()) / 20,
            'ambiguity': self.calculate_ambiguity(query),
            'domain_specificity': self.check_domain_terms(query),
            'document_similarity': self.calculate_doc_similarity(documents[:10])
        }
        
        # Weighted combination
        weights = {'query_length': 0.2, 'ambiguity': 0.3, 
                  'domain_specificity': 0.3, 'document_similarity': 0.2}
        
        return sum(factors[k] * weights[k] for k in factors)
    
    async def cascade_rerank(self, query, documents):
        # First pass with light model
        light_scores = await self.light_model.predict(
            [[query, doc['text']] for doc in documents]
        )
        
        # Get top candidates
        top_indices = np.argsort(light_scores)[-20:]
        top_candidates = [documents[i] for i in top_indices]
        
        # Second pass with heavy model on top candidates
        heavy_scores = await self.heavy_model.predict(
            [[query, doc['text']] for doc in top_candidates]
        )
        
        # Combine results
        final_rankings = sorted(
            zip(top_candidates, heavy_scores),
            key=lambda x: x[1],
            reverse=True
        )
        
        return final_rankings

# Cost tracking
class CostAwareReranker:
    def __init__(self, model, cost_per_1k_tokens=0.001):
        self.model = model
        self.cost_per_1k_tokens = cost_per_1k_tokens
        self.daily_budget = 10.0  # $10/day
        self.spent_today = 0.0
        
    async def rerank_with_budget(self, query, documents):
        # Estimate cost
        total_tokens = sum(
            len(f"{query} {doc['text']}".split()) * 1.3  # Rough token estimate
            for doc in documents
        )
        estimated_cost = (total_tokens / 1000) * self.cost_per_1k_tokens
        
        # Check budget
        if self.spent_today + estimated_cost > self.daily_budget:
            # Fall back to cheaper alternative
            return self.fallback_rerank(query, documents)
        
        # Proceed with reranking
        results = await self.model.rerank(query, documents)
        self.spent_today += estimated_cost
        
        return results
\`\`\`

## 4. A/B Testing Framework
Test and optimize reranking strategies:

\`\`\`python
class RerankingABTest:
    def __init__(self, control_reranker, treatment_reranker, 
                 split_ratio=0.5, min_sample_size=1000):
        self.control = control_reranker
        self.treatment = treatment_reranker
        self.split_ratio = split_ratio
        self.min_sample_size = min_sample_size
        self.results = {'control': [], 'treatment': []}
        
    async def rerank_with_test(self, query, documents, user_id):
        # Consistent assignment based on user
        is_treatment = hash(user_id) % 100 < self.split_ratio * 100
        
        reranker = self.treatment if is_treatment else self.control
        variant = 'treatment' if is_treatment else 'control'
        
        # Rerank and track
        start_time = time.time()
        results = await reranker.rerank(query, documents)
        latency = time.time() - start_time
        
        # Log for analysis
        self.log_interaction({
            'variant': variant,
            'query': query,
            'user_id': user_id,
            'latency': latency,
            'timestamp': datetime.now(),
            'top_results': [r[0]['id'] for r in results[:5]]
        })
        
        return results
    
    def analyze_results(self):
        if len(self.results['control']) < self.min_sample_size:
            return {'status': 'insufficient_data'}
        
        # Calculate metrics
        metrics = {}
        for variant in ['control', 'treatment']:
            data = self.results[variant]
            metrics[variant] = {
                'avg_ctr': np.mean([d['ctr'] for d in data]),
                'avg_latency': np.mean([d['latency'] for d in data]),
                'user_satisfaction': np.mean([d['satisfaction'] for d in data])
            }
        
        # Statistical significance
        from scipy import stats
        
        control_ctr = [d['ctr'] for d in self.results['control']]
        treatment_ctr = [d['ctr'] for d in self.results['treatment']]
        
        t_stat, p_value = stats.ttest_ind(control_ctr, treatment_ctr)
        
        return {
            'metrics': metrics,
            'p_value': p_value,
            'significant': p_value < 0.05,
            'recommendation': 'adopt_treatment' if p_value < 0.05 and 
                             metrics['treatment']['avg_ctr'] > metrics['control']['avg_ctr']
                             else 'keep_control'
        }
\`\`\`

## 5. Performance Monitoring
Track and optimize reranking performance:

\`\`\`python
class RerankingMonitor:
    def __init__(self, prometheus_gateway=None):
        self.metrics = {
            'latency_histogram': Histogram(
                'reranking_latency_seconds',
                'Reranking latency in seconds',
                buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 2.0]
            ),
            'throughput_counter': Counter(
                'reranking_requests_total',
                'Total reranking requests'
            ),
            'cache_hit_rate': Gauge(
                'reranking_cache_hit_rate',
                'Cache hit rate for reranking'
            ),
            'model_accuracy': Gauge(
                'reranking_model_accuracy',
                'Current model accuracy based on user feedback'
            )
        }
        
    async def monitor_rerank(self, func, *args, **kwargs):
        start_time = time.time()
        
        try:
            result = await func(*args, **kwargs)
            
            # Record metrics
            latency = time.time() - start_time
            self.metrics['latency_histogram'].observe(latency)
            self.metrics['throughput_counter'].inc()
            
            # Check if result was cached
            if hasattr(result, '_from_cache'):
                self.update_cache_metrics(hit=result._from_cache)
            
            return result
            
        except Exception as e:
            self.metrics['error_counter'].inc()
            self.log_error(e, args, kwargs)
            raise
    
    def update_accuracy_metrics(self, feedback_batch):
        # Calculate accuracy from user feedback
        positive = sum(1 for f in feedback_batch if f['relevant'])
        total = len(feedback_batch)
        
        accuracy = positive / total if total > 0 else 0
        self.metrics['model_accuracy'].set(accuracy)
        
        # Alert if accuracy drops
        if accuracy < 0.7:
            self.send_alert(
                'Reranking accuracy below threshold',
                {'accuracy': accuracy, 'sample_size': total}
            )

# Real-time dashboard
class RerankingDashboard:
    def __init__(self):
        self.app = FastAPI()
        self.monitor = RerankingMonitor()
        
    @app.get("/metrics/reranking")
    async def get_metrics(self):
        return {
            'current': {
                'qps': self.monitor.get_current_qps(),
                'p50_latency': self.monitor.get_percentile_latency(50),
                'p99_latency': self.monitor.get_percentile_latency(99),
                'cache_hit_rate': self.monitor.get_cache_hit_rate(),
                'error_rate': self.monitor.get_error_rate()
            },
            'trends': {
                'latency_trend': self.monitor.get_latency_trend(hours=24),
                'accuracy_trend': self.monitor.get_accuracy_trend(hours=24)
            },
            'alerts': self.monitor.get_active_alerts()
        }
\`\`\``,
    metadata: {
      type: 'technical_pattern',
      category: 'production_implementation',
      importance: 10,
      keywords: [
        'caching',
        'batch-processing',
        'cost-optimization',
        'ab-testing',
        'monitoring',
        'performance',
      ],
      related_concepts: ['production-systems', 'scalability', 'reliability', 'observability'],
      implementation_complexity: 'high',
      performance_impact: 'critical',
    },
    tags: ['reranking', 'production', 'caching', 'optimization', 'monitoring', 'a/b-testing'],
  },
];

async function storeMemories() {
  process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('Starting to store reranking memories...');

  for (const memory of rerankingMemories) {
    try {
      // Store memory in ai_memories table
      const memoryData = {
        service_id: 'reranking-knowledge-base',
        memory_type: memory.metadata.type,
        content: memory.content,
        metadata: {
          ...memory.metadata,
          user_id: 'system',
          importance_score: memory.metadata.importance / 10,
          memory_category: memory.metadata.category,
          keywords: memory.metadata.keywords,
          related_entities: memory.metadata.related_concepts.map((concept) => ({
            type: 'concept',
            value: concept,
          })),
        },
      };

      const { data, error } = await supabase
        .from('ai_memories')
        .insert(memoryData)
        .select()
        .single();

      if (error) {
        process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('Error storing memory:', error);
      } else {
        console.log(`Successfully stored memory: ${memory.metadata.category}`);

        // Create connections between related memories if they exist
        if (data && memory.metadata.related_concepts.length > 0) {
          // Search for related memories by checking metadata
          const { data: relatedMemories } = await supabase
            .from('ai_memories')
            .select('id, metadata')
            .eq('service_id', 'reranking-knowledge-base')
            .neq('id', data.id)
            .limit(10);

          if (relatedMemories && relatedMemories.length > 0) {
            for (const related of relatedMemories) {
              // Check if they share any keywords or concepts
              const relatedKeywords = related.metadata?.keywords || [];
              const sharedKeywords = memory.metadata.keywords.filter((k) =>
                relatedKeywords.includes(k)
              );

              const relatedConcepts = related.metadata?.related_concepts || [];
              const sharedConcepts = memory.metadata.related_concepts.filter((c) =>
                relatedConcepts.includes(c)
              );

              if (sharedKeywords.length > 0 || sharedConcepts.length > 0) {
                const strength =
                  (sharedKeywords.length + sharedConcepts.length) /
                  (memory.metadata.keywords.length + memory.metadata.related_concepts.length);

                await supabase
                  .from('memory_connections')
                  .insert({
                    source_memory_id: data.id,
                    target_memory_id: related.id,
                    connection_type: 'semantic_similarity',
                    strength: Math.min(strength, 0.9),
                    metadata: {
                      connection_reason: 'shared_concepts',
                      shared_keywords: sharedKeywords,
                      shared_concepts: sharedConcepts,
                    },
                  })
                  .select();
              }
            }
          }
        }
      }

      // Add delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Unexpected error:', error);
    }
  }

  console.log('Finished storing reranking memories');
}

// Run the script
storeMemories().catch(console.error);
