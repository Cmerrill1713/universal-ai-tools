# Generate Universal AI Tools PRP

## Feature Description: $ARGUMENTS

Generate a comprehensive PRP for implementing advanced AI features in the Universal AI Tools platform. Ensure thorough research and context to enable one-pass implementation success.

The Universal AI Tools platform has sophisticated service-oriented architecture with:
- **Context Injection Service** (mandatory for all LLM calls)
- **MLX Fine-Tuning System** (Apple Silicon optimized)
- **Intelligent Parameter Automation** (ML-based optimization)
- **DSPy Cognitive Orchestration** (10-agent reasoning chains)
- **AB-MCTS Probabilistic Coordination**
- **Production Security** (Supabase vault, SQL injection protection)

## Research Process

1. **Architecture Analysis**
   - Review CLAUDE.md for project-specific patterns
   - Analyze existing services for integration points
   - Identify service-oriented architecture patterns
   - Check security and performance requirements

2. **Service Integration Research**
   - Context injection patterns (mandatory)
   - MLX fine-tuning opportunities
   - Intelligent parameter optimization
   - DSPy orchestration integration
   - Supabase schema and RLS patterns

3. **External Research**
   - Library documentation for advanced AI features
   - Best practices for production AI systems
   - Security patterns for AI platforms
   - Performance optimization techniques

4. **Production Requirements**
   - Multi-tenant isolation patterns
   - Monitoring and observability
   - Error handling and circuit breakers
   - Scalability considerations

## PRP Generation

Using PRPs/templates/prp_base.md as template:

### Critical Context for Universal AI Tools
- **Architecture Files**: CLAUDE.md, service files, migration files
- **Security Patterns**: Context injection, vault usage, SQL protection
- **Integration Points**: How to extend existing services
- **Production Patterns**: Database, API, monitoring patterns

### Implementation Blueprint for Advanced AI Systems
- Service integration pseudocode
- Production database patterns
- Security and performance considerations
- AI-specific optimization strategies

### Validation Gates (Production Standards)
```bash
# Architecture Validation
npm run lint:fix && npm run build

# Security Validation  
npm run security:audit

# Integration Testing
npm test && npm run test:integration

# Performance Testing
npm run test:performance
```

*** CRITICAL: Research Universal AI Tools Architecture First ***
*** Read CLAUDE.md, existing services, and migration files ***
*** Understand service-oriented patterns before writing PRP ***

## Output
Save as: `PRPs/{feature-name}.md`

## Quality Checklist for Advanced AI Platform
- [ ] All Universal AI Tools context included
- [ ] Service integration patterns identified
- [ ] Security requirements (context injection, vault) addressed
- [ ] Production validation gates are executable
- [ ] Architecture consistency maintained
- [ ] MLX/DSPy integration opportunities identified
- [ ] Performance and scalability considered
- [ ] Multi-tenant isolation patterns followed

Score the PRP on a scale of 1-10 for production-ready implementation success.

Remember: Universal AI Tools is a sophisticated AI platform with advanced services. The PRP must leverage existing infrastructure and maintain architectural consistency.