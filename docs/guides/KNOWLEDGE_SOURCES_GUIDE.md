# Knowledge Sources Integration Guide

This guide provides a comprehensive list of databases and knowledge sources that can be scraped and integrated into Supabase to enhance your AI agents' capabilities.

## 🌐 Programming & Technical Documentation

### 1. **MDN Web Docs**
- **URL**: https://developer.mozilla.org
- **Content**: HTML, CSS, JavaScript, Web APIs
- **Benefits**: Comprehensive web development reference
- **Rate Limit**: 30 requests/minute
- **Status**: ✅ Implemented

### 2. **DevDocs.io**
- **URL**: https://devdocs.io
- **Content**: Aggregated API documentation for 500+ languages/frameworks
- **Benefits**: Single source for multiple technologies
- **Rate Limit**: 60 requests/minute
- **Status**: ✅ Implemented

### 3. **Stack Overflow**
- **URL**: https://api.stackexchange.com
- **Content**: Q&A with code examples
- **Benefits**: Real-world problem solutions
- **Rate Limit**: 300 requests/minute (with key)
- **Status**: ✅ Implemented

### 4. **GitHub**
- **APIs Available**:
  - Trending repositories
  - Code search
  - Gists
  - README files
- **Benefits**: Latest code patterns and best practices
- **Rate Limit**: 60 requests/hour (5000 with auth)

## 🤖 AI & Machine Learning

### 1. **Papers with Code**
- **URL**: https://paperswithcode.com/api
- **Content**: ML papers with implementation
- **Benefits**: State-of-the-art algorithms
- **Status**: ✅ Implemented

### 2. **Hugging Face**
- **URL**: https://huggingface.co/api
- **Content**: Model cards, datasets, spaces
- **Benefits**: Pre-trained models and examples
- **Status**: ✅ Implemented

### 3. **arXiv**
- **URL**: http://export.arxiv.org/api
- **Content**: Research papers
- **Benefits**: Latest AI research
- **Rate Limit**: 3 requests/second

### 4. **OpenAI Cookbook**
- **URL**: https://github.com/openai/openai-cookbook
- **Content**: Best practices for LLMs
- **Benefits**: Official OpenAI patterns

## 📚 General Knowledge

### 1. **Wikipedia API**
- **URL**: https://en.wikipedia.org/w/api.php
- **Content**: Encyclopedia articles
- **Benefits**: Comprehensive general knowledge
- **Rate Limit**: 200 requests/second

### 2. **Wikidata**
- **URL**: https://www.wikidata.org/w/api.php
- **Content**: Structured knowledge graph
- **Benefits**: Entity relationships and facts
- **Format**: SPARQL queries

### 3. **DBpedia**
- **URL**: https://dbpedia.org/sparql
- **Content**: Structured Wikipedia data
- **Benefits**: RDF triples for semantic queries

## 📦 Package & Library Documentation

### 1. **npm Registry**
- **URL**: https://registry.npmjs.org
- **Content**: JavaScript package info
- **Benefits**: Dependencies and documentation
- **Rate Limit**: 250 requests/minute

### 2. **PyPI**
- **URL**: https://pypi.org/pypi/{package}/json
- **Content**: Python package information
- **Benefits**: Python ecosystem knowledge

### 3. **crates.io**
- **URL**: https://crates.io/api/v1
- **Content**: Rust package registry
- **Benefits**: Rust ecosystem

## 🔧 API References

### 1. **Public APIs Directory**
- **URL**: https://api.publicapis.org
- **Content**: List of 1400+ public APIs
- **Benefits**: API discovery

### 2. **RapidAPI Hub**
- **URL**: https://rapidapi.com
- **Content**: API marketplace
- **Benefits**: Unified API access

### 3. **OpenAPI Directory**
- **URL**: https://api.apis.guru/v2/list.json
- **Content**: OpenAPI specifications
- **Benefits**: Machine-readable API specs

## 🔬 Domain-Specific Sources

### Medical/Scientific
- **PubMed**: https://pubmed.ncbi.nlm.nih.gov
- **CrossRef**: https://api.crossref.org
- **Europe PMC**: https://www.ebi.ac.uk/europepmc/webservices/rest

### Financial
- **SEC EDGAR**: https://www.sec.gov/edgar
- **Federal Reserve**: https://api.stlouisfed.org
- **World Bank**: https://api.worldbank.org

### Legal
- **USPTO**: https://developer.uspto.gov
- **Legal Information Institute**: https://www.law.cornell.edu

## 🚀 Implementation Guide

### 1. **Enable Knowledge Scraping**
```bash
# Run the migration
npx supabase migration up

# Start scraping
curl -X POST http://localhost:9999/api/v1/knowledge/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "sources": ["MDN Web Docs", "Stack Overflow"],
    "limit": 100,
    "updateExisting": true
  }'
```

### 2. **Search Knowledge Base**
```bash
curl -X GET "http://localhost:9999/api/v1/knowledge/search?query=react+hooks" \
  -H "Content-Type: application/json"
```

### 3. **Monitor Status**
```bash
curl -X GET http://localhost:9999/api/v1/knowledge/status
```

## 📊 Recommended Scraping Strategy

### Phase 1: Core Documentation (Week 1)
1. MDN Web Docs - Web fundamentals
2. Stack Overflow - Common problems/solutions
3. DevDocs - API references
4. npm Registry - Package documentation

### Phase 2: AI Knowledge (Week 2)
1. Papers with Code - ML implementations
2. Hugging Face - Model documentation
3. OpenAI Cookbook - LLM best practices
4. arXiv - Latest research

### Phase 3: Extended Sources (Week 3+)
1. GitHub - Code examples
2. Wikipedia - General knowledge
3. Domain-specific sources based on your needs

## ⚠️ Important Considerations

### 1. **Storage Requirements**
- Estimate: 10GB for 1M entries with embeddings
- Use vector compression for efficiency
- Implement data retention policies

### 2. **Rate Limiting**
- Respect API rate limits
- Implement exponential backoff
- Use authentication where available

### 3. **Legal Compliance**
- Check terms of service
- Respect robots.txt
- Attribute sources properly
- Don't scrape personal data

### 4. **Quality Control**
- Validate scraped data
- Remove duplicates
- Update stale content
- Monitor data quality metrics

## 🔌 Custom Source Integration

To add a new knowledge source:

1. Add to `knowledge_sources` table
2. Implement parser in `knowledge-scraper-service.ts`
3. Configure rate limiting
4. Test with small batches first

Example:
```typescript
{
  name: 'Custom API',
  type: 'api',
  url: 'https://api.example.com/docs',
  rateLimit: 60,
  parser: (data) => {
    // Custom parsing logic
    return entries;
  }
}
```

## 📈 Benefits for Your Agents

1. **Enhanced Context**: Agents can reference documentation
2. **Problem Solving**: Access to Stack Overflow solutions
3. **Best Practices**: Learn from code examples
4. **Up-to-date Info**: Latest API changes and features
5. **Domain Expertise**: Specialized knowledge for specific tasks

The knowledge base will significantly improve your agents' ability to:
- Write better code
- Debug issues
- Suggest optimal solutions
- Understand new technologies
- Provide accurate information