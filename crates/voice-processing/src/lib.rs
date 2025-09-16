#[cfg(feature = "napi")]
mod napi_impl;

#[cfg(not(feature = "napi"))]
pub fn napi_disabled() {}
