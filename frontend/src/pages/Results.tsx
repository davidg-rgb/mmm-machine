import { useState, lazy, Suspense } from "react";
import { useParams, Link } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  Briefcase,
  BarChart3,
  FlaskConical,
  ArrowLeft,
  Download,
} from "lucide-react";
import { Button, Badge, Skeleton, Spinner } from "@/components/shared";
import { cn } from "@/lib/utils";
import ExecutiveView from "@/components/results/ExecutiveView";
import { useModelRun, useModelResults } from "@/hooks/api-hooks";
import toast from "react-hot-toast";

// Lazy-load views that use heavy chart libraries (Plotly = 4.75MB)
const ManagerView = lazy(() => import("@/components/results/ManagerView"));
const AnalystView = lazy(() => import("@/components/results/AnalystView"));

type ViewMode = "executive" | "manager" | "analyst";

const viewTabs: { key: ViewMode; label: string; icon: typeof Briefcase }[] = [
  { key: "executive", label: "Executive", icon: Briefcase },
  { key: "manager", label: "Manager", icon: BarChart3 },
  { key: "analyst", label: "Analyst", icon: FlaskConical },
];

export default function Results() {
  const { runId } = useParams<{ runId: string }>();
  const [view, setView] = useState<ViewMode>("executive");

  const { data: run, isLoading: runLoading, error: runError } = useModelRun(runId ?? "");
  const { data: results, isLoading: resultsLoading, error: resultsError } = useModelResults(runId ?? "");

  usePageTitle(run?.name ? `Results: ${run.name}` : "Results");

  function handleExport() {
    if (!results || !run) return;
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${run.name}-results.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report exported");
  }

  if (runLoading || resultsLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (runError || !run) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500">Model run not found.</p>
          <Link to="/models">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="h-4 w-4" />
              Back to Model Runs
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (resultsError || !results) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500">
            Results are not yet available for this run.
          </p>
          <Link to="/models">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="h-4 w-4" />
              Back to Model Runs
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              to="/models"
              className="text-gray-400 transition-colors hover:text-gray-600"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">{run.name}</h1>
            <Badge variant="success">completed</Badge>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {run.config.adstock_type}/{run.config.saturation_type} |{" "}
            {run.config.mode === "quick" ? "Quick" : "Full"} mode |{" "}
            {run.completed_at &&
              new Date(run.completed_at).toLocaleDateString()}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Export Report
        </Button>
      </div>

      {/* View Switcher */}
      <div className="flex rounded-lg border border-gray-200 bg-white p-1">
        {viewTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
              view === tab.key
                ? "bg-brand-600 text-white"
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-700",
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* View descriptions */}
      <p className="text-xs text-gray-400">
        {view === "executive" &&
          "High-level KPIs, revenue decomposition, and actionable recommendations"}
        {view === "manager" &&
          "Detailed ROAS comparison, saturation curves, and adstock analysis"}
        {view === "analyst" &&
          "Posterior distributions, convergence diagnostics, and model fit analysis"}
      </p>

      {/* View Content */}
      {view === "executive" && <ExecutiveView results={results} />}
      {view === "manager" && (
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" />
              <span className="ml-3 text-gray-500">Loading charts...</span>
            </div>
          }
        >
          <ManagerView results={results} runId={runId!} />
        </Suspense>
      )}
      {view === "analyst" && (
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" />
              <span className="ml-3 text-gray-500">Loading charts...</span>
            </div>
          }
        >
          <AnalystView results={results} />
        </Suspense>
      )}
    </div>
  );
}
