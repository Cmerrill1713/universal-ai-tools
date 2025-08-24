# AI Data Discovery Guide

## Overview
This guide helps AI assistants understand and utilize the programming knowledge stored in our Neo4j and Supabase databases.

## 🗄️ Supabase: Programming Knowledge Base

### Database: `context_storage` Table
- **Purpose**: Stores programming documentation, code patterns, and examples
- **Connection**: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`

### Data Structure

#### 1. Programming Language Documentation
```sql
-- Finding documentation for any language
SELECT * FROM context_storage 
WHERE category = 'code_patterns'
  AND content::json->>'type' = 'language-documentation'
  AND content::json->>'name' = 'JavaScript';  -- Replace with any language
```

**Available Languages**: JavaScript, Python, TypeScript, Java, C#, C++, Go, Rust, Swift, PHP

**Metadata Fields**:
- `name`: Language name
- `url`: Official documentation URL
- `content`: Extracted documentation text
- `doc_category`: 'language' or 'framework'
- `crawled_at`: Timestamp of last update

#### 2. Code Patterns & Examples
```sql
-- Finding code patterns for any language
SELECT * FROM context_storage 
WHERE category = 'code_patterns'
  AND content::json->>'type' = 'code-pattern'
  AND content::json->>'language' = 'python';  -- Use lowercase
```

**Pattern Metadata**:
- `name`: Pattern name (e.g., "Python Decorator Pattern")
- `code`: Complete working code example
- `language`: Programming language (lowercase)
- `pattern_category`: Type of pattern (e.g., 'async-patterns', 'oop-patterns')
- `tags`: Array of relevant tags for searching

#### 3. Swift Special Collection (Most Comprehensive)
```sql
-- Swift has the richest documentation set
SELECT * FROM context_storage 
WHERE source LIKE 'swift%'
ORDER BY created_at DESC;
```

**Swift Resources**:
- 17 documentation pages (SwiftUI, Concurrency, @Observable, etc.)
- 10 detailed code patterns with modern Swift 6 syntax
- Covers iOS 18, macOS 15, and latest Swift features

### 🔍 AI Search Patterns

#### Search by Topic
```sql
-- Find all async/await patterns across languages
SELECT 
  content::json->>'language' as language,
  content::json->>'name' as pattern_name,
  content::json->>'code' as code_example
FROM context_storage 
WHERE category = 'code_patterns'
  AND content::json->>'tags'::text ILIKE '%async%';
```

#### Search by Framework
```sql
-- Find framework documentation
SELECT * FROM context_storage 
WHERE category = 'code_patterns'
  AND content::json->>'type' = 'language-documentation'
  AND content::json->>'name' IN ('React', 'Express.js', 'SwiftUI', 'Django');
```

#### Get Language Overview
```sql
-- Get all resources for a specific language
SELECT 
  content::json->>'type' as resource_type,
  content::json->>'name' as resource_name,
  COUNT(*) as count
FROM context_storage 
WHERE category = 'code_patterns'
  AND (content::json->>'language' = 'javascript' 
       OR content::json->>'name' = 'JavaScript')
GROUP BY resource_type, resource_name;
```

## 🔗 Neo4j: Knowledge Graph (If Connected)

### Connection
- **URI**: `bolt://localhost:7687`
- **Database**: Knowledge relationships and connections

### Node Types
- `Documentation`: Language/framework docs
- `Pattern`: Code patterns and examples
- `Concept`: Programming concepts
- `Relationship`: How concepts connect

### Sample Cypher Queries
```cypher
// Find all patterns related to a concept
MATCH (p:Pattern)-[:IMPLEMENTS]->(c:Concept {name: 'Async Programming'})
RETURN p.name, p.language, p.code

// Find related documentation
MATCH (d:Documentation {language: 'Python'})-[:RELATES_TO]->(c:Concept)
RETURN d.name, c.name
```

## 📋 Quick Reference for AI Assistants

### To Help Users with Code:

1. **Check for existing patterns**:
```sql
SELECT content::json->>'code' as example
FROM context_storage 
WHERE category = 'code_patterns'
  AND content::json->>'language' = '<language>'
  AND content::json->>'pattern_category' = '<pattern_type>';
```

2. **Find documentation**:
```sql
SELECT content::json->>'url' as doc_url
FROM context_storage 
WHERE category = 'code_patterns'
  AND content::json->>'name' = '<LanguageName>';
```

3. **Search by tags**:
```sql
SELECT * FROM context_storage 
WHERE category = 'code_patterns'
  AND content::json->>'tags'::text ILIKE '%<search_term>%';
```

### Available Pattern Categories:
- `async-patterns`: Async/await, promises, concurrency
- `oop-patterns`: Classes, inheritance, encapsulation
- `functional-patterns`: Higher-order functions, composition
- `error-handling`: Exception handling, error types
- `design-patterns`: Builder, factory, singleton, etc.
- `concurrency-patterns`: Threading, parallel processing
- `state-management`: State handling patterns

### Response Format for Users:

When providing code help:
1. Reference the source: "Based on the stored [Language] patterns..."
2. Show the relevant code example
3. Explain how to adapt it to their use case
4. Mention related patterns if applicable

## 🎯 Key Insights for AI

1. **Swift has the most comprehensive coverage** - Use for iOS/macOS questions
2. **All major languages have at least basic patterns** - Can provide examples
3. **Patterns include working code** - Can be directly used/adapted
4. **Documentation includes official URLs** - Can reference for more details
5. **Tags enable cross-language pattern discovery** - Find similar concepts

## 📊 Current Statistics

- **Total Resources**: 71 entries
- **Languages Covered**: 10 major languages + 12 frameworks
- **Code Patterns**: 22 complete working examples
- **Documentation Pages**: 39 official documentation references
- **Swift Resources**: 28 (most comprehensive)

## 🔄 Keeping Data Fresh

The data is stored with timestamps and can be updated by running:
```bash
# Update all documentation
node scripts/crawl-documentation.mjs

# Update Swift specifically
node scripts/crawl-swift-docs.mjs
node scripts/crawl-swift-patterns.mjs

# Update all patterns
node scripts/crawl-all-patterns.mjs
```

## 💡 Usage Tips for AI Assistants

1. **Always check for existing patterns first** before generating new code
2. **Reference the official documentation URLs** when explaining concepts
3. **Use tags to find similar patterns** across different languages
4. **Leverage Swift's comprehensive coverage** for Apple platform questions
5. **Combine documentation + patterns** for complete answers

---

This knowledge base enables AI assistants to provide accurate, example-driven programming help across all major languages and frameworks.