import { X } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/shared";
import { formatCurrency } from "@/lib/utils";

export interface SavedScenario {
  label: string;
  budget: number;
  allocations: Record<string, number>;
  contributions: Record<string, number>;
  totalContribution: number;
}

interface ScenarioComparisonProps {
  scenarios: SavedScenario[];
  channelNames: string[];
  onRemove: (index: number) => void;
}

export default function ScenarioComparison({
  scenarios,
  channelNames,
  onRemove,
}: ScenarioComparisonProps) {
  if (scenarios.length < 2) return null;

  function bestInRow(values: number[]): number {
    return Math.max(...values);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Scenario Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  Channel
                </th>
                {scenarios.map((s, i) => (
                  <th key={i} className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500">
                    <div className="flex items-center justify-end gap-1">
                      <span>{s.label}</span>
                      <button
                        type="button"
                        onClick={() => onRemove(i)}
                        className="ml-1 rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                        aria-label={`Remove ${s.label}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="text-[10px] font-normal text-gray-400">
                      Budget: {formatCurrency(s.budget)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {channelNames.map((ch) => {
                const contribs = scenarios.map(s => s.contributions[ch] || 0);
                const best = bestInRow(contribs);
                return (
                  <tr key={ch}>
                    <td className="px-3 py-2 font-medium text-gray-900">{ch}</td>
                    {scenarios.map((s, i) => {
                      const val = s.contributions[ch] || 0;
                      return (
                        <td
                          key={i}
                          className={`px-3 py-2 text-right font-mono ${
                            val === best && best > 0 ? "text-emerald-700 font-semibold" : "text-gray-600"
                          }`}
                        >
                          {formatCurrency(val)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              <tr className="bg-gray-50 font-semibold">
                <td className="px-3 py-2 text-gray-900">Total</td>
                {scenarios.map((s, i) => {
                  const totals = scenarios.map(sc => sc.totalContribution);
                  const best = bestInRow(totals);
                  return (
                    <td
                      key={i}
                      className={`px-3 py-2 text-right font-mono ${
                        s.totalContribution === best ? "text-emerald-700" : "text-gray-600"
                      }`}
                    >
                      {formatCurrency(s.totalContribution)}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
