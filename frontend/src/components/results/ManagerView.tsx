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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/shared";
import type { ModelResults } from "@/types";
import { formatCurrency } from "@/lib/utils";

interface ManagerViewProps {
  results: ModelResults;
}

export default function ManagerView({ results }: ManagerViewProps) {
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

  // Saturation data
  const saturationData = channel_results.map((ch) => ({
    channel: ch.channel,
    saturation: Math.round(ch.saturation_pct * 100),
  }));

  // Adstock decay curves
  const adstockData = Array.from({ length: 12 }, (_, week) => {
    const point: Record<string, number | string> = { week: `W${week}` };
    for (const ch of channel_results) {
      const alpha = ch.adstock_params.alpha ?? 0.5;
      point[ch.channel] = Math.round(Math.pow(alpha, week) * 100);
    }
    return point;
  });

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

        {/* Saturation */}
        <Card>
          <CardHeader>
            <CardTitle>Channel Saturation</CardTitle>
            <CardDescription>
              How close each channel is to diminishing returns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {saturationData.map((d) => (
                <div key={d.channel}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm text-gray-700">{d.channel}</span>
                    <span className="text-sm font-medium text-gray-900">
                      {d.saturation}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className={`h-full rounded-full transition-all ${
                        d.saturation >= 80
                          ? "bg-red-500"
                          : d.saturation >= 60
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                      }`}
                      style={{ width: `${d.saturation}%` }}
                    />
                  </div>
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
    </div>
  );
}

