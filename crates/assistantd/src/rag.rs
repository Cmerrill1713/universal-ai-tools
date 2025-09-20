use llm_router::{context::MessageRole, models::Message, LLMRouter};
use serde::{Deserialize, Serialize};
use serde_with::serde_as;
use std::sync::Arc;
use crate::rag_provider::{RagProvider, RagProviderConfig, HybridSearchRow};

#[derive(Debug, Deserialize)]
pub struct R1RagRequest {
    pub query: String,
    #[serde(default)]
    pub k: Option<usize>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    #[allow(dead_code)]
    pub max_iterations: Option<u8>,
    /// Enable multi-hop reasoning with knowledge graph traversal
    #[serde(default)]
    pub enable_multi_hop: Option<bool>,
    /// Maximum traversal depth for multi-hop search (default: 2)
    #[serde(default)]
    pub traversal_depth: Option<u8>,
    /// Maximum number of knowledge paths to explore (default: 5)
    #[serde(default)]
    pub max_paths: Option<u8>,
}

#[serde_as]
#[derive(Debug, Serialize)]
pub struct RagCitation {
    pub table: String,
    pub id: String,
    pub title: Option<String>,
    pub score: f32,
}

#[derive(Debug, Serialize)]
pub struct R1RagResponse {
    pub answer: String,
    pub model: String,
    pub provider: String,
    pub citations: Vec<RagCitation>,
    /// Multi-hop reasoning paths taken (if enabled)
    #[serde(default)]
    pub reasoning_paths: Option<Vec<ReasoningPath>>,
    /// Whether multi-hop reasoning was used
    #[serde(default)]
    pub used_multi_hop: bool,
}

#[derive(Debug, Serialize)]
pub struct ReasoningPath {
    pub path_id: u32,
    pub memory_sequence: Vec<String>,
    pub content_sequence: Vec<String>,
    pub domain_sequence: Vec<String>,
    pub total_strength: f32,
    pub path_description: String,
}


pub async fn run_r1_pipeline(router: &mut LLMRouter, req: R1RagRequest) -> anyhow::Result<R1RagResponse> {
    let k = req.k.unwrap_or(5);
    let model = req.model.clone();
    let enable_multi_hop = req.enable_multi_hop.unwrap_or(false);
    let traversal_depth = req.traversal_depth.unwrap_or(2) as i32;
    let max_paths = req.max_paths.unwrap_or(5) as i32;

    // Step 1: Generate query variations (simple heuristic; a single pass for now)
    let variations = generate_query_variations(router, &req.query, model.clone()).await.unwrap_or_else(|_| vec![req.query.clone()]);

    // Step 2: Retrieve context using multi-hop or single-hop approach
    let mut all_rows = Vec::<HybridSearchRow>::new();
    let mut reasoning_paths = Vec::new();
    let provider = RagProvider::from_env(RagProviderConfig::from_env())?;

    if enable_multi_hop {
        // Multi-hop reasoning: Use knowledge graph traversal
        for v in variations.iter().take(3) {
            match provider.search_multi_hop(v, k, 0.7, traversal_depth, max_paths).await {
                Ok((rows, paths)) => {
                    all_rows.extend(rows);
                    reasoning_paths.extend(paths);
                },
                Err(e) => {
                    tracing::warn!("Multi-hop search failed for query '{}': {}", v, e);
                    // Fallback to single-hop
                    let rows = provider.search(v, k, 0.7).await.unwrap_or_default();
                    all_rows.extend(rows);
                }
            }
        }
    } else {
        // Single-hop reasoning: Traditional approach
        for v in variations.iter().take(3) {
            let rows = provider.search(v, k, 0.7).await.unwrap_or_default();
            all_rows.extend(rows);
        }
    }

    // Dedup by id + table, keep top by combined_score
    all_rows.sort_by(|a, b| b.combined_score.partial_cmp(&a.combined_score).unwrap());
    let mut seen = std::collections::HashSet::new();
    let mut top_context = Vec::new();
    for row in all_rows {
        let key = format!("{}:{}", row.table_name, row.id);
        if seen.insert(key) {
            top_context.push(row);
            if top_context.len() >= k { break; }
        }
    }

    // Step 3: Synthesize final answer with citations
    let context_block = build_context_block(&top_context);
    let final_prompt = format!(
        "You are a concise, precise assistant. Use the provided context to answer.\n\nCONTEXT:\n{}\n\nQUESTION:\n{}\n\nINSTRUCTIONS:\n- Cite sources inline like [1], [2] corresponding to the provided context entries.\n- If the answer is uncertain, say so.",
        context_block,
        req.query
    );

    let messages = vec![
        Message { role: MessageRole::System, content: "You answer with direct, factual statements and include citations.".to_string(), name: None },
        Message { role: MessageRole::User, content: final_prompt, name: None },
    ];

    let options = model.clone().map(|model| llm_router::models::GenerationOptions {
        model: Some(model),
        temperature: None,
        max_tokens: None,
        top_p: None,
        frequency_penalty: None,
        presence_penalty: None,
        stop_sequences: None,
        stream: None,
        user_id: None,
        request_id: None,
        include_context: None,
        context_types: None,
        capabilities: None,
    });
    let response = router.route_request(messages, options).await?;

    let citations = top_context.iter().enumerate().map(|(_i, r)| RagCitation {
        table: r.table_name.clone(),
        id: r.id.clone(),
        title: r.title.clone(),
        score: r.combined_score,
    }).collect();

    Ok(R1RagResponse {
        answer: response.content,
        model: response.model,
        provider: response.provider,
        citations,
        reasoning_paths: if enable_multi_hop && !reasoning_paths.is_empty() { Some(reasoning_paths) } else { None },
        used_multi_hop: enable_multi_hop,
    })
}

async fn generate_query_variations(router: &mut LLMRouter, query: &str, model: Option<String>) -> anyhow::Result<Vec<String>> {
    let prompt = format!("Generate 3 short alternative search queries that would help answer: '{}'. Return each on a new line, no numbering.", query);
    let messages = vec![
        Message { role: MessageRole::System, content: "You generate alternative search keyword queries.".to_string(), name: None },
        Message { role: MessageRole::User, content: prompt, name: None },
    ];
    let options = model.map(|model| llm_router::models::GenerationOptions {
        model: Some(model),
        temperature: None,
        max_tokens: None,
        top_p: None,
        frequency_penalty: None,
        presence_penalty: None,
        stop_sequences: None,
        stream: None,
        user_id: None,
        request_id: None,
        include_context: None,
        context_types: None,
        capabilities: None,
    });
    let res = router.route_request(messages, options).await?;
    let lines: Vec<String> = res
        .content
        .lines()
        .map(|s| s.trim().trim_matches('-').trim().to_string())
        .filter(|s| !s.is_empty())
        .take(3)
        .collect();
    Ok(lines)
}

fn build_context_block(rows: &[HybridSearchRow]) -> String {
    let mut out = String::new();
    for (i, r) in rows.iter().enumerate() {
        out.push_str(&format!("[{}] {} | {} | score={:.2}\n{}\n\n", i + 1, r.table_name, r.title.clone().unwrap_or_else(|| "(untitled)".into()), r.combined_score, r.content));
    }
    out
}

// Retrieval now delegated to rag_provider
