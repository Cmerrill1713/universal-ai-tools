#!/usr/bin/env python3
"""
Login Notifier - Shows evolution report window on login
Checks for pending recommendations and displays them
"""

import json
import subprocess
from datetime import datetime
from pathlib import Path


class EvolutionNotifier:
    def __init__(self):
        self.reports_dir = Path("/Users/christianmerrill/Documents/GitHub/AI-Projects/universal-ai-tools/logs/evolution-reports")

    def check_pending_reports(self):
        """Check if there are pending evolution reports"""
        if not self.reports_dir.exists():
            return None

        # Find latest report
        reports = sorted(self.reports_dir.glob("evolution-report-*.json"), reverse=True)

        if not reports:
            return None

        latest_report = reports[0]

        with open(latest_report, 'r') as f:
            report = json.load(f)

        # Check if there are pending recommendations
        recommendations = report.get("recommendations", [])
        pending = [r for r in recommendations if not r.get("approved") and not r.get("rejected")]

        if not pending:
            return None

        return {
            "report_file": str(latest_report),
            "date": report.get("date"),
            "pending_count": len(pending),
            "recommendations": pending,
            "report": report
        }

    def show_notification_window(self, pending_info):
        """Show macOS notification and open review window"""
        if not pending_info:
            return

        count = pending_info["pending_count"]
        date = pending_info["date"]

        # Create AppleScript to show dialog
        script = f'''
        tell application "System Events"
            set frontApp to name of first application process whose frontmost is true
        end tell
        
        display dialog "🌅 Athena Evolution Report Ready!

{count} recommendation(s) pending your review from {date}

The system analyzed yesterday's performance and has suggestions to improve.

Would you like to review them now?" ¬
            buttons {{"Later", "Review in Browser", "Show Report"}} ¬
            default button "Review in Browser" ¬
            with title "Athena Morning Report" ¬
            with icon note ¬
            giving up after 300
        
        set userChoice to button returned of result
        
        if userChoice is "Review in Browser" then
            do shell script "open http://localhost:3000#/evolution/review"
        else if userChoice is "Show Report" then
            do shell script "open {self.reports_dir}/MORNING-REPORT-{datetime.now().strftime('%Y%m%d')}.md"
        end if
        
        tell application frontApp to activate
        '''

        try:
            subprocess.run(['osascript', '-e', script], check=False, capture_output=True)
        except Exception as e:
            print(f"Failed to show dialog: {e}")
            # Fallback to terminal notification
            self.show_terminal_notification(pending_info)

    def show_terminal_notification(self, pending_info):
        """Show notification in terminal if GUI fails"""
        count = pending_info["pending_count"]
        date = pending_info["date"]
        recommendations = pending_info["recommendations"]

        print("\n" + "="*70)
        print(f"🌅 ATHENA MORNING REPORT - {date}")
        print("="*70)
        print(f"\n📊 {count} Recommendation(s) Pending Your Review:\n")

        for i, rec in enumerate(recommendations, 1):
            priority = rec.get("priority", "unknown").upper()
            priority_emoji = {"HIGH": "🔴", "MEDIUM": "🟡", "LOW": "🟢"}.get(priority, "⚪")

            print(f"{i}. {rec.get('type', 'unknown').replace('_', ' ').title()} {priority_emoji}")
            print(f"   Priority: {priority}")
            print(f"   Reason: {rec.get('reason', 'N/A')}")
            print(f"   Action: {rec.get('action', 'N/A')}")
            print(f"   Impact: {rec.get('impact', 'unknown').upper()}")
            print()

        print("="*70)
        print("\n🎯 Review Options:")
        print("  • Web: http://localhost:3000#/evolution/review")
        print("  • iPhone: Open Athena app → Settings → Evolution")
        print("  • CLI: curl http://localhost:8014/api/evolution/recommendations")
        print("\n" + "="*70 + "\n")

    def run(self):
        """Main entry point"""
        pending = self.check_pending_reports()

        if pending:
            print(f"\n🔔 Found {pending['pending_count']} pending evolution recommendations!")
            self.show_notification_window(pending)
        else:
            print("✅ No pending evolution reports")


if __name__ == "__main__":
    notifier = EvolutionNotifier()
    notifier.run()

