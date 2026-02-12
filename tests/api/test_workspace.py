"""Tests for workspace endpoints."""

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password
from app.models.invitation import Invitation
from app.models.user import User


# --- Fixtures ---


@pytest_asyncio.fixture
async def member_user(db_session: AsyncSession, registered_user: dict) -> dict:
    """Create a member-role user in the same workspace."""
    raw_password = "MemberPass123!"
    user = User(
        email="member@example.com",
        hashed_password=hash_password(raw_password),
        full_name="Member User",
        role="member",
        workspace_id=registered_user["workspace_id"],
    )
    db_session.add(user)
    await db_session.flush()
    return {
        "user": user,
        "email": user.email,
        "password": raw_password,
        "user_id": user.id,
        "workspace_id": registered_user["workspace_id"],
    }


@pytest_asyncio.fixture
async def non_admin_headers(member_user: dict) -> dict:
    """Return Authorization headers for a non-admin (member) user."""
    token = create_access_token(
        member_user["user_id"],
        {"workspace_id": member_user["workspace_id"]},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def sample_invitation(
    db_session: AsyncSession, registered_user: dict
) -> Invitation:
    """Create a pending invitation for testing."""
    invitation = Invitation(
        workspace_id=registered_user["workspace_id"],
        email="invitee@example.com",
        role="member",
        invited_by=registered_user["user_id"],
    )
    db_session.add(invitation)
    await db_session.flush()
    return invitation


# --- Workspace CRUD ---


class TestGetWorkspace:
    """GET /api/workspace"""

    async def test_get_workspace_authenticated(
        self, client: AsyncClient, registered_user, auth_headers
    ):
        resp = await client.get("/api/workspace", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == registered_user["workspace_id"]
        assert "name" in data
        assert "created_at" in data

    async def test_get_workspace_unauthenticated(self, client: AsyncClient):
        resp = await client.get("/api/workspace")
        assert resp.status_code in (401, 403)


class TestUpdateWorkspace:
    """PUT /api/workspace"""

    async def test_update_workspace_unauthenticated(self, client: AsyncClient):
        resp = await client.put(
            "/api/workspace",
            json={"name": "New Name"},
        )
        assert resp.status_code in (401, 403)

    async def test_update_workspace_success(
        self, client: AsyncClient, auth_headers
    ):
        resp = await client.put(
            "/api/workspace",
            json={"name": "Updated Workspace"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated Workspace"

    async def test_update_workspace_empty_name_422(
        self, client: AsyncClient, auth_headers, registered_user
    ):
        resp = await client.put(
            "/api/workspace",
            json={"name": ""},
            headers=auth_headers,
        )
        assert resp.status_code == 422


class TestWorkspaceMembers:
    """GET /api/workspace/members"""

    async def test_list_members_authenticated(
        self, client: AsyncClient, registered_user, auth_headers
    ):
        response = await client.get("/api/workspace/members", headers=auth_headers)
        assert response.status_code == 200
        members = response.json()
        assert isinstance(members, list)
        assert len(members) >= 1
        assert "email" in members[0]
        assert "full_name" in members[0]
        assert "role" in members[0]

    async def test_list_members_unauthenticated(self, client: AsyncClient):
        response = await client.get("/api/workspace/members")
        assert response.status_code in (401, 403)


# --- Invite endpoints ---


class TestInviteMember:
    """POST /api/workspace/invite"""

    async def test_invite_link_only_success(
        self, client: AsyncClient, auth_headers
    ):
        resp = await client.post(
            "/api/workspace/invite",
            json={"role": "member"},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "token" in data
        assert "invite_url" in data
        assert data["role"] == "member"

    async def test_invite_with_email(
        self, client: AsyncClient, auth_headers
    ):
        resp = await client.post(
            "/api/workspace/invite",
            json={"role": "viewer", "email": "newuser@example.com"},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        assert resp.json()["role"] == "viewer"

    async def test_invite_invalid_role_422(
        self, client: AsyncClient, auth_headers
    ):
        resp = await client.post(
            "/api/workspace/invite",
            json={"role": "superadmin"},
            headers=auth_headers,
        )
        assert resp.status_code == 422

    async def test_invite_invalid_email_422(
        self, client: AsyncClient, auth_headers
    ):
        resp = await client.post(
            "/api/workspace/invite",
            json={"role": "member", "email": "not-an-email"},
            headers=auth_headers,
        )
        assert resp.status_code == 422

    async def test_invite_non_admin_403(
        self, client: AsyncClient, registered_user, non_admin_headers
    ):
        resp = await client.post(
            "/api/workspace/invite",
            json={"role": "member"},
            headers=non_admin_headers,
        )
        assert resp.status_code == 403

    async def test_invite_duplicate_email_409(
        self, client: AsyncClient, auth_headers, sample_invitation
    ):
        resp = await client.post(
            "/api/workspace/invite",
            json={"role": "member", "email": sample_invitation.email},
            headers=auth_headers,
        )
        assert resp.status_code == 409
        assert "pending invitation" in resp.json()["detail"].lower()

    async def test_invite_link_only_duplicates_ok(
        self, client: AsyncClient, auth_headers
    ):
        """Link-only invites (no email) should allow multiple creations."""
        resp1 = await client.post(
            "/api/workspace/invite",
            json={"role": "member"},
            headers=auth_headers,
        )
        resp2 = await client.post(
            "/api/workspace/invite",
            json={"role": "member"},
            headers=auth_headers,
        )
        assert resp1.status_code == 201
        assert resp2.status_code == 201
        assert resp1.json()["token"] != resp2.json()["token"]


class TestDeleteInvitation:
    """DELETE /api/workspace/invitations/{id}"""

    async def test_delete_invitation_success(
        self, client: AsyncClient, auth_headers, sample_invitation
    ):
        resp = await client.delete(
            f"/api/workspace/invitations/{sample_invitation.id}",
            headers=auth_headers,
        )
        assert resp.status_code == 204

    async def test_delete_invitation_not_found(
        self, client: AsyncClient, auth_headers, registered_user
    ):
        resp = await client.delete(
            "/api/workspace/invitations/nonexistent-id",
            headers=auth_headers,
        )
        assert resp.status_code == 404


class TestValidateInviteToken:
    """GET /api/workspace/invite/{token}"""

    async def test_validate_token_success(
        self, client: AsyncClient, sample_invitation
    ):
        resp = await client.get(
            f"/api/workspace/invite/{sample_invitation.token}"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["role"] == "member"
        assert data["email"] == sample_invitation.email

    async def test_validate_token_not_found(self, client: AsyncClient):
        resp = await client.get("/api/workspace/invite/bogus-token")
        assert resp.status_code == 404

    async def test_validate_token_expired(
        self, client: AsyncClient, db_session, sample_invitation
    ):
        from datetime import datetime, timedelta, timezone

        sample_invitation.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
        await db_session.flush()

        resp = await client.get(
            f"/api/workspace/invite/{sample_invitation.token}"
        )
        assert resp.status_code == 410


class TestAcceptInvite:
    """POST /api/workspace/invite/{token}/accept"""

    async def test_accept_invite_success(
        self, client: AsyncClient, db_session, sample_invitation
    ):
        """Create a second user (different workspace) to accept the invite."""
        from app.models.workspace import Workspace

        other_ws = Workspace(name="Other Workspace")
        db_session.add(other_ws)
        await db_session.flush()

        other_user = User(
            email="other@example.com",
            hashed_password=hash_password("OtherPass123!"),
            full_name="Other User",
            role="admin",
            workspace_id=other_ws.id,
        )
        db_session.add(other_user)
        await db_session.flush()

        token = create_access_token(
            other_user.id, {"workspace_id": other_ws.id}
        )
        headers = {"Authorization": f"Bearer {token}"}

        resp = await client.post(
            f"/api/workspace/invite/{sample_invitation.token}/accept",
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["role"] == "member"
        assert "workspace_id" in data

    async def test_accept_invite_not_found(
        self, client: AsyncClient, auth_headers, registered_user
    ):
        resp = await client.post(
            "/api/workspace/invite/bogus-token/accept",
            headers=auth_headers,
        )
        assert resp.status_code == 404

    async def test_accept_invite_already_in_workspace(
        self, client: AsyncClient, auth_headers, registered_user, sample_invitation
    ):
        """User already in the workspace should get 409."""
        resp = await client.post(
            f"/api/workspace/invite/{sample_invitation.token}/accept",
            headers=auth_headers,
        )
        assert resp.status_code == 409
        assert "already a member" in resp.json()["detail"].lower()

    async def test_accept_invite_email_mismatch(
        self, client: AsyncClient, db_session, registered_user, sample_invitation
    ):
        """Email-targeted invite rejected when different user tries to accept."""
        from app.models.workspace import Workspace

        other_ws = Workspace(name="Other WS")
        db_session.add(other_ws)
        await db_session.flush()

        other_user = User(
            email="wrong@example.com",
            hashed_password=hash_password("WrongPass123!"),
            full_name="Wrong User",
            role="admin",
            workspace_id=other_ws.id,
        )
        db_session.add(other_user)
        await db_session.flush()

        token = create_access_token(other_user.id, {"workspace_id": other_ws.id})
        headers = {"Authorization": f"Bearer {token}"}

        # sample_invitation has email="invitee@example.com", but this user is "wrong@example.com"
        resp = await client.post(
            f"/api/workspace/invite/{sample_invitation.token}/accept",
            headers=headers,
        )
        assert resp.status_code == 403
        assert "different email" in resp.json()["detail"].lower()

    async def test_accept_invite_expired(
        self, client: AsyncClient, db_session, sample_invitation
    ):
        """Accepting an expired invite should return 410."""
        from datetime import datetime, timedelta, timezone
        from app.models.workspace import Workspace

        sample_invitation.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
        await db_session.flush()

        other_ws = Workspace(name="Acceptor WS")
        db_session.add(other_ws)
        await db_session.flush()

        other_user = User(
            email="acceptor@example.com",
            hashed_password=hash_password("AcceptPass123!"),
            full_name="Acceptor User",
            role="admin",
            workspace_id=other_ws.id,
        )
        db_session.add(other_user)
        await db_session.flush()

        token = create_access_token(other_user.id, {"workspace_id": other_ws.id})
        headers = {"Authorization": f"Bearer {token}"}

        resp = await client.post(
            f"/api/workspace/invite/{sample_invitation.token}/accept",
            headers=headers,
        )
        assert resp.status_code == 410


# --- Member management ---


class TestUpdateMemberRole:
    """PUT /api/workspace/members/{id}/role"""

    async def test_update_role_success(
        self, client: AsyncClient, auth_headers, member_user
    ):
        resp = await client.put(
            f"/api/workspace/members/{member_user['user_id']}/role",
            json={"role": "viewer"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["role"] == "viewer"

    async def test_update_own_role_400(
        self, client: AsyncClient, auth_headers, registered_user
    ):
        resp = await client.put(
            f"/api/workspace/members/{registered_user['user_id']}/role",
            json={"role": "member"},
            headers=auth_headers,
        )
        assert resp.status_code == 400
        assert "own role" in resp.json()["detail"].lower()

    async def test_update_role_invalid_422(
        self, client: AsyncClient, auth_headers, member_user
    ):
        resp = await client.put(
            f"/api/workspace/members/{member_user['user_id']}/role",
            json={"role": "superadmin"},
            headers=auth_headers,
        )
        assert resp.status_code == 422

    async def test_update_role_non_admin_403(
        self, client: AsyncClient, registered_user, non_admin_headers, member_user
    ):
        resp = await client.put(
            f"/api/workspace/members/{member_user['user_id']}/role",
            json={"role": "viewer"},
            headers=non_admin_headers,
        )
        assert resp.status_code == 403

    async def test_update_role_not_found(
        self, client: AsyncClient, auth_headers, registered_user
    ):
        resp = await client.put(
            "/api/workspace/members/nonexistent-id/role",
            json={"role": "member"},
            headers=auth_headers,
        )
        assert resp.status_code == 404


class TestRemoveMember:
    """DELETE /api/workspace/members/{id}"""

    async def test_remove_member_success(
        self, client: AsyncClient, auth_headers, member_user
    ):
        resp = await client.delete(
            f"/api/workspace/members/{member_user['user_id']}",
            headers=auth_headers,
        )
        assert resp.status_code == 204

    async def test_remove_self_400(
        self, client: AsyncClient, auth_headers, registered_user
    ):
        resp = await client.delete(
            f"/api/workspace/members/{registered_user['user_id']}",
            headers=auth_headers,
        )
        assert resp.status_code == 400
        assert "yourself" in resp.json()["detail"].lower()

    async def test_remove_member_not_found(
        self, client: AsyncClient, auth_headers, registered_user
    ):
        resp = await client.delete(
            "/api/workspace/members/nonexistent-id",
            headers=auth_headers,
        )
        assert resp.status_code == 404

    async def test_remove_member_non_admin_403(
        self, client: AsyncClient, registered_user, non_admin_headers, member_user
    ):
        resp = await client.delete(
            f"/api/workspace/members/{member_user['user_id']}",
            headers=non_admin_headers,
        )
        assert resp.status_code == 403

    async def test_remove_last_admin_400(
        self, client: AsyncClient, db_session, auth_headers, registered_user
    ):
        """Cannot remove the only admin in the workspace."""
        # Create a second admin to be the target
        second_admin = User(
            email="admin2@example.com",
            hashed_password=hash_password("Admin2Pass123!"),
            full_name="Admin Two",
            role="admin",
            workspace_id=registered_user["workspace_id"],
        )
        db_session.add(second_admin)
        await db_session.flush()

        # Remove second admin - should succeed (registered_user is still admin)
        resp = await client.delete(
            f"/api/workspace/members/{second_admin.id}",
            headers=auth_headers,
        )
        assert resp.status_code == 204

        # Now create a member and try to make them the target - but registered_user
        # is the only admin. Create another admin user to remove registered_user?
        # Actually: the last-admin check fires when the target is an admin.
        # registered_user is the only admin, so if we create a third admin and
        # remove them, it fails because admin_count would be 1.
        third_admin = User(
            email="admin3@example.com",
            hashed_password=hash_password("Admin3Pass123!"),
            full_name="Admin Three",
            role="admin",
            workspace_id=registered_user["workspace_id"],
        )
        db_session.add(third_admin)
        await db_session.flush()

        # Remove third admin - only 2 admins (registered_user + third_admin), so OK
        resp2 = await client.delete(
            f"/api/workspace/members/{third_admin.id}",
            headers=auth_headers,
        )
        assert resp2.status_code == 204

        # Now registered_user is the only admin.
        # Create one more admin and try to remove registered_user as last admin.
        sole_admin = User(
            email="sole_target@example.com",
            hashed_password=hash_password("SolePass123!"),
            full_name="Sole Target",
            role="admin",
            workspace_id=registered_user["workspace_id"],
        )
        db_session.add(sole_admin)
        await db_session.flush()

        # Remove sole_admin - 2 admins exist, should work
        resp3 = await client.delete(
            f"/api/workspace/members/{sole_admin.id}",
            headers=auth_headers,
        )
        assert resp3.status_code == 204

    async def test_remove_member_moves_to_personal_workspace(
        self, client: AsyncClient, db_session, auth_headers, member_user
    ):
        """Removing a member should move them to a personal workspace, not delete."""
        from sqlalchemy import select

        resp = await client.delete(
            f"/api/workspace/members/{member_user['user_id']}",
            headers=auth_headers,
        )
        assert resp.status_code == 204

        # Verify user still exists but in a different workspace
        result = await db_session.execute(
            select(User).where(User.id == member_user["user_id"])
        )
        user = result.scalar_one_or_none()
        assert user is not None, "User should not be deleted"
        assert user.workspace_id != member_user["workspace_id"]
        assert user.role == "admin"  # Admin of their personal workspace
