/**
 * TensorFlow Loader - Makes TensorFlow optional
 * Falls back gracefully if TensorFlow is not available
 */

let tf: any = null;
let tfAvailable = false;

try {
  // Try to load TensorFlow
  tf = require('@tensorflow/tfjs-node');
  tfAvailable = true;
  console.log('TensorFlow.js loaded successfully');
} catch (error) {
  console.warn('TensorFlow.js not available, some features will be disabled');
  // Create mock TensorFlow object with no-op functions
  tf = {
    tensor: () => null,
    dispose: () => null,
    tidy: () => null,
    ready: () => Promise.resolve(),
    // Add other commonly used functions as no-ops
  };
}

export { tf, tfAvailable };