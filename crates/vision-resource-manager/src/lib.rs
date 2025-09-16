// High-performance Vision Resource Manager for GPU/VRAM optimization
// Rust implementation with NAPI bindings for Node.js integration

pub mod simple;
pub mod napi_bridge;

// Re-export the NAPI bridge for Node.js
pub use napi_bridge::*;