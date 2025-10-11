"""
Users router
"""

from typing import List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class User(BaseModel):
    id: int
    name: str
    email: str
    active: bool = True


# Mock data
users_db = [
    User(id=1, name="Alice", email="alice@example.com"),
    User(id=2, name="Bob", email="bob@example.com"),
]


@router.get("/")
async def list_users() -> List[User]:
    """List all users"""
    return users_db


@router.get("/{user_id}")
async def get_user(user_id: int) -> User:
    """Get user by ID"""
    for user in users_db:
        if user.id == user_id:
            return user
    raise HTTPException(status_code=404, detail="User not found")


@router.post("/")
async def create_user(user: User) -> User:
    """Create a new user"""
    users_db.append(user)
    return user

