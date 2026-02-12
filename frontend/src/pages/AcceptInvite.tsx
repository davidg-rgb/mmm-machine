import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { getInviteInfo, acceptInvite, getMe, register } from "@/services/api";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Eye, EyeOff, Check, X } from "lucide-react";
import { Button, Spinner } from "@/components/shared";
import toast from "react-hot-toast";

interface FieldErrors {
  fullName?: string;
  email?: string;
  password?: string;
}

const passwordRules = [
  { test: (p: string) => p.length >= 8, label: "At least 8 characters" },
  { test: (p: string) => /[A-Z]/.test(p), label: "One uppercase letter" },
  { test: (p: string) => /[0-9]/.test(p), label: "One number" },
];

export default function AcceptInvite() {
  usePageTitle("Accept Invitation");
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setAuth = useAuthStore((s) => s.setAuth);
  const logout = useAuthStore((s) => s.logout);

  // Register form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);

  const {
    data: inviteInfo,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["invite-info", token],
    queryFn: () => getInviteInfo(token!),
    enabled: !!token,
    retry: false,
  });

  function validate(): boolean {
    const errors: FieldErrors = {};
    if (!fullName.trim()) {
      errors.fullName = "Full name is required";
    }
    if (!email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Enter a valid email address";
    }
    if (!password) {
      errors.password = "Password is required";
    } else if (!passwordRules.every((r) => r.test(password))) {
      errors.password = "Password does not meet requirements";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function clearFieldError(field: keyof FieldErrors) {
    if (fieldErrors[field]) {
      setFieldErrors((p) => ({ ...p, [field]: undefined }));
    }
  }

  async function handleJoinWorkspace() {
    if (!token) return;
    setJoining(true);
    try {
      await acceptInvite(token);
      // Refresh user data so auth store has the new workspace/role
      const updatedUser = await getMe();
      const currentAccessToken = useAuthStore.getState().accessToken;
      const currentRefreshToken = useAuthStore.getState().refreshToken;
      if (currentAccessToken && currentRefreshToken) {
        setAuth(updatedUser, currentAccessToken, currentRefreshToken);
      }
      toast.success("Joined workspace successfully!");
      navigate("/");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail?.includes("already a member")) {
        toast.error("You are already a member of this workspace.");
      } else {
        toast.error("Failed to join workspace. The invite may have expired.");
      }
    } finally {
      setJoining(false);
    }
  }

  async function handleRegisterAndJoin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await register(email, password, fullName, undefined, token);
      setAuth(res.user, res.access_token, res.refresh_token);
      toast.success("Account created and joined workspace!");
      navigate("/");
    } catch {
      setError("Registration failed. Email may already be in use.");
    } finally {
      setLoading(false);
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Spinner size="lg" />
      </div>
    );
  }

  // Error / expired state
  if (isError || !inviteInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-600">
            <X className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            Invalid or Expired Invitation
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            This invitation link is no longer valid. It may have expired or been
            revoked.
          </p>
          <Link
            to="/register"
            className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Create a new account instead
          </Link>
        </div>
      </div>
    );
  }

  // Logged in - show join button
  if (isAuthenticated && user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white">
              <BarChart3 className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Join {inviteInfo.workspace_name}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              You have been invited to join as{" "}
              <span className="font-medium text-gray-700">
                {inviteInfo.role}
              </span>
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="mb-4 text-sm text-gray-600">
              Logged in as{" "}
              <span className="font-medium text-gray-900">{user.email}</span>
            </p>
            <Button
              className="w-full"
              onClick={handleJoinWorkspace}
              disabled={joining}
            >
              {joining ? "Joining..." : "Join Workspace"}
            </Button>
            <button
              type="button"
              onClick={logout}
              className="mt-3 block w-full text-center text-sm text-gray-500 hover:text-gray-700"
            >
              Not you? Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Not logged in - show register form
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white">
            <BarChart3 className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Create your account
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            You have been invited to join{" "}
            <span className="font-medium text-gray-700">
              {inviteInfo.workspace_name}
            </span>{" "}
            as{" "}
            <span className="font-medium text-gray-700">
              {inviteInfo.role}
            </span>
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <form
            onSubmit={handleRegisterAndJoin}
            className="space-y-4"
          >
            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="fullName"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Full name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  clearFieldError("fullName");
                }}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                  fieldErrors.fullName
                    ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                    : "border-gray-300 focus:border-brand-500 focus:ring-brand-500"
                }`}
                placeholder="Jane Smith"
                autoComplete="name"
              />
              {fieldErrors.fullName && (
                <p className="mt-1 text-xs text-red-600">
                  {fieldErrors.fullName}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearFieldError("email");
                }}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                  fieldErrors.email
                    ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                    : "border-gray-300 focus:border-brand-500 focus:ring-brand-500"
                }`}
                placeholder="you@company.com"
                autoComplete="email"
              />
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-red-600">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearFieldError("password");
                  }}
                  className={`w-full rounded-lg border px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-1 ${
                    fieldErrors.password
                      ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                      : "border-gray-300 focus:border-brand-500 focus:ring-brand-500"
                  }`}
                  placeholder="Create a password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {password.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {passwordRules.map((rule) => {
                    const passes = rule.test(password);
                    return (
                      <li
                        key={rule.label}
                        className={`flex items-center gap-1.5 text-xs ${
                          passes ? "text-emerald-600" : "text-gray-400"
                        }`}
                      >
                        {passes ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <X className="h-3 w-3" />
                        )}
                        {rule.label}
                      </li>
                    );
                  })}
                </ul>
              )}
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-red-600">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Creating account..." : "Create account & join"}
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link
            to={`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`}
            className="font-medium text-brand-600 hover:text-brand-700"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
