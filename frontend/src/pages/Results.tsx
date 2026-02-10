import { useParams } from "react-router-dom";

export default function Results() {
  const { runId } = useParams<{ runId: string }>();

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">
        Results — Run {runId?.slice(0, 8)}
      </h1>
      <div className="rounded-xl border border-gray-200 bg-white p-8">
        <p className="text-gray-500">
          Results dashboard with Executive/Manager/Analyst views will be implemented here.
        </p>
        {/* TODO: View switcher, charts, summaries */}
      </div>
    </div>
  );
}
