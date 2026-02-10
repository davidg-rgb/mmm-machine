import { Link } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  Upload,
  FlaskConical,
  BarChart3,
  ArrowRight,
  TrendingUp,
  DollarSign,
  Activity,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
} from "@/components/shared";
import { Skeleton } from "@/components/shared/Skeleton";
import { useModelRuns, useDatasets } from "@/hooks/api-hooks";
import { getStatusBadgeVariant, formatCurrency } from "@/lib/utils";
import type { ModelRun, Dataset } from "@/types";

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "failed":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case "fitting":
    case "preprocessing":
    case "postprocessing":
      return <Loader2 className="h-4 w-4 animate-spin text-brand-500" />;
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
}

function StatsCards({ runs, datasets }: { runs: ModelRun[]; datasets: Dataset[] }) {
  const completedRuns = runs.filter((r) => r.status === "completed");

  const bestRoas = completedRuns.reduce<number | null>((best, run) => {
    if (!run.results || run.results.channel_results.length === 0) return best;
    const maxRoas = Math.max(...run.results.channel_results.map((c) => c.roas.mean));
    return best === null ? maxRoas : Math.max(best, maxRoas);
  }, null);

  const bestRoasChannel = completedRuns.reduce<string | null>((ch, run) => {
    if (!run.results) return ch;
    const top = run.results.channel_results.reduce((a, b) =>
      a.roas.mean > b.roas.mean ? a : b,
    );
    if (bestRoas !== null && top.roas.mean === bestRoas) return top.channel;
    return ch;
  }, null);

  const avgFit = completedRuns.length > 0
    ? completedRuns.reduce((sum, r) => sum + (r.results?.diagnostics.r_squared ?? 0), 0) / completedRuns.length
    : null;

  const validatedCount = datasets.filter((d) => d.status === "validated").length;

  const cards = [
    {
      label: "Total Model Runs",
      value: String(runs.length),
      icon: Activity,
      change: `${completedRuns.length} completed`,
      color: "text-brand-600" as const,
      bg: "bg-brand-50" as const,
    },
    {
      label: "Best ROAS",
      value: bestRoas !== null ? `$${bestRoas.toFixed(2)}` : "--",
      icon: DollarSign,
      change: bestRoasChannel ?? "No data",
      color: "text-emerald-600" as const,
      bg: "bg-emerald-50" as const,
    },
    {
      label: "Avg. Model Fit",
      value: avgFit !== null ? `${(avgFit * 100).toFixed(0)}%` : "--",
      icon: TrendingUp,
      change: "R-squared",
      color: "text-blue-600" as const,
      bg: "bg-blue-50" as const,
    },
    {
      label: "Datasets",
      value: String(datasets.length),
      icon: BarChart3,
      change: `${validatedCount} validated`,
      color: "text-amber-600" as const,
      bg: "bg-amber-50" as const,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((s) => (
        <Card key={s.label}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">{s.label}</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                  {s.value}
                </p>
                <p className="mt-0.5 text-xs text-gray-400">{s.change}</p>
              </div>
              <div className={`rounded-lg p-2 ${s.bg}`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Dashboard() {
  usePageTitle("Dashboard");
  const user = useAuthStore((s) => s.user);
  const { data: modelRuns, isLoading: runsLoading } = useModelRuns();
  const { data: datasets, isLoading: datasetsLoading } = useDatasets();

  const runs: ModelRun[] = modelRuns ?? [];
  const dsList: Dataset[] = datasets ?? [];
  const isLoading = runsLoading || datasetsLoading;

  const hasDatasets = dsList.length > 0;
  const completedRun = runs.find((r) => r.status === "completed");
  const hasCompletedRun = !!completedRun;

  const latestCompleted = runs
    .filter((r) => r.status === "completed" && r.results)
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))[0];

  const steps = [
    {
      num: 1,
      title: "Upload Data",
      desc: "Upload your marketing CSV with spend and revenue columns",
      link: "/upload",
      icon: Upload,
      done: hasDatasets,
    },
    {
      num: 2,
      title: "Run Model",
      desc: "Configure and run Bayesian MMM analysis on your data",
      link: "/models",
      icon: FlaskConical,
      done: hasCompletedRun,
    },
    {
      num: 3,
      title: "View Results",
      desc: "Explore channel ROAS, contribution, and actionable insights",
      link: completedRun ? `/results/${completedRun.id}` : "/models",
      icon: BarChart3,
      done: false,
    },
  ];

  // Derive quick stats from latest completed run
  const totalSpend = latestCompleted?.results?.channel_results.reduce(
    (sum, ch) => sum + (ch.roas.mean !== 0 ? ch.weekly_contribution_mean * 104 / ch.roas.mean : 0),
    0,
  );
  const avgRevenue = latestCompleted?.results
    ? (latestCompleted.results.base_sales.weekly_mean +
        latestCompleted.results.channel_results.reduce(
          (s, c) => s + c.weekly_contribution_mean,
          0,
        ))
    : null;
  const channelCount = latestCompleted?.results?.channel_results.length ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.full_name?.split(" ")[0] ?? "there"}
        </h1>
        <p className="mt-1 text-gray-500">
          Measure your marketing ROI with Bayesian Marketing Mix Modeling
        </p>
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <StatsCards runs={runs} datasets={dsList} />
      )}

      {/* Getting Started + Recent Runs */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Getting Started */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {steps.map((step) => (
                <li key={step.num}>
                  <Link
                    to={step.link}
                    className="group flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-gray-50"
                  >
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                        step.done
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {step.done ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        step.num
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {step.title}
                      </p>
                      <p className="text-xs text-gray-500">{step.desc}</p>
                    </div>
                    <ArrowRight className="mt-0.5 h-4 w-4 text-gray-300 transition-colors group-hover:text-gray-500" />
                  </Link>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Model Runs</CardTitle>
            <Link
              to="/models"
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-100 p-3">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            ) : runs.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">
                No model runs yet. Upload data to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {runs.map((run) => (
                  <Link
                    key={run.id}
                    to={
                      run.status === "completed"
                        ? `/results/${run.id}`
                        : "/models"
                    }
                    className="flex items-center gap-3 rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50"
                  >
                    <StatusIcon status={run.status} />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {run.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {run.config.mode === "quick" ? "Quick" : "Full"} mode
                        {run.completed_at
                          ? ` \u00b7 ${new Date(run.completed_at).toLocaleDateString()}`
                          : run.started_at
                            ? ` \u00b7 Started ${new Date(run.started_at).toLocaleDateString()}`
                            : ""}
                      </p>
                    </div>
                    <Badge variant={getStatusBadgeVariant(run.status)}>
                      {run.status}
                    </Badge>
                    {run.status === "completed" && run.results && (
                      <span className="text-xs font-medium text-gray-500">
                        R{"\u00b2"} {(run.results.diagnostics.r_squared * 100).toFixed(0)}%
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Recommendation Banner */}
      {latestCompleted?.results && (
        <Card className="border-brand-100 bg-brand-50/30">
          <CardContent className="flex items-start gap-4 p-5">
            <div className="rounded-lg bg-brand-100 p-2">
              <TrendingUp className="h-5 w-5 text-brand-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                Top Recommendation
              </p>
              <p className="mt-0.5 text-sm text-gray-600">
                {latestCompleted.results.top_recommendation}
              </p>
            </div>
            <Link
              to={`/results/${latestCompleted.id}`}
              className="shrink-0 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              View details
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats Row */}
      {latestCompleted?.results ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">Total Media Spend Analyzed</p>
              <p className="mt-1 text-xl font-semibold text-gray-900">
                {formatCurrency(totalSpend ?? 0)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">Avg. Weekly Revenue</p>
              <p className="mt-1 text-xl font-semibold text-gray-900">
                {formatCurrency(avgRevenue ?? 0)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">Media Channels Tracked</p>
              <p className="mt-1 text-xl font-semibold text-gray-900">{channelCount}</p>
            </CardContent>
          </Card>
        </div>
      ) : !isLoading ? null : (
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-7 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
