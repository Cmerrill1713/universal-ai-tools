"""
Grade Record for training pipelines
"""

from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel


class GradeRecord(BaseModel):
    """Record of a grading/evaluation result"""

    id: str
    timestamp: datetime = datetime.now()
    score: float
    max_score: float = 1.0
    passed: bool = False
    feedback: Optional[str] = None
    metadata: Dict[str, Any] = {}

    def __init__(self, **data):
        super().__init__(**data)
        # Auto-calculate passed if not provided
        if 'passed' not in data:
            self.passed = self.score >= (self.max_score * 0.7)

    @property
    def percentage(self) -> float:
        """Get score as percentage"""
        if self.max_score == 0:
            return 0.0
        return (self.score / self.max_score) * 100

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat(),
            "score": self.score,
            "max_score": self.max_score,
            "percentage": self.percentage,
            "passed": self.passed,
            "feedback": self.feedback,
            "metadata": self.metadata,
        }

