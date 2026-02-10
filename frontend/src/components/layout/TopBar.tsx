import { Link } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { LogOut, User, Settings } from "lucide-react";

export default function TopBar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div />
      <div className="flex items-center gap-4">
        <Link
          to="/settings"
          className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <User className="h-4 w-4" />
          <span>{user?.full_name}</span>
        </Link>
        <Link
          to="/settings"
          className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <Settings className="h-4 w-4" />
        </Link>
        <button
          onClick={logout}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </header>
  );
}
