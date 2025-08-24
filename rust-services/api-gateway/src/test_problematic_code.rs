// Test file with deliberate code quality issues for AutoFix testing

use std::collections::HashMap;  // This will be unused - should be auto-removed
use std::path::PathBuf;        // This will be unused - should be auto-removed
use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct TestStruct {
    pub name: String,
    pub value: i32,
}

pub fn problematic_function() -> Result<String, Box<dyn std::error::Error>> {
    let unused_variable = "this variable is never used";  // Should be prefixed with _
    let another_unused = 42;  // Should be prefixed with _
    
    // Problematic error handling - using unwrap()
    let config_data = std::fs::read_to_string("config.json").unwrap();
    let parsed_config: serde_json::Value = serde_json::from_str(&config_data).unwrap();
    
    // Another unwrap that should be converted to proper error handling
    let important_value = parsed_config["important_key"].as_str().unwrap();
    
    Ok(important_value.to_string())
}

pub fn another_function_with_issues() {
    let temp_var = "temporary";  // Unused variable
    let _used_var = "this one is used";
    
    println!("Using: {}", _used_var);
    
    // More problematic unwrap usage
    let path = std::env::current_dir().unwrap();
    println!("Current directory: {:?}", path);
}

// Function with no documentation - should be flagged for missing docs
pub fn undocumented_function(input: &str) -> String {
    input.to_uppercase()
}