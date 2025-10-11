# TypeScript Fix Guide for Universal AI Tools
This guide provides specific fixes for the TypeScript errors in the codebase based on our analysis of 519 errors.
## Summary

- **Total Errors**: 519

- **Error Types**: 22

- **Most Common**: TS1240 (decorator issues, 250 occurrences)
## Top Priority Fixes
### 1. TS1240: Decorator Issues (250 occurrences in pydantic_models.ts)
**Problem**: Unable to resolve signature of property decorator when called as an expression.
**Solution**: The pydantic_models.ts file is using Python-style decorators that don't translate directly to TypeScript.
**Fix**:

```typescript

// Remove Python decorators and use TypeScript interfaces

// Before:

@Field(description="Agent name")

name: string;
// After:

interface AgentModel {

  name: string;

  description?: string;

}
// Or use class-validator decorators properly:

import { IsString, IsOptional } from 'class-validator';
class AgentModel {

  @IsString()

  name: string;

  

  @IsOptional()

  @IsString()

  description?: string;

}

```
### 2. TS2345: Type Assignment Issues (80 occurrences)
**Problem**: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
**Common Fixes**:

```typescript

// Option 1: Add null check

if (value !== undefined) {

  processString(value);

}
// Option 2: Use default value

processString(value || '');
// Option 3: Use non-null assertion (if you're sure)

processString(value!);
// Option 4: Update function signature

function processString(value: string | undefined) {

  if (!value) return;

  // process value

}

```
### 3. TS2339: Missing Properties (71 occurrences)
**Problem**: Property 'metadata' does not exist on type 'AgentContext'.
**Fix**: Update the AgentContext interface

```typescript

// In src/types/agent.types.ts or similar

interface AgentContext {

  // existing properties...

  metadata?: {

    [key: string]: any;

  };

  userId?: string;

  sessionId?: string;

  requestId?: string;

}

```
### 4. TS7053: Index Signature Issues (24 occurrences)
**Problem**: Can't use string to index object without index signature.
**Fixes**:

```typescript

// Option 1: Add index signature to type

interface AgentRoles {

  [key: string]: string;

  planner: string;

  retriever: string;

  // ... other roles

}
// Option 2: Use type assertion

const role = agentRoles[agentType as keyof typeof agentRoles];
// Option 3: Use Record type

type AgentRoles = Record<string, string>;
// Option 4: Type guard

if (agentType in agentRoles) {

  const role = agentRoles[agentType as keyof typeof agentRoles];

}

```
### 5. TS2322: Array vs String Assignment (24 occurrences)
**Problem**: Type 'string[]' is not assignable to type 'string'.
**Fix**: Check if you're accidentally assigning an array to a string property

```typescript

// Common mistake in memory/knowledge systems:

// Before:

memory.content = ['item1', 'item2']; // Error!
// After:

memory.content = ['item1', 'item2'].join(', ');

// or

memory.tags = ['item1', 'item2']; // if it should be an array

```
## Quick Fix Script
Create a script to automatically fix common issues:
```bash
#!/bin/bash
# fix_typescript_errors.sh

# Fix decorator issues by replacing pydantic_models.ts

echo "Fixing decorator issues..."
# Consider removing or rewriting pydantic_models.ts

# Add missing properties to interfaces

echo "Adding missing interface properties..."

find src -name "*.ts" -type f -exec sed -i '' \

  's/interface AgentContext {/interface AgentContext {\n  metadata?: Record<string, any>;/g' {} \;

# Fix undefined checks

echo "Adding undefined checks..."

find src -name "*.ts" -type f -exec sed -i '' \

  's/\.embedding\b/.embedding || []/g' {} \;
echo "TypeScript fixes applied!"

```
## Recommended Actions
1. **Remove pydantic_models.ts** - This file uses Python patterns incompatible with TypeScript

2. **Update all interfaces** - Add missing properties identified in the error report

3. **Add proper type guards** - Use TypeScript's type narrowing features

4. **Enable strict mode gradually** - Fix errors incrementally
## Next Steps
1. Run `npm run build` after each fix to verify progress

2. Focus on fixing one error type at a time

3. Update tests as you fix the types

4. Consider using `// @ts-expect-error` temporarily for complex fixes
## Additional Resources
- TypeScript Handbook: https://www.typescriptlang.org/docs/handbook/

- Error Reference: Stored in Supabase (use search_typescript_fixes.js)

- Community Help: TypeScript Discord/GitHub