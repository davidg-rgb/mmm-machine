import { useState } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuthStore } from "@/store/auth";
import { User, Building2, Users, Save } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Skeleton,
} from "@/components/shared";
import toast from "react-hot-toast";
import api from "@/services/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface WorkspaceData {
  id: string;
  name: string;
  created_at: string;
}

interface MemberData {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

export default function Settings() {
  usePageTitle("Settings");
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [workspaceName, setWorkspaceName] = useState("");
  const [initialized, setInitialized] = useState(false);

  const { data: workspace, isLoading: wsLoading } = useQuery<WorkspaceData>({
    queryKey: ["workspace"],
    queryFn: async () => {
      const { data } = await api.get("/workspace");
      return data;
    },
  });

  const { data: members, isLoading: membersLoading } = useQuery<MemberData[]>({
    queryKey: ["workspace-members"],
    queryFn: async () => {
      const { data } = await api.get("/workspace/members");
      return data;
    },
  });

  // Initialize workspace name from fetched data
  if (workspace && !initialized) {
    setWorkspaceName(workspace.name);
    setInitialized(true);
  }

  const updateWorkspace = useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.put("/workspace", { name });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
      toast.success("Workspace updated");
    },
    onError: () => toast.error("Failed to update workspace"),
  });

  function handleSaveWorkspace(e: React.FormEvent) {
    e.preventDefault();
    if (workspaceName.trim()) {
      updateWorkspace.mutate(workspaceName.trim());
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your profile and workspace
        </p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-gray-500" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <p className="mt-1 text-sm text-gray-900">
                {user?.full_name ?? "—"}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <p className="mt-1 text-sm text-gray-900">
                {user?.email ?? "—"}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Role
              </label>
              <Badge variant="brand">{user?.role ?? "—"}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workspace Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-gray-500" />
            Workspace
          </CardTitle>
        </CardHeader>
        <CardContent>
          {wsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <form onSubmit={handleSaveWorkspace} className="space-y-4">
              <div>
                <label
                  htmlFor="workspace-name"
                  className="block text-sm font-medium text-gray-700"
                >
                  Workspace Name
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    id="workspace-name"
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    placeholder="My Workspace"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={
                      updateWorkspace.isPending ||
                      workspaceName.trim() === workspace?.name
                    }
                  >
                    <Save className="h-4 w-4" />
                    Save
                  </Button>
                </div>
              </div>
              {workspace?.created_at && (
                <p className="text-xs text-gray-400">
                  Created{" "}
                  {new Date(workspace.created_at).toLocaleDateString()}
                </p>
              )}
            </form>
          )}
        </CardContent>
      </Card>

      {/* Members Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-gray-500" />
            Team Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : !members || members.length === 0 ? (
            <p className="text-sm text-gray-400">No team members found.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-medium text-brand-700">
                    {member.full_name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {member.full_name}
                    </p>
                    <p className="truncate text-xs text-gray-400">
                      {member.email}
                    </p>
                  </div>
                  <Badge
                    variant={
                      member.role === "admin" ? "brand" : "default"
                    }
                  >
                    {member.role}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
