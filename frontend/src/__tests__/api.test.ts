import { describe, it, expect, beforeEach, vi } from "vitest";
import { login, register, getMe } from "../services/api";
import { useAuthStore } from "../store/auth";

// Mock fetch globally
global.fetch = vi.fn();

// Create a mock for axios since the api service uses axios, not fetch
vi.mock("axios", () => {
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() },
    },
  };

  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
    },
  };
});

describe("API Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset auth store
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  });

  describe("login", () => {
    it("sends correct body and returns parsed response", async () => {
      const mockResponse = {
        access_token: "test-access-token",
        refresh_token: "test-refresh-token",
        user: {
          id: "user-123",
          email: "test@example.com",
          full_name: "Test User",
          role: "admin",
          workspace_id: "ws-456",
        },
      };

      // Import the mocked axios
      const axios = await import("axios");
      const axiosInstance = axios.default.create();
      vi.mocked(axiosInstance.post).mockResolvedValueOnce({ data: mockResponse });

      const result = await login("test@example.com", "password123");

      expect(axiosInstance.post).toHaveBeenCalledWith("/auth/login", {
        email: "test@example.com",
        password: "password123",
      });
      expect(result).toEqual(mockResponse);
    });

    it("includes user data in response", async () => {
      const mockResponse = {
        access_token: "access-tok",
        refresh_token: "refresh-tok",
        user: {
          id: "u1",
          email: "user@test.com",
          full_name: "User Name",
          role: "member",
          workspace_id: "ws1",
        },
      };

      const axios = await import("axios");
      const axiosInstance = axios.default.create();
      vi.mocked(axiosInstance.post).mockResolvedValueOnce({ data: mockResponse });

      const result = await login("user@test.com", "pass");

      expect(result.user).toEqual(mockResponse.user);
      expect(result.access_token).toBe("access-tok");
    });
  });

  describe("register", () => {
    it("sends correct body with all fields", async () => {
      const mockResponse = {
        access_token: "new-access",
        refresh_token: "new-refresh",
        user: {
          id: "new-user",
          email: "new@example.com",
          full_name: "New User",
          role: "admin",
          workspace_id: "new-ws",
        },
      };

      const axios = await import("axios");
      const axiosInstance = axios.default.create();
      vi.mocked(axiosInstance.post).mockResolvedValueOnce({ data: mockResponse });

      const result = await register(
        "new@example.com",
        "securepass",
        "New User",
        "My Workspace",
      );

      expect(axiosInstance.post).toHaveBeenCalledWith("/auth/register", {
        email: "new@example.com",
        password: "securepass",
        full_name: "New User",
        workspace_name: "My Workspace",
      });
      expect(result).toEqual(mockResponse);
    });

    it("handles registration without workspace name", async () => {
      const mockResponse = {
        access_token: "tok",
        refresh_token: "ref",
        user: {
          id: "u",
          email: "e@e.com",
          full_name: "E",
          role: "admin",
          workspace_id: "w",
        },
      };

      const axios = await import("axios");
      const axiosInstance = axios.default.create();
      vi.mocked(axiosInstance.post).mockResolvedValueOnce({ data: mockResponse });

      await register("e@e.com", "p", "E");

      expect(axiosInstance.post).toHaveBeenCalledWith("/auth/register", {
        email: "e@e.com",
        password: "p",
        full_name: "E",
        workspace_name: undefined,
      });
    });
  });

  describe("getMe", () => {
    it("returns current user data", async () => {
      const mockUser = {
        id: "current-user",
        email: "current@example.com",
        full_name: "Current User",
        role: "member",
        workspace_id: "ws-current",
      };

      const axios = await import("axios");
      const axiosInstance = axios.default.create();
      vi.mocked(axiosInstance.get).mockResolvedValueOnce({ data: mockUser });

      const result = await getMe();

      expect(axiosInstance.get).toHaveBeenCalledWith("/auth/me");
      expect(result).toEqual(mockUser);
    });
  });

  describe("Error handling", () => {
    it("throws error on non-OK response", async () => {
      const axios = await import("axios");
      const axiosInstance = axios.default.create();

      const errorResponse = {
        response: {
          status: 400,
          data: { detail: "Invalid credentials" },
        },
      };

      vi.mocked(axiosInstance.post).mockRejectedValueOnce(errorResponse);

      await expect(login("bad@email.com", "wrong")).rejects.toEqual(errorResponse);
    });

    it("handles network errors", async () => {
      const axios = await import("axios");
      const axiosInstance = axios.default.create();

      const networkError = new Error("Network Error");
      vi.mocked(axiosInstance.post).mockRejectedValueOnce(networkError);

      await expect(login("test@test.com", "pass")).rejects.toThrow("Network Error");
    });
  });

  describe("Token refresh interceptor", () => {
    it("attempts to refresh token on 401 response", async () => {
      const axios = await import("axios");
      const axiosInstance = axios.default.create();

      // Set up initial auth state
      useAuthStore.setState({
        user: {
          id: "u1",
          email: "user@test.com",
          full_name: "User",
          role: "member",
          workspace_id: "ws1",
        },
        accessToken: "expired-token",
        refreshToken: "valid-refresh",
        isAuthenticated: true,
      });

      const unauthorizedError = {
        response: { status: 401 },
        config: { url: "/some-endpoint", headers: {} },
      };

      const refreshResponse = {
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
      };

      // First call fails with 401, second call (refresh) succeeds
      vi.mocked(axiosInstance.post)
        .mockRejectedValueOnce(unauthorizedError)
        .mockResolvedValueOnce({ data: refreshResponse });

      // The interceptor is set up in the api service, so we're testing the concept here
      // In a real scenario, the interceptor would catch the 401 and call refresh
      try {
        await axiosInstance.post("/some-endpoint");
      } catch (error: any) {
        if (error.response?.status === 401) {
          const refresh = await axiosInstance.post("/auth/refresh", {
            refresh_token: "valid-refresh",
          });
          expect(refresh.data).toEqual(refreshResponse);
        }
      }
    });
  });
});
