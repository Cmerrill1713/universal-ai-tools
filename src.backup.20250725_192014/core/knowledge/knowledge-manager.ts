/**
 * Knowledge Manager - Now uses DS.Py-based implementation* The original 800+ line implementation has been replaced with a lightweight* DS.Py-powered knowledge management system that maintains all essential functionality* while leveraging intelligent knowledge extraction and optimization.
 */ // Re-export the DS.Py-based implementation;
export * from './dspy-knowledge-manager';
export { DSPyKnowledge.Manager as Knowledge.Manager } from './dspy-knowledge-manager'// For backward compatibility, also export as default;
import { DSPyKnowledge.Manager } from './dspy-knowledge-manager';
export default DSPyKnowledge.Manager;
