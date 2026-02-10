from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.models.user import User
from app.models.workspace import Workspace
from app.schemas.workspace import WorkspaceResponse, WorkspaceUpdate

router = APIRouter(prefix="/workspace", tags=["workspace"])


@router.get("", response_model=WorkspaceResponse)
async def get_workspace(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Workspace).where(Workspace.id == current_user.workspace_id)
    )
    workspace = result.scalar_one_or_none()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    return WorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        created_at=workspace.created_at.isoformat(),
    )


@router.put("", response_model=WorkspaceResponse)
async def update_workspace(
    body: WorkspaceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    result = await db.execute(
        select(Workspace).where(Workspace.id == current_user.workspace_id)
    )
    workspace = result.scalar_one_or_none()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    workspace.name = body.name
    await db.flush()

    return WorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        created_at=workspace.created_at.isoformat(),
    )


@router.get("/members")
async def list_members(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.workspace_id == current_user.workspace_id)
    )
    users = result.scalars().all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role,
        }
        for u in users
    ]


@router.post("/invite", status_code=202)
async def invite_member(
    current_user: User = Depends(get_current_user),
):
    """Stub for workspace member invitation (Phase 2)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    return {"detail": "Invitation feature coming soon"}
