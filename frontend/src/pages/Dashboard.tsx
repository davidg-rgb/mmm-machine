import { Link } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
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
import { mockModelRuns, getStatusBadgeVariant } from "@/services/mock-data";
import { formatCurrency } from "@/lib/utils";

const statsCards = [
  {
    label: "Total Model Runs",
    value: "4",
    icon: Activity,
    change: "+2 this month",
    color: "text-brand-600" as const,
    bg: "bg-brand-50" as const,
  },
  {
    label: "Best ROAS",
    value: "$8.50",
    icon: DollarSign,
    change: "Email channel",
    color: "text-emerald-600" as const,
    bg: "bg-emerald-50" as const,
  },
  {
    label: "Avg. Model Fit",
    value: "94%",
    icon: TrendingUp,
    change: "R-squared",
    color: "text-blue-600" as const,
    bg: "bg-blue-50" as const,
  },
  {
    label: "Datasets",
    value: "2",
    icon: BarChart3,
    change: "1 validated",
    color: "text-amber-600" as const,
    bg: "bg-amber-50" as const,
  },
];

const steps = [
  {
    num: 1,
    title: "Upload Data",
    desc: "Upload your marketing CSV with spend and revenue columns",
    link: "/upload",
    icon: Upload,
    done: true,
  },
  {
    num: 2,
    title: "Run Model",
    desc: "Configure and run Bayesian MMM analysis on your data",
    link: "/models",
    icon: FlaskConical,
    done: true,
  },
  {
    num: 3,
    title: "View Results",
    desc: "Explore channel ROAS, contribution, and actionable insights",
    link: `/results/${mockModelRuns[0]?.id ?? ""}`,
    icon: BarChart3,
    done: false,
  },
];

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

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);

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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((s) => (
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
            {mockModelRuns.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">
                No model runs yet. Upload data to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {mockModelRuns.map((run) => (
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
      {mockModelRuns[0]?.results && (
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
                {mockModelRuns[0].results.top_recommendation}
              </p>
            </div>
            <Link
              to={`/results/${mockModelRuns[0].id}`}
              className="shrink-0 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              View details
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats Row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Total Media Spend Analyzed</p>
            <p className="mt-1 text-xl font-semibold text-gray-900">
              {formatCurrency(2450000)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Avg. Weekly Revenue</p>
            <p className="mt-1 text-xl font-semibold text-gray-900">
              {formatCurrency(185000)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Media Channels Tracked</p>
            <p className="mt-1 text-xl font-semibold text-gray-900">4</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
