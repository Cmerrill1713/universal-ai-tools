# Execute Universal AI Tools PRP

Implement an advanced AI feature using the PRP file for the Universal AI Tools platform.

## PRP File: $ARGUMENTS

## Execution Process for Production AI Platform

1. **Load PRP & Architecture Context**
   - Read the specified PRP file thoroughly
   - Review CLAUDE.md for project-specific patterns
   - Understand Universal AI Tools service architecture
   - Identify integration points with existing services
   - Ensure context injection service integration

2. **ULTRATHINK - Production Planning**
   - Analyze how feature integrates with existing services
   - Plan service-oriented architecture approach
   - Consider security implications (context injection, vault)
   - Plan MLX fine-tuning opportunities
   - Design for multi-tenant scalability
   - Use TodoWrite tool to create comprehensive implementation plan

3. **Architecture Validation**
   - Verify integration with context injection service
   - Confirm Supabase vault usage for secrets
   - Validate service-oriented design patterns
   - Check for AB-MCTS coordination opportunities

4. **Execute Implementation**
   - Follow Universal AI Tools architectural patterns
   - Implement service integration points
   - Ensure mandatory context injection usage
   - Apply intelligent parameter optimization
   - Build with production security patterns

5. **Production Validation**
   - Run architecture validation: `npm run lint:fix && npm run build`
   - Execute security audit: `npm run security:audit`
   - Validate service integration: `npm test && npm run test:integration`
   - Performance testing: `npm run test:performance`
   - Fix any failures using existing service patterns

6. **Advanced AI Integration Testing**
   - Test context injection effectiveness
   - Validate MLX integration (if applicable)
   - Check intelligent parameter optimization
   - Verify DSPy orchestration integration
   - Monitor AB-MCTS coordination

7. **Production Readiness Check**
   - Verify all Universal AI Tools patterns followed
   - Confirm service architecture consistency
   - Validate security and performance requirements
   - Check monitoring and observability
   - Ensure multi-tenant isolation

8. **Final Validation**
   - All production checklist items completed
   - Integration with existing sophisticated services verified
   - Performance benchmarks met
   - Security audit clean
   - Architecture consistency maintained

## Universal AI Tools Specific Patterns

```typescript
// MANDATORY: Context injection for all LLM calls
const { enrichedPrompt } = await contextInjectionService.enrichWithContext(
  userRequest, 
  { userId, workingDirectory, currentProject }
);

// REQUIRED: Supabase vault for secrets
const apiKey = await getSecretFromVault('service_name_api_key');

// PATTERN: Service-oriented architecture
export class NewService {
  // Integrate with existing services
  // Follow established patterns
}
```

Note: Universal AI Tools has sophisticated infrastructure. Always integrate with existing services rather than creating isolated components.

Reference the PRP and CLAUDE.md throughout implementation to maintain architectural consistency.