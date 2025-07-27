/**;
 * Knowledge Manager - Now uses D.S.Py-based implementation* The original 800+ line implementation has been replaced with a lightweight* D.S.Py-powered knowledge management system that maintains all essential functionality* while leveraging intelligent knowledge extraction and optimization.
 */ // Re-export the D.S.Py-based implementation;
export * from './dspy-knowledge-manager';
export { DSPy.Knowledge.Manager.as Knowledge.Manager } from './dspy-knowledge-manager'// For backward compatibility, also export as default;
import { DSPy.Knowledge.Manager } from './dspy-knowledge-manager';
export default DSPy.Knowledge.Manager;
