import { useState, lazy, Suspense } from "react";
import { useParams, Link } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  Briefcase,
  BarChart3,
  FlaskConical,
  ArrowLeft,
  Download,
  ChevronDown,
} from "lucide-react";
import { Button, Badge, Skeleton, Spinner } from "@/components/shared";
import { cn } from "@/lib/utils";
import ExecutiveView from "@/components/results/ExecutiveView";
import { useModelRun, useModelResults } from "@/hooks/api-hooks";
import toast from "react-hot-toast";
import { toCSV, downloadFile, copyToClipboard } from "@/lib/export";

// Lazy-load views that use heavy chart libraries (Plotly ~800KB via basic-dist-min)
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
  const [exportOpen, setExportOpen] = useState(false);

  const { data: run, isLoading: runLoading, error: runError } = useModelRun(runId ?? "");
  const { data: results, isLoading: resultsLoading, error: resultsError } = useModelResults(runId ?? "");

  usePageTitle(run?.name ? `Results: ${run.name}` : "Results");

  function handleExportChannelCSV() {
    if (!results || !run) return;
    const headers = [
      "Channel",
      "Weekly Contribution",
      "ROAS Mean",
      "ROAS Low (3%)",
      "ROAS High (97%)",
      "Spend Share (%)",
      "Saturation (%)",
    ];
    const rows = results.channel_results.map((ch) => [
      ch.channel,
      ch.weekly_contribution_mean.toFixed(2),
      ch.roas.mean.toFixed(2),
      ch.roas.hdi_3.toFixed(2),
      ch.roas.hdi_97.toFixed(2),
      (ch.contribution_share * 100).toFixed(1),
      (ch.saturation_pct * 100).toFixed(1),
    ]);
    const csv = toCSV(headers, rows);
    downloadFile(csv, `${run.name}-channel-performance.csv`);
    setExportOpen(false);
    toast.success("Channel performance exported");
  }

  function handleExportDecompositionCSV() {
    if (!results || !run) return;
    const channels = results.channel_results.map((ch) => ch.channel);
    const headers = ["Date", "Actual", "Predicted", "Base", ...channels];
    const rows = results.decomposition_ts.dates.map((date, i) => [
      date,
      results.decomposition_ts.actual[i] ?? 0,
      results.decomposition_ts.predicted[i] ?? 0,
      results.decomposition_ts.base[i] ?? 0,
      ...channels.map((ch) => results.decomposition_ts.channels[ch]?.[i] ?? 0),
    ]);
    const csv = toCSV(headers, rows);
    downloadFile(csv, `${run.name}-weekly-decomposition.csv`);
    setExportOpen(false);
    toast.success("Weekly decomposition exported");
  }

  async function handleCopySummary() {
    if (!results) return;
    const summaryText = `${results.summary_text}\n\nTop Recommendation:\n${results.top_recommendation}`;
    const success = await copyToClipboard(summaryText);
    setExportOpen(false);
    if (success) {
      toast.success("Copied to clipboard!");
    } else {
      toast.error("Failed to copy to clipboard");
    }
  }

  function handleExportJSON() {
    if (!results || !run) return;
    const blob = new Blob([JSON.stringify(results, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${run.name}-results.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
    toast.success("Raw results exported");
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
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExportOpen(!exportOpen)}
            data-testid="export-btn"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
          {exportOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setExportOpen(false)}
              />
              <div className="absolute right-0 mt-1 w-64 rounded-lg border border-gray-200 bg-white shadow-lg z-20" data-testid="export-dropdown">
                <button
                  onClick={handleExportChannelCSV}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors first:rounded-t-lg"
                >
                  <Download className="h-4 w-4 text-gray-400" />
                  <div className="text-left">
                    <div className="font-medium">Channel Performance (CSV)</div>
                    <div className="text-xs text-gray-500">ROAS, contribution, saturation</div>
                  </div>
                </button>
                <button
                  onClick={handleExportDecompositionCSV}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100"
                >
                  <Download className="h-4 w-4 text-gray-400" />
                  <div className="text-left">
                    <div className="font-medium">Weekly Decomposition (CSV)</div>
                    <div className="text-xs text-gray-500">Time series by channel</div>
                  </div>
                </button>
                <button
                  onClick={handleCopySummary}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100"
                >
                  <Download className="h-4 w-4 text-gray-400" />
                  <div className="text-left">
                    <div className="font-medium">Copy Summary</div>
                    <div className="text-xs text-gray-500">Copy AI summary to clipboard</div>
                  </div>
                </button>
                <button
                  onClick={handleExportJSON}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100 last:rounded-b-lg"
                >
                  <Download className="h-4 w-4 text-gray-400" />
                  <div className="text-left">
                    <div className="font-medium">Raw Results (JSON)</div>
                    <div className="text-xs text-gray-500">Complete model output</div>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* View Switcher */}
      <div className="flex rounded-lg border border-gray-200 bg-white p-1">
        {viewTabs.map((tab) => (
          <button
            key={tab.key}
            data-testid={`tab-${tab.key}`}
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
