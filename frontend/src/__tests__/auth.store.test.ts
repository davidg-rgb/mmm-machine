import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "../store/auth";

describe("useAuthStore", () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  });

  it("starts with unauthenticated state", () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it("setAuth stores user and tokens", () => {
    const mockUser = {
      id: "user-123",
      email: "test@example.com",
      full_name: "Test User",
      role: "admin",
      workspace_id: "ws-456",
    };

    useAuthStore.getState().setAuth(mockUser, "access-tok", "refresh-tok");

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.accessToken).toBe("access-tok");
    expect(state.refreshToken).toBe("refresh-tok");
    expect(state.isAuthenticated).toBe(true);
  });

  it("logout clears all auth state", () => {
    const mockUser = {
      id: "user-123",
      email: "test@example.com",
      full_name: "Test User",
      role: "admin",
      workspace_id: "ws-456",
    };

    // Set auth then logout
    useAuthStore.getState().setAuth(mockUser, "access-tok", "refresh-tok");
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it("setAuth can be called multiple times", () => {
    const user1 = {
      id: "user-1",
      email: "a@example.com",
      full_name: "User A",
      role: "admin",
      workspace_id: "ws-1",
    };
    const user2 = {
      id: "user-2",
      email: "b@example.com",
      full_name: "User B",
      role: "viewer",
      workspace_id: "ws-2",
    };

    useAuthStore.getState().setAuth(user1, "tok-1", "ref-1");
    useAuthStore.getState().setAuth(user2, "tok-2", "ref-2");

    const state = useAuthStore.getState();
    expect(state.user?.id).toBe("user-2");
    expect(state.accessToken).toBe("tok-2");
  });
});
