#!/usr/bin/env python3
"""
R1 RAG Service
Retrieval-Augmented Generation with R1 reasoning capabilities
"""

import asyncio
import aiohttp
import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from sentence_transformers import SentenceTransformer
import sqlite3
import hashlib

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class R1RAGService:
    def __init__(self, 
                 librarian_service_url="http://localhost:8029",
                 knowledge_graph_url="http://localhost:8031",
                 hrm_service_url="http://localhost:8027"):
        self.librarian_service_url = librarian_service_url
        self.knowledge_graph_url = knowledge_graph_url
        self.hrm_service_url = hrm_service_url
        self.session = None
        self.embedding_model = None
        
    async def initialize(self):
        """Initialize the R1 RAG service"""
        self.session = aiohttp.ClientSession()
        
        # Initialize embedding model for R1 reasoning
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        
        logger.info("🧠 R1 RAG Service initialized")
        
    async def r1_reasoning(self, query: str, context: Dict[str, Any] = None) -> Dict[str, Any]:
        """Perform R1 (Reasoning-1) style reasoning with RAG"""
        logger.info(f"🧠 Starting R1 reasoning for: '{query}'")
        
        # Step 1: Retrieve relevant knowledge
        retrieved_knowledge = await self._retrieve_knowledge(query)
        
        # Step 2: Build reasoning chain
        reasoning_chain = await self._build_reasoning_chain(query, retrieved_knowledge, context)
        
        # Step 3: Generate response with reasoning
        response = await self._generate_reasoned_response(query, reasoning_chain, retrieved_knowledge)
        
        # Step 4: Validate and refine
        validated_response = await self._validate_response(response, query, retrieved_knowledge)
        
        return {
            "query": query,
            "reasoning_chain": reasoning_chain,
            "retrieved_knowledge": retrieved_knowledge,
            "response": validated_response,
            "confidence": self._calculate_confidence(reasoning_chain, retrieved_knowledge),
            "timestamp": datetime.now().isoformat()
        }
        
    async def _retrieve_knowledge(self, query: str) -> Dict[str, Any]:
        """Retrieve relevant knowledge using multiple sources"""
        logger.info("🔍 Retrieving knowledge from multiple sources...")
        
        knowledge_sources = {}
        
        try:
            # Retrieve from librarian (vector search)
            librarian_results = await self._retrieve_from_librarian(query)
            knowledge_sources["librarian"] = librarian_results
            
            # Retrieve from knowledge graph (entity relationships)
            kg_results = await self._retrieve_from_knowledge_graph(query)
            knowledge_sources["knowledge_graph"] = kg_results
            
            # Retrieve from HRM (decision context)
            hrm_results = await self._retrieve_from_hrm(query)
            knowledge_sources["hrm"] = hrm_results
            
            # Combine and rank knowledge
            combined_knowledge = await self._combine_knowledge_sources(knowledge_sources)
            
            logger.info(f"✅ Retrieved {len(combined_knowledge.get('documents', []))} knowledge items")
            return combined_knowledge
            
        except Exception as e:
            logger.error(f"❌ Knowledge retrieval failed: {e}")
            return {"error": str(e), "documents": []}
            
    async def _retrieve_from_librarian(self, query: str) -> Dict[str, Any]:
        """Retrieve knowledge from librarian service"""
        try:
            async with self.session.post(
                f"{self.librarian_service_url}/search",
                json={"query": query, "limit": 10}
            ) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    logger.error(f"❌ Librarian retrieval failed: HTTP {response.status}")
                    return {"results": []}
                    
        except Exception as e:
            logger.error(f"❌ Librarian request failed: {e}")
            return {"results": []}
            
    async def _retrieve_from_knowledge_graph(self, query: str) -> Dict[str, Any]:
        """Retrieve knowledge from knowledge graph"""
        try:
            # Extract entities from query
            query_entities = await self._extract_query_entities(query)
            
            # Find related entities
            related_entities = []
            for entity in query_entities:
                async with self.session.get(
                    f"{self.knowledge_graph_url}/related/{entity}",
                    params={"max_depth": 2}
                ) as response:
                    if response.status == 200:
                        related = await response.json()
                        related_entities.extend(related)
                        
            return {
                "query_entities": query_entities,
                "related_entities": related_entities
            }
            
        except Exception as e:
            logger.error(f"❌ Knowledge graph retrieval failed: {e}")
            return {"query_entities": [], "related_entities": []}
            
    async def _retrieve_from_hrm(self, query: str) -> Dict[str, Any]:
        """Retrieve decision context from HRM"""
        try:
            async with self.session.post(
                f"{self.hrm_service_url}/decide",
                json={
                    "query": query,
                    "context": {"reasoning": True},
                    "reasoning": True
                }
            ) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    logger.error(f"❌ HRM retrieval failed: HTTP {response.status}")
                    return {"decision": "", "reasoning": []}
                    
        except Exception as e:
            logger.error(f"❌ HRM request failed: {e}")
            return {"decision": "", "reasoning": []}
            
    async def _extract_query_entities(self, query: str) -> List[str]:
        """Extract entities from query using simple NLP"""
        # Simple entity extraction (in production, use spaCy or similar)
        words = query.split()
        entities = []
        
        for i, word in enumerate(words):
            if word[0].isupper() and len(word) > 2:
                # Check for multi-word entities
                entity_text = word
                j = i + 1
                while j < len(words) and words[j][0].isupper():
                    entity_text += " " + words[j]
                    j += 1
                    
                if len(entity_text.split()) <= 3:
                    entities.append(entity_text.lower())
                    
        return entities
        
    async def _combine_knowledge_sources(self, knowledge_sources: Dict[str, Any]) -> Dict[str, Any]:
        """Combine knowledge from multiple sources"""
        combined_documents = []
        
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
            
        # Add knowledge graph entities as documents
        kg_entities = knowledge_sources.get("knowledge_graph", {}).get("related_entities", [])
        for entity in kg_entities:
            combined_documents.append({
                "id": f"kg_{entity.get('entity_id', '')}",
                "title": entity.get("entity_name", ""),
                "content": f"Entity: {entity.get('entity_name', '')} - Relationship: {entity.get('relationship_type', '')}",
                "source": "knowledge_graph",
                "similarity": entity.get("weight", 0.0),
                "type": "entity"
            })
            
        # Add HRM reasoning as context
        hrm_reasoning = knowledge_sources.get("hrm", {}).get("reasoning", [])
        for reasoning_step in hrm_reasoning:
            combined_documents.append({
                "id": f"hrm_{hashlib.md5(reasoning_step.get('description', '').encode()).hexdigest()[:8]}",
                "title": f"HRM Reasoning: {reasoning_step.get('step', '')}",
                "content": reasoning_step.get("description", ""),
                "source": "hrm",
                "similarity": reasoning_step.get("confidence", 0.0),
                "type": "reasoning"
            })
            
        # Sort by similarity/confidence
        combined_documents.sort(key=lambda x: x["similarity"], reverse=True)
        
        return {
            "documents": combined_documents[:15],  # Top 15 most relevant
            "sources": list(knowledge_sources.keys()),
            "total_documents": len(combined_documents)
        }
        
    async def _build_reasoning_chain(self, query: str, knowledge: Dict[str, Any], context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Build a reasoning chain for R1 reasoning"""
        reasoning_steps = []
        
        # Step 1: Query Analysis
        reasoning_steps.append({
            "step": 1,
            "description": f"Analyzing query: '{query}'",
            "confidence": 0.9,
            "evidence": [f"Query length: {len(query)} characters"],
            "reasoning": "Understanding the user's intent and requirements"
        })
        
        # Step 2: Knowledge Assessment
        documents = knowledge.get("documents", [])
        reasoning_steps.append({
            "step": 2,
            "description": f"Assessing {len(documents)} relevant knowledge sources",
            "confidence": 0.8,
            "evidence": [f"Found {len(documents)} relevant documents"],
            "reasoning": "Evaluating the quality and relevance of retrieved information"
        })
        
        # Step 3: Information Synthesis
        if documents:
            top_docs = documents[:3]
            reasoning_steps.append({
                "step": 3,
                "description": f"Synthesizing information from {len(top_docs)} key sources",
                "confidence": 0.85,
                "evidence": [doc["title"] for doc in top_docs],
                "reasoning": "Combining the most relevant information to form a comprehensive understanding"
            })
            
        # Step 4: Response Generation
        reasoning_steps.append({
            "step": 4,
            "description": "Generating reasoned response based on synthesized knowledge",
            "confidence": 0.8,
            "evidence": ["Retrieved knowledge", "Reasoning chain"],
            "reasoning": "Creating a response that addresses the query using available knowledge"
        })
        
        return reasoning_steps
        
    async def _generate_reasoned_response(self, query: str, reasoning_chain: List[Dict[str, Any]], knowledge: Dict[str, Any]) -> str:
        """Generate a reasoned response using R1 methodology"""
        documents = knowledge.get("documents", [])
        
        # Build response based on reasoning chain and knowledge
        response_parts = []
        
        # Introduction
        response_parts.append(f"Based on my analysis of your query '{query}', here's my reasoned response:")
        
        # Use top knowledge sources
        for i, doc in enumerate(documents[:3]):
            if doc["source"] == "librarian":
                response_parts.append(f"\nFrom {doc['title']}: {doc['content'][:200]}...")
            elif doc["source"] == "knowledge_graph":
                response_parts.append(f"\nRelated concept: {doc['title']} - {doc['content']}")
            elif doc["source"] == "hrm":
                response_parts.append(f"\nReasoning insight: {doc['content']}")
                
        # Conclusion
        response_parts.append(f"\nThis response is based on {len(documents)} knowledge sources and follows a structured reasoning process.")
        
        return "".join(response_parts)
        
    async def _validate_response(self, response: str, query: str, knowledge: Dict[str, Any]) -> str:
        """Validate and refine the response"""
        # Simple validation (in production, use more sophisticated validation)
        
        # Check if response addresses the query
        query_words = set(query.lower().split())
        response_words = set(response.lower().split())
        
        overlap = len(query_words.intersection(response_words))
        relevance_score = overlap / len(query_words) if query_words else 0
        
        if relevance_score < 0.3:
            # Add more context if response is not relevant enough
            response += f"\n\nNote: This response may not fully address your specific query about '{query}'. Please let me know if you need more specific information."
            
        return response
        
    def _calculate_confidence(self, reasoning_chain: List[Dict[str, Any]], knowledge: Dict[str, Any]) -> float:
        """Calculate overall confidence in the response"""
        # Average confidence from reasoning steps
        reasoning_confidence = sum(step["confidence"] for step in reasoning_chain) / len(reasoning_chain)
        
        # Knowledge quality score
        documents = knowledge.get("documents", [])
        knowledge_confidence = sum(doc["similarity"] for doc in documents) / len(documents) if documents else 0
        
        # Combined confidence
        overall_confidence = (reasoning_confidence * 0.6) + (knowledge_confidence * 0.4)
        
        return min(overall_confidence, 1.0)
        
    async def close(self):
        """Close the R1 RAG service session"""
        if self.session:
            await self.session.close()

async def main():
    """Test the R1 RAG service"""
    rag = R1RAGService()
    
    try:
        await rag.initialize()
        
        # Test R1 reasoning
        logger.info("🧠 Testing R1 reasoning...")
        result = await rag.r1_reasoning("What is machine learning and how does it relate to artificial intelligence?")
        
        logger.info(f"✅ R1 reasoning completed with confidence: {result['confidence']:.2f}")
        logger.info(f"📝 Response: {result['response'][:200]}...")
        
    except Exception as e:
        logger.error(f"❌ R1 RAG test failed: {e}")
        
    finally:
        await rag.close()

if __name__ == "__main__":
    asyncio.run(main())
