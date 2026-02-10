import { Link } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { Upload, FlaskConical, BarChart3 } from "lucide-react";

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.full_name?.split(" ")[0]}
        </h1>
        <p className="mt-1 text-gray-500">
          Measure your marketing ROI with Bayesian Marketing Mix Modeling
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <Link
          to="/upload"
          className="group rounded-xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md"
        >
          <Upload className="mb-3 h-8 w-8 text-brand-500" />
          <h3 className="font-semibold text-gray-900">Upload Data</h3>
          <p className="mt-1 text-sm text-gray-500">
            Upload your marketing CSV and map columns
          </p>
        </Link>

        <Link
          to="/models"
          className="group rounded-xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md"
        >
          <FlaskConical className="mb-3 h-8 w-8 text-brand-500" />
          <h3 className="font-semibold text-gray-900">Run Model</h3>
          <p className="mt-1 text-sm text-gray-500">
            Configure and run Bayesian MMM analysis
          </p>
        </Link>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <BarChart3 className="mb-3 h-8 w-8 text-brand-500" />
          <h3 className="font-semibold text-gray-900">View Results</h3>
          <p className="mt-1 text-sm text-gray-500">
            Charts, ROAS, and actionable insights
          </p>
        </div>
      </div>

      {/* Recent activity placeholder */}
      <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 font-semibold text-gray-900">Recent Activity</h2>
        <p className="text-sm text-gray-400">
          No model runs yet. Upload data to get started.
        </p>
      </div>
    </div>
  );
}
