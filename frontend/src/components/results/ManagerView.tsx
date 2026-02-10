import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ErrorBar,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";
import Plot from "react-plotly.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/shared";
import type { ModelResults } from "@/types";
import { formatCurrency } from "@/lib/utils";
import BudgetOptimizer from "./BudgetOptimizer";

interface ManagerViewProps {
  results: ModelResults;
  runId: string;
}

export default function ManagerView({ results, runId }: ManagerViewProps) {
  const { channel_results, decomposition_ts, base_sales } = results;

  // ROAS bar chart data
  const roasData = channel_results.map((ch) => ({
    channel: ch.channel,
    roas: ch.roas.mean,
    low: ch.roas.mean - ch.roas.hdi_3,
    high: ch.roas.hdi_97 - ch.roas.mean,
  }));

  // Waterfall data
  const waterfallData = [
    {
      name: "Base Sales",
      value: base_sales.weekly_mean,
      fill: "#94a3b8",
    },
    ...channel_results.map((ch, i) => ({
      name: ch.channel,
      value: ch.weekly_contribution_mean,
      fill: ["#4c6ef5", "#f59f00", "#40c057", "#e64980"][i % 4],
    })),
  ];

  // Adstock decay curves (prefer backend-computed, fallback to geometric)
  const adstockData = (() => {
    const curves = results.adstock_decay_curves;
    if (curves && Object.keys(curves).length > 0) {
      // Use backend-computed curves (handles both geometric + Weibull)
      const firstChannel = Object.values(curves)[0];
      return (firstChannel?.weeks || []).map((week: number, idx: number) => {
        const point: Record<string, number | string> = { week: `W${week}` };
        for (const ch of channel_results) {
          const chCurve = curves[ch.channel];
          point[ch.channel] = chCurve
            ? Math.round((chCurve.decay_weights[idx] ?? 0) * 100)
            : 0;
        }
        return point;
      });
    }
    // Fallback: calculate from adstock_params (backward compat)
    return Array.from({ length: 12 }, (_, week) => {
      const point: Record<string, number | string> = { week: `W${week}` };
      for (const ch of channel_results) {
        const alpha = ch.adstock_params.alpha ?? 0.5;
        point[ch.channel] = Math.round(Math.pow(alpha, week) * 100);
      }
      return point;
    });
  })();

  // Decomposition time series (downsample for readability)
  const tsLength = decomposition_ts.dates.length;
  const step = Math.max(1, Math.floor(tsLength / 52));
  const tsData = decomposition_ts.dates
    .filter((_, i) => i % step === 0)
    .map((date, idx) => {
      const i = idx * step;
      return {
        date: date.slice(5), // MM-DD
        actual: decomposition_ts.actual[i] ?? 0,
        predicted: decomposition_ts.predicted[i] ?? 0,
        base: decomposition_ts.base[i] ?? 0,
      };
    });

  return (
    <div className="space-y-6">
      {/* ROAS Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Return on Ad Spend (ROAS) by Channel</CardTitle>
          <CardDescription>
            Mean ROAS with 94% credible intervals
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={roasData}
                layout="vertical"
                margin={{ left: 80, right: 20, top: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `$${v}`} />
                <YAxis type="category" dataKey="channel" width={80} />
                <Tooltip
                  formatter={(value: number) => [`$${value.toFixed(2)}`, "ROAS"]}
                />
                <Bar dataKey="roas" fill="#4c6ef5" radius={[0, 4, 4, 0]}>
                  <ErrorBar
                    dataKey="high"
                    width={8}
                    stroke="#364fc7"
                    strokeWidth={1.5}
                    direction="x"
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Waterfall */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Revenue Contribution</CardTitle>
            <CardDescription>
              Average weekly contribution by source
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={waterfallData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    angle={-15}
                  />
                  <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number) => [
                      formatCurrency(value),
                      "Weekly Avg.",
                    ]}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {waterfallData.map((d, i) => (
                      <Cell key={i} fill={d.fill as string} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Response Curves (Saturation) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Response Curves</CardTitle>
            <CardDescription>
              Spend vs predicted contribution — how each channel responds to budget changes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <Plot
                data={[
                  ...channel_results.map((ch, i) => {
                    const curve = results.response_curves?.[ch.channel];
                    if (!curve) return null;
                    return {
                      x: curve.spend_levels,
                      y: curve.predicted_contribution,
                      type: 'scatter' as const,
                      mode: 'lines' as const,
                      name: ch.channel,
                      line: { color: ["#4c6ef5", "#f59f00", "#40c057", "#e64980"][i % 4], width: 2.5 },
                    };
                  }).filter(Boolean),
                  ...channel_results.map((ch, i) => {
                    const curve = results.response_curves?.[ch.channel];
                    if (!curve) return null;
                    return {
                      x: [curve.current_spend],
                      y: [curve.current_contribution],
                      type: 'scatter' as const,
                      mode: 'markers' as const,
                      name: `${ch.channel} (current)`,
                      marker: { color: ["#4c6ef5", "#f59f00", "#40c057", "#e64980"][i % 4], size: 10, symbol: 'circle' },
                      showlegend: false,
                    };
                  }).filter(Boolean),
                ] as any[]}
                layout={{
                  autosize: true,
                  margin: { l: 60, r: 20, t: 10, b: 50 },
                  xaxis: { title: 'Weekly Spend ($)', tickprefix: '$', tickformat: ',.0f' },
                  yaxis: { title: 'Predicted Contribution ($)', tickprefix: '$', tickformat: ',.0f' },
                  legend: { orientation: 'h', y: -0.15 },
                  plot_bgcolor: 'white',
                  paper_bgcolor: 'white',
                  font: { family: 'Inter, system-ui, sans-serif', size: 12 },
                }}
                config={{ displayModeBar: false, responsive: true }}
                useResizeHandler
                style={{ width: '100%', height: '100%' }}
              />
            </div>
            {/* Saturation indicators below chart */}
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {channel_results.map((ch) => (
                <div key={ch.channel} className="rounded-lg border border-gray-100 p-3 text-center">
                  <p className="text-xs text-gray-500">{ch.channel}</p>
                  <p className={`text-lg font-bold ${
                    ch.saturation_pct >= 0.8 ? "text-red-600" :
                    ch.saturation_pct >= 0.6 ? "text-amber-600" : "text-emerald-600"
                  }`}>
                    {Math.round(ch.saturation_pct * 100)}% saturated
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Adstock Decay */}
      <Card>
        <CardHeader>
          <CardTitle>Adstock Decay Curves</CardTitle>
          <CardDescription>
            How advertising effects carry over across weeks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={adstockData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis
                  tickFormatter={(v) => `${v}%`}
                  domain={[0, 100]}
                />
                <Tooltip formatter={(v: number) => [`${v}%`, "Retention"]} />
                {channel_results.map((ch, i) => (
                  <Line
                    key={ch.channel}
                    type="monotone"
                    dataKey={ch.channel}
                    stroke={
                      ["#4c6ef5", "#f59f00", "#40c057", "#e64980"][i % 4]
                    }
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Actual vs Predicted */}
      <Card>
        <CardHeader>
          <CardTitle>Actual vs Predicted Revenue</CardTitle>
          <CardDescription>Weekly time series comparison</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={tsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: number) => [formatCurrency(v), ""]}
                />
                <Area
                  type="monotone"
                  dataKey="base"
                  stackId="1"
                  fill="#e2e8f0"
                  stroke="#94a3b8"
                  fillOpacity={0.5}
                  name="Base"
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#1e293b"
                  strokeWidth={2}
                  dot={false}
                  name="Actual"
                />
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke="#4c6ef5"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="4 2"
                  name="Predicted"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Budget Optimizer */}
      {results.response_curves && Object.keys(results.response_curves).length > 0 && (
        <BudgetOptimizer
          runId={runId}
          channelNames={channel_results.map(ch => ch.channel)}
          currentSpend={Object.fromEntries(
            channel_results.map(ch => [ch.channel, results.response_curves[ch.channel]?.current_spend ?? 0])
          )}
        />
      )}
    </div>
  );
}

