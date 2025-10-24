#!/usr/bin/env python3
"""
Family Athena Integration Test
Comprehensive testing of all family features
"""

import asyncio
import json
import time
from datetime import datetime, date, timedelta

# Import family services
from src.family.family_profiles import get_family_profile_service, FamilyMember, FamilyRole, LearningStyle
from src.family.family_calendar import get_family_calendar_service, FamilyEvent, EventType, EventPriority
from src.family.family_knowledge import get_family_knowledge_service, FamilyKnowledge, KnowledgeType, KnowledgeCategory

class FamilyAthenaTester:
    def __init__(self):
        self.test_results = []
        self.errors = []
        
    def log(self, message, level="INFO"):
        timestamp = time.strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    async def test_family_profiles(self):
        """Test family profile system"""
        self.log("🧪 Testing family profiles...")
        
        try:
            service = get_family_profile_service()
            
            # Create sample family
            await service.create_sample_family()
            
            # Test family summary
            summary = await service.get_family_summary()
            assert summary['total_members'] == 4, f"Expected 4 members, got {summary['total_members']}"
            
            # Test individual member retrieval
            dad = await service.get_family_member("dad_001")
            assert dad is not None, "Dad not found"
            assert dad.name == "Dad", f"Expected 'Dad', got '{dad.name}'"
            
            # Test age-appropriate responses
            child_response = await service.get_age_appropriate_response("child_001", "Hello!")
            assert len(child_response) > 0, "Child response should not be empty"
            
            parent_response = await service.get_age_appropriate_response("dad_001", "Hello!")
            assert len(parent_response) > 0, "Parent response should not be empty"
            
            self.test_results.append("✅ Family profiles test passed")
            self.log("✅ Family profiles working correctly")
            
        except Exception as e:
            self.test_results.append("❌ Family profiles test failed")
            self.log(f"❌ Family profiles test failed: {e}", "ERROR")
            self.errors.append(f"Family profiles test failed: {e}")
    
    async def test_family_calendar(self):
        """Test family calendar system"""
        self.log("🧪 Testing family calendar...")
        
        try:
            service = get_family_calendar_service()
            
            # Create sample events
            await service.create_sample_events()
            
            # Test schedule retrieval
            today = date.today()
            next_week = today + timedelta(days=7)
            schedule = await service.get_family_schedule(today, next_week)
            
            assert 'events' in schedule, "Schedule should contain events"
            assert len(schedule['events']) > 0, "Should have sample events"
            
            # Test meeting suggestions
            suggestions = await service.suggest_meeting_time(
                attendees=["dad_001", "mom_001"],
                duration_minutes=60
            )
            assert isinstance(suggestions, list), "Suggestions should be a list"
            
            self.test_results.append("✅ Family calendar test passed")
            self.log("✅ Family calendar working correctly")
            
        except Exception as e:
            self.test_results.append("❌ Family calendar test failed")
            self.log(f"❌ Family calendar test failed: {e}", "ERROR")
            self.errors.append(f"Family calendar test failed: {e}")
    
    async def test_family_knowledge(self):
        """Test family knowledge system"""
        self.log("🧪 Testing family knowledge...")
        
        try:
            service = get_family_knowledge_service()
            
            # Create sample knowledge
            await service.create_sample_knowledge()
            
            # Test knowledge search
            results = await service.search_knowledge("christmas")
            assert len(results) > 0, "Should find Christmas knowledge"
            
            # Test category filtering
            emergency_info = await service.get_knowledge_by_category(KnowledgeCategory.EMERGENCY_INFO)
            assert len(emergency_info) > 0, "Should have emergency information"
            
            # Test knowledge summary
            summary = await service.get_knowledge_summary()
            assert summary['total_items'] > 0, "Should have knowledge items"
            
            self.test_results.append("✅ Family knowledge test passed")
            self.log("✅ Family knowledge working correctly")
            
        except Exception as e:
            self.test_results.append("❌ Family knowledge test failed")
            self.log(f"❌ Family knowledge test failed: {e}", "ERROR")
            self.errors.append(f"Family knowledge test failed: {e}")
    
    async def test_family_integration(self):
        """Test family features working together"""
        self.log("🧪 Testing family integration...")
        
        try:
            profile_service = get_family_profile_service()
            calendar_service = get_family_calendar_service()
            knowledge_service = get_family_knowledge_service()
            
            # Create sample data
            await profile_service.create_sample_family()
            await calendar_service.create_sample_events()
            await knowledge_service.create_sample_knowledge()
            
            # Test cross-service functionality
            # Get family member and their events
            dad = await profile_service.get_family_member("dad_001")
            assert dad is not None, "Dad should exist"
            
            # Get events for dad
            today = date.today()
            next_week = today + timedelta(days=7)
            schedule = await calendar_service.get_family_schedule(today, next_week)
            
            dad_events = [event for event in schedule['events'] if 'dad_001' in event['attendees']]
            assert len(dad_events) > 0, "Dad should have events"
            
            # Get knowledge related to dad
            dad_knowledge = await knowledge_service.get_knowledge_by_family_member("dad_001")
            assert len(dad_knowledge) > 0, "Dad should have related knowledge"
            
            self.test_results.append("✅ Family integration test passed")
            self.log("✅ Family integration working correctly")
            
        except Exception as e:
            self.test_results.append("❌ Family integration test failed")
            self.log(f"❌ Family integration test failed: {e}", "ERROR")
            self.errors.append(f"Family integration test failed: {e}")
    
    async def run_all_tests(self):
        """Run all family tests"""
        self.log("🚀 Starting Family Athena Integration Tests")
        self.log("=" * 60)
        
        # Run individual tests
        await self.test_family_profiles()
        await self.test_family_calendar()
        await self.test_family_knowledge()
        await self.test_family_integration()
        
        # Summary
        self.log("=" * 60)
        self.log("📊 FAMILY ATHENA TEST RESULTS")
        self.log("=" * 60)
        
        passed = len([r for r in self.test_results if r.startswith("✅")])
        failed = len([r for r in self.test_results if r.startswith("❌")])
        total = len(self.test_results)
        
        self.log(f"Total Tests: {total}")
        self.log(f"Passed: {passed}")
        self.log(f"Failed: {failed}")
        
        for result in self.test_results:
            self.log(f"  {result}")
        
        if self.errors:
            self.log(f"Errors: {len(self.errors)}")
            for error in self.errors:
                self.log(f"  - {error}")
        
        self.log("=" * 60)
        
        if failed == 0:
            self.log("🎉 ALL FAMILY TESTS PASSED!")
            self.log("Family Athena is working perfectly!")
        else:
            self.log(f"⚠️ {failed} tests failed - review errors above")
        
        return failed == 0

async def main():
    """Main test execution"""
    tester = FamilyAthenaTester()
    success = await tester.run_all_tests()
    
    if success:
        print("\n🎯 FAMILY ATHENA STATUS:")
        print("   ✅ Family Profiles: WORKING")
        print("   ✅ Family Calendar: WORKING")
        print("   ✅ Family Knowledge: WORKING")
        print("   ✅ Family Integration: WORKING")
        print("\n🚀 Family Athena is ready for your family!")
    else:
        print("\n⚠️ Some family features need attention")
        print("Review the test results above")

if __name__ == "__main__":
    asyncio.run(main())
