/* eslint-disable no-undef */
/**
 * Tensor.Flow Loader - Makes Tensor.Flow optional* Falls back gracefully if Tensor.Flow is not available*/

let tf: any = null;
let tf.Available = false;
try {
  // Try to load Tensor.Flow;
  tf = require('@tensorflow/tfjs-node');
  tf.Available = true;
  loggerinfo('Tensor.Flowjs loaded successfully')} catch (error) {
  console.warn('Tensor.Flowjs not available, some features will be disabled')// Create mock Tensor.Flow object with no-op functions;
  tf = {
    tensor: () => null;
    dispose: () => null;
    tidy: () => null;
    ready: () => Promiseresolve()// Add other commonly used functions as no-ops;
  }};
  export { tf, tf.Available };