#!/usr/bin/env python3
"""
Athena Gateway Integration for Family Features
Integrate family services with the main Athena API Gateway
"""

from fastapi import FastAPI, HTTPException, Depends
from typing import Dict, Any, List, Optional
import httpx
import json
from datetime import datetime

# Import family services
import sys
from pathlib import Path
sys.path.append('/workspace')

from src.family.family_profiles import get_family_profile_service
from src.family.family_calendar import get_family_calendar_service
from src.family.family_knowledge import get_family_knowledge_service

class FamilyAthenaGateway:
    def __init__(self):
        self.family_profile_service = get_family_profile_service()
        self.family_calendar_service = get_family_calendar_service()
        self.family_knowledge_service = get_family_knowledge_service()
        
    async def get_family_dashboard_data(self) -> Dict[str, Any]:
        """Get complete family dashboard data"""
        try:
            # Get family summary
            family_summary = await self.family_profile_service.get_family_summary()
            
            # Get today's events
            today = datetime.now().date()
            today_schedule = await self.family_calendar_service.get_family_schedule(today, today)
            
            # Get knowledge summary
            knowledge_summary = await self.family_knowledge_service.get_knowledge_summary()
            
            return {
                "success": True,
                "data": {
                    "family": family_summary,
                    "today_events": today_schedule["events"],
                    "knowledge_summary": knowledge_summary,
                    "timestamp": datetime.now().isoformat()
                }
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    async def get_family_member_response(self, member_id: str, message: str) -> Dict[str, Any]:
        """Get age-appropriate response for family member"""
        try:
            response = await self.family_profile_service.get_age_appropriate_response(member_id, message)
            return {
                "success": True,
                "response": response,
                "member_id": member_id,
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "member_id": member_id,
                "timestamp": datetime.now().isoformat()
            }
    
    async def search_family_knowledge(self, query: str, category: Optional[str] = None) -> Dict[str, Any]:
        """Search family knowledge"""
        try:
            if category:
                from src.family.family_knowledge import KnowledgeCategory
                category_enum = KnowledgeCategory(category)
                results = await self.family_knowledge_service.search_knowledge(query, category_enum)
            else:
                results = await self.family_knowledge_service.search_knowledge(query)
            
            return {
                "success": True,
                "results": [result.to_dict() for result in results],
                "query": query,
                "category": category,
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "query": query,
                "timestamp": datetime.now().isoformat()
            }
    
    async def get_family_schedule(self, start_date: str, end_date: str) -> Dict[str, Any]:
        """Get family schedule for date range"""
        try:
            from datetime import datetime
            start = datetime.fromisoformat(start_date).date()
            end = datetime.fromisoformat(end_date).date()
            
            schedule = await self.family_calendar_service.get_family_schedule(start, end)
            
            return {
                "success": True,
                "schedule": schedule,
                "start_date": start_date,
                "end_date": end_date,
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "start_date": start_date,
                "end_date": end_date,
                "timestamp": datetime.now().isoformat()
            }

# Global family gateway instance
_family_gateway = None

def get_family_gateway() -> FamilyAthenaGateway:
    """Get global family gateway instance"""
    global _family_gateway
    if _family_gateway is None:
        _family_gateway = FamilyAthenaGateway()
    return _family_gateway

# FastAPI app for family integration
app = FastAPI(title="Family Athena Gateway Integration")

@app.get("/api/family/dashboard")
async def get_family_dashboard():
    """Get family dashboard data through Athena Gateway"""
    gateway = get_family_gateway()
    return await gateway.get_family_dashboard_data()

@app.get("/api/family/members/{member_id}/chat")
async def chat_with_family_member(member_id: str, message: str):
    """Chat with specific family member through Athena Gateway"""
    gateway = get_family_gateway()
    return await gateway.get_family_member_response(member_id, message)

@app.get("/api/family/knowledge/search")
async def search_family_knowledge_gateway(query: str, category: Optional[str] = None):
    """Search family knowledge through Athena Gateway"""
    gateway = get_family_gateway()
    return await gateway.search_family_knowledge(query, category)

@app.get("/api/family/calendar/schedule")
async def get_family_schedule_gateway(start_date: str, end_date: str):
    """Get family schedule through Athena Gateway"""
    gateway = get_family_gateway()
    return await gateway.get_family_schedule(start_date, end_date)

@app.get("/api/family/health")
async def get_family_health():
    """Get family system health through Athena Gateway"""
    try:
        # Test all family services
        profile_service = get_family_profile_service()
        calendar_service = get_family_calendar_service()
        knowledge_service = get_family_knowledge_service()
        
        # Create sample data if needed
        await profile_service.create_sample_family()
        await calendar_service.create_sample_events()
        await knowledge_service.create_sample_knowledge()
        
        return {
            "success": True,
            "status": "healthy",
            "services": {
                "family_profiles": "active",
                "family_calendar": "active",
                "family_knowledge": "active"
            },
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "success": False,
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8006)
