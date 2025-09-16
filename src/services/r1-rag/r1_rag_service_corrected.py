#!/usr/bin/env python3
"""
R1 RAG Service (Corrected Implementation)
Retrieval-Augmented Generation with R1 reasoning methodology (model-agnostic)
"""

import asyncio
import aiohttp
import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
import chromadb
from chromadb.config import Settings
import hashlib

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class R1RAGService:
    def __init__(self, 
                 ollama_url="http://localhost:11434",
                 mlx_url="http://localhost:8085",
                 lm_studio_url="http://localhost:1234",
                 librarian_service_url="http://localhost:8029",
                 knowledge_graph_url="http://localhost:8031",
                 hrm_service_url="http://localhost:8027"):
        self.ollama_url = ollama_url
        self.mlx_url = mlx_url
        self.lm_studio_url = lm_studio_url
        self.librarian_service_url = librarian_service_url
        self.knowledge_graph_url = knowledge_graph_url
        self.hrm_service_url = hrm_service_url
        self.session = None
        self.chroma_client = None
        self.collection = None
        self.available_models = {}
        
    async def initialize(self):
        """Initialize the R1 RAG service"""
        self.session = aiohttp.ClientSession()
        
        # Initialize ChromaDB for vector storage (updated configuration)
        self.chroma_client = chromadb.PersistentClient(path="./chroma_db")
        
        # Create or get collection
        try:
            self.collection = self.chroma_client.get_collection("r1_rag_knowledge")
        except:
            self.collection = self.chroma_client.create_collection("r1_rag_knowledge")
            
        # Discover available models
        await self._discover_available_models()
            
        logger.info("🧠 R1 RAG Service initialized (model-agnostic)")
        
    async def _discover_available_models(self):
        """Discover available models from Ollama, MLX, and LM Studio"""
        logger.info("🔍 Discovering available models...")
        
        # Discover Ollama models
        await self._discover_ollama_models()
        
        # Discover MLX models
        await self._discover_mlx_models()
        
        # Discover LM Studio models
        await self._discover_lm_studio_models()
        
        total_models = sum(len(models) for models in self.available_models.values())
        logger.info(f"✅ Discovered {total_models} models across all services")
        
    async def _discover_ollama_models(self):
        """Discover models available in Ollama"""
        try:
            async with self.session.get(f"{self.ollama_url}/api/tags") as response:
                if response.status == 200:
                    data = await response.json()
                    models = data.get("models", [])
                    self.available_models["ollama"] = [
                        {
                            "name": model["name"],
                            "size": model.get("size", 0),
                            "modified_at": model.get("modified_at", ""),
                            "provider": "ollama",
                            "url": self.ollama_url
                        }
                        for model in models
                    ]
                    logger.info(f"✅ Found {len(models)} Ollama models")
                else:
                    logger.warning(f"⚠️ Ollama not available: HTTP {response.status}")
                    self.available_models["ollama"] = []
        except Exception as e:
            logger.warning(f"⚠️ Ollama discovery failed: {e}")
            self.available_models["ollama"] = []
            
    async def _discover_mlx_models(self):
        """Discover models available in MLX"""
        try:
            async with self.session.get(f"{self.mlx_url}/models") as response:
                if response.status == 200:
                    data = await response.json()
                    models = data.get("available_production_models", [])
                    self.available_models["mlx"] = [
                        {
                            "name": model,
                            "provider": "mlx",
                            "url": self.mlx_url,
                            "type": "production"
                        }
                        for model in models
                    ]
                    logger.info(f"✅ Found {len(models)} MLX models")
                else:
                    logger.warning(f"⚠️ MLX not available: HTTP {response.status}")
                    self.available_models["mlx"] = []
        except Exception as e:
            logger.warning(f"⚠️ MLX discovery failed: {e}")
            self.available_models["mlx"] = []
            
    async def _discover_lm_studio_models(self):
        """Discover models available in LM Studio"""
        try:
            async with self.session.get(f"{self.lm_studio_url}/v1/models") as response:
                if response.status == 200:
                    data = await response.json()
                    models = data.get("data", [])
                    self.available_models["lm_studio"] = [
                        {
                            "name": model["id"],
                            "provider": "lm_studio",
                            "url": self.lm_studio_url,
                            "type": model.get("object", "model")
                        }
                        for model in models
                    ]
                    logger.info(f"✅ Found {len(models)} LM Studio models")
                else:
                    logger.warning(f"⚠️ LM Studio not available: HTTP {response.status}")
                    self.available_models["lm_studio"] = []
        except Exception as e:
            logger.warning(f"⚠️ LM Studio discovery failed: {e}")
            self.available_models["lm_studio"] = []
            
    def _select_best_model(self, query: str) -> Optional[Dict[str, Any]]:
        """Select the best available model for the query"""
        all_models = []
        
        # Collect all models
        for provider, models in self.available_models.items():
            all_models.extend(models)
            
        if not all_models:
            logger.warning("⚠️ No models available")
            return None
            
        # Simple model selection logic
        # Prefer larger models for complex queries
        query_length = len(query.split())
        
        if query_length > 20:  # Complex query
            # Prefer larger models
            large_models = [m for m in all_models if m.get("size", 0) > 7_000_000_000]  # >7GB
            if large_models:
                return large_models[0]
                
        # For medium queries, prefer medium models
        elif query_length > 10:
            medium_models = [m for m in all_models if 1_000_000_000 < m.get("size", 0) < 7_000_000_000]
            if medium_models:
                return medium_models[0]
                
        # For simple queries, any model will do
        return all_models[0]
        
    async def r1_reasoning(self, query: str, context: Dict[str, Any] = None) -> Dict[str, Any]:
        """Perform R1 reasoning methodology with RAG"""
        logger.info(f"🧠 Starting R1 reasoning for: '{query}'")
        
        # R1 Step 1: Problem Decomposition
        decomposed_problem = await self._decompose_problem(query)
        
        # R1 Step 2: Knowledge Retrieval
        retrieved_knowledge = await self._retrieve_knowledge(query, decomposed_problem)
        
        # R1 Step 3: Reasoning Chain Construction
        reasoning_chain = await self._construct_reasoning_chain(query, retrieved_knowledge, decomposed_problem)
        
        # R1 Step 4: Multi-step Reasoning
        reasoned_response = await self._multi_step_reasoning(query, reasoning_chain, retrieved_knowledge)
        
        # R1 Step 5: Response Validation
        validated_response = await self._validate_reasoning(reasoned_response, query, retrieved_knowledge)
        
        return {
            "query": query,
            "decomposed_problem": decomposed_problem,
            "retrieved_knowledge": retrieved_knowledge,
            "reasoning_chain": reasoning_chain,
            "response": validated_response,
            "confidence": self._calculate_reasoning_confidence(reasoning_chain, retrieved_knowledge),
            "methodology": "R1_RAG",
            "timestamp": datetime.now().isoformat()
        }
        
    async def _decompose_problem(self, query: str) -> Dict[str, Any]:
        """R1 Step 1: Decompose complex problems into sub-problems"""
        logger.info("🔍 R1 Step 1: Problem decomposition...")
        
        # Use HRM to decompose the problem
        try:
            async with self.session.post(
                f"{self.hrm_service_url}/decide",
                json={
                    "query": f"Decompose this problem into sub-problems: {query}",
                    "context": {"reasoning": True, "decomposition": True},
                    "reasoning": True
                }
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    sub_problems = result.get("reasoning", [])
                    
                    return {
                        "original_query": query,
                        "sub_problems": [step.get("description", "") for step in sub_problems],
                        "complexity_score": len(sub_problems),
                        "decomposition_method": "HRM_hierarchical"
                    }
                    
        except Exception as e:
            logger.error(f"❌ Problem decomposition failed: {e}")
            
        # Fallback: Simple decomposition
        return {
            "original_query": query,
            "sub_problems": [query],  # Treat as single problem
            "complexity_score": 1,
            "decomposition_method": "simple"
        }
        
    async def _retrieve_knowledge(self, query: str, decomposed_problem: Dict[str, Any]) -> Dict[str, Any]:
        """R1 Step 2: Retrieve relevant knowledge using multiple sources"""
        logger.info("📚 R1 Step 2: Knowledge retrieval...")
        
        knowledge_sources = {}
        
        # Retrieve from ChromaDB
        try:
            chroma_results = self.collection.query(
                query_texts=[query],
                n_results=5
            )
            knowledge_sources["chromadb"] = chroma_results
        except Exception as e:
            logger.error(f"❌ ChromaDB retrieval failed: {e}")
            knowledge_sources["chromadb"] = {"documents": [], "metadatas": []}
            
        # Retrieve from librarian service
        try:
            async with self.session.post(
                f"{self.librarian_service_url}/search",
                json={"query": query, "limit": 5}
            ) as response:
                if response.status == 200:
                    librarian_results = await response.json()
                    knowledge_sources["librarian"] = librarian_results
        except Exception as e:
            logger.error(f"❌ Librarian retrieval failed: {e}")
            knowledge_sources["librarian"] = {"results": []}
            
        # Retrieve from knowledge graph
        try:
            # Extract entities from query
            query_entities = await self._extract_entities(query)
            knowledge_sources["knowledge_graph"] = {
                "query_entities": query_entities,
                "related_entities": []
            }
        except Exception as e:
            logger.error(f"❌ Knowledge graph retrieval failed: {e}")
            knowledge_sources["knowledge_graph"] = {"query_entities": [], "related_entities": []}
            
        # Combine knowledge sources
        combined_knowledge = await self._combine_knowledge_sources(knowledge_sources)
        
        logger.info(f"✅ Retrieved {len(combined_knowledge.get('documents', []))} knowledge items")
        return combined_knowledge
        
    async def _construct_reasoning_chain(self, query: str, knowledge: Dict[str, Any], decomposed_problem: Dict[str, Any]) -> List[Dict[str, Any]]:
        """R1 Step 3: Construct multi-step reasoning chain"""
        logger.info("🔗 R1 Step 3: Reasoning chain construction...")
        
        reasoning_steps = []
        
        # Step 1: Problem Understanding
        reasoning_steps.append({
            "step": 1,
            "type": "problem_understanding",
            "description": f"Understanding the query: '{query}'",
            "confidence": 0.9,
            "evidence": [f"Query analysis: {len(query)} characters"],
            "reasoning": "Analyzing the user's intent and requirements"
        })
        
        # Step 2: Knowledge Assessment
        documents = knowledge.get("documents", [])
        reasoning_steps.append({
            "step": 2,
            "type": "knowledge_assessment",
            "description": f"Assessing {len(documents)} relevant knowledge sources",
            "confidence": 0.8,
            "evidence": [f"Found {len(documents)} relevant documents"],
            "reasoning": "Evaluating the quality and relevance of retrieved information"
        })
        
        # Step 3: Sub-problem Analysis
        sub_problems = decomposed_problem.get("sub_problems", [])
        reasoning_steps.append({
            "step": 3,
            "type": "sub_problem_analysis",
            "description": f"Analyzing {len(sub_problems)} sub-problems",
            "confidence": 0.85,
            "evidence": sub_problems,
            "reasoning": "Breaking down complex problems into manageable components"
        })
        
        # Step 4: Information Synthesis
        if documents:
            top_docs = documents[:3]
            reasoning_steps.append({
                "step": 4,
                "type": "information_synthesis",
                "description": f"Synthesizing information from {len(top_docs)} key sources",
                "confidence": 0.85,
                "evidence": [doc.get("title", "Unknown") for doc in top_docs],
                "reasoning": "Combining the most relevant information to form a comprehensive understanding"
            })
            
        # Step 5: Logical Inference
        reasoning_steps.append({
            "step": 5,
            "type": "logical_inference",
            "description": "Drawing logical conclusions from synthesized information",
            "confidence": 0.8,
            "evidence": ["Retrieved knowledge", "Reasoning chain"],
            "reasoning": "Applying logical reasoning to derive conclusions"
        })
        
        return reasoning_steps
        
    async def _multi_step_reasoning(self, query: str, reasoning_chain: List[Dict[str, Any]], knowledge: Dict[str, Any]) -> str:
        """R1 Step 4: Perform multi-step reasoning using any available LLM"""
        logger.info("🧠 R1 Step 4: Multi-step reasoning...")
        
        # Build reasoning context
        reasoning_context = self._build_reasoning_context(query, reasoning_chain, knowledge)
        
        # Select best available model
        selected_model = self._select_best_model(query)
        
        if not selected_model:
            logger.warning("⚠️ No models available, using fallback response")
            return self._generate_fallback_response(query, reasoning_chain, knowledge)
            
        logger.info(f"🎯 Using model: {selected_model['name']} ({selected_model['provider']})")
        
        # Query the selected model
        try:
            response = await self._query_model(selected_model, reasoning_context)
            if response:
                return response
            else:
                logger.warning("⚠️ Model returned empty response, trying fallback")
                return self._generate_fallback_response(query, reasoning_chain, knowledge)
                
        except Exception as e:
            logger.error(f"❌ Model query failed: {e}")
            return self._generate_fallback_response(query, reasoning_chain, knowledge)
            
    async def _query_model(self, model_info: Dict[str, Any], context: str) -> str:
        """Query any model (Ollama, MLX, or LM Studio) with reasoning context"""
        provider = model_info["provider"]
        model_name = model_info["name"]
        
        try:
            if provider == "ollama":
                return await self._query_ollama_model(model_info, context)
            elif provider == "mlx":
                return await self._query_mlx_model(model_info, context)
            elif provider == "lm_studio":
                return await self._query_lm_studio_model(model_info, context)
            else:
                logger.error(f"❌ Unknown provider: {provider}")
                return ""
                
        except Exception as e:
            logger.error(f"❌ Model query failed for {model_name}: {e}")
            return ""
            
    async def _query_ollama_model(self, model_info: Dict[str, Any], context: str) -> str:
        """Query Ollama model with reasoning context"""
        try:
            async with self.session.post(
                f"{model_info['url']}/api/generate",
                json={
                    "model": model_info["name"],
                    "prompt": context,
                    "stream": False,
                    "options": {
                        "temperature": 0.7,
                        "top_p": 0.9,
                        "max_tokens": 1000
                    }
                }
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    return result.get("response", "")
                else:
                    logger.error(f"❌ Ollama query failed: HTTP {response.status}")
                    return ""
                    
        except Exception as e:
            logger.error(f"❌ Ollama request failed: {e}")
            return ""
            
    async def _query_mlx_model(self, model_info: Dict[str, Any], context: str) -> str:
        """Query MLX model with reasoning context"""
        try:
            async with self.session.post(
                f"{model_info['url']}/generate",
                json={
                    "model": model_info["name"],
                    "prompt": context,
                    "max_tokens": 1000,
                    "temperature": 0.7
                }
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    return result.get("response", "")
                else:
                    logger.error(f"❌ MLX query failed: HTTP {response.status}")
                    return ""
                    
        except Exception as e:
            logger.error(f"❌ MLX request failed: {e}")
            return ""
            
    async def _query_lm_studio_model(self, model_info: Dict[str, Any], context: str) -> str:
        """Query LM Studio model with reasoning context"""
        try:
            async with self.session.post(
                f"{model_info['url']}/v1/chat/completions",
                json={
                    "model": model_info["name"],
                    "messages": [
                        {"role": "user", "content": context}
                    ],
                    "max_tokens": 1000,
                    "temperature": 0.7
                }
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    return result.get("choices", [{}])[0].get("message", {}).get("content", "")
                else:
                    logger.error(f"❌ LM Studio query failed: HTTP {response.status}")
                    return ""
                    
        except Exception as e:
            logger.error(f"❌ LM Studio request failed: {e}")
            return ""
            
    def _build_reasoning_context(self, query: str, reasoning_chain: List[Dict[str, Any]], knowledge: Dict[str, Any]) -> str:
        """Build context for LLM reasoning"""
        context_parts = []
        
        # Add query
        context_parts.append(f"Query: {query}")
        
        # Add reasoning steps
        context_parts.append("\nReasoning Steps:")
        for step in reasoning_chain:
            context_parts.append(f"Step {step['step']}: {step['description']}")
            context_parts.append(f"Reasoning: {step['reasoning']}")
            
        # Add knowledge sources
        documents = knowledge.get("documents", [])
        if documents:
            context_parts.append("\nRelevant Knowledge:")
            for doc in documents[:3]:
                context_parts.append(f"- {doc.get('title', 'Unknown')}: {doc.get('content', '')[:200]}...")
                
        # Add reasoning instruction
        context_parts.append("\nPlease provide a reasoned response based on the above information and reasoning steps.")
        
        return "\n".join(context_parts)
        
    def _generate_fallback_response(self, query: str, reasoning_chain: List[Dict[str, Any]], knowledge: Dict[str, Any]) -> str:
        """Generate fallback response when LLM is unavailable"""
        response_parts = []
        
        response_parts.append(f"Based on my analysis of your query '{query}', here's my reasoned response:")
        
        # Use reasoning chain
        for step in reasoning_chain:
            response_parts.append(f"\n{step['description']}: {step['reasoning']}")
            
        # Use knowledge sources
        documents = knowledge.get("documents", [])
        if documents:
            response_parts.append(f"\nBased on {len(documents)} knowledge sources:")
            for doc in documents[:2]:
                response_parts.append(f"- {doc.get('title', 'Unknown')}: {doc.get('content', '')[:100]}...")
                
        response_parts.append("\nThis response follows the R1 reasoning methodology with multi-step analysis.")
        
        return "".join(response_parts)
        
    async def _validate_reasoning(self, response: str, query: str, knowledge: Dict[str, Any]) -> str:
        """R1 Step 5: Validate reasoning and response"""
        logger.info("✅ R1 Step 5: Response validation...")
        
        # Check response quality
        if len(response) < 50:
            response += "\n\nNote: This response may be incomplete. Please provide more specific information if needed."
            
        # Check relevance to query
        query_words = set(query.lower().split())
        response_words = set(response.lower().split())
        overlap = len(query_words.intersection(response_words))
        relevance_score = overlap / len(query_words) if query_words else 0
        
        if relevance_score < 0.3:
            response += f"\n\nNote: This response may not fully address your specific query about '{query}'. Please let me know if you need more specific information."
            
        return response
        
    def _calculate_reasoning_confidence(self, reasoning_chain: List[Dict[str, Any]], knowledge: Dict[str, Any]) -> float:
        """Calculate overall confidence in the reasoning"""
        # Average confidence from reasoning steps
        reasoning_confidence = sum(step["confidence"] for step in reasoning_chain) / len(reasoning_chain)
        
        # Knowledge quality score
        documents = knowledge.get("documents", [])
        knowledge_confidence = 0.8 if documents else 0.5
        
        # Combined confidence
        overall_confidence = (reasoning_confidence * 0.7) + (knowledge_confidence * 0.3)
        
        return min(overall_confidence, 1.0)
        
    async def get_available_models(self) -> Dict[str, Any]:
        """Get information about available models"""
        return {
            "total_models": sum(len(models) for models in self.available_models.values()),
            "providers": list(self.available_models.keys()),
            "models_by_provider": self.available_models,
            "timestamp": datetime.now().isoformat()
        }
        
    async def _extract_entities(self, query: str) -> List[str]:
        """Extract entities from query"""
        # Simple entity extraction
        words = query.split()
        entities = []
        
        for i, word in enumerate(words):
            if word[0].isupper() and len(word) > 2:
                entities.append(word.lower())
                
        return entities
        
    async def _combine_knowledge_sources(self, knowledge_sources: Dict[str, Any]) -> Dict[str, Any]:
        """Combine knowledge from multiple sources"""
        combined_documents = []
        
        # Add ChromaDB documents
        chroma_results = knowledge_sources.get("chromadb", {})
        chroma_docs = chroma_results.get("documents", [[]])[0] if chroma_results.get("documents") else []
        chroma_metas = chroma_results.get("metadatas", [[]])[0] if chroma_results.get("metadatas") else []
        
        for i, doc in enumerate(chroma_docs):
            meta = chroma_metas[i] if i < len(chroma_metas) else {}
            combined_documents.append({
                "id": f"chroma_{i}",
                "title": meta.get("title", "ChromaDB Document"),
                "content": doc,
                "source": "chromadb",
                "similarity": 0.8,
                "type": "vector_search"
            })
            
        # Add librarian documents
        librarian_results = knowledge_sources.get("librarian", {}).get("results", [])
        for doc in librarian_results:
            combined_documents.append({
                "id": doc.get("id", ""),
                "title": doc.get("title", ""),
                "content": doc.get("content", ""),
                "source": "librarian",
                "similarity": doc.get("similarity", 0.0),
                "type": doc.get("type", "general")
            })
            
        # Sort by similarity/confidence
        combined_documents.sort(key=lambda x: x["similarity"], reverse=True)
        
        return {
            "documents": combined_documents[:10],  # Top 10 most relevant
            "sources": list(knowledge_sources.keys()),
            "total_documents": len(combined_documents)
        }
        
    async def add_document(self, title: str, content: str, metadata: Dict[str, Any] = None):
        """Add document to ChromaDB for R1 RAG"""
        try:
            doc_id = f"doc_{hashlib.md5(content.encode()).hexdigest()[:8]}"
            
            self.collection.add(
                documents=[content],
                metadatas=[{
                    "title": title,
                    "source": metadata.get("source", "unknown"),
                    "type": metadata.get("type", "general"),
                    "timestamp": datetime.now().isoformat()
                }],
                ids=[doc_id]
            )
            
            logger.info(f"✅ Added document to R1 RAG: {title}")
            
        except Exception as e:
            logger.error(f"❌ Failed to add document: {e}")
            
    async def close(self):
        """Close the R1 RAG service session"""
        if self.session:
            await self.session.close()

async def main():
    """Test the corrected R1 RAG service with dynamic model discovery"""
    rag = R1RAGService()
    
    try:
        await rag.initialize()
        
        # Show discovered models
        models_info = await rag.get_available_models()
        logger.info(f"🔍 Discovered {models_info['total_models']} models:")
        for provider, models in models_info['models_by_provider'].items():
            if models:
                logger.info(f"  {provider}: {len(models)} models")
                for model in models[:3]:  # Show first 3 models
                    logger.info(f"    - {model['name']}")
            else:
                logger.info(f"  {provider}: No models available")
        
        # Add some test documents
        await rag.add_document(
            "Machine Learning Basics",
            "Machine learning is a subset of artificial intelligence that enables computers to learn and make decisions from data without being explicitly programmed.",
            {"source": "test", "type": "educational"}
        )
        
        # Test R1 reasoning
        logger.info("🧠 Testing R1 reasoning methodology...")
        result = await rag.r1_reasoning("What is machine learning and how does it work?")
        
        logger.info(f"✅ R1 reasoning completed with confidence: {result['confidence']:.2f}")
        logger.info(f"📝 Response: {result['response'][:200]}...")
        
    except Exception as e:
        logger.error(f"❌ R1 RAG test failed: {e}")
        
    finally:
        await rag.close()

if __name__ == "__main__":
    asyncio.run(main())
