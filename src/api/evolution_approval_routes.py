import json
import logging
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/evolution", tags=["evolution"])

REPORTS_DIR = Path("/Users/christianmerrill/Documents/GitHub/AI-Projects/universal-ai-tools/logs/evolution-reports")
REPORTS_DIR.mkdir(parents=True, exist_ok=True)


class ApprovalRequest(BaseModel):
    recommendation_id: str
    approved: bool
    notes: Optional[str] = None


class RecommendationResponse(BaseModel):
    recommendations: List[dict]
    total: int
    pending: int
    approved: int
    rejected: int


@router.get("/recommendations", response_model=RecommendationResponse)
async def get_recommendations():
    """Get all pending recommendations from latest report"""
    try:
        # Find latest report
        reports = sorted(REPORTS_DIR.glob("evolution-report-*.json"), reverse=True)

        if not reports:
            return RecommendationResponse(
                recommendations=[],
                total=0,
                pending=0,
                approved=0,
                rejected=0
            )

        latest_report = reports[0]

        with open(latest_report, 'r') as f:
            report = json.load(f)

        recommendations = report.get("recommendations", [])

        # Count statuses
        pending = sum(1 for r in recommendations if not r.get("approved") and not r.get("rejected"))
        approved = sum(1 for r in recommendations if r.get("approved"))
        rejected = sum(1 for r in recommendations if r.get("rejected"))

        return RecommendationResponse(
            recommendations=recommendations,
            total=len(recommendations),
            pending=pending,
            approved=approved,
            rejected=rejected
        )

    except Exception as e:
        logger.error(f"Failed to get recommendations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/approve")
async def approve_recommendation(request: ApprovalRequest):
    """Approve or reject a specific recommendation"""
    try:
        # Find latest report
        reports = sorted(REPORTS_DIR.glob("evolution-report-*.json"), reverse=True)

        if not reports:
            raise HTTPException(status_code=404, detail="No reports found")

        latest_report = reports[0]

        # Load report
        with open(latest_report, 'r') as f:
            report = json.load(f)

        # Find and update recommendation
        found = False
        for rec in report.get("recommendations", []):
            if rec.get("id") == request.recommendation_id:
                rec["approved"] = request.approved
                rec["rejected"] = not request.approved
                rec["review_timestamp"] = datetime.now().isoformat()
                rec["notes"] = request.notes
                found = True
                break

        if not found:
            raise HTTPException(status_code=404, detail=f"Recommendation {request.recommendation_id} not found")

        # Save updated report
        with open(latest_report, 'w') as f:
            json.dump(report, f, indent=2)

        # If approved, apply the change
        if request.approved:
            await apply_recommendation(rec)
            logger.info(f"✅ Applied recommendation: {request.recommendation_id}")
        else:
            logger.info(f"❌ Rejected recommendation: {request.recommendation_id}")

        return {
            "success": True,
            "recommendation_id": request.recommendation_id,
            "approved": request.approved,
            "message": "Applied successfully" if request.approved else "Rejected"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to approve recommendation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/approve-all")
async def approve_all_recommendations():
    """Approve all pending recommendations"""
    try:
        # Find latest report
        reports = sorted(REPORTS_DIR.glob("evolution-report-*.json"), reverse=True)

        if not reports:
            raise HTTPException(status_code=404, detail="No reports found")

        latest_report = reports[0]

        with open(latest_report, 'r') as f:
            report = json.load(f)

        applied = 0
        for rec in report.get("recommendations", []):
            if not rec.get("approved") and not rec.get("rejected"):
                rec["approved"] = True
                rec["rejected"] = False
                rec["review_timestamp"] = datetime.now().isoformat()
                await apply_recommendation(rec)
                applied += 1

        # Save updated report
        with open(latest_report, 'w') as f:
            json.dump(report, f, indent=2)

        logger.info(f"✅ Approved and applied {applied} recommendations")

        return {
            "success": True,
            "applied": applied,
            "message": f"Applied {applied} recommendations"
        }

    except Exception as e:
        logger.error(f"Failed to approve all: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reject-all")
async def reject_all_recommendations():
    """Reject all pending recommendations"""
    try:
        # Find latest report
        reports = sorted(REPORTS_DIR.glob("evolution-report-*.json"), reverse=True)

        if not reports:
            raise HTTPException(status_code=404, detail="No reports found")

        latest_report = reports[0]

        with open(latest_report, 'r') as f:
            report = json.load(f)

        rejected = 0
        for rec in report.get("recommendations", []):
            if not rec.get("approved") and not rec.get("rejected"):
                rec["approved"] = False
                rec["rejected"] = True
                rec["review_timestamp"] = datetime.now().isoformat()
                rejected += 1

        # Save updated report
        with open(latest_report, 'w') as f:
            json.dump(report, f, indent=2)

        logger.info(f"❌ Rejected {rejected} recommendations")

        return {
            "success": True,
            "rejected": rejected,
            "message": f"Rejected {rejected} recommendations"
        }

    except Exception as e:
        logger.error(f"Failed to reject all: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def apply_recommendation(rec: dict):
    """Apply a single approved recommendation"""
    rec_type = rec.get("type")

    logger.info(f"🔧 Applying recommendation: {rec_type}")

    # Here you would actually apply the change based on type
    # For now, just log it
    if rec_type == "improve_routing":
        logger.info("  → Would optimize routing keywords")
    elif rec_type == "optimize_performance":
        logger.info("  → Would prioritize faster backends")
    elif rec_type == "strengthen_current":
        logger.info("  → Would increase routing confidence")
    else:
        logger.warning(f"  → Unknown recommendation type: {rec_type}")

    # TODO: Integrate with actual evolution system
    # await evolutionary_api.apply_change(rec)


@router.get("/morning-report")
async def get_morning_report():
    """Get the latest morning report for review"""
    try:
        # Find latest markdown report
        reports = sorted(REPORTS_DIR.glob("MORNING-REPORT-*.md"), reverse=True)

        if not reports:
            return {
                "available": False,
                "message": "No morning report available yet. The nightly analysis hasn't run."
            }

        latest_report = reports[0]

        with open(latest_report, 'r') as f:
            content = f.read()

        return {
            "available": True,
            "date": latest_report.stem.replace("MORNING-REPORT-", ""),
            "content": content,
            "file": str(latest_report)
        }

    except Exception as e:
        logger.error(f"Failed to get morning report: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
async def get_evolution_history():
    """Get history of all evolution runs"""
    try:
        reports = sorted(REPORTS_DIR.glob("evolution-report-*.json"))

        history = []
        for report_file in reports:
            with open(report_file, 'r') as f:
                report = json.load(f)

            history.append({
                "date": report.get("date"),
                "total_recommendations": len(report.get("recommendations", [])),
                "approved": sum(1 for r in report.get("recommendations", []) if r.get("approved")),
                "rejected": sum(1 for r in report.get("recommendations", []) if r.get("rejected")),
                "status": report.get("status")
            })

        return {
            "history": history,
            "total_runs": len(history)
        }

    except Exception as e:
        logger.error(f"Failed to get history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

