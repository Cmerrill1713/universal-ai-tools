//! Service Integration for Unlimited Context
//! 
//! This module integrates with existing services like the knowledge crawler,
//! web scraper, and other data sources to enhance unlimited context.

use crate::models::Message;
use crate::context::MessageRole;
use crate::RouterError;
use crate::keychain::KeychainManager;
use serde::{Deserialize, Serialize};
// use std::collections::HashMap; // Not used in this module

/// Integration with existing knowledge crawler service
#[derive(Debug)]
pub struct KnowledgeCrawlerIntegration {
    crawler_url: String,
    client: reqwest::Client,
}

/// Knowledge crawler response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrawlerResponse {
    pub status: String,
    pub total_documents: usize,
    pub documents: Vec<CrawledDocument>,
    pub sources: Vec<String>,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrawledDocument {
    pub source: String,
    pub title: String,
    pub content: String,
    pub url: String,
    pub relevance_score: f32,
    pub topics: Vec<String>,
    pub scraped_at: String,
}

/// Integration with existing knowledge scraper service
#[derive(Debug)]
pub struct KnowledgeScraperIntegration {
    scraper_url: String,
    client: reqwest::Client,
}

/// Knowledge scraper response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScraperResponse {
    pub entries: Vec<KnowledgeEntry>,
    pub total_scraped: usize,
    pub sources_processed: Vec<String>,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeEntry {
    pub source: String,
    pub category: String,
    pub title: String,
    pub content: String,
    pub url: Option<String>,
    pub relevance_score: f32,
    pub topics: Vec<String>,
}

/// GitHub integration for repository access
#[derive(Debug)]
pub struct GitHubIntegration {
    keychain_manager: KeychainManager,
    client: reqwest::Client,
    username: Option<String>,
}

/// GitHub repository information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubRepo {
    pub name: String,
    pub full_name: String,
    pub description: Option<String>,
    pub url: String,
    pub clone_url: String,
    pub topics: Vec<String>,
    pub language: Option<String>,
    pub stars: u32,
    pub forks: u32,
    pub updated_at: String,
}

/// GitHub issue/PR information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubIssue {
    pub number: u32,
    pub title: String,
    pub body: String,
    pub state: String,
    pub author: String,
    pub created_at: String,
    pub updated_at: String,
    pub labels: Vec<String>,
    pub comments: Vec<GitHubComment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubComment {
    pub author: String,
    pub body: String,
    pub created_at: String,
}

impl KnowledgeCrawlerIntegration {
    pub fn new(crawler_url: String) -> Self {
        let client = reqwest::Client::builder()
            .user_agent("Universal-AI-Tools-LLMRouter/1.0")
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");
            
        Self {
            crawler_url,
            client,
        }
    }
    
    /// Crawl knowledge for a specific query
    pub async fn crawl_knowledge(&self, query: &str, max_results: Option<usize>) -> Result<CrawlerResponse, RouterError> {
        let url = format!("{}/crawl", self.crawler_url);
        
        let payload = serde_json::json!({
            "query": query,
            "max_results": max_results.unwrap_or(10),
            "sources": ["github", "stackoverflow", "documentation", "blogs"]
        });
        
        let response = self.client
            .post(&url)
            .json(&payload)
            .send()
            .await
            .map_err(|e| RouterError::NetworkError(format!("Failed to crawl knowledge: {}", e)))?;
            
        if !response.status().is_success() {
            return Err(RouterError::NetworkError(format!(
                "Knowledge crawler returned error: {}", response.status()
            )));
        }
        
        let crawler_response: CrawlerResponse = response.json().await
            .map_err(|e| RouterError::SerializationError(format!("Failed to parse crawler response: {}", e)))?;
            
        Ok(crawler_response)
    }
    
    /// Convert crawled documents to messages for context
    pub fn documents_to_messages(&self, documents: &[CrawledDocument], query: &str) -> Vec<Message> {
        let mut messages = Vec::new();
        
        // Add a system message explaining the context
        messages.push(Message {
            role: MessageRole::System,
            content: format!(
                "Retrieved {} relevant documents for query '{}':\n\n",
                documents.len(),
                query
            ),
            name: Some("knowledge_crawler".to_string()),
        });
        
        // Add each document as a system message
        for (i, doc) in documents.iter().enumerate() {
            let content = format!(
                "Document {}: {}\nSource: {}\nURL: {}\nRelevance: {:.2}\nTopics: {}\n\nContent:\n{}",
                i + 1,
                doc.title,
                doc.source,
                doc.url,
                doc.relevance_score,
                doc.topics.join(", "),
                doc.content
            );
            
            messages.push(Message {
                role: MessageRole::System,
                content,
                name: Some(format!("crawled_doc_{}", i + 1)),
            });
        }
        
        messages
    }
}

impl KnowledgeScraperIntegration {
    pub fn new(scraper_url: String) -> Self {
        let client = reqwest::Client::builder()
            .user_agent("Universal-AI-Tools-LLMRouter/1.0")
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");
            
        Self {
            scraper_url,
            client,
        }
    }
    
    /// Scrape specific sources for knowledge
    pub async fn scrape_sources(&self, sources: &[String], categories: Option<&[String]>) -> Result<ScraperResponse, RouterError> {
        let url = format!("{}/scrape", self.scraper_url);
        
        let payload = serde_json::json!({
            "sources": sources,
            "categories": categories.unwrap_or(&[]),
            "limit": 50
        });
        
        let response = self.client
            .post(&url)
            .json(&payload)
            .send()
            .await
            .map_err(|e| RouterError::NetworkError(format!("Failed to scrape sources: {}", e)))?;
            
        if !response.status().is_success() {
            return Err(RouterError::NetworkError(format!(
                "Knowledge scraper returned error: {}", response.status()
            )));
        }
        
        let scraper_response: ScraperResponse = response.json().await
            .map_err(|e| RouterError::SerializationError(format!("Failed to parse scraper response: {}", e)))?;
            
        Ok(scraper_response)
    }
    
    /// Convert knowledge entries to messages for context
    pub fn entries_to_messages(&self, entries: &[KnowledgeEntry], query: &str) -> Vec<Message> {
        let mut messages = Vec::new();
        
        // Add a system message explaining the context
        messages.push(Message {
            role: MessageRole::System,
            content: format!(
                "Retrieved {} knowledge entries for query '{}':\n\n",
                entries.len(),
                query
            ),
            name: Some("knowledge_scraper".to_string()),
        });
        
        // Add each entry as a system message
        for (i, entry) in entries.iter().enumerate() {
            let content = format!(
                "Entry {}: {}\nSource: {}\nCategory: {}\nRelevance: {:.2}\nTopics: {}\nURL: {}\n\nContent:\n{}",
                i + 1,
                entry.title,
                entry.source,
                entry.category,
                entry.relevance_score,
                entry.topics.join(", "),
                entry.url.as_deref().unwrap_or("N/A"),
                entry.content
            );
            
            messages.push(Message {
                role: MessageRole::System,
                content,
                name: Some(format!("scraped_entry_{}", i + 1)),
            });
        }
        
        messages
    }
}

impl GitHubIntegration {
    pub fn new(username: Option<String>) -> Self {
        let keychain_manager = KeychainManager::new("universal-ai-tools");
        
        let client = reqwest::Client::builder()
            .user_agent("Universal-AI-Tools-LLMRouter/1.0")
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");
        
        Self {
            keychain_manager,
            client,
            username,
        }
    }
    
    /// Set up authentication using keychain token
    pub fn authenticate(&mut self, username: &str) -> Result<(), RouterError> {
        let token = self.keychain_manager.get_github_token(username)?;
        
        // Update client with authentication
        self.client = reqwest::Client::builder()
            .user_agent("Universal-AI-Tools-LLMRouter/1.0")
            .timeout(std::time::Duration::from_secs(30))
            .default_headers({
                let mut headers = reqwest::header::HeaderMap::new();
                headers.insert(
                    reqwest::header::AUTHORIZATION,
                    format!("Bearer {}", token).parse().unwrap(),
                );
                headers
            })
            .build()
            .expect("Failed to create HTTP client");
        
        self.username = Some(username.to_string());
        Ok(())
    }
    
    /// Store GitHub token in keychain
    pub fn store_token(&self, username: &str, token: &str) -> Result<(), RouterError> {
        self.keychain_manager.store_github_token(username, token)
    }
    
    /// Search GitHub repositories
    pub async fn search_repositories(&self, query: &str, language: Option<&str>, limit: Option<usize>) -> Result<Vec<GitHubRepo>, RouterError> {
        let mut search_query = query.to_string();
        if let Some(lang) = language {
            search_query.push_str(&format!(" language:{}", lang));
        }
        
        let url = format!("https://api.github.com/search/repositories?q={}&per_page={}", 
            search_query, 
            limit.unwrap_or(10)
        );
        
        let response = self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| RouterError::NetworkError(format!("Failed to search GitHub: {}", e)))?;
            
        if !response.status().is_success() {
            return Err(RouterError::NetworkError(format!(
                "GitHub API returned error: {}", response.status()
            )));
        }
        
        let json_response: serde_json::Value = response.json().await
            .map_err(|e| RouterError::SerializationError(format!("Failed to parse GitHub response: {}", e)))?;
        
        let mut repos = Vec::new();
        if let Some(items) = json_response["items"].as_array() {
            for item in items {
                let repo = GitHubRepo {
                    name: item["name"].as_str().unwrap_or("").to_string(),
                    full_name: item["full_name"].as_str().unwrap_or("").to_string(),
                    description: item["description"].as_str().map(|s| s.to_string()),
                    url: item["html_url"].as_str().unwrap_or("").to_string(),
                    clone_url: item["clone_url"].as_str().unwrap_or("").to_string(),
                    topics: item["topics"].as_array()
                        .map(|arr| arr.iter().filter_map(|t| t.as_str()).map(|s| s.to_string()).collect())
                        .unwrap_or_default(),
                    language: item["language"].as_str().map(|s| s.to_string()),
                    stars: item["stargazers_count"].as_u64().unwrap_or(0) as u32,
                    forks: item["forks_count"].as_u64().unwrap_or(0) as u32,
                    updated_at: item["updated_at"].as_str().unwrap_or("").to_string(),
                };
                repos.push(repo);
            }
        }
        
        Ok(repos)
    }
    
    /// Get repository information
    pub async fn get_repository(&self, owner: &str, repo: &str) -> Result<GitHubRepo, RouterError> {
        let url = format!("https://api.github.com/repos/{}/{}", owner, repo);
        
        let response = self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| RouterError::NetworkError(format!("Failed to get repository: {}", e)))?;
            
        if !response.status().is_success() {
            return Err(RouterError::NetworkError(format!(
                "GitHub API returned error: {}", response.status()
            )));
        }
        
        let item: serde_json::Value = response.json().await
            .map_err(|e| RouterError::SerializationError(format!("Failed to parse GitHub response: {}", e)))?;
        
        let repo = GitHubRepo {
            name: item["name"].as_str().unwrap_or("").to_string(),
            full_name: item["full_name"].as_str().unwrap_or("").to_string(),
            description: item["description"].as_str().map(|s| s.to_string()),
            url: item["html_url"].as_str().unwrap_or("").to_string(),
            clone_url: item["clone_url"].as_str().unwrap_or("").to_string(),
            topics: item["topics"].as_array()
                .map(|arr| arr.iter().filter_map(|t| t.as_str()).map(|s| s.to_string()).collect())
                .unwrap_or_default(),
            language: item["language"].as_str().map(|s| s.to_string()),
            stars: item["stargazers_count"].as_u64().unwrap_or(0) as u32,
            forks: item["forks_count"].as_u64().unwrap_or(0) as u32,
            updated_at: item["updated_at"].as_str().unwrap_or("").to_string(),
        };
        
        Ok(repo)
    }
    
    /// Get repository issues
    pub async fn get_repository_issues(&self, owner: &str, repo: &str, limit: Option<usize>) -> Result<Vec<GitHubIssue>, RouterError> {
        let url = format!("https://api.github.com/repos/{}/{}/issues?per_page={}&state=all", 
            owner, repo, limit.unwrap_or(10));
        
        let response = self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| RouterError::NetworkError(format!("Failed to get issues: {}", e)))?;
            
        if !response.status().is_success() {
            return Err(RouterError::NetworkError(format!(
                "GitHub API returned error: {}", response.status()
            )));
        }
        
        let items: Vec<serde_json::Value> = response.json().await
            .map_err(|e| RouterError::SerializationError(format!("Failed to parse GitHub response: {}", e)))?;
        
        let mut issues = Vec::new();
        for item in items {
            let issue = GitHubIssue {
                number: item["number"].as_u64().unwrap_or(0) as u32,
                title: item["title"].as_str().unwrap_or("").to_string(),
                body: item["body"].as_str().unwrap_or("").to_string(),
                state: item["state"].as_str().unwrap_or("").to_string(),
                author: item["user"]["login"].as_str().unwrap_or("").to_string(),
                created_at: item["created_at"].as_str().unwrap_or("").to_string(),
                updated_at: item["updated_at"].as_str().unwrap_or("").to_string(),
                labels: item["labels"].as_array()
                    .map(|arr| arr.iter().filter_map(|l| l["name"].as_str()).map(|s| s.to_string()).collect())
                    .unwrap_or_default(),
                comments: Vec::new(), // Would need separate API call for comments
            };
            issues.push(issue);
        }
        
        Ok(issues)
    }
    
    /// Convert GitHub data to messages for context
    pub fn github_data_to_messages(&self, repos: &[GitHubRepo], issues: &[GitHubIssue], query: &str) -> Vec<Message> {
        let mut messages = Vec::new();
        
        // Add repositories information
        if !repos.is_empty() {
            let mut content = format!("Found {} relevant GitHub repositories for '{}':\n\n", repos.len(), query);
            
            for (i, repo) in repos.iter().enumerate() {
                content.push_str(&format!(
                    "Repository {}: {}\nDescription: {}\nLanguage: {}\nStars: {} | Forks: {}\nTopics: {}\nURL: {}\n\n",
                    i + 1,
                    repo.full_name,
                    repo.description.as_deref().unwrap_or("No description"),
                    repo.language.as_deref().unwrap_or("Unknown"),
                    repo.stars,
                    repo.forks,
                    repo.topics.join(", "),
                    repo.url
                ));
            }
            
            messages.push(Message {
                role: MessageRole::System,
                content,
                name: Some("github_repositories".to_string()),
            });
        }
        
        // Add issues information
        if !issues.is_empty() {
            let mut content = format!("Found {} relevant GitHub issues for '{}':\n\n", issues.len(), query);
            
            for (_i, issue) in issues.iter().enumerate() {
                content.push_str(&format!(
                    "Issue #{}: {}\nState: {}\nAuthor: {}\nLabels: {}\nBody: {}\n\n",
                    issue.number,
                    issue.title,
                    issue.state,
                    issue.author,
                    issue.labels.join(", "),
                    issue.body.chars().take(200).collect::<String>() // Truncate long bodies
                ));
            }
            
            messages.push(Message {
                role: MessageRole::System,
                content,
                name: Some("github_issues".to_string()),
            });
        }
        
        messages
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_documents_to_messages() {
        let integration = KnowledgeCrawlerIntegration::new("http://localhost:8030".to_string());
        
        let documents = vec![
            CrawledDocument {
                source: "GitHub".to_string(),
                title: "Test Repository".to_string(),
                content: "This is test content".to_string(),
                url: "https://github.com/test/repo".to_string(),
                relevance_score: 0.8,
                topics: vec!["rust".to_string(), "testing".to_string()],
                scraped_at: "2024-01-01T00:00:00Z".to_string(),
            }
        ];
        
        let messages = integration.documents_to_messages(&documents, "test query");
        
        assert_eq!(messages.len(), 2); // System message + document message
        assert_eq!(messages[0].role, MessageRole::System);
        assert_eq!(messages[1].role, MessageRole::System);
    }
    
    #[test]
    fn test_entries_to_messages() {
        let integration = KnowledgeScraperIntegration::new("http://localhost:8031".to_string());
        
        let entries = vec![
            KnowledgeEntry {
                source: "StackOverflow".to_string(),
                category: "Programming".to_string(),
                title: "Test Question".to_string(),
                content: "This is test content".to_string(),
                url: Some("https://stackoverflow.com/questions/123".to_string()),
                relevance_score: 0.7,
                topics: vec!["rust".to_string()],
            }
        ];
        
        let messages = integration.entries_to_messages(&entries, "test query");
        
        assert_eq!(messages.len(), 2); // System message + entry message
        assert_eq!(messages[0].role, MessageRole::System);
        assert_eq!(messages[1].role, MessageRole::System);
    }
}
