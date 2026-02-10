import { useState } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useModelRuns } from "@/hooks/api-hooks";
import { useQuery } from "@tanstack/react-query";
import { getModelResults } from "@/services/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Skeleton,
} from "@/components/shared";
import { ArrowLeftRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ModelRun } from "@/types";

export default function Compare() {
  usePageTitle("Compare Models");
  const [selectedRuns, setSelectedRuns] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);

  const { data: modelRuns, isLoading: runsLoading } = useModelRuns();

  // Only fetch completed runs
  const completedRuns = (modelRuns ?? []).filter(
    (run) => run.status === "completed" && run.results
  );

  function toggleSelection(runId: string) {
    setSelectedRuns((prev) => {
      if (prev.includes(runId)) {
        return prev.filter((id) => id !== runId);
      }
      if (prev.length >= 2) {
        const secondId = prev[1];
        if (secondId) {
          return [secondId, runId]; // Replace first selection
        }
        return [runId];
      }
      return [...prev, runId];
    });
  }

  function startComparison() {
    if (selectedRuns.length === 2) {
      setComparing(true);
    }
  }

  function resetComparison() {
    setComparing(false);
    setSelectedRuns([]);
  }

  if (runsLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!comparing) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compare Models</h1>
          <p className="mt-1 text-sm text-gray-500">
            Select exactly 2 completed model runs to compare side-by-side
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Select Model Runs</CardTitle>
          </CardHeader>
          <CardContent>
            {completedRuns.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">
                No completed model runs available for comparison.
              </p>
            ) : (
              <div className="space-y-3">
                {completedRuns.map((run) => (
                  <button
                    key={run.id}
                    onClick={() => toggleSelection(run.id)}
                    className={cn(
                      "w-full rounded-lg border-2 p-4 text-left transition-all",
                      selectedRuns.includes(run.id)
                        ? "border-brand-500 bg-brand-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "mt-0.5 flex h-5 w-5 items-center justify-center rounded border-2",
                          selectedRuns.includes(run.id)
                            ? "border-brand-500 bg-brand-500"
                            : "border-gray-300 bg-white"
                        )}
                      >
                        {selectedRuns.includes(run.id) && (
                          <CheckCircle2 className="h-4 w-4 text-white" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{run.name}</p>
                          {selectedRuns.includes(run.id) && (
                            <Badge variant="default" className="text-xs">
                              Run {selectedRuns.indexOf(run.id) === 0 ? "A" : "B"}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-gray-500">
                          {run.config.adstock_type}/{run.config.saturation_type}
                          {" · "}
                          {run.config.mode === "quick" ? "Quick" : "Full"} mode
                          {run.completed_at &&
                            ` · ${new Date(run.completed_at).toLocaleDateString()}`}
                        </p>
                        {run.results && (
                          <p className="mt-1 text-xs text-gray-400">
                            R² {(run.results.diagnostics.r_squared * 100).toFixed(1)}%
                            {" · "}
                            MAPE {(run.results.diagnostics.mape * 100).toFixed(1)}%
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={startComparison}
            disabled={selectedRuns.length !== 2}
          >
            <ArrowLeftRight className="h-4 w-4" />
            Compare Selected Models
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ComparisonView
      runIds={selectedRuns}
      runs={completedRuns}
      onBack={resetComparison}
    />
  );
}

interface ComparisonViewProps {
  runIds: string[];
  runs: ModelRun[];
  onBack: () => void;
}

function ComparisonView({ runIds, runs, onBack }: ComparisonViewProps) {
  const runA = runs.find((r) => r.id === runIds[0]);
  const runB = runs.find((r) => r.id === runIds[1]);

  const { data: resultsA, isLoading: loadingA } = useQuery({
    queryKey: ["modelResults", runIds[0]],
    queryFn: () => {
      const id = runIds[0];
      if (!id) throw new Error("No run ID");
      return getModelResults(id);
    },
    enabled: !!runIds[0],
  });

  const { data: resultsB, isLoading: loadingB } = useQuery({
    queryKey: ["modelResults", runIds[1]],
    queryFn: () => {
      const id = runIds[1];
      if (!id) throw new Error("No run ID");
      return getModelResults(id);
    },
    enabled: !!runIds[1],
  });

  if (loadingA || loadingB || !runA || !runB || !resultsA || !resultsB) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Calculate recommendation
  const aFitBetter =
    resultsA.diagnostics.r_squared > resultsB.diagnostics.r_squared &&
    resultsA.diagnostics.mape < resultsB.diagnostics.mape;
  const bFitBetter =
    resultsB.diagnostics.r_squared > resultsA.diagnostics.r_squared &&
    resultsB.diagnostics.mape < resultsA.diagnostics.mape;

  let recommendation = "";
  if (aFitBetter) {
    recommendation = `${runA.name} appears to have a better overall fit (higher R², lower MAPE).`;
  } else if (bFitBetter) {
    recommendation = `${runB.name} appears to have a better overall fit (higher R², lower MAPE).`;
  } else {
    recommendation =
      "Both models have comparable fit metrics. Consider the adstock/saturation assumptions that best match your domain knowledge.";
  }

  // Get all channels (union of both)
  const allChannels = Array.from(
    new Set([
      ...resultsA.channel_results.map((c) => c.channel),
      ...resultsB.channel_results.map((c) => c.channel),
    ])
  ).sort();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Model Comparison</h1>
          <p className="mt-1 text-sm text-gray-500">
            Comparing {runA.name} vs {runB.name}
          </p>
        </div>
        <Button variant="outline" onClick={onBack}>
          Change Selection
        </Button>
      </div>

      {/* Model Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Model Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-2 text-left font-medium text-gray-700">
                    Metric
                  </th>
                  <th className="py-2 text-left font-medium text-gray-700">
                    Run A: {runA.name}
                  </th>
                  <th className="py-2 text-left font-medium text-gray-700">
                    Run B: {runB.name}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="py-2 text-gray-600">Mode</td>
                  <td className="py-2 text-gray-900">
                    {runA.config.mode === "quick" ? "Quick" : "Full"}
                  </td>
                  <td className="py-2 text-gray-900">
                    {runB.config.mode === "quick" ? "Quick" : "Full"}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-600">Adstock</td>
                  <td className="py-2 text-gray-900 capitalize">
                    {runA.config.adstock_type}
                  </td>
                  <td className="py-2 text-gray-900 capitalize">
                    {runB.config.adstock_type}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-600">Saturation</td>
                  <td className="py-2 text-gray-900 capitalize">
                    {runA.config.saturation_type}
                  </td>
                  <td className="py-2 text-gray-900 capitalize">
                    {runB.config.saturation_type}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-600">Samples</td>
                  <td className="py-2 text-gray-900">{runA.config.n_samples}</td>
                  <td className="py-2 text-gray-900">{runB.config.n_samples}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Fit Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Fit Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-2 text-left font-medium text-gray-700">
                    Metric
                  </th>
                  <th className="py-2 text-left font-medium text-gray-700">
                    Run A: {runA.name}
                  </th>
                  <th className="py-2 text-left font-medium text-gray-700">
                    Run B: {runB.name}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="py-2 text-gray-600">R²</td>
                  <td
                    className={cn(
                      "py-2 font-medium",
                      resultsA.diagnostics.r_squared >
                        resultsB.diagnostics.r_squared
                        ? "text-emerald-600"
                        : "text-gray-900"
                    )}
                  >
                    {(resultsA.diagnostics.r_squared * 100).toFixed(1)}%
                  </td>
                  <td
                    className={cn(
                      "py-2 font-medium",
                      resultsB.diagnostics.r_squared >
                        resultsA.diagnostics.r_squared
                        ? "text-emerald-600"
                        : "text-gray-900"
                    )}
                  >
                    {(resultsB.diagnostics.r_squared * 100).toFixed(1)}%
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-600">MAPE</td>
                  <td
                    className={cn(
                      "py-2 font-medium",
                      resultsA.diagnostics.mape < resultsB.diagnostics.mape
                        ? "text-emerald-600"
                        : "text-gray-900"
                    )}
                  >
                    {(resultsA.diagnostics.mape * 100).toFixed(1)}%
                  </td>
                  <td
                    className={cn(
                      "py-2 font-medium",
                      resultsB.diagnostics.mape < resultsA.diagnostics.mape
                        ? "text-emerald-600"
                        : "text-gray-900"
                    )}
                  >
                    {(resultsB.diagnostics.mape * 100).toFixed(1)}%
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-600">Divergences</td>
                  <td
                    className={cn(
                      "py-2 font-medium",
                      resultsA.diagnostics.divergences <
                        resultsB.diagnostics.divergences
                        ? "text-emerald-600"
                        : "text-gray-900"
                    )}
                  >
                    {resultsA.diagnostics.divergences}
                  </td>
                  <td
                    className={cn(
                      "py-2 font-medium",
                      resultsB.diagnostics.divergences <
                        resultsA.diagnostics.divergences
                        ? "text-emerald-600"
                        : "text-gray-900"
                    )}
                  >
                    {resultsB.diagnostics.divergences}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-600">Convergence</td>
                  <td className="py-2">
                    <Badge
                      variant={
                        resultsA.diagnostics.convergence_status === "good"
                          ? "success"
                          : resultsA.diagnostics.convergence_status ===
                            "acceptable"
                          ? "warning"
                          : "error"
                      }
                    >
                      {resultsA.diagnostics.convergence_status}
                    </Badge>
                  </td>
                  <td className="py-2">
                    <Badge
                      variant={
                        resultsB.diagnostics.convergence_status === "good"
                          ? "success"
                          : resultsB.diagnostics.convergence_status ===
                            "acceptable"
                          ? "warning"
                          : "error"
                      }
                    >
                      {resultsB.diagnostics.convergence_status}
                    </Badge>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Channel ROAS */}
      <Card>
        <CardHeader>
          <CardTitle>Channel ROAS Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-2 text-left font-medium text-gray-700">
                    Channel
                  </th>
                  <th className="py-2 text-right font-medium text-gray-700">
                    ROAS (A)
                  </th>
                  <th className="py-2 text-right font-medium text-gray-700">
                    ROAS (B)
                  </th>
                  <th className="py-2 text-right font-medium text-gray-700">
                    Difference
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allChannels.map((channel) => {
                  const channelA = resultsA.channel_results.find(
                    (c) => c.channel === channel
                  );
                  const channelB = resultsB.channel_results.find(
                    (c) => c.channel === channel
                  );
                  const roasA = channelA?.roas.mean ?? 0;
                  const roasB = channelB?.roas.mean ?? 0;
                  const diff = roasA - roasB;

                  return (
                    <tr key={channel}>
                      <td className="py-2 text-gray-900">{channel}</td>
                      <td className="py-2 text-right text-gray-900">
                        {channelA ? `$${roasA.toFixed(2)}` : "—"}
                      </td>
                      <td className="py-2 text-right text-gray-900">
                        {channelB ? `$${roasB.toFixed(2)}` : "—"}
                      </td>
                      <td
                        className={cn(
                          "py-2 text-right font-medium",
                          Math.abs(diff) < 0.01
                            ? "text-gray-400"
                            : diff > 0
                            ? "text-emerald-600"
                            : "text-red-600"
                        )}
                      >
                        {channelA && channelB
                          ? `${diff > 0 ? "+" : ""}$${diff.toFixed(2)}`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recommendation */}
      <Card className="border-brand-200 bg-brand-50">
        <CardHeader>
          <CardTitle>Recommendation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-700">{recommendation}</p>
        </CardContent>
      </Card>
    </div>
  );
}
