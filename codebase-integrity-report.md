# Codebase Integrity Report

**Generated:** 2025-07-26T06:11:14.368Z

## Summary

- **Total Files Scanned:** 54
- **Errors Found:** 8
- **Warnings Found:** 24

### Error Breakdown

- Missing Imports: 8
- Invalid Paths: 0
- Undefined References: 24
- Syntax Errors: 0
- Inconsistent Naming: 0

## Issues Found

### MISSING IMPORT

**File:** `src/routers/vision.ts`
**Line:** 9
**Message:** Import path '../services/pyvision-bridge.js' cannot be resolved
**Severity:** error
**Suggestion:** Check if the file exists or update the import path

---

**File:** `src/routers/vision.ts`
**Line:** 10
**Message:** Import path '../services/vision-resource-manager.js' cannot be resolved
**Severity:** error
**Suggestion:** Check if the file exists or update the import path

---

**File:** `src/routers/vision.ts`
**Line:** 11
**Message:** Import path '../utils/logger.js' cannot be resolved
**Severity:** error
**Suggestion:** Check if the file exists or update the import path

---

**File:** `src/routers/vision.ts`
**Line:** 12
**Message:** Import path '../utils/api-response.js' cannot be resolved
**Severity:** error
**Suggestion:** Check if the file exists or update the import path

---

**File:** `src/routers/vision.ts`
**Line:** 13
**Message:** Import path '../middleware/rate-limiter-enhanced.js' cannot be resolved
**Severity:** error
**Suggestion:** Check if the file exists or update the import path

---

**File:** `src/agents/base_agent.ts`
**Line:** 95
**Message:** Dynamic import path '../utils/logger.js' cannot be resolved
**Severity:** error
**Suggestion:** Check if the file exists or update the import path

---

**File:** `src/services/dspy-orchestrator/bridge.ts`
**Line:** 2
**Message:** Import path '../../utils/enhanced-logger' cannot be resolved
**Severity:** error
**Suggestion:** Check if the file exists or update the import path

---

**File:** `src/services/dspy-orchestrator/bridge.ts`
**Line:** 8
**Message:** Import path '../../utils/smart-port-manager' cannot be resolved
**Severity:** error
**Suggestion:** Check if the file exists or update the import path

---

### UNDEFINED REFERENCE

**File:** `src/types/vision.ts`
**Message:** Type 'DetectedObject' is used but not imported or defined
**Severity:** warning
**Suggestion:** Import DetectedObject from the appropriate types file

---

**File:** `src/types/vision.ts`
**Message:** Type 'SceneDescription' is used but not imported or defined
**Severity:** warning
**Suggestion:** Import SceneDescription from the appropriate types file

---

**File:** `src/types/vision.ts`
**Message:** Type 'ExtractedText' is used but not imported or defined
**Severity:** warning
**Suggestion:** Import ExtractedText from the appropriate types file

---

**File:** `src/types/vision.ts`
**Message:** Type 'BoundingBox' is used but not imported or defined
**Severity:** warning
**Suggestion:** Import BoundingBox from the appropriate types file

---

**File:** `src/types/vision.ts`
**Message:** Type 'Record' is used but not imported or defined
**Severity:** warning
**Suggestion:** Import Record from the appropriate types file

---

**File:** `src/types/vision.ts`
**Message:** Type 'BoundingBox' is used but not imported or defined
**Severity:** warning
**Suggestion:** Import BoundingBox from the appropriate types file

---

**File:** `src/types/vision.ts`
**Message:** Type 'Float32Array' is used but not imported or defined
**Severity:** warning
**Suggestion:** Import Float32Array from the appropriate types file

---

**File:** `src/types/vision.ts`
**Message:** Type 'Record' is used but not imported or defined
**Severity:** warning
**Suggestion:** Import Record from the appropriate types file

---

**File:** `src/types/vision.ts`
**Message:** Type 'GenerationParameters' is used but not imported or defined
**Severity:** warning
**Suggestion:** Import GenerationParameters from the appropriate types file

---

**File:** `src/types/vision.ts`
**Message:** Type 'QualityMetrics' is used but not imported or defined
**Severity:** warning
**Suggestion:** Import QualityMetrics from the appropriate types file

---

**File:** `src/types/vision.ts`
**Message:** Type 'GeneratedImage' is used but not imported or defined
**Severity:** warning
**Suggestion:** Import GeneratedImage from the appropriate types file

---

**File:** `src/types/vision.ts`
**Message:** Type 'VisualHypothesis' is used but not imported or defined
**Severity:** warning
**Suggestion:** Import VisualHypothesis from the appropriate types file

---

**File:** `src/types/vision.ts`
**Message:** Type 'VisionAnalysis' is used but not imported or defined
**Severity:** warning
**Suggestion:** Import VisionAnalysis from the appropriate types file

---

**File:** `src/types/vision.ts`
**Message:** Type 'LearningOutcome' is used but not imported or defined
**Severity:** warning
**Suggestion:** Import LearningOutcome from the appropriate types file

---

**File:** `src/types/vision.ts`
**Message:** Type 'VisionEmbedding' is used but not imported or defined
**Severity:** warning
**Suggestion:** Import VisionEmbedding from the appropriate types file

---

**File:** `src/types/vision.ts`
**Message:** Type 'VisionAnalysis' is used but not imported or defined
**Severity:** warning
**Suggestion:** Import VisionAnalysis from the appropriate types file

---

**File:** `src/types/vision.ts`
**Message:** Type 'TemporalContext' is used but not imported or defined
**Severity:** warning
**Suggestion:** Import TemporalContext from the appropriate types file

---

**File:** `src/types/vision.ts`
**Message:** Type 'SpatialContext' is used but not imported or defined
**Severity:** warning
**Suggestion:** Import SpatialContext from the appropriate types file

---

**File:** `src/types/vision.ts`
**Message:** Type 'CausalEvent' is used but not imported or defined
**Severity:** warning
**Suggestion:** Import CausalEvent from the appropriate types file

---

**File:** `src/types/vision.ts`
**Message:** Type 'Record' is used but not imported or defined
**Severity:** warning
**Suggestion:** Import Record from the appropriate types file

---

**File:** `src/types/vision.ts`
**Message:** Type 'SpatialObject' is used but not imported or defined
**Severity:** warning
**Suggestion:** Import SpatialObject from the appropriate types file

---

**File:** `src/types/vision.ts`
**Message:** Type 'SpatialRelation' is used but not imported or defined
**Severity:** warning
**Suggestion:** Import SpatialRelation from the appropriate types file

---

**File:** `src/types/vision.ts`
**Message:** Type 'Buffer' is used but not imported or defined
**Severity:** warning
**Suggestion:** Import Buffer from the appropriate types file

---

**File:** `src/types/vision.ts`
**Message:** Type 'VisionOptions' is used but not imported or defined
**Severity:** warning
**Suggestion:** Import VisionOptions from the appropriate types file

---

## Recommendations

- Fix 8 missing import statements
- Resolve 24 undefined references

## Next Steps

1. Review and fix all errors marked as 'error' severity
2. Address warnings to improve code quality
3. Run the validator again to verify fixes
4. Consider adding this to your CI/CD pipeline
