import { useState } from "react";
import { Zap, FlaskConical, Info } from "lucide-react";
import { Button, Card, CardContent } from "@/components/shared";
import { useModelStore } from "@/store/model";
import { cn } from "@/lib/utils";
import type { ModelRunConfig } from "@/types";

interface ModelConfigFormProps {
  datasetId: string;
  onSubmit: (config: ModelRunConfig) => void;
}

export default function ModelConfigForm({
  datasetId,
  onSubmit,
}: ModelConfigFormProps) {
  const { config, setConfig } = useModelStore();
  const [name, setName] = useState("");

  function handleSubmit() {
    const runConfig: ModelRunConfig = {
      dataset_id: datasetId,
      name: name || `Run ${new Date().toLocaleDateString()}`,
      adstock_type: config.adstock_type,
      saturation_type: config.saturation_type,
      n_samples: config.mode === "quick" ? 500 : 2000,
      n_chains: config.mode === "quick" ? 2 : 4,
      target_accept: 0.9,
      yearly_seasonality: config.yearly_seasonality,
      mode: config.mode,
    };
    onSubmit(runConfig);
  }

  return (
    <div className="space-y-5">
      {/* Run Name */}
      <div>
        <label htmlFor="run-name" className="mb-1.5 block text-sm font-medium text-gray-700">
          Run Name
        </label>
        <input
          id="run-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Run ${new Date().toLocaleDateString()}`}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {/* Mode Toggle */}
      <div>
        <p className="mb-2 block text-sm font-medium text-gray-700">
          Run Mode
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setConfig({ mode: "quick" })}
            className={cn(
              "flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-colors",
              config.mode === "quick"
                ? "border-brand-500 bg-brand-50"
                : "border-gray-200 hover:border-gray-300",
            )}
            aria-label="Select quick mode - 3 minutes, 500 samples"
            aria-pressed={config.mode === "quick"}
          >
            <div
              className={cn(
                "rounded-lg p-2",
                config.mode === "quick" ? "bg-brand-100" : "bg-gray-100",
              )}
            >
              <Zap
                className={cn(
                  "h-5 w-5",
                  config.mode === "quick" ? "text-brand-600" : "text-gray-400",
                )}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Quick</p>
              <p className="text-xs text-gray-500">~3 min, 500 samples</p>
            </div>
          </button>
          <button
            onClick={() => setConfig({ mode: "full" })}
            className={cn(
              "flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-colors",
              config.mode === "full"
                ? "border-brand-500 bg-brand-50"
                : "border-gray-200 hover:border-gray-300",
            )}
            aria-label="Select full mode - 12 minutes, 2000 samples"
            aria-pressed={config.mode === "full"}
          >
            <div
              className={cn(
                "rounded-lg p-2",
                config.mode === "full" ? "bg-brand-100" : "bg-gray-100",
              )}
            >
              <FlaskConical
                className={cn(
                  "h-5 w-5",
                  config.mode === "full" ? "text-brand-600" : "text-gray-400",
                )}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Full</p>
              <p className="text-xs text-gray-500">~12 min, 2000 samples</p>
            </div>
          </button>
        </div>
      </div>

      {/* Adstock Type */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Adstock Type</p>
              <p className="text-xs text-gray-500">
                How advertising effects decay over time
              </p>
            </div>
            <div className="flex rounded-lg border border-gray-200 p-0.5">
              <button
                onClick={() => setConfig({ adstock_type: "geometric" })}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  config.adstock_type === "geometric"
                    ? "bg-brand-600 text-white"
                    : "text-gray-500 hover:text-gray-700",
                )}
                aria-label="Select geometric adstock type"
                aria-pressed={config.adstock_type === "geometric"}
              >
                Geometric
              </button>
              <button
                onClick={() => setConfig({ adstock_type: "weibull" })}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  config.adstock_type === "weibull"
                    ? "bg-brand-600 text-white"
                    : "text-gray-500 hover:text-gray-700",
                )}
                aria-label="Select weibull adstock type"
                aria-pressed={config.adstock_type === "weibull"}
              >
                Weibull
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Saturation Type */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                Saturation Type
              </p>
              <p className="text-xs text-gray-500">
                How channels reach diminishing returns
              </p>
            </div>
            <div className="flex rounded-lg border border-gray-200 p-0.5">
              <button
                onClick={() => setConfig({ saturation_type: "logistic" })}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  config.saturation_type === "logistic"
                    ? "bg-brand-600 text-white"
                    : "text-gray-500 hover:text-gray-700",
                )}
                aria-label="Select logistic saturation type"
                aria-pressed={config.saturation_type === "logistic"}
              >
                Logistic
              </button>
              <button
                onClick={() => setConfig({ saturation_type: "hill" })}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  config.saturation_type === "hill"
                    ? "bg-brand-600 text-white"
                    : "text-gray-500 hover:text-gray-700",
                )}
                aria-label="Select hill saturation type"
                aria-pressed={config.saturation_type === "hill"}
              >
                Hill
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seasonality */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                Yearly Seasonality
              </p>
              <p className="text-xs text-gray-500">
                Account for seasonal patterns in your data
              </p>
            </div>
            <button
              onClick={() =>
                setConfig({ yearly_seasonality: config.yearly_seasonality > 0 ? 0 : 2 })
              }
              className={cn(
                "relative h-6 w-11 rounded-full transition-colors",
                config.yearly_seasonality > 0 ? "bg-brand-600" : "bg-gray-300",
              )}
              aria-label="Toggle yearly seasonality"
              aria-pressed={config.yearly_seasonality > 0}
            >
              <span
                className={cn(
                  "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                  config.yearly_seasonality > 0 && "translate-x-5",
                )}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Info note */}
      <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          {config.mode === "quick"
            ? "Quick mode uses fewer samples (500) and chains (2) for faster iteration. Good for initial exploration."
            : "Full mode uses 2000 samples across 4 chains for publication-quality results. Recommended for final analysis."}
        </p>
      </div>

      <Button onClick={handleSubmit} className="w-full">
        Start Model Run
      </Button>
    </div>
  );
}
