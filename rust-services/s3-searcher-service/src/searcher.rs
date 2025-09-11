use anyhow::{Result, anyhow};
use serde_json::json;
use tracing::{info, debug, warn};
use uuid::Uuid;
use chrono::Utc;

use crate::models::{
    SearchQuery, Document, SearchTurn, SearchSession,
    SearcherConfig, SearchRequest
};
use crate::retriever::DocumentRetriever;
use crate::generator::GeneratorClient;

/// S3 Searcher - Implements the iterative search strategy from the S3 paper
pub struct S3Searcher {
    config: SearcherConfig,
    retriever: Box<dyn DocumentRetriever>,
    llm_client: reqwest::Client,
    cache: Option<redis::aio::ConnectionManager>,
}

impl S3Searcher {
    pub fn new(
        config: SearcherConfig,
        retriever: Box<dyn DocumentRetriever>,
        redis_conn: Option<redis::aio::ConnectionManager>,
    ) -> Self {
        Self {
            config,
            retriever,
            llm_client: reqwest::Client::new(),
            cache: redis_conn,
        }
    }

    /// Main search function - performs iterative search with the S3 algorithm
    pub async fn search(&self, request: SearchRequest) -> Result<SearchSession> {
        info!("Starting S3 search for question: {}", request.question);

        let mut session = SearchSession {
            id: Uuid::new_v4(),
            original_question: request.question.clone(),
            turns: Vec::new(),
            final_documents: Vec::new(),
            gbr_reward: None,
            baseline_documents: None,
            created_at: Utc::now(),
            completed_at: None,
        };

        // Check cache if enabled
        if request.use_cache {
            if let Some(cached) = self.check_cache(&request.question).await? {
                info!("Found cached result for question");
                return Ok(cached);
            }
        }

        // Initialize with the original question as the first query
        let mut current_query = request.question.clone();
        let mut accumulated_docs = Vec::new();

        // Perform iterative search
        for turn_num in 0..self.config.max_turns {
            debug!("Starting turn {}/{}", turn_num + 1, self.config.max_turns);

            // Step 1: Retrieve documents for current query
            let retrieved_docs = self.retriever
                .retrieve(&current_query, self.config.docs_per_turn * 3)
                .await?;

            // Step 2: Select most relevant documents
            let selected_docs = self.select_documents(
                &current_query,
                &request.question,
                &retrieved_docs,
                &accumulated_docs,
            ).await?;

            // Step 3: Decide whether to continue searching
            let (should_continue, reasoning) = self.should_continue_search(
                &request.question,
                &accumulated_docs,
                &selected_docs,
                turn_num,
            ).await?;

            // Record this turn
            let turn = SearchTurn {
                turn_number: turn_num,
                query: current_query.clone(),
                retrieved_docs: retrieved_docs.clone(),
                selected_docs: selected_docs.clone(),
                should_continue,
                reasoning: Some(reasoning),
            };
            session.turns.push(turn);

            // Add selected documents to accumulated set
            for doc in selected_docs {
                if !accumulated_docs.iter().any(|d| d.id == doc.id) {
                    accumulated_docs.push(doc);
                }
            }

            // Check if we should stop
            if !should_continue {
                info!("Stopping search at turn {} - sufficient evidence found", turn_num + 1);
                break;
            }

            // Step 4: Generate next query if continuing
            if turn_num < self.config.max_turns - 1 {
                current_query = self.generate_next_query(
                    &request.question,
                    &accumulated_docs,
                    &session.turns,
                ).await?;
                debug!("Generated next query: {}", current_query);
            }
        }

        // Set final documents and completion time
        session.final_documents = accumulated_docs;
        session.completed_at = Some(Utc::now());

        // Cache the result if enabled
        if request.use_cache {
            self.cache_result(&request.question, &session).await?;
        }

        info!("Search completed with {} documents after {} turns",
              session.final_documents.len(),
              session.turns.len());

        Ok(session)
    }

    /// Select the most relevant documents from retrieved set
    async fn select_documents(
        &self,
        query: &str,
        original_question: &str,
        retrieved: &[Document],
        accumulated: &[Document],
    ) -> Result<Vec<Document>> {
        // Prompt for document selection
        let prompt = format!(
            "You are selecting documents to answer this question: {}\n\n\
             Current search query: {}\n\n\
             Already selected documents: {}\n\n\
             New retrieved documents:\n{}\n\n\
             Select up to {} most relevant NEW documents that provide additional information. \
             Return a JSON array of document indices (0-based) to select.",
            original_question,
            query,
            self.format_doc_summaries(accumulated),
            self.format_doc_list(retrieved),
            self.config.docs_per_turn
        );

        let response = self.call_llm(&prompt, 0.3).await?;
        let indices: Vec<usize> = serde_json::from_str(&response)
            .unwrap_or_else(|_| vec![0, 1, 2].into_iter()
                .filter(|&i| i < retrieved.len())
                .collect());

        Ok(indices.into_iter()
            .filter_map(|i| retrieved.get(i).cloned())
            .take(self.config.docs_per_turn)
            .collect())
    }

    /// Decide whether to continue searching
    async fn should_continue_search(
        &self,
        original_question: &str,
        accumulated: &[Document],
        new_docs: &[Document],
        turn_num: usize,
    ) -> Result<(bool, String)> {
        // Always stop at max turns
        if turn_num >= self.config.max_turns - 1 {
            return Ok((false, "Reached maximum search turns".to_string()));
        }

        // Check if we have enough high-quality evidence
        let prompt = format!(
            "Question: {}\n\n\
             Current evidence documents: {}\n\n\
             New documents just found: {}\n\n\
             Do we have sufficient evidence to answer the question accurately? \
             Consider: 1) Coverage of key aspects, 2) Contradictions needing resolution, \
             3) Missing critical information.\n\n\
             Respond with JSON: {{\"continue\": true/false, \"reasoning\": \"...\"}}}",
            original_question,
            self.format_doc_summaries(accumulated),
            self.format_doc_summaries(new_docs)
        );

        let response = self.call_llm(&prompt, 0.5).await?;

        let decision: serde_json::Value = serde_json::from_str(&response)
            .unwrap_or_else(|_| json!({
                "continue": turn_num < 2,
                "reasoning": "Parse error - defaulting based on turn count"
            }));

        Ok((
            decision["continue"].as_bool().unwrap_or(false),
            decision["reasoning"].as_str().unwrap_or("").to_string()
        ))
    }

    /// Generate the next search query based on current evidence
    async fn generate_next_query(
        &self,
        original_question: &str,
        accumulated: &[Document],
        turns: &[SearchTurn],
    ) -> Result<String> {
        let previous_queries: Vec<String> = turns.iter()
            .map(|t| t.query.clone())
            .collect();

        let prompt = format!(
            "Original question: {}\n\n\
             Previous queries: {}\n\n\
             Current evidence: {}\n\n\
             What information is still missing to fully answer the question? \
             Generate a new search query to find this missing information. \
             The query should be different from previous queries and target specific gaps.\n\n\
             Return only the search query text, nothing else.",
            original_question,
            previous_queries.join(", "),
            self.format_doc_summaries(accumulated)
        );

        self.call_llm(&prompt, self.config.temperature).await
    }

    /// Call the searcher LLM
    async fn call_llm(&self, prompt: &str, temperature: f32) -> Result<String> {
        // This would call Ollama or other LLM service
        // For now, return a placeholder

        // In production, this would be:
        // let response = self.llm_client
        //     .post(&format!("{}/api/generate", self.config.model_url))
        //     .json(&json!({
        //         "model": self.config.model_name,
        //         "prompt": prompt,
        //         "temperature": temperature,
        //         "stream": false
        //     }))
        //     .send()
        //     .await?;

        Ok("placeholder_response".to_string())
    }

    /// Format document summaries for prompts
    fn format_doc_summaries(&self, docs: &[Document]) -> String {
        if docs.is_empty() {
            return "None".to_string();
        }

        docs.iter()
            .enumerate()
            .map(|(i, doc)| {
                format!("[{}] {} (relevance: {:.2})",
                    i,
                    doc.content.chars().take(200).collect::<String>(),
                    doc.relevance_score
                )
            })
            .collect::<Vec<_>>()
            .join("\n")
    }

    /// Format document list for selection
    fn format_doc_list(&self, docs: &[Document]) -> String {
        docs.iter()
            .enumerate()
            .map(|(i, doc)| {
                format!("[{}] Title: {}\nContent: {}\nRelevance: {:.2}\n",
                    i,
                    doc.title.as_ref().unwrap_or(&"Untitled".to_string()),
                    doc.content.chars().take(300).collect::<String>(),
                    doc.relevance_score
                )
            })
            .collect::<Vec<_>>()
            .join("\n---\n")
    }

    /// Check cache for existing results
    async fn check_cache(&self, _question: &str) -> Result<Option<SearchSession>> {
        // Redis caching planned for performance optimization
        // Currently returns None - cache will be implemented when Redis is added
        Ok(None)
    }

    /// Cache search results
    async fn cache_result(&self, _question: &str, _session: &SearchSession) -> Result<()> {
        // Redis caching planned for performance optimization
        // Currently no-op - cache storage will be implemented when Redis is added
        Ok(())
    }
}
