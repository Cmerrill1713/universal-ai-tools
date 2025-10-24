#!/usr/bin/env python3
"""
Family Member Profiles for Athena
Individual AI personalities and preferences for each family member
"""

import asyncio
import json
import time
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, asdict
from datetime import datetime, date
from enum import Enum

class FamilyRole(Enum):
    PARENT = "parent"
    CHILD = "child"
    TEEN = "teen"
    GRANDPARENT = "grandparent"
    GUARDIAN = "guardian"

class LearningStyle(Enum):
    VISUAL = "visual"
    AUDITORY = "auditory"
    KINESTHETIC = "kinesthetic"
    READING = "reading"

@dataclass
class FamilyMember:
    id: str
    name: str
    role: FamilyRole
    age: int
    preferences: Dict[str, Any]
    learning_style: LearningStyle
    ai_personality: str
    goals: List[str]
    interests: List[str]
    communication_style: str
    created_at: datetime
    last_active: datetime
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'role': self.role.value,
            'age': self.age,
            'preferences': self.preferences,
            'learning_style': self.learning_style.value,
            'ai_personality': self.ai_personality,
            'goals': self.goals,
            'interests': self.interests,
            'communication_style': self.communication_style,
            'created_at': self.created_at.isoformat(),
            'last_active': self.last_active.isoformat()
        }

class FamilyProfileService:
    def __init__(self):
        self.family_members = {}
        self.family_relationships = {}
        self.family_preferences = {}
        
    async def add_family_member(self, member: FamilyMember) -> bool:
        """Add a new family member"""
        try:
            self.family_members[member.id] = member
            self.log(f"Added family member: {member.name} ({member.role.value})")
            return True
        except Exception as e:
            self.log(f"Error adding family member: {e}", "ERROR")
            return False
    
    async def get_family_member(self, member_id: str) -> Optional[FamilyMember]:
        """Get family member by ID"""
        return self.family_members.get(member_id)
    
    async def get_family_member_by_name(self, name: str) -> Optional[FamilyMember]:
        """Get family member by name"""
        for member in self.family_members.values():
            if member.name.lower() == name.lower():
                return member
        return None
    
    async def update_family_member(self, member_id: str, updates: Dict[str, Any]) -> bool:
        """Update family member information"""
        try:
            if member_id in self.family_members:
                member = self.family_members[member_id]
                for key, value in updates.items():
                    if hasattr(member, key):
                        setattr(member, key, value)
                member.last_active = datetime.now()
                self.log(f"Updated family member: {member.name}")
                return True
            return False
        except Exception as e:
            self.log(f"Error updating family member: {e}", "ERROR")
            return False
    
    async def get_age_appropriate_response(self, member_id: str, message: str) -> str:
        """Get age-appropriate response for family member"""
        member = await self.get_family_member(member_id)
        if not member:
            return "I don't recognize you. Please introduce yourself to the family!"
        
        # Age-appropriate response logic
        if member.role == FamilyRole.CHILD:
            return await self._get_child_response(message, member)
        elif member.role == FamilyRole.TEEN:
            return await self._get_teen_response(message, member)
        elif member.role == FamilyRole.PARENT:
            return await self._get_parent_response(message, member)
        elif member.role == FamilyRole.GRANDPARENT:
            return await self._get_grandparent_response(message, member)
        else:
            return await self._get_default_response(message, member)
    
    async def _get_child_response(self, message: str, member: FamilyMember) -> str:
        """Get response appropriate for children"""
        # Simple, encouraging language
        responses = [
            f"Hi {member.name}! That's a great question! Let me help you with that.",
            f"Wow {member.name}, you're so smart! Here's what I think...",
            f"Great job asking {member.name}! I'm here to help you learn.",
            f"Hi there {member.name}! I love helping kids like you. What would you like to know?"
        ]
        return responses[hash(message) % len(responses)]
    
    async def _get_teen_response(self, message: str, member: FamilyMember) -> str:
        """Get response appropriate for teenagers"""
        # More mature but still supportive
        responses = [
            f"Hey {member.name}, I understand what you're asking. Here's my take on it...",
            f"Good question {member.name}. Let me break this down for you...",
            f"I get it {member.name}. This is actually pretty interesting...",
            f"Nice {member.name}, that's a thoughtful question. Here's what I think..."
        ]
        return responses[hash(message) % len(responses)]
    
    async def _get_parent_response(self, message: str, member: FamilyMember) -> str:
        """Get response appropriate for parents"""
        # Professional but warm
        responses = [
            f"Hello {member.name}, I understand your concern. Let me help you with this...",
            f"Good point {member.name}. As a parent, you might want to consider...",
            f"I appreciate you asking {member.name}. Here's what I recommend...",
            f"Thanks for reaching out {member.name}. Let me provide some guidance..."
        ]
        return responses[hash(message) % len(responses)]
    
    async def _get_grandparent_response(self, message: str, member: FamilyMember) -> str:
        """Get response appropriate for grandparents"""
        # Respectful and warm
        responses = [
            f"Hello {member.name}, it's wonderful to hear from you. Let me help...",
            f"Thank you for asking {member.name}. With your experience, you'll appreciate...",
            f"Hello dear {member.name}. I'm honored to assist you with...",
            f"Good to hear from you {member.name}. Let me share some thoughts..."
        ]
        return responses[hash(message) % len(responses)]
    
    async def _get_default_response(self, message: str, member: FamilyMember) -> str:
        """Get default response"""
        return f"Hello {member.name}! I'm here to help. What can I do for you today?"
    
    async def get_family_summary(self) -> Dict[str, Any]:
        """Get summary of all family members"""
        return {
            'total_members': len(self.family_members),
            'members': [member.to_dict() for member in self.family_members.values()],
            'roles': {
                role.value: len([m for m in self.family_members.values() if m.role == role])
                for role in FamilyRole
            },
            'last_updated': datetime.now().isoformat()
        }
    
    async def create_sample_family(self):
        """Create a sample family for demonstration"""
        sample_members = [
            FamilyMember(
                id="dad_001",
                name="Dad",
                role=FamilyRole.PARENT,
                age=45,
                preferences={"communication": "direct", "notifications": "important_only"},
                learning_style=LearningStyle.READING,
                ai_personality="supportive_leader",
                goals=["family_health", "career_growth", "home_improvement"],
                interests=["technology", "sports", "cooking"],
                communication_style="direct_and_supportive",
                created_at=datetime.now(),
                last_active=datetime.now()
            ),
            FamilyMember(
                id="mom_001",
                name="Mom",
                role=FamilyRole.PARENT,
                age=42,
                preferences={"communication": "detailed", "notifications": "all"},
                learning_style=LearningStyle.VISUAL,
                ai_personality="nurturing_organizer",
                goals=["family_wellness", "education", "organization"],
                interests=["health", "education", "gardening"],
                communication_style="warm_and_detailed",
                created_at=datetime.now(),
                last_active=datetime.now()
            ),
            FamilyMember(
                id="teen_001",
                name="Alex",
                role=FamilyRole.TEEN,
                age=16,
                preferences={"communication": "casual", "notifications": "social"},
                learning_style=LearningStyle.KINESTHETIC,
                ai_personality="encouraging_mentor",
                goals=["academic_success", "social_skills", "independence"],
                interests=["gaming", "music", "technology"],
                communication_style="casual_and_encouraging",
                created_at=datetime.now(),
                last_active=datetime.now()
            ),
            FamilyMember(
                id="child_001",
                name="Emma",
                role=FamilyRole.CHILD,
                age=8,
                preferences={"communication": "simple", "notifications": "fun"},
                learning_style=LearningStyle.VISUAL,
                ai_personality="playful_teacher",
                goals=["learning", "creativity", "friendship"],
                interests=["art", "animals", "reading"],
                communication_style="playful_and_educational",
                created_at=datetime.now(),
                last_active=datetime.now()
            )
        ]
        
        for member in sample_members:
            await self.add_family_member(member)
        
        self.log("Created sample family with 4 members")
    
    def log(self, message: str, level: str = "INFO"):
        """Log message"""
        print(f"[FamilyProfileService] {level}: {message}")

# Global family profile service
_family_profile_service = None

def get_family_profile_service() -> FamilyProfileService:
    """Get global family profile service instance"""
    global _family_profile_service
    if _family_profile_service is None:
        _family_profile_service = FamilyProfileService()
    return _family_profile_service

if __name__ == "__main__":
    # Test family profile service
    async def test_family_profiles():
        service = get_family_profile_service()
        
        # Create sample family
        await service.create_sample_family()
        
        # Test family member retrieval
        dad = await service.get_family_member("dad_001")
        print(f"Dad: {dad.name}, Role: {dad.role.value}, Age: {dad.age}")
        
        # Test age-appropriate responses
        child_response = await service.get_age_appropriate_response("child_001", "Hello Athena!")
        print(f"Child response: {child_response}")
        
        parent_response = await service.get_age_appropriate_response("dad_001", "Hello Athena!")
        print(f"Parent response: {parent_response}")
        
        # Get family summary
        summary = await service.get_family_summary()
        print(f"Family summary: {json.dumps(summary, indent=2)}")
    
    import asyncio
    asyncio.run(test_family_profiles())
