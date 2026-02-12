import { useState } from "react";
import Plot from "@/lib/plotly";
import toast from "react-hot-toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
} from "@/components/shared";
import { TrendingUp, Loader2, Bookmark, Copy } from "lucide-react";
import { formatCurrency, formatCompactCurrency } from "@/lib/utils";
import { optimizeBudget } from "@/services/api";
import { copyToClipboard } from "@/lib/export";
import ConstraintEditor from "./ConstraintEditor";
import ScenarioComparison, { type SavedScenario } from "./ScenarioComparison";

interface BudgetOptimizerProps {
  runId: string;
  channelNames: string[];
  currentSpend: Record<string, number>;
}

interface OptimizeResult {
  allocations: Record<string, number>;
  predicted_contributions: Record<string, number>;
  total_predicted_contribution: number;
  current_allocations: Record<string, number>;
  current_contributions: Record<string, number>;
  total_current_contribution: number;
  improvement_pct: number;
}

type ChartMode = "allocation" | "contribution";

export default function BudgetOptimizer({ runId, channelNames, currentSpend }: BudgetOptimizerProps) {
  const totalCurrentSpend = Object.values(currentSpend).reduce((a, b) => a + b, 0);

  // Budget state
  const [budget, setBudget] = useState(Math.round(totalCurrentSpend));
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Constraint state
  const [minConstraints, setMinConstraints] = useState<Record<string, number>>({});
  const [maxConstraints, setMaxConstraints] = useState<Record<string, number>>({});

  // Chart & scenario state
  const [chartMode, setChartMode] = useState<ChartMode>("allocation");
  const [scenarios, setScenarios] = useState<SavedScenario[]>([]);

  // Budget slider range: 50% to 200% of current spend
  const sliderMin = Math.round(totalCurrentSpend * 0.5);
  const sliderMax = Math.round(totalCurrentSpend * 2);

  function handleMinChange(channel: string, value: number) {
    setMinConstraints((prev) => {
      if (value === 0) {
        const next = { ...prev };
        delete next[channel];
        return next;
      }
      return { ...prev, [channel]: value };
    });
  }

  function handleMaxChange(channel: string, value: number) {
    setMaxConstraints((prev) => {
      if (value === 0) {
        const next = { ...prev };
        delete next[channel];
        return next;
      }
      return { ...prev, [channel]: value };
    });
  }

  function handleClearConstraints() {
    setMinConstraints({});
    setMaxConstraints({});
  }

  async function handleOptimize() {
    setLoading(true);
    setError(null);
    try {
      const minArg = Object.keys(minConstraints).length > 0 ? minConstraints : undefined;
      const maxArg = Object.keys(maxConstraints).length > 0 ? maxConstraints : undefined;
      const res = await optimizeBudget(runId, budget, minArg, maxArg);
      setResult(res);
    } catch (e: any) {
      setError(e.message || "Optimization failed");
    } finally {
      setLoading(false);
    }
  }

  function handleSaveScenario() {
    if (!result || scenarios.length >= 3) return;
    const label = `${formatCurrency(budget)} (#${scenarios.length + 1})`;
    setScenarios((prev) => [
      ...prev,
      {
        label,
        budget,
        allocations: { ...result.allocations },
        contributions: { ...result.predicted_contributions },
        totalContribution: result.total_predicted_contribution,
      },
    ]);
    toast.success("Scenario saved");
  }

  function handleRemoveScenario(index: number) {
    setScenarios((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCopy() {
    if (!result) return;
    const headers = [
      "Channel",
      "Current Spend",
      "Optimal Spend",
      "Spend Change",
      "Current Contrib",
      "Optimal Contrib",
      "Contrib Change",
    ];
    const rows = channelNames.map((ch) => {
      const currSpend = result.current_allocations[ch] || 0;
      const optSpend = result.allocations[ch] || 0;
      const currContrib = result.current_contributions[ch] || 0;
      const optContrib = result.predicted_contributions[ch] || 0;
      return [
        ch,
        currSpend,
        optSpend,
        optSpend - currSpend,
        currContrib,
        optContrib,
        optContrib - currContrib,
      ].join("\t");
    });
    const text = [headers.join("\t"), ...rows].join("\n");
    const ok = await copyToClipboard(text);
    if (ok) toast.success("Copied to clipboard!");
  }

  // Chart data
  const chartData = result
    ? chartMode === "allocation"
      ? [
          {
            x: channelNames,
            y: channelNames.map((ch) => result.current_allocations[ch] || 0),
            type: "bar" as const,
            name: "Current",
            marker: { color: "#94a3b8" },
          },
          {
            x: channelNames,
            y: channelNames.map((ch) => result.allocations[ch] || 0),
            type: "bar" as const,
            name: "Optimal",
            marker: { color: "#4c6ef5" },
          },
        ]
      : [
          {
            x: channelNames,
            y: channelNames.map((ch) => result.current_contributions[ch] || 0),
            type: "bar" as const,
            name: "Current",
            marker: { color: "#94a3b8" },
          },
          {
            x: channelNames,
            y: channelNames.map((ch) => result.predicted_contributions[ch] || 0),
            type: "bar" as const,
            name: "Optimal",
            marker: { color: "#10b981" },
          },
        ]
    : [];

  const yAxisLabel = chartMode === "allocation" ? "Weekly Budget ($)" : "Predicted Contribution ($)";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-brand-600" />
          Budget Optimizer
        </CardTitle>
        <CardDescription>
          Find the optimal budget allocation to maximize predicted revenue
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Budget slider + input */}
        <div>
          <label htmlFor="budget-input" className="mb-1 block text-sm font-medium text-gray-700">
            Total Weekly Budget
          </label>
          <div className="flex items-center gap-3">
            <div className="flex-1 space-y-1">
              <input
                type="range"
                min={sliderMin}
                max={sliderMax}
                step={100}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="w-full accent-brand-600"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>{formatCompactCurrency(sliderMin)}</span>
                <span>Current: {formatCompactCurrency(totalCurrentSpend)}</span>
                <span>{formatCompactCurrency(sliderMax)}</span>
              </div>
            </div>
            <input
              id="budget-input"
              type="number"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              min={0}
              step={100}
            />
            <Button onClick={handleOptimize} disabled={loading || budget <= 0}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? "Optimizing..." : "Optimize"}
            </Button>
          </div>
        </div>

        {/* Constraint editor */}
        <ConstraintEditor
          channelNames={channelNames}
          totalBudget={budget}
          minConstraints={minConstraints}
          maxConstraints={maxConstraints}
          onMinChange={handleMinChange}
          onMaxChange={handleMaxChange}
          onClearAll={handleClearConstraints}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        {result && (
          <div className="space-y-4">
            {/* Improvement banner */}
            <div
              className={`rounded-lg p-4 text-center ${
                result.improvement_pct > 0 ? "bg-emerald-50" : "bg-gray-50"
              }`}
            >
              <p className="text-sm text-gray-600">Predicted Revenue Improvement</p>
              <p
                className={`text-3xl font-bold ${
                  result.improvement_pct > 0 ? "text-emerald-700" : "text-gray-700"
                }`}
              >
                {result.improvement_pct >= 0 ? "+" : ""}
                {result.improvement_pct.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500">
                {formatCurrency(result.total_current_contribution)} →{" "}
                {formatCurrency(result.total_predicted_contribution)}
              </p>
            </div>

            {/* Chart mode toggle + save scenario */}
            <div className="flex items-center justify-between">
              <div className="inline-flex rounded-lg border border-gray-200">
                <button
                  type="button"
                  onClick={() => setChartMode("allocation")}
                  className={`rounded-l-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    chartMode === "allocation"
                      ? "bg-brand-600 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  Budget Allocation
                </button>
                <button
                  type="button"
                  onClick={() => setChartMode("contribution")}
                  className={`rounded-r-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    chartMode === "contribution"
                      ? "bg-brand-600 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  Predicted Contribution
                </button>
              </div>
              <Button
                onClick={handleSaveScenario}
                disabled={scenarios.length >= 3}
                className="gap-1.5 text-xs"
              >
                <Bookmark className="h-3.5 w-3.5" />
                Save Scenario{scenarios.length > 0 ? ` (${scenarios.length}/3)` : ""}
              </Button>
            </div>

            {/* Chart */}
            <div className="h-72">
              <Plot
                data={chartData}
                layout={{
                  autosize: true,
                  barmode: "group",
                  margin: { l: 60, r: 20, t: 10, b: 60 },
                  yaxis: {
                    title: yAxisLabel,
                    tickprefix: "$",
                    tickformat: ",.0f",
                  },
                  legend: { orientation: "h", y: -0.2 },
                  plot_bgcolor: "white",
                  paper_bgcolor: "white",
                  font: { family: "Inter, system-ui, sans-serif", size: 12 },
                }}
                config={{ displayModeBar: false, responsive: true }}
                useResizeHandler
                style={{ width: "100%", height: "100%" }}
              />
            </div>

            {/* Extended per-channel table */}
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Channel
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
                      Current Spend
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
                      Optimal Spend
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
                      Spend Change
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
                      Current Contrib
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
                      Optimal Contrib
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
                      Contrib Change
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {channelNames.map((ch) => {
                    const currSpend = result.current_allocations[ch] || 0;
                    const optSpend = result.allocations[ch] || 0;
                    const spendDiff = optSpend - currSpend;
                    const currContrib = result.current_contributions[ch] || 0;
                    const optContrib = result.predicted_contributions[ch] || 0;
                    const contribDiff = optContrib - currContrib;
                    return (
                      <tr key={ch}>
                        <td className="px-4 py-2 font-medium text-gray-900">{ch}</td>
                        <td className="px-4 py-2 text-right font-mono text-gray-600">
                          {formatCurrency(currSpend)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-gray-900">
                          {formatCurrency(optSpend)}
                        </td>
                        <td
                          className={`px-4 py-2 text-right font-mono ${
                            spendDiff > 0
                              ? "text-emerald-600"
                              : spendDiff < 0
                                ? "text-red-600"
                                : "text-gray-400"
                          }`}
                        >
                          {spendDiff > 0 ? "+" : ""}
                          {formatCurrency(spendDiff)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-gray-600">
                          {formatCurrency(currContrib)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-gray-900">
                          {formatCurrency(optContrib)}
                        </td>
                        <td
                          className={`px-4 py-2 text-right font-mono ${
                            contribDiff > 0
                              ? "text-emerald-600"
                              : contribDiff < 0
                                ? "text-red-600"
                                : "text-gray-400"
                          }`}
                        >
                          {contribDiff > 0 ? "+" : ""}
                          {formatCurrency(contribDiff)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Copy to clipboard */}
            <div className="flex justify-end">
              <Button onClick={handleCopy} className="gap-1.5 text-xs">
                <Copy className="h-3.5 w-3.5" />
                Copy Table
              </Button>
            </div>

            {/* Scenario comparison */}
            <ScenarioComparison
              scenarios={scenarios}
              channelNames={channelNames}
              onRemove={handleRemoveScenario}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
