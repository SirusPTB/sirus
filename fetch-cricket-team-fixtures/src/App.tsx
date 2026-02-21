import { useEffect, useMemo, useState } from "react";

type ApiResponse = {
  ok: boolean;
  dataset?: {
    generatedAt: string | null;
    source: string | null;
    team: { id: string; name: string } | null;
  };
  query?: Record<string, string>;
  count?: number;
  fixtures?: Array<{
    id: string;
    startTime: string;
    endTime: string | null;
    format: string;
    opponent: string;
    homeAway: "home" | "away";
    venue: string;
    city: string;
    country: string;
    competition: string;
    status: "scheduled" | "completed" | "cancelled";
  }>;
  error?: string;
  message?: string;
};

function buildQuery(params: Record<string, string>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v.trim() !== "") sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

function formatLocal(dtIso: string) {
  const d = new Date(dtIso);
  if (Number.isNaN(d.getTime())) return dtIso;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function App() {
  const [swStatus, setSwStatus] = useState<string>("Not registered");

  const [from, setFrom] = useState<string>("2026-03-01");
  const [to, setTo] = useState<string>("2026-03-31");
  const [format, setFormat] = useState<string>("");
  const [opponent, setOpponent] = useState<string>("");
  const [homeAway, setHomeAway] = useState<string>("");
  const [limit, setLimit] = useState<string>("50");
  const [pretty, setPretty] = useState<boolean>(true);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [raw, setRaw] = useState<string>("");

  const apiUrl = useMemo(() => {
    return (
      "/api/fixtures" +
      buildQuery({
        from,
        to,
        format,
        opponent,
        homeAway,
        limit,
        pretty: pretty ? "1" : "0",
      })
    );
  }, [from, to, format, opponent, homeAway, limit, pretty]);

  async function run() {
    setLoading(true);
    setResult(null);
    setRaw("");

    try {
      const res = await fetch(apiUrl, {
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      const text = await res.text();
      setRaw(text);
      const json = JSON.parse(text) as ApiResponse;
      setResult(json);
    } catch (e) {
      setRaw(String(e));
      setResult({ ok: false, error: "CLIENT_ERROR", message: String(e) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function register() {
      if (!("serviceWorker" in navigator)) {
        setSwStatus("Service Worker not supported in this browser");
        return;
      }

      try {
        setSwStatus("Registering Service Worker…");
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

        const updateStatus = () => {
          const ctrl = navigator.serviceWorker.controller;
          const state = ctrl ? "controlling" : "not controlling yet (refresh once)";
          if (!cancelled) setSwStatus(`Registered (${state})`);
        };

        updateStatus();

        reg.addEventListener("updatefound", () => {
          if (!cancelled) setSwStatus("Service Worker update found…");
        });

        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (!cancelled) setSwStatus("Service Worker now controlling (API enabled)");
        });
      } catch (err) {
        if (!cancelled) setSwStatus(`Service Worker registration failed: ${String(err)}`);
      }
    }

    register();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Auto-run once so the page is never "blank".
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Australia Cricket Fixtures — Free “API”</h1>
            <p className="text-sm text-slate-600">
              This is a static, deploy-anywhere fixtures API implemented via a Service Worker. It serves data from
              <code className="mx-1 rounded bg-slate-100 px-1 py-0.5">/fixtures.json</code>.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm">
            <div className="font-medium">API status</div>
            <div className="mt-0.5">{swStatus}</div>
          </div>
        </header>

        <main className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Endpoints</h2>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <div>
                <code className="rounded bg-slate-100 px-2 py-1">GET /api/fixtures</code>
                <span className="ml-2 text-slate-500">(JSON)</span>
              </div>
              <div>
                <code className="rounded bg-slate-100 px-2 py-1">GET /api/fixtures.ics</code>
                <span className="ml-2 text-slate-500">(Calendar export)</span>
              </div>
              <div>
                <code className="rounded bg-slate-100 px-2 py-1">GET /api/openapi.json</code>
                <span className="ml-2 text-slate-500">(OpenAPI spec)</span>
              </div>
            </div>

            <h3 className="mt-6 text-sm font-semibold text-slate-900">Playground</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <div className="text-xs font-medium text-slate-600">from (YYYY-MM-DD)</div>
                <input
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  placeholder="2026-03-01"
                />
              </label>
              <label className="space-y-1 text-sm">
                <div className="text-xs font-medium text-slate-600">to (YYYY-MM-DD)</div>
                <input
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="2026-03-31"
                />
              </label>
              <label className="space-y-1 text-sm">
                <div className="text-xs font-medium text-slate-600">format (comma-separated)</div>
                <input
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  placeholder="Test,ODI,T20I"
                />
              </label>
              <label className="space-y-1 text-sm">
                <div className="text-xs font-medium text-slate-600">opponent (substring)</div>
                <input
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                  value={opponent}
                  onChange={(e) => setOpponent(e.target.value)}
                  placeholder="india"
                />
              </label>
              <label className="space-y-1 text-sm">
                <div className="text-xs font-medium text-slate-600">homeAway</div>
                <select
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                  value={homeAway}
                  onChange={(e) => setHomeAway(e.target.value)}
                >
                  <option value="">(any)</option>
                  <option value="home">home</option>
                  <option value="away">away</option>
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <div className="text-xs font-medium text-slate-600">limit</div>
                <input
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  placeholder="50"
                  inputMode="numeric"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={pretty}
                  onChange={(e) => setPretty(e.target.checked)}
                />
                pretty JSON
              </label>

              <div className="flex gap-2">
                <button
                  onClick={run}
                  className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
                  disabled={loading}
                >
                  {loading ? "Fetching…" : "Fetch /api/fixtures"}
                </button>
                <a
                  href={"/api/fixtures.ics" + buildQuery({ from, to, format, opponent, homeAway, limit })}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50"
                >
                  Download .ics
                </a>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <div className="font-medium text-slate-800">Request URL</div>
              <div className="mt-1 break-all font-mono">{apiUrl}</div>
            </div>

            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="font-semibold">About “free fixtures”</div>
              <p className="mt-1 text-amber-900/90">
                Many official fixtures feeds don’t allow browser CORS. This demo ships a free, editable dataset at
                <code className="mx-1 rounded bg-amber-100 px-1 py-0.5">public/fixtures.json</code> so you can deploy
                a working endpoint immediately.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">Results</h2>
              <div className="text-xs text-slate-500">
                {result?.ok ? `${result.count ?? 0} fixtures` : result ? "error" : "—"}
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <div className="max-h-80 overflow-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs text-slate-600">
                    <tr>
                      <th className="border-b border-slate-200 px-3 py-2">Start</th>
                      <th className="border-b border-slate-200 px-3 py-2">Format</th>
                      <th className="border-b border-slate-200 px-3 py-2">Opponent</th>
                      <th className="border-b border-slate-200 px-3 py-2">Venue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(result?.fixtures || []).map((fx) => (
                      <tr key={fx.id} className="hover:bg-slate-50">
                        <td className="border-b border-slate-100 px-3 py-2 font-medium text-slate-900">
                          {formatLocal(fx.startTime)}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-2 text-slate-700">{fx.format}</td>
                        <td className="border-b border-slate-100 px-3 py-2 text-slate-700">{fx.opponent}</td>
                        <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                          <div className="font-medium text-slate-800">{fx.venue}</div>
                          <div className="text-xs text-slate-500">
                            {[fx.city, fx.country].filter(Boolean).join(", ")}
                          </div>
                        </td>
                      </tr>
                    ))}

                    {result?.ok && (result.fixtures?.length ?? 0) === 0 ? (
                      <tr>
                        <td className="px-3 py-6 text-center text-sm text-slate-600" colSpan={4}>
                          No fixtures matched your filters.
                        </td>
                      </tr>
                    ) : null}

                    {!result ? (
                      <tr>
                        <td className="px-3 py-6 text-center text-sm text-slate-600" colSpan={4}>
                          Loading…
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <h3 className="mt-6 text-sm font-semibold text-slate-900">Raw JSON</h3>
            <div className="mt-2 rounded-xl border border-slate-200 bg-slate-950 p-3 text-xs text-slate-100">
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words">{raw || "(empty)"}</pre>
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">Next step: make it a real public API</div>
              <p className="mt-1 text-sm text-slate-600">
                If you want an API that works for any client (not just browsers controlled by this Service Worker),
                deploy a tiny serverless proxy (Cloudflare Workers / Vercel / Netlify) that fetches fixtures from a
                source you’re allowed to use and returns normalized JSON.
              </p>
              <div className="mt-3 text-xs text-slate-600">
                Tip: This demo’s output schema is already stable—use it as your contract.
              </div>
            </div>
          </section>
        </main>

        <footer className="mt-10 text-xs text-slate-500">
          Data is currently the example dataset in <code className="rounded bg-slate-100 px-1 py-0.5">public/fixtures.json</code>.
          Update that file (or generate it in CI) to keep fixtures current.
        </footer>
      </div>
    </div>
  );
}
