#!/usr/bin/env python3
"""
Knowledge Graph Service
Manages entity relationships and knowledge graph operations
"""

import asyncio
import aiohttp
import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
import networkx as nx
import sqlite3
import hashlib

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class KnowledgeGraph:
    def __init__(self, db_path="knowledge_graph.db"):
        self.db_path = db_path
        self.graph = nx.DiGraph()
        self.session = None
        
    async def initialize(self):
        """Initialize the knowledge graph"""
        await self._init_database()
        await self._load_graph_from_db()
        self.session = aiohttp.ClientSession()
        logger.info("🕸️ Knowledge Graph initialized")
        
    async def _init_database(self):
        """Initialize SQLite database for knowledge graph"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Create entities table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS entities (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                description TEXT,
                properties TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create relationships table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS relationships (
                id TEXT PRIMARY KEY,
                source_entity_id TEXT NOT NULL,
                target_entity_id TEXT NOT NULL,
                relationship_type TEXT NOT NULL,
                weight REAL DEFAULT 1.0,
                properties TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (source_entity_id) REFERENCES entities (id),
                FOREIGN KEY (target_entity_id) REFERENCES entities (id)
            )
        ''')
        
        # Create knowledge documents table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS knowledge_documents (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                source TEXT,
                url TEXT,
                entities TEXT,
                relationships TEXT,
                embedding_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create indexes
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_entity_type ON entities(type)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_entity_name ON entities(name)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_rel_source ON relationships(source_entity_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_rel_target ON relationships(target_entity_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_rel_type ON relationships(relationship_type)')
        
        conn.commit()
        conn.close()
        
        logger.info("✅ Knowledge Graph database initialized")
        
    async def _load_graph_from_db(self):
        """Load graph from database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Load entities
            cursor.execute('SELECT id, name, type, description, properties FROM entities')
            entities = cursor.fetchall()
            
            for entity_id, name, entity_type, description, properties in entities:
                self.graph.add_node(
                    entity_id,
                    name=name,
                    type=entity_type,
                    description=description,
                    properties=json.loads(properties) if properties else {}
                )
                
            # Load relationships
            cursor.execute('''
                SELECT id, source_entity_id, target_entity_id, relationship_type, weight, properties 
                FROM relationships
            ''')
            relationships = cursor.fetchall()
            
            for rel_id, source_id, target_id, rel_type, weight, properties in relationships:
                self.graph.add_edge(
                    source_id,
                    target_id,
                    relationship_type=rel_type,
                    weight=weight,
                    properties=json.loads(properties) if properties else {}
                )
                
            logger.info(f"✅ Loaded {len(entities)} entities and {len(relationships)} relationships")
            
        finally:
            conn.close()
            
    async def add_entity(self, 
                        name: str, 
                        entity_type: str, 
                        description: str = "",
                        properties: Dict[str, Any] = None) -> str:
        """Add an entity to the knowledge graph"""
        entity_id = f"{entity_type}_{hashlib.md5(name.encode()).hexdigest()[:8]}"
        
        # Check if entity already exists
        if entity_id in self.graph.nodes:
            logger.info(f"Entity {name} already exists")
            return entity_id
            
        # Add to graph
        self.graph.add_node(
            entity_id,
            name=name,
            type=entity_type,
            description=description,
            properties=properties or {}
        )
        
        # Store in database
        await self._store_entity(entity_id, name, entity_type, description, properties)
        
        logger.info(f"✅ Added entity: {name} ({entity_type})")
        return entity_id
        
    async def add_relationship(self,
                              source_entity_id: str,
                              target_entity_id: str,
                              relationship_type: str,
                              weight: float = 1.0,
                              properties: Dict[str, Any] = None) -> str:
        """Add a relationship between entities"""
        rel_id = f"rel_{hashlib.md5(f'{source_entity_id}_{target_entity_id}_{relationship_type}'.encode()).hexdigest()[:8]}"
        
        # Add to graph
        self.graph.add_edge(
            source_entity_id,
            target_entity_id,
            relationship_type=relationship_type,
            weight=weight,
            properties=properties or {}
        )
        
        # Store in database
        await self._store_relationship(rel_id, source_entity_id, target_entity_id, relationship_type, weight, properties)
        
        logger.info(f"✅ Added relationship: {relationship_type} between {source_entity_id} and {target_entity_id}")
        return rel_id
        
    async def _store_entity(self, entity_id: str, name: str, entity_type: str, description: str, properties: Dict[str, Any]):
        """Store entity in database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                INSERT OR REPLACE INTO entities (id, name, type, description, properties, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (entity_id, name, entity_type, description, json.dumps(properties), datetime.now().isoformat()))
            
            conn.commit()
            
        finally:
            conn.close()
            
    async def _store_relationship(self, rel_id: str, source_id: str, target_id: str, rel_type: str, weight: float, properties: Dict[str, Any]):
        """Store relationship in database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                INSERT OR REPLACE INTO relationships 
                (id, source_entity_id, target_entity_id, relationship_type, weight, properties, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (rel_id, source_id, target_id, rel_type, weight, json.dumps(properties), datetime.now().isoformat()))
            
            conn.commit()
            
        finally:
            conn.close()
            
    async def extract_entities_from_text(self, text: str) -> List[Dict[str, Any]]:
        """Extract entities from text using simple NLP"""
        entities = []
        
        # Simple entity extraction (in production, use spaCy or similar)
        words = text.split()
        
        # Look for capitalized words (potential entities)
        for i, word in enumerate(words):
            if word[0].isupper() and len(word) > 2:
                # Check if it's part of a multi-word entity
                entity_text = word
                j = i + 1
                while j < len(words) and words[j][0].isupper():
                    entity_text += " " + words[j]
                    j += 1
                    
                if len(entity_text.split()) <= 3:  # Limit to 3 words
                    entities.append({
                        "text": entity_text,
                        "type": "PERSON" if any(name_word in entity_text.lower() for name_word in ["john", "jane", "smith", "johnson"]) else "ORGANIZATION",
                        "start": text.find(entity_text),
                        "end": text.find(entity_text) + len(entity_text)
                    })
                    
        return entities
        
    async def build_knowledge_graph_from_documents(self, documents: List[Dict[str, Any]]):
        """Build knowledge graph from crawled documents"""
        logger.info(f"🕸️ Building knowledge graph from {len(documents)} documents...")
        
        for doc in documents:
            try:
                # Extract entities from document
                entities = await self.extract_entities_from_text(doc['content'])
                
                # Add entities to graph
                doc_entities = []
                for entity in entities:
                    entity_id = await self.add_entity(
                        name=entity['text'],
                        entity_type=entity['type'],
                        description=f"Extracted from {doc['title']}",
                        properties={"source_document": doc['id']}
                    )
                    doc_entities.append(entity_id)
                    
                # Create relationships between entities in the same document
                for i, source_entity in enumerate(doc_entities):
                    for target_entity in doc_entities[i+1:]:
                        await self.add_relationship(
                            source_entity_id=source_entity,
                            target_entity_id=target_entity,
                            relationship_type="CO_OCCURS_WITH",
                            weight=0.5,
                            properties={"source_document": doc['id']}
                        )
                        
                # Store document with its entities
                await self._store_knowledge_document(doc, doc_entities)
                
            except Exception as e:
                logger.error(f"❌ Failed to process document {doc.get('id', 'unknown')}: {e}")
                
        logger.info("✅ Knowledge graph construction completed")
        
    async def _store_knowledge_document(self, doc: Dict[str, Any], entities: List[str]):
        """Store knowledge document with its entities"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                INSERT OR REPLACE INTO knowledge_documents 
                (id, title, content, source, url, entities, relationships, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                doc['id'],
                doc['title'],
                doc['content'],
                doc.get('source', ''),
                doc.get('url', ''),
                json.dumps(entities),
                json.dumps([]),  # Relationships will be stored separately
                datetime.now().isoformat()
            ))
            
            conn.commit()
            
        finally:
            conn.close()
            
    async def find_related_entities(self, entity_id: str, max_depth: int = 2) -> List[Dict[str, Any]]:
        """Find entities related to a given entity"""
        try:
            # Use NetworkX to find related entities
            related = []
            
            # Direct neighbors
            for neighbor in self.graph.neighbors(entity_id):
                edge_data = self.graph.get_edge_data(entity_id, neighbor)
                related.append({
                    "entity_id": neighbor,
                    "entity_name": self.graph.nodes[neighbor].get('name', ''),
                    "relationship_type": edge_data.get('relationship_type', ''),
                    "weight": edge_data.get('weight', 1.0),
                    "depth": 1
                })
                
            # Second-degree neighbors
            if max_depth > 1:
                for neighbor in self.graph.neighbors(entity_id):
                    for second_neighbor in self.graph.neighbors(neighbor):
                        if second_neighbor != entity_id:
                            edge_data = self.graph.get_edge_data(neighbor, second_neighbor)
                            related.append({
                                "entity_id": second_neighbor,
                                "entity_name": self.graph.nodes[second_neighbor].get('name', ''),
                                "relationship_type": edge_data.get('relationship_type', ''),
                                "weight": edge_data.get('weight', 1.0) * 0.5,  # Reduce weight for indirect relationships
                                "depth": 2
                            })
                            
            return related
            
        except Exception as e:
            logger.error(f"❌ Failed to find related entities: {e}")
            return []
            
    async def get_graph_statistics(self) -> Dict[str, Any]:
        """Get knowledge graph statistics"""
        return {
            "total_entities": self.graph.number_of_nodes(),
            "total_relationships": self.graph.number_of_edges(),
            "entity_types": list(set(data.get('type', 'unknown') for _, data in self.graph.nodes(data=True))),
            "relationship_types": list(set(data.get('relationship_type', 'unknown') for _, _, data in self.graph.edges(data=True))),
            "connected_components": nx.number_connected_components(self.graph.to_undirected()),
            "density": nx.density(self.graph),
            "timestamp": datetime.now().isoformat()
        }
        
    async def close(self):
        """Close the knowledge graph session"""
        if self.session:
            await self.session.close()

async def main():
    """Test the knowledge graph"""
    kg = KnowledgeGraph()
    
    try:
        await kg.initialize()
        
        # Test adding entities
        logger.info("🧪 Testing entity addition...")
        ai_id = await kg.add_entity("Artificial Intelligence", "CONCEPT", "The simulation of human intelligence in machines")
        ml_id = await kg.add_entity("Machine Learning", "CONCEPT", "A subset of AI that enables machines to learn")
        
        # Test adding relationship
        await kg.add_relationship(ai_id, ml_id, "CONTAINS", weight=0.8)
        
        # Test finding related entities
        related = await kg.find_related_entities(ai_id)
        logger.info(f"✅ Found {len(related)} related entities")
        
        # Get statistics
        stats = await kg.get_graph_statistics()
        logger.info(f"📊 Graph stats: {stats}")
        
    except Exception as e:
        logger.error(f"❌ Knowledge graph test failed: {e}")
        
    finally:
        await kg.close()

if __name__ == "__main__":
    asyncio.run(main())
