import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { TrendingUp, DollarSign, Target, Lightbulb } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/shared";
import type { ModelResults } from "@/types";
import { formatPercent } from "@/lib/utils";

interface ExecutiveViewProps {
  results: ModelResults;
}

const PIE_COLORS = ["#4c6ef5", "#f59f00", "#40c057", "#e64980", "#7950f2"];

export default function ExecutiveView({ results }: ExecutiveViewProps) {
  const { channel_results, base_sales, summary_text, top_recommendation, diagnostics } =
    results;

  const pieData = [
    { name: "Base Sales", value: base_sales.share_of_total },
    ...channel_results.map((c) => ({
      name: c.channel,
      value: c.contribution_share,
    })),
  ];

  const bestRoas = [...channel_results].sort(
    (a, b) => b.roas.mean - a.roas.mean,
  )[0];
  const highestContrib = [...channel_results].sort(
    (a, b) => b.contribution_share - a.contribution_share,
  )[0];

  return (
    <div className="space-y-6">
      {/* Hero metrics */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-emerald-50 p-2">
                <Target className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Model Fit (R-squared)</p>
                <p className="mt-0.5 text-2xl font-bold text-gray-900">
                  {(diagnostics.r_squared * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-gray-400">
                  MAPE: {(diagnostics.mape * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-brand-50 p-2">
                <DollarSign className="h-5 w-5 text-brand-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Best ROAS</p>
                <p className="mt-0.5 text-2xl font-bold text-gray-900">
                  ${bestRoas?.roas.mean.toFixed(2) ?? "N/A"}
                </p>
                <p className="text-xs text-gray-400">
                  {bestRoas?.channel ?? ""} channel
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-amber-50 p-2">
                <TrendingUp className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Top Contributor</p>
                <p className="mt-0.5 text-2xl font-bold text-gray-900">
                  {formatPercent(highestContrib?.contribution_share ?? 0)}
                </p>
                <p className="text-xs text-gray-400">
                  {highestContrib?.channel ?? ""} of incremental revenue
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue Decomposition Pie */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Decomposition</CardTitle>
            <CardDescription>
              Share of total revenue by channel
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) =>
                      `${name}: ${(value * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {pieData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatPercent(value)}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle>Channel Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {channel_results.map((ch) => (
                <div
                  key={ch.channel}
                  className="rounded-lg border border-gray-100 p-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">
                      {ch.channel}
                    </p>
                    <span className="text-xs font-medium text-gray-500">
                      ROAS ${ch.roas.mean.toFixed(2)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {ch.recommendation}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* NL Summary */}
      <Card className="border-brand-100 bg-brand-50/20">
        <CardContent className="flex items-start gap-4 p-5">
          <div className="rounded-lg bg-brand-100 p-2">
            <Lightbulb className="h-5 w-5 text-brand-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">AI Summary</p>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">
              {summary_text}
            </p>
            <div className="mt-3 rounded-lg bg-white/60 p-3">
              <p className="text-xs font-medium text-gray-700">
                Top Recommendation
              </p>
              <p className="mt-0.5 text-sm text-gray-600">
                {top_recommendation}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
