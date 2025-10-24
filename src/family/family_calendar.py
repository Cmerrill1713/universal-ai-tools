#!/usr/bin/env python3
"""
Family Calendar System for Athena
Coordinated scheduling and family event management
"""

import asyncio
import json
import time
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta, date
from enum import Enum

class EventType(Enum):
    FAMILY = "family"
    INDIVIDUAL = "individual"
    WORK = "work"
    SCHOOL = "school"
    HEALTH = "health"
    SOCIAL = "social"
    EMERGENCY = "emergency"

class EventPriority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"

@dataclass
class FamilyEvent:
    id: str
    title: str
    description: str
    event_type: EventType
    priority: EventPriority
    start_time: datetime
    end_time: datetime
    attendees: List[str]  # Family member IDs
    location: str
    recurring: bool
    recurring_pattern: Optional[str]
    created_by: str
    created_at: datetime
    updated_at: datetime
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'event_type': self.event_type.value,
            'priority': self.priority.value,
            'start_time': self.start_time.isoformat(),
            'end_time': self.end_time.isoformat(),
            'attendees': self.attendees,
            'location': self.location,
            'recurring': self.recurring,
            'recurring_pattern': self.recurring_pattern,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class FamilyCalendarService:
    def __init__(self):
        self.events = {}
        self.family_schedule = {}
        self.conflicts = []
        self.reminders = []
        
    async def add_event(self, event: FamilyEvent) -> bool:
        """Add a new family event"""
        try:
            # Check for conflicts
            conflicts = await self.check_conflicts(event)
            if conflicts:
                self.conflicts.extend(conflicts)
                self.log(f"Event added with {len(conflicts)} conflicts: {event.title}")
            else:
                self.log(f"Event added successfully: {event.title}")
            
            self.events[event.id] = event
            await self._update_family_schedule()
            return True
        except Exception as e:
            self.log(f"Error adding event: {e}", "ERROR")
            return False
    
    async def check_conflicts(self, event: FamilyEvent) -> List[Dict[str, Any]]:
        """Check for scheduling conflicts"""
        conflicts = []
        
        for existing_event in self.events.values():
            # Check if any attendees overlap
            overlapping_attendees = set(event.attendees) & set(existing_event.attendees)
            
            if overlapping_attendees:
                # Check if times overlap
                if (event.start_time < existing_event.end_time and 
                    event.end_time > existing_event.start_time):
                    
                    conflict = {
                        'event_id': event.id,
                        'conflicting_event_id': existing_event.id,
                        'attendees': list(overlapping_attendees),
                        'time_overlap': {
                            'start': max(event.start_time, existing_event.start_time).isoformat(),
                            'end': min(event.end_time, existing_event.end_time).isoformat()
                        }
                    }
                    conflicts.append(conflict)
        
        return conflicts
    
    async def get_family_schedule(self, start_date: date, end_date: date) -> Dict[str, Any]:
        """Get family schedule for date range"""
        schedule = {
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'events': [],
            'conflicts': [],
            'summary': {}
        }
        
        # Filter events by date range
        for event in self.events.values():
            if start_date <= event.start_time.date() <= end_date:
                schedule['events'].append(event.to_dict())
        
        # Get conflicts in date range
        for conflict in self.conflicts:
            conflict_event = self.events.get(conflict['event_id'])
            if conflict_event and start_date <= conflict_event.start_time.date() <= end_date:
                schedule['conflicts'].append(conflict)
        
        # Generate summary
        schedule['summary'] = await self._generate_schedule_summary(schedule['events'])
        
        return schedule
    
    async def _generate_schedule_summary(self, events: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate summary of schedule"""
        total_events = len(events)
        event_types = {}
        priorities = {}
        attendees_count = {}
        
        for event in events:
            # Count by event type
            event_type = event['event_type']
            event_types[event_type] = event_types.get(event_type, 0) + 1
            
            # Count by priority
            priority = event['priority']
            priorities[priority] = priorities.get(priority, 0) + 1
            
            # Count attendees
            for attendee in event['attendees']:
                attendees_count[attendee] = attendees_count.get(attendee, 0) + 1
        
        return {
            'total_events': total_events,
            'event_types': event_types,
            'priorities': priorities,
            'attendees_count': attendees_count,
            'busiest_day': await self._find_busiest_day(events)
        }
    
    async def _find_busiest_day(self, events: List[Dict[str, Any]]) -> str:
        """Find the busiest day in the schedule"""
        day_counts = {}
        
        for event in events:
            event_date = event['start_time'][:10]  # Get date part
            day_counts[event_date] = day_counts.get(event_date, 0) + 1
        
        if day_counts:
            busiest_day = max(day_counts, key=day_counts.get)
            return f"{busiest_day} ({day_counts[busiest_day]} events)"
        else:
            return "No events scheduled"
    
    async def suggest_meeting_time(self, attendees: List[str], duration_minutes: int, 
                                 preferred_days: List[str] = None) -> List[Dict[str, Any]]:
        """Suggest meeting times for family members"""
        suggestions = []
        
        # Get all events for attendees
        attendee_events = []
        for event in self.events.values():
            if any(attendee in event.attendees for attendee in attendees):
                attendee_events.append(event)
        
        # Find free time slots
        # This is a simplified version - in reality, you'd have more sophisticated logic
        current_time = datetime.now()
        
        for day_offset in range(7):  # Next 7 days
            check_date = current_time + timedelta(days=day_offset)
            
            # Skip if preferred_days specified and day not in list
            if preferred_days and check_date.strftime('%A').lower() not in [d.lower() for d in preferred_days]:
                continue
            
            # Check morning slot (9 AM - 12 PM)
            morning_start = check_date.replace(hour=9, minute=0, second=0, microsecond=0)
            morning_end = morning_start + timedelta(minutes=duration_minutes)
            
            if not await self._has_conflict(attendee_events, morning_start, morning_end):
                suggestions.append({
                    'start_time': morning_start.isoformat(),
                    'end_time': morning_end.isoformat(),
                    'day': check_date.strftime('%A'),
                    'date': check_date.strftime('%Y-%m-%d'),
                    'available_attendees': attendees
                })
            
            # Check afternoon slot (1 PM - 5 PM)
            afternoon_start = check_date.replace(hour=13, minute=0, second=0, microsecond=0)
            afternoon_end = afternoon_start + timedelta(minutes=duration_minutes)
            
            if not await self._has_conflict(attendee_events, afternoon_start, afternoon_end):
                suggestions.append({
                    'start_time': afternoon_start.isoformat(),
                    'end_time': afternoon_end.isoformat(),
                    'day': check_date.strftime('%A'),
                    'date': check_date.strftime('%Y-%m-%d'),
                    'available_attendees': attendees
                })
        
        return suggestions[:5]  # Return top 5 suggestions
    
    async def _has_conflict(self, events: List[FamilyEvent], start_time: datetime, end_time: datetime) -> bool:
        """Check if time slot has conflicts"""
        for event in events:
            if (start_time < event.end_time and end_time > event.start_time):
                return True
        return False
    
    async def _update_family_schedule(self):
        """Update family schedule cache"""
        # This would update a cached schedule for quick access
        pass
    
    async def create_sample_events(self):
        """Create sample family events"""
        sample_events = [
            FamilyEvent(
                id="event_001",
                title="Family Dinner",
                description="Weekly family dinner together",
                event_type=EventType.FAMILY,
                priority=EventPriority.HIGH,
                start_time=datetime.now() + timedelta(days=1, hours=18),
                end_time=datetime.now() + timedelta(days=1, hours=20),
                attendees=["dad_001", "mom_001", "teen_001", "child_001"],
                location="Home",
                recurring=True,
                recurring_pattern="weekly",
                created_by="mom_001",
                created_at=datetime.now(),
                updated_at=datetime.now()
            ),
            FamilyEvent(
                id="event_002",
                title="Alex's Soccer Game",
                description="Alex's weekly soccer game",
                event_type=EventType.INDIVIDUAL,
                priority=EventPriority.MEDIUM,
                start_time=datetime.now() + timedelta(days=2, hours=15),
                end_time=datetime.now() + timedelta(days=2, hours=17),
                attendees=["teen_001", "dad_001"],
                location="Community Center",
                recurring=True,
                recurring_pattern="weekly",
                created_by="teen_001",
                created_at=datetime.now(),
                updated_at=datetime.now()
            ),
            FamilyEvent(
                id="event_003",
                title="Emma's Art Class",
                description="Emma's weekly art class",
                event_type=EventType.INDIVIDUAL,
                priority=EventPriority.MEDIUM,
                start_time=datetime.now() + timedelta(days=3, hours=14),
                end_time=datetime.now() + timedelta(days=3, hours=16),
                attendees=["child_001", "mom_001"],
                location="Art Studio",
                recurring=True,
                recurring_pattern="weekly",
                created_by="mom_001",
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
        ]
        
        for event in sample_events:
            await self.add_event(event)
        
        self.log("Created sample family events")
    
    def log(self, message: str, level: str = "INFO"):
        """Log message"""
        print(f"[FamilyCalendarService] {level}: {message}")

# Global family calendar service
_family_calendar_service = None

def get_family_calendar_service() -> FamilyCalendarService:
    """Get global family calendar service instance"""
    global _family_calendar_service
    if _family_calendar_service is None:
        _family_calendar_service = FamilyCalendarService()
    return _family_calendar_service

if __name__ == "__main__":
    # Test family calendar service
    async def test_family_calendar():
        service = get_family_calendar_service()
        
        # Create sample events
        await service.create_sample_events()
        
        # Get family schedule
        start_date = date.today()
        end_date = start_date + timedelta(days=7)
        schedule = await service.get_family_schedule(start_date, end_date)
        print(f"Family schedule: {json.dumps(schedule, indent=2)}")
        
        # Suggest meeting time
        suggestions = await service.suggest_meeting_time(
            attendees=["dad_001", "mom_001"],
            duration_minutes=60,
            preferred_days=["Saturday", "Sunday"]
        )
        print(f"Meeting suggestions: {json.dumps(suggestions, indent=2)}")
    
    import asyncio
    asyncio.run(test_family_calendar())
