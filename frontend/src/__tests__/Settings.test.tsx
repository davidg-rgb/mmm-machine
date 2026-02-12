import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import Settings from "../pages/Settings";

// Mock API
const mockGet = vi.fn();
const mockPut = vi.fn();
const mockListInvitations = vi.fn();

vi.mock("../services/api", () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    put: (...args: unknown[]) => mockPut(...args),
    post: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
  createInvite: vi.fn().mockResolvedValue({ id: "inv_1", token: "tok_1", invite_url: "/invite/tok_1", role: "member", expires_at: "" }),
  listInvitations: (...args: unknown[]) => mockListInvitations(...args),
  revokeInvitation: vi.fn().mockResolvedValue(undefined),
  updateMemberRole: vi.fn().mockResolvedValue(undefined),
  removeMember: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("../lib/export", () => ({
  copyToClipboard: vi.fn().mockResolvedValue(true),
}));

const MOCK_WORKSPACE = { id: "ws_001", name: "Test Workspace", created_at: "2025-01-01T00:00:00Z" };
const MOCK_MEMBERS = [
  { id: "usr_001", email: "admin@test.com", full_name: "Admin User", role: "admin", created_at: "2025-01-01T00:00:00Z" },
  { id: "usr_002", email: "member@test.com", full_name: "Team Member", role: "member", created_at: "2025-01-02T00:00:00Z" },
];

function setAuthState(role: "admin" | "member" | "viewer") {
  useAuthStore.setState({
    user: { id: "usr_001", email: "admin@test.com", full_name: "Admin User", role, workspace_id: "ws_001" },
    isAuthenticated: true,
    accessToken: "mock-token",
    refreshToken: "mock-refresh",
  });
}

function renderSettings(role: "admin" | "member" | "viewer" = "admin") {
  setAuthState(role);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockImplementation((url: string) => {
      if (url === "/workspace") return Promise.resolve({ data: MOCK_WORKSPACE });
      if (url === "/workspace/members") return Promise.resolve({ data: MOCK_MEMBERS });
      return Promise.resolve({ data: {} });
    });
    mockListInvitations.mockResolvedValue([]);
  });

  it("renders profile, workspace, and member sections", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Profile")).toBeDefined();
      expect(screen.getByText("Workspace")).toBeDefined();
      expect(screen.getByText("Team Members")).toBeDefined();
    });
  });

  it("displays current user info in profile section", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Admin User")).toBeDefined();
      expect(screen.getByText("admin@test.com")).toBeDefined();
    });
  });

  it("shows workspace name in form", async () => {
    renderSettings();
    await waitFor(() => {
      const input = screen.getByDisplayValue("Test Workspace");
      expect(input).toBeDefined();
    });
  });

  it("shows invite section for admin users", async () => {
    renderSettings("admin");
    await waitFor(() => {
      expect(screen.getAllByText("Invite Member").length).toBeGreaterThan(0);
    });
  });

  it("hides invite section for non-admin users", async () => {
    renderSettings("member");
    await waitFor(() => {
      expect(screen.getByText("Team Members")).toBeDefined();
    });
    expect(screen.queryAllByText("Invite Member")).toHaveLength(0);
  });

  it("renders members list", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Team Member")).toBeDefined();
      expect(screen.getByText("member@test.com")).toBeDefined();
    });
  });

  it("shows 'You' badge on current user", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("You")).toBeDefined();
    });
  });
});
