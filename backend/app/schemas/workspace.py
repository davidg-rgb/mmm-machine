from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class WorkspaceResponse(BaseModel):
    id: str
    name: str
    created_at: str

    model_config = {"from_attributes": True}


class WorkspaceUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class InviteRequest(BaseModel):
    role: Literal["admin", "member", "viewer"] = "member"
    email: EmailStr | None = None


class InviteResponse(BaseModel):
    id: str
    token: str
    invite_url: str
    role: str
    expires_at: str


class InvitationResponse(BaseModel):
    id: str
    email: str | None
    role: str
    status: str
    invited_by: str
    expires_at: str
    created_at: str

    model_config = {"from_attributes": True}


class UpdateMemberRoleRequest(BaseModel):
    role: Literal["admin", "member", "viewer"]


class MemberResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    created_at: str

    model_config = {"from_attributes": True}
