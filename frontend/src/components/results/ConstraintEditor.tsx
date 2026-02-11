import { useState } from "react";
import { ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

interface ConstraintEditorProps {
  channelNames: string[];
  totalBudget: number;
  minConstraints: Record<string, number>;
  maxConstraints: Record<string, number>;
  onMinChange: (channel: string, value: number) => void;
  onMaxChange: (channel: string, value: number) => void;
  onClearAll: () => void;
}

export default function ConstraintEditor({
  channelNames,
  totalBudget,
  minConstraints,
  maxConstraints,
  onMinChange,
  onMaxChange,
  onClearAll,
}: ConstraintEditorProps) {
  const [open, setOpen] = useState(false);

  const sumMins = Object.values(minConstraints).reduce((a, b) => a + b, 0);
  const hasAnyConstraint = Object.values(minConstraints).some(v => v > 0)
    || Object.values(maxConstraints).some(v => v > 0);

  function getErrors(channel: string): string | null {
    const min = minConstraints[channel] || 0;
    const max = maxConstraints[channel] || 0;
    if (min < 0) return "Min must be ≥ 0";
    if (max > 0 && max > totalBudget) return `Max exceeds total budget (${formatCurrency(totalBudget)})`;
    if (min > 0 && max > 0 && min > max) return "Min cannot exceed max";
    return null;
  }

  const sumMinError = sumMins > totalBudget
    ? `Sum of minimums (${formatCurrency(sumMins)}) exceeds total budget (${formatCurrency(totalBudget)})`
    : null;

  return (
    <div className="rounded-lg border border-gray-200">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <span className="flex items-center gap-2">
          Channel Constraints
          {hasAnyConstraint && (
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-700">Active</span>
          )}
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="border-t border-gray-200 px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">Set min/max spend per channel</p>
            {hasAnyConstraint && (
              <button
                type="button"
                onClick={onClearAll}
                className="text-xs text-red-600 hover:text-red-700"
              >
                Clear All
              </button>
            )}
          </div>

          {sumMinError && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              {sumMinError}
            </div>
          )}

          <div className="space-y-2">
            {channelNames.map((ch) => {
              const min = minConstraints[ch] || 0;
              const max = maxConstraints[ch] || 0;
              const error = getErrors(ch);
              const barMin = totalBudget > 0 ? (min / totalBudget) * 100 : 0;
              const barMax = totalBudget > 0 && max > 0 ? (max / totalBudget) * 100 : 100;

              return (
                <div key={ch} className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="w-24 truncate text-sm font-medium text-gray-700" title={ch}>
                      {ch}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs text-gray-500">Min $</label>
                      <input
                        type="number"
                        value={min || ""}
                        onChange={(e) => onMinChange(ch, Number(e.target.value) || 0)}
                        placeholder="0"
                        min={0}
                        step={100}
                        className={cn(
                          "w-24 rounded border px-2 py-1 text-xs",
                          error ? "border-red-300" : "border-gray-300",
                        )}
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs text-gray-500">Max $</label>
                      <input
                        type="number"
                        value={max || ""}
                        onChange={(e) => onMaxChange(ch, Number(e.target.value) || 0)}
                        placeholder="No limit"
                        min={0}
                        step={100}
                        className={cn(
                          "w-24 rounded border px-2 py-1 text-xs",
                          error ? "border-red-300" : "border-gray-300",
                        )}
                      />
                    </div>
                    <div className="relative ml-2 hidden h-2 flex-1 rounded-full bg-gray-100 sm:block">
                      <div
                        className="absolute h-full rounded-full bg-brand-200"
                        style={{ left: `${barMin}%`, width: `${Math.max(0, barMax - barMin)}%` }}
                      />
                    </div>
                  </div>
                  {error && (
                    <p className="ml-24 pl-1 text-xs text-red-600">{error}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
