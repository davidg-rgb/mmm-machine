import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { CheckCircle2, AlertCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
} from "@/components/shared";
import type { ModelResults } from "@/types";
import { formatCurrency } from "@/lib/utils";

interface AnalystViewProps {
  results: ModelResults;
}

export default function AnalystView({ results }: AnalystViewProps) {
  const { diagnostics, decomposition_ts, channel_results } = results;

  // Convergence table data
  const convergenceRows = [
    {
      metric: "R-hat (max)",
      value: diagnostics.r_hat_max.toFixed(3),
      threshold: "< 1.05",
      pass: diagnostics.r_hat_max < 1.05,
    },
    {
      metric: "ESS (min)",
      value: diagnostics.ess_min.toLocaleString(),
      threshold: "> 400",
      pass: diagnostics.ess_min > 400,
    },
    {
      metric: "Divergences",
      value: diagnostics.divergences.toString(),
      threshold: "0",
      pass: diagnostics.divergences === 0,
    },
    {
      metric: "R-squared",
      value: diagnostics.r_squared.toFixed(3),
      threshold: "> 0.80",
      pass: diagnostics.r_squared > 0.8,
    },
    {
      metric: "MAPE",
      value: `${(diagnostics.mape * 100).toFixed(2)}%`,
      threshold: "< 10%",
      pass: diagnostics.mape < 0.1,
    },
  ];

  // Actual vs Predicted with HDI
  const tsLength = decomposition_ts.dates.length;
  const step = Math.max(1, Math.floor(tsLength / 60));
  const tsData = decomposition_ts.dates
    .filter((_, i) => i % step === 0)
    .map((date, idx) => {
      const i = idx * step;
      const actual = decomposition_ts.actual[i] ?? 0;
      const predicted = decomposition_ts.predicted[i] ?? 0;
      return {
        date: date.slice(5),
        actual,
        predicted,
        hdi_lower: decomposition_ts.predicted_hdi_lower[i] ?? 0,
        hdi_upper: decomposition_ts.predicted_hdi_upper[i] ?? 0,
        residual: actual - predicted,
      };
    });

  // Residuals
  const residualData = tsData.map((d) => ({
    date: d.date,
    residual: d.residual,
  }));

  // Posterior distributions (simulated normal draws for display)
  function generatePosteriorData(mean: number, std: number) {
    const points = [];
    for (let x = mean - 3 * std; x <= mean + 3 * std; x += std * 0.1) {
      const density =
        (1 / (std * Math.sqrt(2 * Math.PI))) *
        Math.exp(-0.5 * Math.pow((x - mean) / std, 2));
      points.push({ x: parseFloat(x.toFixed(3)), density: parseFloat(density.toFixed(6)) });
    }
    return points;
  }

  return (
    <div className="space-y-6">
      {/* Convergence Diagnostics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Convergence Diagnostics
            <Badge
              variant={
                diagnostics.convergence_status === "good"
                  ? "success"
                  : diagnostics.convergence_status === "acceptable"
                    ? "warning"
                    : "error"
              }
            >
              {diagnostics.convergence_status}
            </Badge>
          </CardTitle>
          <CardDescription>
            MCMC sampler convergence and model quality metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Metric
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Value
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Threshold
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {convergenceRows.map((row) => (
                  <tr key={row.metric}>
                    <td className="px-4 py-2 font-medium text-gray-900">
                      {row.metric}
                    </td>
                    <td className="px-4 py-2 font-mono text-gray-700">
                      {row.value}
                    </td>
                    <td className="px-4 py-2 text-gray-500">{row.threshold}</td>
                    <td className="px-4 py-2 text-center">
                      {row.pass ? (
                        <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" />
                      ) : (
                        <AlertCircle className="mx-auto h-4 w-4 text-red-500" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Actual vs Predicted with HDI band */}
      <Card>
        <CardHeader>
          <CardTitle>Actual vs Predicted (with 94% HDI)</CardTitle>
          <CardDescription>
            Model predictions overlaid with highest density interval
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={tsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: number, name: string) => [
                    formatCurrency(v),
                    name,
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="hdi_upper"
                  stroke="none"
                  fill="#bac8ff"
                  fillOpacity={0.3}
                  name="HDI Upper"
                />
                <Area
                  type="monotone"
                  dataKey="hdi_lower"
                  stroke="none"
                  fill="#ffffff"
                  fillOpacity={1}
                  name="HDI Lower"
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#1e293b"
                  strokeWidth={1.5}
                  dot={false}
                  name="Actual"
                />
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke="#4c6ef5"
                  strokeWidth={2}
                  dot={false}
                  name="Predicted"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Residuals */}
      <Card>
        <CardHeader>
          <CardTitle>Residuals</CardTitle>
          <CardDescription>
            Actual minus predicted — check for systematic bias
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={residualData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: number) => [formatCurrency(v), "Residual"]}
                />
                <Area
                  type="monotone"
                  dataKey="residual"
                  stroke="#4c6ef5"
                  fill="#bac8ff"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Posterior Distributions (ROAS) */}
      <Card>
        <CardHeader>
          <CardTitle>Posterior Distributions (ROAS)</CardTitle>
          <CardDescription>
            Bayesian posterior density estimates for channel ROAS
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {channel_results.map((ch, i) => {
              const mean = ch.roas.mean;
              const std = (ch.roas.hdi_97 - ch.roas.hdi_3) / 4; // approximate
              const data = generatePosteriorData(mean, std);
              const color = ["#4c6ef5", "#f59f00", "#40c057", "#e64980"][
                i % 4
              ];
              return (
                <div key={ch.channel}>
                  <p className="mb-1 text-sm font-medium text-gray-700">
                    {ch.channel}{" "}
                    <span className="font-normal text-gray-400">
                      (mean: ${mean.toFixed(2)})
                    </span>
                  </p>
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data}>
                        <XAxis
                          dataKey="x"
                          tick={{ fontSize: 10 }}
                          tickFormatter={(v) => `$${v}`}
                        />
                        <YAxis hide />
                        <Tooltip
                          formatter={(v: number) => [v.toFixed(4), "Density"]}
                          labelFormatter={(v) => `ROAS: $${v}`}
                        />
                        <Area
                          type="monotone"
                          dataKey="density"
                          stroke={color}
                          fill={color}
                          fillOpacity={0.15}
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Parameter Table */}
      <Card>
        <CardHeader>
          <CardTitle>Channel Parameters</CardTitle>
          <CardDescription>
            Estimated adstock and saturation parameters
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Channel
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Adstock
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Alpha
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Lag (wks)
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Saturation
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Sat. %
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    ROAS [94% HDI]
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {channel_results.map((ch) => (
                  <tr key={ch.channel}>
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-900">
                      {ch.channel}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {ch.adstock_params.type}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-600">
                      {ch.adstock_params.alpha?.toFixed(2) ?? "N/A"}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-600">
                      {ch.adstock_params.mean_lag_weeks.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {ch.saturation_params.type}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`font-mono ${
                          ch.saturation_pct >= 0.8
                            ? "text-red-600"
                            : ch.saturation_pct >= 0.6
                              ? "text-amber-600"
                              : "text-emerald-600"
                        }`}
                      >
                        {(ch.saturation_pct * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-gray-600">
                      ${ch.roas.mean.toFixed(2)} [${ch.roas.hdi_3.toFixed(2)},{" "}
                      ${ch.roas.hdi_97.toFixed(2)}]
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
