/**
 * Knowledge Manager - Now uses DSPy-based implementation
 * The original 800+ line implementation has been replaced with a lightweight
 * DSPy-powered knowledge management system that maintains all essential functionality
 * while leveraging intelligent knowledge extraction and optimization.
 */

// Re-export the DSPy-based implementation
export * from './dspy-knowledge-manager';
export { DSPyKnowledgeManager as KnowledgeManager } from './dspy-knowledge-manager';

// For backward compatibility, also export as default
import { DSPyKnowledgeManager } from './dspy-knowledge-manager';
export default DSPyKnowledgeManager;