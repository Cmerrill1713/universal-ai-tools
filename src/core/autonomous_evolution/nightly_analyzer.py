#!/usr/bin/env python3
"""
Nightly Analyzer - Runs at 2 AM
Analyzes system performance and generates recommendations
Does NOT auto-apply - waits for human approval
"""

import asyncio
import httpx
import json
from datetime import datetime
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class NightlyAnalyzer:
    def __init__(self):
        self.base_url = "http://localhost:8014"
        self.reports_dir = Path("/Users/christianmerrill/Documents/GitHub/AI-Projects/universal-ai-tools/logs/evolution-reports")
        self.reports_dir.mkdir(parents=True, exist_ok=True)
        
    async def run_analysis(self):
        """Run complete nightly analysis"""
        timestamp = datetime.now().isoformat()
        report = {
            "timestamp": timestamp,
            "date": datetime.now().strftime("%Y-%m-%d"),
            "analysis": {},
            "recommendations": [],
            "status": "pending_review"
        }
        
        logger.info("🌙 Starting nightly analysis at %s", timestamp)
        
        try:
            # 1. Collect system stats
            logger.info("📊 Collecting system statistics...")
            report["analysis"]["system_stats"] = await self.collect_stats()
            
            # 2. Analyze performance
            logger.info("📈 Analyzing performance...")
            report["analysis"]["performance"] = await self.analyze_performance()
            
            # 3. Generate recommendations
            logger.info("💡 Generating recommendations...")
            report["recommendations"] = await self.generate_recommendations(report["analysis"])
            
            # 4. Save report for morning review
            report_file = self.reports_dir / f"evolution-report-{datetime.now().strftime('%Y%m%d')}.json"
            with open(report_file, 'w') as f:
                json.dump(report, f, indent=2)
            
            logger.info("✅ Analysis complete! Report saved to: %s", report_file)
            logger.info("📋 Found %d recommendations pending your review", len(report["recommendations"]))
            
            # 5. Generate human-readable summary
            await self.create_morning_summary(report)
            
            return report
            
        except Exception as e:
            logger.error("❌ Nightly analysis failed: %s", e)
            report["status"] = "failed"
            report["error"] = str(e)
            return report
    
    async def collect_stats(self):
        """Collect system statistics"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(f"{self.base_url}/api/evolution/status")
                return response.json() if response.status_code == 200 else {}
            except Exception as e:
                logger.error("Failed to collect stats: %s", e)
                return {}
    
    async def analyze_performance(self):
        """Analyze system performance"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                # Get routing history
                response = await client.get(f"{self.base_url}/api/evolutionary/stats")
                stats = response.json() if response.status_code == 200 else {}
                
                return {
                    "total_requests": stats.get("total_requests", 0),
                    "success_rate": stats.get("success_rate", 0),
                    "avg_latency": stats.get("avg_latency", 0),
                    "analysis": "System operational"
                }
            except Exception as e:
                logger.error("Failed to analyze performance: %s", e)
                return {}
    
    async def generate_recommendations(self, analysis):
        """Generate improvement recommendations based on analysis"""
        recommendations = []
        
        performance = analysis.get("performance", {})
        success_rate = performance.get("success_rate", 0)
        avg_latency = performance.get("avg_latency", 0)
        
        # Analyze success rate
        if success_rate < 0.9:
            recommendations.append({
                "id": f"rec_{len(recommendations)+1}",
                "type": "improve_routing",
                "priority": "high",
                "reason": f"Success rate is {success_rate:.1%}, below target 90%",
                "action": "Review and optimize routing keywords",
                "impact": "medium",
                "approved": False
            })
        
        # Analyze latency
        if avg_latency > 2.0:
            recommendations.append({
                "id": f"rec_{len(recommendations)+1}",
                "type": "optimize_performance",
                "priority": "medium",
                "reason": f"Average latency is {avg_latency:.2f}s, above target 2.0s",
                "action": "Prioritize faster backends for common tasks",
                "impact": "high",
                "approved": False
            })
        
        # If system is performing well
        if success_rate >= 0.95 and avg_latency <= 2.0:
            recommendations.append({
                "id": f"rec_{len(recommendations)+1}",
                "type": "strengthen_current",
                "priority": "low",
                "reason": f"System performing excellently ({success_rate:.1%} success, {avg_latency:.2f}s latency)",
                "action": "Increase confidence in current routing patterns",
                "impact": "low",
                "approved": False
            })
        
        return recommendations
    
    async def create_morning_summary(self, report):
        """Create a human-readable summary for morning review"""
        summary_file = self.reports_dir / f"MORNING-REPORT-{datetime.now().strftime('%Y%m%d')}.md"
        
        performance = report["analysis"].get("performance", {})
        recommendations = report["recommendations"]
        
        summary = f"""# 🌅 Athena Morning Report - {report['date']}

## 📊 Yesterday's Performance

- **Total Requests**: {performance.get('total_requests', 0)}
- **Success Rate**: {performance.get('success_rate', 0):.1%}
- **Average Latency**: {performance.get('avg_latency', 0):.2f}s
- **Status**: {performance.get('analysis', 'Unknown')}

## 💡 Recommendations ({len(recommendations)} pending your review)

"""
        
        for i, rec in enumerate(recommendations, 1):
            priority_emoji = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(rec["priority"], "⚪")
            summary += f"""
### {i}. {rec['type'].replace('_', ' ').title()} {priority_emoji}

- **Priority**: {rec['priority'].upper()}
- **Reason**: {rec['reason']}
- **Action**: {rec['action']}
- **Impact**: {rec['impact'].upper()}
- **Status**: ⏳ PENDING YOUR APPROVAL

"""
        
        summary += f"""
---

## 🎯 How to Review

### Option 1: Web Interface (Easiest)
```bash
# Open Athena in browser
open http://localhost:3000
# Go to Settings → Evolution → Pending Recommendations
```

### Option 2: Command Line
```bash
# View recommendations
curl http://localhost:8014/api/evolution/recommendations

# Approve a specific recommendation
curl -X POST http://localhost:8014/api/evolution/approve \\
  -H "Content-Type: application/json" \\
  -d '{{"recommendation_id": "rec_1", "approved": true}}'

# Approve all
curl -X POST http://localhost:8014/api/evolution/approve-all

# Reject all
curl -X POST http://localhost:8014/api/evolution/reject-all
```

### Option 3: iPhone
```
# Open Athena app
# Tap Settings → Evolution
# Review and approve/reject
```

---

## 🔐 Safety Features

- ✅ No automatic changes applied
- ✅ All recommendations require approval
- ✅ Each change is reversible
- ✅ History tracked for all approvals
- ✅ You have full control

---

*Next analysis: Tomorrow at 2:00 AM*
*Report generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*
"""
        
        with open(summary_file, 'w') as f:
            f.write(summary)
        
        logger.info("📄 Morning summary saved to: %s", summary_file)
        
        # Also print to console
        print("\n" + "="*60)
        print(summary)
        print("="*60 + "\n")

async def main():
    analyzer = NightlyAnalyzer()
    await analyzer.run_analysis()

if __name__ == "__main__":
    asyncio.run(main())

