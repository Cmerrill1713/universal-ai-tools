use crate::config::Config;
use crate::scanner::NewLibrary;
use anyhow::Result;
use octocrab::Octocrab;
use serde::{Deserialize, Serialize};
use tracing::{info, warn, error};

#[derive(Debug, Clone)]
pub struct GitHubMonitor {
    client: Octocrab,
    config: Config,
}

#[derive(Debug, Serialize, Deserialize)]
struct TrendingRepo {
    name: String,
    full_name: String,
    description: Option<String>,
    html_url: String,
    stargazers_count: u32,
    language: Option<String>,
    topics: Vec<String>,
    created_at: String,
    updated_at: String,
}

impl GitHubMonitor {
    pub async fn new(config: &Config) -> Result<Self> {
        let client = if let Some(token) = &config.github.token {
            Octocrab::builder()
                .personal_token(token.clone())
                .build()?
        } else {
            warn!("No GitHub token provided, using unauthenticated requests (limited rate)");
            Octocrab::builder().build()?
        };

        Ok(Self {
            client,
            config: config.clone(),
        })
    }

    pub async fn scan_trending_technologies(&self) -> Result<Vec<NewLibrary>> {
        info!("🔍 Scanning GitHub for trending technologies");

        let mut new_libraries = Vec::new();

        // Search for trending repositories in each technology we care about
        for language in &self.config.scanner.languages {
            match self.search_trending_repos_by_language(language).await {
                Ok(repos) => {
                    for repo in repos {
                        if let Some(library) = self.evaluate_repo_relevance(&repo).await {
                            new_libraries.push(library);
                        }
                    }
                }
                Err(e) => {
                    error!("Failed to search trending repos for {}: {}", language, e);
                }
            }
        }

        // Search for specific framework updates
        for framework in &self.config.scanner.frameworks {
            match self.search_framework_updates(framework).await {
                Ok(repos) => {
                    for repo in repos {
                        if let Some(library) = self.evaluate_repo_relevance(&repo).await {
                            new_libraries.push(library);
                        }
                    }
                }
                Err(e) => {
                    error!("Failed to search framework updates for {}: {}", framework, e);
                }
            }
        }

        // Remove duplicates and sort by relevance
        new_libraries.sort_by(|a, b| b.relevance_score.partial_cmp(&a.relevance_score).unwrap());
        new_libraries.dedup_by(|a, b| a.github_url == b.github_url);

        info!("✅ Found {} potentially relevant new libraries", new_libraries.len());
        Ok(new_libraries)
    }

    async fn search_trending_repos_by_language(&self, language: &str) -> Result<Vec<TrendingRepo>> {
        let query = format!(
            "language:{} created:>{}",
            language,
            chrono::Utc::now()
                .checked_sub_signed(chrono::Duration::days(30))
                .unwrap()
                .format("%Y-%m-%d")
        );

        let search_result = self.client
            .search()
            .repositories(&query)
            .sort("stars")
            .order("desc")
            .per_page(20)
            .send()
            .await?;

        let repos: Vec<TrendingRepo> = search_result
            .items
            .into_iter()
            .map(|repo| {
                let name = repo.name.clone();
                TrendingRepo {
                    name: name.clone(),
                    full_name: repo.full_name.unwrap_or_else(|| {
                        if let Some(owner) = &repo.owner {
                            format!("{}/{}", owner.login, name)
                        } else {
                            name.clone()
                        }
                    }),
                description: repo.description,
                html_url: repo.html_url.map(|u| u.to_string()).unwrap_or_default(),
                stargazers_count: repo.stargazers_count.unwrap_or(0),
                language: repo.language.and_then(|v| match v {
                    serde_json::Value::String(s) => Some(s),
                    _ => None,
                }),
                    topics: repo.topics.unwrap_or_default(),
                    created_at: repo.created_at.map(|dt| dt.to_string()).unwrap_or_default(),
                    updated_at: repo.updated_at.map(|dt| dt.to_string()).unwrap_or_default(),
                }
            })
            .collect();

        Ok(repos)
    }

    async fn search_framework_updates(&self, framework: &str) -> Result<Vec<TrendingRepo>> {
        let query = format!(
            "{} in:name,description,topics pushed:>{}",
            framework,
            chrono::Utc::now()
                .checked_sub_signed(chrono::Duration::days(7))
                .unwrap()
                .format("%Y-%m-%d")
        );

        let search_result = self.client
            .search()
            .repositories(&query)
            .sort("updated")
            .order("desc")
            .per_page(10)
            .send()
            .await?;

        let repos: Vec<TrendingRepo> = search_result
            .items
            .into_iter()
            .filter(|repo| repo.stargazers_count.unwrap_or(0) > 100) // Filter for quality
            .map(|repo| {
                let name = repo.name.clone();
                TrendingRepo {
                    name: name.clone(),
                    full_name: repo.full_name.unwrap_or_else(|| {
                        if let Some(owner) = &repo.owner {
                            format!("{}/{}", owner.login, name)
                        } else {
                            name.clone()
                        }
                    }),
                description: repo.description,
                html_url: repo.html_url.map(|u| u.to_string()).unwrap_or_default(),
                stargazers_count: repo.stargazers_count.unwrap_or(0),
                language: repo.language.and_then(|v| match v {
                    serde_json::Value::String(s) => Some(s),
                    _ => None,
                }),
                    topics: repo.topics.unwrap_or_default(),
                    created_at: repo.created_at.map(|dt| dt.to_string()).unwrap_or_default(),
                    updated_at: repo.updated_at.map(|dt| dt.to_string()).unwrap_or_default(),
                }
            })
            .collect();

        Ok(repos)
    }

    async fn evaluate_repo_relevance(&self, repo: &TrendingRepo) -> Option<NewLibrary> {
        // Calculate relevance score based on various factors
        let mut relevance_score = 0.0;

        // Star count contributes to relevance
        relevance_score += match repo.stargazers_count {
            0..=100 => 0.1,
            101..=500 => 0.3,
            501..=2000 => 0.5,
            2001..=10000 => 0.7,
            _ => 0.9,
        };

        // Language match
        if let Some(language) = &repo.language {
            if self.config.scanner.languages.iter().any(|l| l.eq_ignore_ascii_case(language)) {
                relevance_score += 0.2;
            }
        }

        // Topic/framework relevance
        for topic in &repo.topics {
            if self.config.scanner.frameworks.iter().any(|f| topic.contains(f)) {
                relevance_score += 0.15;
            }
        }

        // Description keywords
        if let Some(description) = &repo.description {
            let description_lower = description.to_lowercase();
            let relevant_keywords = [
                "ai", "assistant", "automation", "self-healing", "monitoring",
                "architecture", "framework", "library", "tool", "sdk"
            ];
            
            for keyword in relevant_keywords {
                if description_lower.contains(keyword) {
                    relevance_score += 0.05;
                }
            }
        }

        // Recent activity boost
        if let Ok(updated) = chrono::DateTime::parse_from_rfc3339(&repo.updated_at) {
            let days_since_update = chrono::Utc::now()
                .signed_duration_since(updated.with_timezone(&chrono::Utc))
                .num_days();
            
            if days_since_update <= 7 {
                relevance_score += 0.1;
            }
        }

        // Only return if relevance score is above threshold
        if relevance_score >= 0.3 {
            Some(NewLibrary {
                name: repo.name.clone(),
                language: repo.language.clone().unwrap_or_else(|| "Unknown".to_string()),
                description: repo.description.clone().unwrap_or_else(|| "No description".to_string()),
                github_url: repo.html_url.clone(),
                stars: repo.stargazers_count,
                weekly_downloads: None, // Would need additional API calls to get this
                relevance_score,
            })
        } else {
            None
        }
    }

    pub async fn check_repository_updates(&self, owner: &str, repo: &str) -> Result<Option<String>> {
        let repository = self.client.repos(owner, repo).get().await?;
        
        // Get latest release
        match self.client.repos(owner, repo).releases().list().per_page(1).send().await {
            Ok(releases) => {
                if let Some(release) = releases.items.first() {
                    Ok(Some(release.tag_name.clone()))
                } else {
                    Ok(None)
                }
            }
            Err(_) => Ok(None),
        }
    }
}