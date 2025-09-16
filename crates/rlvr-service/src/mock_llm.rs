use anyhow::Result;
use std::collections::HashMap;
use tokio::time::{sleep, Duration};

/// Mock LLM service for testing RLVR without external dependencies
pub struct MockLLMService {
    responses: HashMap<String, Vec<String>>,
    current_iteration: HashMap<String, usize>,
}

impl MockLLMService {
    pub fn new() -> Self {
        let mut responses = HashMap::new();
        
        // Pre-defined responses for different prompts to simulate learning
        responses.insert("hello_world".to_string(), vec![
            "print('Hello World')".to_string(),
            "def hello(): print('Hello World')".to_string(),
            "def hello_world(): print('Hello World!')".to_string(),
            "def hello_world(): print('Hello World!'); return 'Hello World!'".to_string(),
            "def hello_world(): print('Hello World!'); return 'Hello World!'; hello_world()".to_string(),
        ]);
        
        responses.insert("fibonacci".to_string(), vec![
            "def fib(n): return n if n <= 1 else fib(n-1) + fib(n-2)".to_string(),
            "def fibonacci(n): return n if n <= 1 else fibonacci(n-1) + fibonacci(n-2)".to_string(),
            "def fibonacci(n): return n if n <= 1 else fibonacci(n-1) + fibonacci(n-2); print(fibonacci(10))".to_string(),
            "def fibonacci(n): return n if n <= 1 else fibonacci(n-1) + fibonacci(n-2); for i in range(10): print(fibonacci(i))".to_string(),
            "def fibonacci(n): return n if n <= 1 else fibonacci(n-1) + fibonacci(n-2); [print(fibonacci(i)) for i in range(10)]".to_string(),
        ]);
        
        responses.insert("sorting".to_string(), vec![
            "def sort_list(lst): return sorted(lst)".to_string(),
            "def quicksort(arr): return sorted(arr)".to_string(),
            "def quicksort(arr): return arr if len(arr) <= 1 else quicksort([x for x in arr[1:] if x < arr[0]]) + [arr[0]] + quicksort([x for x in arr[1:] if x >= arr[0]])".to_string(),
            "def quicksort(arr): return arr if len(arr) <= 1 else quicksort([x for x in arr[1:] if x < arr[0]]) + [arr[0]] + quicksort([x for x in arr[1:] if x >= arr[0]]); print(quicksort([3,1,4,1,5]))".to_string(),
            "def quicksort(arr): return arr if len(arr) <= 1 else quicksort([x for x in arr[1:] if x < arr[0]]) + [arr[0]] + quicksort([x for x in arr[1:] if x >= arr[0]]); print(quicksort([3,1,4,1,5])); print('Sorted!')".to_string(),
        ]);
        
        Self {
            responses,
            current_iteration: HashMap::new(),
        }
    }
    
    pub async fn generate(&mut self, prompt: &str, _context: Option<&str>) -> Result<String> {
        // Simulate network delay
        sleep(Duration::from_millis(50)).await;
        
        // Extract task type from prompt
        let task_type = self.extract_task_type(prompt);
        let iteration = self.current_iteration.entry(task_type.clone()).or_insert(0);
        
        // Get response for this iteration (cycling through available responses)
        let default_response = vec!["def example(): pass".to_string()];
        let responses = self.responses.get(&task_type).unwrap_or(&default_response);
        let response = responses[*iteration % responses.len()].clone();
        
        // Increment iteration for next call
        *iteration += 1;
        
        // Add some randomness to simulate real LLM behavior
        if *iteration % 3 == 0 {
            Ok(format!("{} # Improved version", response))
        } else {
            Ok(response)
        }
    }
    
    fn extract_task_type(&self, prompt: &str) -> String {
        let prompt_lower = prompt.to_lowercase();
        if prompt_lower.contains("hello") || prompt_lower.contains("world") {
            "hello_world".to_string()
        } else if prompt_lower.contains("fibonacci") || prompt_lower.contains("fib") {
            "fibonacci".to_string()
        } else if prompt_lower.contains("sort") || prompt_lower.contains("quicksort") {
            "sorting".to_string()
        } else {
            "default".to_string()
        }
    }
    
    pub fn reset_iterations(&mut self) {
        self.current_iteration.clear();
    }
    
    pub fn get_iteration_count(&self, task_type: &str) -> usize {
        self.current_iteration.get(task_type).copied().unwrap_or(0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_mock_llm_generation() {
        let mut mock_llm = MockLLMService::new();
        
        let response1 = mock_llm.generate("Write a hello world function", None).await.unwrap();
        assert!(response1.contains("Hello"));
        
        let response2 = mock_llm.generate("Write a hello world function", None).await.unwrap();
        assert!(response2.contains("Hello"));
        
        // Should be different responses (progressive improvement)
        assert_ne!(response1, response2);
    }
    
    #[tokio::test]
    async fn test_task_type_extraction() {
        let mock_llm = MockLLMService::new();
        
        assert_eq!(mock_llm.extract_task_type("Write a hello world function"), "hello_world");
        assert_eq!(mock_llm.extract_task_type("Implement fibonacci"), "fibonacci");
        assert_eq!(mock_llm.extract_task_type("Create a sorting algorithm"), "sorting");
        assert_eq!(mock_llm.extract_task_type("Random task"), "default");
    }
}
