"""
Tasks router
"""

from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()


class Task(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    completed: bool = False
    created_at: str = datetime.now().isoformat()


# Mock data
tasks_db = [
    Task(id=1, title="Setup Python paths", description="Configure sitecustomize.py"),
    Task(id=2, title="Update Dockerfile", description="Add PYTHONPATH environment variable"),
]


@router.get("/")
async def list_tasks() -> List[Task]:
    """List all tasks"""
    return tasks_db


@router.get("/{task_id}")
async def get_task(task_id: int) -> Task:
    """Get task by ID"""
    for task in tasks_db:
        if task.id == task_id:
            return task
    raise HTTPException(status_code=404, detail="Task not found")


@router.post("/")
async def create_task(task: Task) -> Task:
    """Create a new task"""
    tasks_db.append(task)
    return task


@router.put("/{task_id}/complete")
async def complete_task(task_id: int) -> Task:
    """Mark task as completed"""
    for task in tasks_db:
        if task.id == task_id:
            task.completed = True
            return task
    raise HTTPException(status_code=404, detail="Task not found")

