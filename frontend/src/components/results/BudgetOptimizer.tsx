import { useState } from "react";
import Plot from "react-plotly.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
} from "@/components/shared";
import { TrendingUp, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { optimizeBudget } from "@/services/api";

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

export default function BudgetOptimizer({ runId, channelNames, currentSpend }: BudgetOptimizerProps) {
  const totalCurrentSpend = Object.values(currentSpend).reduce((a, b) => a + b, 0);
  const [budget, setBudget] = useState(Math.round(totalCurrentSpend));
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOptimize() {
    setLoading(true);
    setError(null);
    try {
      const res = await optimizeBudget(runId, budget);
      setResult(res);
    } catch (e: any) {
      setError(e.message || "Optimization failed");
    } finally {
      setLoading(false);
    }
  }

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
      <CardContent>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label htmlFor="budget-input" className="mb-1 block text-sm font-medium text-gray-700">
              Total Weekly Budget
            </label>
            <input
              id="budget-input"
              type="number"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              min={0}
              step={100}
            />
          </div>
          <Button onClick={handleOptimize} disabled={loading || budget <= 0}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Optimizing..." : "Optimize"}
          </Button>
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}

        {result && (
          <div className="mt-6 space-y-4">
            {/* Improvement banner */}
            <div className={`rounded-lg p-4 text-center ${
              result.improvement_pct > 0 ? "bg-emerald-50" : "bg-gray-50"
            }`}>
              <p className="text-sm text-gray-600">Predicted Revenue Improvement</p>
              <p className={`text-3xl font-bold ${
                result.improvement_pct > 0 ? "text-emerald-700" : "text-gray-700"
              }`}>
                {result.improvement_pct >= 0 ? '+' : ''}{result.improvement_pct.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500">
                {formatCurrency(result.total_current_contribution)} → {formatCurrency(result.total_predicted_contribution)}
              </p>
            </div>

            {/* Current vs Optimal comparison chart */}
            <div className="h-72">
              <Plot
                data={[
                  {
                    x: channelNames,
                    y: channelNames.map(ch => result.current_allocations[ch] || 0),
                    type: 'bar',
                    name: 'Current',
                    marker: { color: '#94a3b8' },
                  },
                  {
                    x: channelNames,
                    y: channelNames.map(ch => result.allocations[ch] || 0),
                    type: 'bar',
                    name: 'Optimal',
                    marker: { color: '#4c6ef5' },
                  },
                ]}
                layout={{
                  autosize: true,
                  barmode: 'group',
                  margin: { l: 60, r: 20, t: 10, b: 60 },
                  yaxis: { title: 'Weekly Budget ($)', tickprefix: '$', tickformat: ',.0f' },
                  legend: { orientation: 'h', y: -0.2 },
                  plot_bgcolor: 'white',
                  paper_bgcolor: 'white',
                  font: { family: 'Inter, system-ui, sans-serif', size: 12 },
                }}
                config={{ displayModeBar: false, responsive: true }}
                useResizeHandler
                style={{ width: '100%', height: '100%' }}
              />
            </div>

            {/* Per-channel table */}
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Channel</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Current</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Optimal</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {channelNames.map((ch) => {
                    const curr = result.current_allocations[ch] || 0;
                    const opt = result.allocations[ch] || 0;
                    const diff = opt - curr;
                    return (
                      <tr key={ch}>
                        <td className="px-4 py-2 font-medium text-gray-900">{ch}</td>
                        <td className="px-4 py-2 text-right font-mono text-gray-600">{formatCurrency(curr)}</td>
                        <td className="px-4 py-2 text-right font-mono text-gray-900">{formatCurrency(opt)}</td>
                        <td className={`px-4 py-2 text-right font-mono ${
                          diff > 0 ? "text-emerald-600" : diff < 0 ? "text-red-600" : "text-gray-400"
                        }`}>
                          {diff > 0 ? "+" : ""}{formatCurrency(diff)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
