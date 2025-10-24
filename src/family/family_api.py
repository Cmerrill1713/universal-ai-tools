#!/usr/bin/env python3
"""
Family API Endpoints for Athena
RESTful API for family-specific features
"""

from fastapi import FastAPI, HTTPException, Depends
from typing import List, Optional, Dict, Any
from datetime import datetime, date
import json

# Import family services
from .family_profiles import get_family_profile_service, FamilyMember, FamilyRole, LearningStyle
from .family_calendar import get_family_calendar_service, FamilyEvent, EventType, EventPriority
from .family_knowledge import get_family_knowledge_service, FamilyKnowledge, KnowledgeType, KnowledgeCategory

app = FastAPI(title="Family Athena API", description="Family-specific API endpoints")

# Family Members Endpoints
@app.get("/api/family/members")
async def get_family_members():
    """Get all family members"""
    service = get_family_profile_service()
    summary = await service.get_family_summary()
    return {"success": True, "data": summary}

@app.post("/api/family/members")
async def add_family_member(member_data: dict):
    """Add a new family member"""
    try:
        service = get_family_profile_service()
        
        # Create family member from data
        member = FamilyMember(
            id=member_data["id"],
            name=member_data["name"],
            role=FamilyRole(member_data["role"]),
            age=member_data["age"],
            preferences=member_data.get("preferences", {}),
            learning_style=LearningStyle(member_data.get("learning_style", "visual")),
            ai_personality=member_data.get("ai_personality", "friendly"),
            goals=member_data.get("goals", []),
            interests=member_data.get("interests", []),
            communication_style=member_data.get("communication_style", "friendly"),
            created_at=datetime.now(),
            last_active=datetime.now()
        )
        
        success = await service.add_family_member(member)
        if success:
            return {"success": True, "message": "Family member added successfully"}
        else:
            raise HTTPException(status_code=400, detail="Failed to add family member")
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/family/members/{member_id}")
async def get_family_member(member_id: str):
    """Get specific family member"""
    service = get_family_profile_service()
    member = await service.get_family_member(member_id)
    
    if member:
        return {"success": True, "data": member.to_dict()}
    else:
        raise HTTPException(status_code=404, detail="Family member not found")

@app.get("/api/family/members/{member_id}/response")
async def get_age_appropriate_response(member_id: str, message: str):
    """Get age-appropriate response for family member"""
    service = get_family_profile_service()
    response = await service.get_age_appropriate_response(member_id, message)
    return {"success": True, "response": response}

# Family Calendar Endpoints
@app.get("/api/family/calendar")
async def get_family_calendar(start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Get family calendar events"""
    service = get_family_calendar_service()
    
    if start_date and end_date:
        start = datetime.fromisoformat(start_date).date()
        end = datetime.fromisoformat(end_date).date()
    else:
        start = date.today()
        end = start.replace(day=start.day + 7)  # Next 7 days
    
    schedule = await service.get_family_schedule(start, end)
    return {"success": True, "data": schedule}

@app.post("/api/family/calendar/events")
async def add_family_event(event_data: dict):
    """Add a new family event"""
    try:
        service = get_family_calendar_service()
        
        # Create event from data
        event = FamilyEvent(
            id=event_data["id"],
            title=event_data["title"],
            description=event_data.get("description", ""),
            event_type=EventType(event_data.get("event_type", "family")),
            priority=EventPriority(event_data.get("priority", "medium")),
            start_time=datetime.fromisoformat(event_data["start_time"]),
            end_time=datetime.fromisoformat(event_data["end_time"]),
            attendees=event_data.get("attendees", []),
            location=event_data.get("location", ""),
            recurring=event_data.get("recurring", False),
            recurring_pattern=event_data.get("recurring_pattern"),
            created_by=event_data["created_by"],
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        success = await service.add_event(event)
        if success:
            return {"success": True, "message": "Event added successfully"}
        else:
            raise HTTPException(status_code=400, detail="Failed to add event")
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/family/calendar/suggestions")
async def get_meeting_suggestions(attendees: str, duration: int = 60, days: Optional[str] = None):
    """Get meeting time suggestions"""
    service = get_family_calendar_service()
    attendee_list = attendees.split(",")
    preferred_days = days.split(",") if days else None
    
    suggestions = await service.suggest_meeting_time(attendee_list, duration, preferred_days)
    return {"success": True, "data": suggestions}

# Family Knowledge Endpoints
@app.get("/api/family/knowledge")
async def search_family_knowledge(query: str, category: Optional[str] = None):
    """Search family knowledge"""
    service = get_family_knowledge_service()
    
    if category:
        category_enum = KnowledgeCategory(category)
        results = await service.search_knowledge(query, category_enum)
    else:
        results = await service.search_knowledge(query)
    
    return {"success": True, "data": [result.to_dict() for result in results]}

@app.get("/api/family/knowledge/categories")
async def get_knowledge_categories():
    """Get all knowledge categories"""
    categories = [category.value for category in KnowledgeCategory]
    return {"success": True, "data": categories}

@app.get("/api/family/knowledge/{knowledge_id}")
async def get_knowledge_item(knowledge_id: str):
    """Get specific knowledge item"""
    service = get_family_knowledge_service()
    knowledge = await service.access_knowledge(knowledge_id)
    
    if knowledge:
        return {"success": True, "data": knowledge.to_dict()}
    else:
        raise HTTPException(status_code=404, detail="Knowledge item not found")

@app.post("/api/family/knowledge")
async def add_family_knowledge(knowledge_data: dict):
    """Add new family knowledge"""
    try:
        service = get_family_knowledge_service()
        
        # Create knowledge from data
        knowledge = FamilyKnowledge(
            id=knowledge_data["id"],
            title=knowledge_data["title"],
            content=knowledge_data["content"],
            knowledge_type=KnowledgeType(knowledge_data.get("knowledge_type", "memory")),
            category=KnowledgeCategory(knowledge_data.get("category", "memories")),
            tags=knowledge_data.get("tags", []),
            family_members=knowledge_data.get("family_members", []),
            importance=knowledge_data.get("importance", 5),
            created_by=knowledge_data["created_by"],
            created_at=datetime.now(),
            updated_at=datetime.now(),
            last_accessed=None,
            access_count=0
        )
        
        success = await service.add_knowledge(knowledge)
        if success:
            return {"success": True, "message": "Knowledge added successfully"}
        else:
            raise HTTPException(status_code=400, detail="Failed to add knowledge")
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# Family Dashboard Endpoints
@app.get("/api/family/dashboard")
async def get_family_dashboard():
    """Get family dashboard data"""
    profile_service = get_family_profile_service()
    calendar_service = get_family_calendar_service()
    knowledge_service = get_family_knowledge_service()
    
    # Get family summary
    family_summary = await profile_service.get_family_summary()
    
    # Get today's events
    today = date.today()
    today_schedule = await calendar_service.get_family_schedule(today, today)
    
    # Get recent knowledge
    knowledge_summary = await knowledge_service.get_knowledge_summary()
    
    return {
        "success": True,
        "data": {
            "family": family_summary,
            "today_events": today_schedule["events"],
            "knowledge_summary": knowledge_summary
        }
    }

@app.get("/api/family/health")
async def get_family_health():
    """Get family system health"""
    return {
        "success": True,
        "data": {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "services": {
                "family_profiles": "active",
                "family_calendar": "active",
                "family_knowledge": "active"
            }
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)
