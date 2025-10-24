#!/usr/bin/env python3
"""
Family Knowledge Base for Athena
Stores family stories, traditions, preferences, and important information
"""

import asyncio
import json
import time
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, asdict
from datetime import datetime
from enum import Enum

class KnowledgeType(Enum):
    STORY = "story"
    TRADITION = "tradition"
    PREFERENCE = "preference"
    EMERGENCY = "emergency"
    RECIPE = "recipe"
    MEMORY = "memory"
    CONTACT = "contact"
    IMPORTANT = "important"

class KnowledgeCategory(Enum):
    FAMILY_HISTORY = "family_history"
    TRADITIONS = "traditions"
    PREFERENCES = "preferences"
    EMERGENCY_INFO = "emergency_info"
    RECIPES = "recipes"
    MEMORIES = "memories"
    CONTACTS = "contacts"
    IMPORTANT_DATES = "important_dates"

@dataclass
class FamilyKnowledge:
    id: str
    title: str
    content: str
    knowledge_type: KnowledgeType
    category: KnowledgeCategory
    tags: List[str]
    family_members: List[str]  # Who this knowledge relates to
    importance: int  # 1-10 scale
    created_by: str
    created_at: datetime
    updated_at: datetime
    last_accessed: Optional[datetime]
    access_count: int
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'content': self.content,
            'knowledge_type': self.knowledge_type.value,
            'category': self.category.value,
            'tags': self.tags,
            'family_members': self.family_members,
            'importance': self.importance,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'last_accessed': self.last_accessed.isoformat() if self.last_accessed else None,
            'access_count': self.access_count
        }

class FamilyKnowledgeService:
    def __init__(self):
        self.knowledge_items = {}
        self.search_index = {}
        self.categories = {}
        
    async def add_knowledge(self, knowledge: FamilyKnowledge) -> bool:
        """Add new family knowledge"""
        try:
            self.knowledge_items[knowledge.id] = knowledge
            await self._update_search_index(knowledge)
            await self._update_categories(knowledge)
            self.log(f"Added knowledge: {knowledge.title}")
            return True
        except Exception as e:
            self.log(f"Error adding knowledge: {e}", "ERROR")
            return False
    
    async def search_knowledge(self, query: str, category: Optional[KnowledgeCategory] = None) -> List[FamilyKnowledge]:
        """Search family knowledge"""
        results = []
        query_lower = query.lower()
        
        for knowledge in self.knowledge_items.values():
            # Filter by category if specified
            if category and knowledge.category != category:
                continue
            
            # Search in title, content, and tags
            if (query_lower in knowledge.title.lower() or
                query_lower in knowledge.content.lower() or
                any(query_lower in tag.lower() for tag in knowledge.tags)):
                results.append(knowledge)
        
        # Sort by importance and access count
        results.sort(key=lambda x: (x.importance, x.access_count), reverse=True)
        return results
    
    async def get_knowledge_by_category(self, category: KnowledgeCategory) -> List[FamilyKnowledge]:
        """Get all knowledge in a category"""
        return [k for k in self.knowledge_items.values() if k.category == category]
    
    async def get_knowledge_by_family_member(self, member_id: str) -> List[FamilyKnowledge]:
        """Get knowledge related to a specific family member"""
        return [k for k in self.knowledge_items.values() if member_id in k.family_members]
    
    async def get_important_knowledge(self, min_importance: int = 8) -> List[FamilyKnowledge]:
        """Get high-importance knowledge"""
        return [k for k in self.knowledge_items.values() if k.importance >= min_importance]
    
    async def access_knowledge(self, knowledge_id: str) -> Optional[FamilyKnowledge]:
        """Access knowledge and update access stats"""
        knowledge = self.knowledge_items.get(knowledge_id)
        if knowledge:
            knowledge.last_accessed = datetime.now()
            knowledge.access_count += 1
            self.log(f"Accessed knowledge: {knowledge.title}")
        return knowledge
    
    async def _update_search_index(self, knowledge: FamilyKnowledge):
        """Update search index for knowledge"""
        # Simple keyword extraction and indexing
        keywords = set()
        
        # Add words from title
        keywords.update(knowledge.title.lower().split())
        
        # Add words from content (first 100 words)
        content_words = knowledge.content.lower().split()[:100]
        keywords.update(content_words)
        
        # Add tags
        keywords.update([tag.lower() for tag in knowledge.tags])
        
        # Update index
        for keyword in keywords:
            if keyword not in self.search_index:
                self.search_index[keyword] = []
            if knowledge.id not in self.search_index[keyword]:
                self.search_index[keyword].append(knowledge.id)
    
    async def _update_categories(self, knowledge: FamilyKnowledge):
        """Update category index"""
        category = knowledge.category
        if category not in self.categories:
            self.categories[category] = []
        if knowledge.id not in self.categories[category]:
            self.categories[category].append(knowledge.id)
    
    async def get_knowledge_summary(self) -> Dict[str, Any]:
        """Get summary of family knowledge"""
        total_items = len(self.knowledge_items)
        category_counts = {}
        type_counts = {}
        importance_distribution = {i: 0 for i in range(1, 11)}
        
        for knowledge in self.knowledge_items.values():
            # Count by category
            category = knowledge.category.value
            category_counts[category] = category_counts.get(category, 0) + 1
            
            # Count by type
            knowledge_type = knowledge.knowledge_type.value
            type_counts[knowledge_type] = type_counts.get(knowledge_type, 0) + 1
            
            # Count by importance
            importance_distribution[knowledge.importance] += 1
        
        return {
            'total_items': total_items,
            'category_counts': category_counts,
            'type_counts': type_counts,
            'importance_distribution': importance_distribution,
            'most_accessed': await self._get_most_accessed(),
            'recently_added': await self._get_recently_added()
        }
    
    async def _get_most_accessed(self, limit: int = 5) -> List[Dict[str, Any]]:
        """Get most accessed knowledge items"""
        sorted_items = sorted(
            self.knowledge_items.values(),
            key=lambda x: x.access_count,
            reverse=True
        )
        return [item.to_dict() for item in sorted_items[:limit]]
    
    async def _get_recently_added(self, limit: int = 5) -> List[Dict[str, Any]]:
        """Get recently added knowledge items"""
        sorted_items = sorted(
            self.knowledge_items.values(),
            key=lambda x: x.created_at,
            reverse=True
        )
        return [item.to_dict() for item in sorted_items[:limit]]
    
    async def create_sample_knowledge(self):
        """Create sample family knowledge"""
        sample_knowledge = [
            FamilyKnowledge(
                id="knowledge_001",
                title="Family Christmas Tradition",
                content="Every Christmas Eve, we gather around the fireplace and read 'Twas the Night Before Christmas' together. Then we each share one thing we're grateful for from the past year.",
                knowledge_type=KnowledgeType.TRADITION,
                category=KnowledgeCategory.TRADITIONS,
                tags=["christmas", "tradition", "gratitude", "family"],
                family_members=["dad_001", "mom_001", "teen_001", "child_001"],
                importance=9,
                created_by="mom_001",
                created_at=datetime.now(),
                updated_at=datetime.now(),
                last_accessed=None,
                access_count=0
            ),
            FamilyKnowledge(
                id="knowledge_002",
                title="Emma's Allergies",
                content="Emma is allergic to peanuts and shellfish. Always check ingredients before giving her food. Keep EpiPen in kitchen cabinet and her backpack.",
                knowledge_type=KnowledgeType.EMERGENCY,
                category=KnowledgeCategory.EMERGENCY_INFO,
                tags=["allergies", "emma", "emergency", "health"],
                family_members=["child_001"],
                importance=10,
                created_by="mom_001",
                created_at=datetime.now(),
                updated_at=datetime.now(),
                last_accessed=None,
                access_count=0
            ),
            FamilyKnowledge(
                id="knowledge_003",
                title="Dad's Favorite Recipe - Grandma's Apple Pie",
                content="Ingredients: 6 apples, 2 cups flour, 1 cup sugar, 1/2 cup butter, 1 tsp cinnamon. Mix dry ingredients, cut in butter, add sliced apples, bake at 375°F for 45 minutes.",
                knowledge_type=KnowledgeType.RECIPE,
                category=KnowledgeCategory.RECIPES,
                tags=["recipe", "apple pie", "grandma", "dessert"],
                family_members=["dad_001"],
                importance=7,
                created_by="dad_001",
                created_at=datetime.now(),
                updated_at=datetime.now(),
                last_accessed=None,
                access_count=0
            ),
            FamilyKnowledge(
                id="knowledge_004",
                title="Emergency Contacts",
                content="Dr. Smith (Pediatrician): 555-0123, Dr. Johnson (Family Doctor): 555-0124, Emergency: 911, Poison Control: 1-800-222-1222, School: 555-0125",
                knowledge_type=KnowledgeType.CONTACT,
                category=KnowledgeCategory.CONTACTS,
                tags=["emergency", "contacts", "doctors", "school"],
                family_members=["dad_001", "mom_001", "teen_001", "child_001"],
                importance=10,
                created_by="mom_001",
                created_at=datetime.now(),
                updated_at=datetime.now(),
                last_accessed=None,
                access_count=0
            ),
            FamilyKnowledge(
                id="knowledge_005",
                title="Alex's Soccer Schedule",
                content="Alex plays soccer every Saturday at 3 PM at the Community Center. Games last 2 hours. Dad usually drives. Bring water bottle and shin guards.",
                knowledge_type=KnowledgeType.IMPORTANT,
                category=KnowledgeCategory.IMPORTANT_DATES,
                tags=["alex", "soccer", "schedule", "sports"],
                family_members=["teen_001", "dad_001"],
                importance=8,
                created_by="teen_001",
                created_at=datetime.now(),
                updated_at=datetime.now(),
                last_accessed=None,
                access_count=0
            )
        ]
        
        for knowledge in sample_knowledge:
            await self.add_knowledge(knowledge)
        
        self.log("Created sample family knowledge")
    
    def log(self, message: str, level: str = "INFO"):
        """Log message"""
        print(f"[FamilyKnowledgeService] {level}: {message}")

# Global family knowledge service
_family_knowledge_service = None

def get_family_knowledge_service() -> FamilyKnowledgeService:
    """Get global family knowledge service instance"""
    global _family_knowledge_service
    if _family_knowledge_service is None:
        _family_knowledge_service = FamilyKnowledgeService()
    return _family_knowledge_service

if __name__ == "__main__":
    # Test family knowledge service
    async def test_family_knowledge():
        service = get_family_knowledge_service()
        
        # Create sample knowledge
        await service.create_sample_knowledge()
        
        # Search knowledge
        results = await service.search_knowledge("christmas")
        print(f"Christmas search results: {len(results)} items")
        
        # Get emergency info
        emergency_info = await service.get_knowledge_by_category(KnowledgeCategory.EMERGENCY_INFO)
        print(f"Emergency info: {len(emergency_info)} items")
        
        # Get knowledge summary
        summary = await service.get_knowledge_summary()
        print(f"Knowledge summary: {json.dumps(summary, indent=2)}")
    
    import asyncio
    asyncio.run(test_family_knowledge())
