from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, require_role
from app.core.database import get_db
from app.models.invitation import Invitation
from app.models.user import User
from app.models.workspace import Workspace
from app.schemas.workspace import (
    InvitationResponse,
    InviteRequest,
    InviteResponse,
    MemberResponse,
    UpdateMemberRoleRequest,
    WorkspaceResponse,
    WorkspaceUpdate,
)

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
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
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


@router.get("/members", response_model=list[MemberResponse])
async def list_members(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.workspace_id == current_user.workspace_id)
    )
    users = result.scalars().all()
    return [
        MemberResponse(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            role=u.role,
            created_at=u.created_at.isoformat() if u.created_at else "",
        )
        for u in users
    ]


# --- Invite endpoints ---


@router.post("/invite", response_model=InviteResponse, status_code=status.HTTP_201_CREATED)
async def invite_member(
    body: InviteRequest,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    if body.email:
        existing = await db.execute(
            select(Invitation).where(
                Invitation.workspace_id == current_user.workspace_id,
                Invitation.email == body.email,
                Invitation.status == "pending",
                Invitation.expires_at > datetime.now(timezone.utc),
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A pending invitation already exists for this email",
            )

    invitation = Invitation(
        workspace_id=current_user.workspace_id,
        email=body.email,
        role=body.role,
        invited_by=current_user.id,
    )
    db.add(invitation)
    await db.flush()

    return InviteResponse(
        id=invitation.id,
        token=invitation.token,
        invite_url=f"/invite/{invitation.token}",
        role=invitation.role,
        expires_at=invitation.expires_at.isoformat(),
    )


@router.get("/invitations", response_model=list[InvitationResponse])
async def list_invitations(
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Invitation).where(
            Invitation.workspace_id == current_user.workspace_id,
            Invitation.status == "pending",
            Invitation.expires_at > datetime.now(timezone.utc),
        )
    )
    invitations = result.scalars().all()
    return [
        InvitationResponse(
            id=inv.id,
            email=inv.email,
            role=inv.role,
            status=inv.status,
            invited_by=inv.invited_by,
            expires_at=inv.expires_at.isoformat(),
            created_at=inv.created_at.isoformat(),
        )
        for inv in invitations
    ]


@router.delete("/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_invitation(
    invitation_id: str,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Invitation).where(
            Invitation.id == invitation_id,
            Invitation.workspace_id == current_user.workspace_id,
        )
    )
    invitation = result.scalar_one_or_none()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")

    await db.delete(invitation)


@router.get("/invite/{token}")
async def validate_invite_token(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint - no auth required. Validates an invite token."""
    result = await db.execute(
        select(Invitation).where(
            Invitation.token == token,
            Invitation.status == "pending",
        )
    )
    invitation = result.scalar_one_or_none()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found or already used")

    if invitation.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Invitation has expired")

    # Get workspace name
    ws_result = await db.execute(
        select(Workspace).where(Workspace.id == invitation.workspace_id)
    )
    workspace = ws_result.scalar_one_or_none()

    return {
        "id": invitation.id,
        "workspace_name": workspace.name if workspace else "Unknown",
        "role": invitation.role,
        "email": invitation.email,
        "expires_at": invitation.expires_at.isoformat(),
    }


@router.post("/invite/{token}/accept")
async def accept_invite(
    token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Authenticated endpoint - accepts an invite and moves user to workspace."""
    result = await db.execute(
        select(Invitation).where(
            Invitation.token == token,
            Invitation.status == "pending",
        )
    )
    invitation = result.scalar_one_or_none()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found or already used")

    if invitation.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Invitation has expired")

    # Prevent accepting if already in this workspace
    if current_user.workspace_id == invitation.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already a member of this workspace",
        )

    # Email-targeted invites can only be accepted by the matching user
    if invitation.email and invitation.email != current_user.email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invitation was sent to a different email address",
        )

    # Update user's workspace and role
    current_user.workspace_id = invitation.workspace_id
    current_user.role = invitation.role

    # Mark invitation as accepted
    invitation.status = "accepted"

    await db.flush()

    return {
        "detail": "Invitation accepted",
        "workspace_id": invitation.workspace_id,
        "role": invitation.role,
    }


# --- Member management endpoints ---


@router.put("/members/{user_id}/role", response_model=MemberResponse)
async def update_member_role(
    user_id: str,
    body: UpdateMemberRoleRequest,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.workspace_id == current_user.workspace_id,
        )
    )
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found in workspace")

    # If demoting an admin, check they're not the last admin
    if target_user.role == "admin" and body.role != "admin":
        admin_count_result = await db.execute(
            select(func.count()).select_from(User).where(
                User.workspace_id == current_user.workspace_id,
                User.role == "admin",
            )
        )
        admin_count = admin_count_result.scalar()
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot demote the last admin")

    target_user.role = body.role
    await db.flush()

    return MemberResponse(
        id=target_user.id,
        email=target_user.email,
        full_name=target_user.full_name,
        role=target_user.role,
        created_at=target_user.created_at.isoformat() if target_user.created_at else "",
    )


@router.delete("/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    user_id: str,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself")

    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.workspace_id == current_user.workspace_id,
        )
    )
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found in workspace")

    # Prevent removing the last admin
    if target_user.role == "admin":
        admin_count_result = await db.execute(
            select(func.count()).select_from(User).where(
                User.workspace_id == current_user.workspace_id,
                User.role == "admin",
            )
        )
        admin_count = admin_count_result.scalar()
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot remove the last admin")

    # Move user to a personal workspace instead of deleting their account
    personal_ws = Workspace(name=f"{target_user.full_name}'s Workspace")
    db.add(personal_ws)
    await db.flush()
    target_user.workspace_id = personal_ws.id
    target_user.role = "admin"
