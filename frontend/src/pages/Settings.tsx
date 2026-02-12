import { useState } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuthStore } from "@/store/auth";
import { User, Building2, Users, Save, Copy, UserPlus, Trash2, Link2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Skeleton,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/shared";
import toast from "react-hot-toast";
import api, {
  createInvite,
  listInvitations,
  revokeInvitation,
  updateMemberRole,
  removeMember,
} from "@/services/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { copyToClipboard } from "@/lib/export";
import type { Invitation } from "@/types";

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

  // Invite form state
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteEmail, setInviteEmail] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");

  const isAdmin = user?.role === "admin";

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

  const { data: invitations } = useQuery<Invitation[]>({
    queryKey: ["workspace-invitations"],
    queryFn: listInvitations,
    enabled: isAdmin,
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

  const createInviteMutation = useMutation({
    mutationFn: async () => {
      return createInvite(inviteRole, inviteEmail || undefined);
    },
    onSuccess: (data) => {
      const fullUrl = `${window.location.origin}${data.invite_url}`;
      setGeneratedLink(fullUrl);
      queryClient.invalidateQueries({ queryKey: ["workspace-invitations"] });
      toast.success("Invite link generated");
    },
    onError: () => toast.error("Failed to create invite"),
  });

  const revokeMutation = useMutation({
    mutationFn: revokeInvitation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-invitations"] });
      toast.success("Invitation revoked");
    },
    onError: () => toast.error("Failed to revoke invitation"),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      updateMemberRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-members"] });
      toast.success("Role updated");
    },
    onError: () => toast.error("Failed to update role"),
  });

  const removeMemberMutation = useMutation({
    mutationFn: removeMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-members"] });
      toast.success("Member removed");
    },
    onError: () => toast.error("Failed to remove member"),
  });

  function handleSaveWorkspace(e: React.FormEvent) {
    e.preventDefault();
    if (workspaceName.trim()) {
      updateWorkspace.mutate(workspaceName.trim());
    }
  }

  function handleGenerateLink() {
    setGeneratedLink("");
    createInviteMutation.mutate();
  }

  async function handleCopyLink() {
    const ok = await copyToClipboard(generatedLink);
    if (ok) {
      toast.success("Link copied to clipboard");
    } else {
      toast.error("Failed to copy link");
    }
  }

  function handleRemoveMember(memberId: string, memberName: string) {
    if (window.confirm(`Remove ${memberName} from this workspace?`)) {
      removeMemberMutation.mutate(memberId);
    }
  }

  const pendingInvitations = invitations?.filter((inv) => inv.status === "pending") ?? [];

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
              <p className="block text-sm font-medium text-gray-700">
                Full Name
              </p>
              <p className="mt-1 text-sm text-gray-900">
                {user?.full_name ?? "\u2014"}
              </p>
            </div>
            <div>
              <p className="block text-sm font-medium text-gray-700">
                Email
              </p>
              <p className="mt-1 text-sm text-gray-900">
                {user?.email ?? "\u2014"}
              </p>
            </div>
            <div>
              <p className="block text-sm font-medium text-gray-700">
                Role
              </p>
              <Badge variant="brand">{user?.role ?? "\u2014"}</Badge>
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

      {/* Invite Section - admin only */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-gray-500" />
              Invite Member
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!showInviteForm ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowInviteForm(true)}
              >
                <UserPlus className="h-4 w-4" />
                Invite Member
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label
                      htmlFor="invite-email"
                      className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                      Email{" "}
                      <span className="font-normal text-gray-400">
                        (optional)
                      </span>
                    </label>
                    <input
                      id="invite-email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      placeholder="colleague@company.com"
                    />
                  </div>
                  <div className="w-full sm:w-36">
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Role
                    </label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleGenerateLink}
                    disabled={createInviteMutation.isPending}
                  >
                    <Link2 className="h-4 w-4" />
                    {createInviteMutation.isPending
                      ? "Generating..."
                      : "Generate Link"}
                  </Button>
                </div>

                {generatedLink && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="mb-1.5 text-xs font-medium text-gray-500">
                      Share this invite link:
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={generatedLink}
                        className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyLink}
                      >
                        <Copy className="h-4 w-4" />
                        Copy
                      </Button>
                    </div>
                  </div>
                )}

                {pendingInvitations.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-sm font-medium text-gray-700">
                      Pending Invitations
                    </p>
                    <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                      {pendingInvitations.map((inv) => (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-gray-900">
                              {inv.email ?? "Anyone with link"}
                            </p>
                            <p className="text-xs text-gray-400">
                              {inv.role} &middot; expires{" "}
                              {new Date(inv.expires_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => revokeMutation.mutate(inv.id)}
                            disabled={revokeMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
              {members.map((member) => {
                const isSelf = member.id === user?.id;
                return (
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
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {member.full_name}
                        {isSelf && (
                          <Badge variant="info" className="ml-2">
                            You
                          </Badge>
                        )}
                      </p>
                      <p className="truncate text-xs text-gray-400">
                        {member.email}
                      </p>
                    </div>
                    {isAdmin && !isSelf ? (
                      <div className="flex items-center gap-2">
                        <Select
                          value={member.role}
                          onValueChange={(role) =>
                            updateRoleMutation.mutate({
                              userId: member.id,
                              role,
                            })
                          }
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleRemoveMember(member.id, member.full_name)
                          }
                          disabled={removeMemberMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ) : (
                      <Badge
                        variant={
                          member.role === "admin" ? "brand" : "default"
                        }
                      >
                        {member.role}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
