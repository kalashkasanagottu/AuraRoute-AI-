import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { loadTelemetry } from './api/aurarouteClient.ts';
import { evaluateDecision } from './shared/decisionEngine.ts';
import type { TelemetryPayload, UserContext } from './shared/types.ts';
import { ContextPanel } from './components/ContextPanel.tsx';
import { VerdictCard } from './components/VerdictCard.tsx';
import { TelemetryGrid } from './components/TelemetryGrid.tsx';
import { HourlyTimeline } from './components/HourlyTimeline.tsx';
import { AssistantChat } from './components/AssistantChat.tsx';
import { MapPin, Navigation, RefreshCw, Radio } from 'lucide-react';

const PRESET_CITIES = [
  'New Delhi',
  'Bengaluru',
  'Mumbai',
  'Hyderabad',
  'Chennai',
  'Pune',
  'Kolkata',
];

const DEFAULT_CONTEXT: UserContext = {
  persona: 'daily_commuter',
  transportMode: 'cycling_two_wheeler',
  timeHorizon: 'now',
  asthmaOrRespiratory: false,
  heatSensitive: false,
  lowLightCaution: false,
};

export default function App() {
  const [cityInput, setCityInput] = useState('New Delhi');
  const [activeQuery, setActiveQuery] = useState<{
    city?: string;
    lat?: number;
    lon?: number;
    label?: string;
  }>({ city: 'New Delhi' });

  const [telemetry, setTelemetry] = useState<TelemetryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [context, setContext] = useState<UserContext>(DEFAULT_CONTEXT);

  const fetchLatest = useCallback(async (query: typeof activeQuery) => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadTelemetry(query);
      setTelemetry(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch live telemetry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLatest(activeQuery);
  }, [activeQuery, fetchLatest]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      void fetchLatest(activeQuery);
    }, 60_000);
    return () => clearInterval(id);
  }, [autoRefresh, activeQuery, fetchLatest]);

  const assessment = useMemo(() => {
    if (!telemetry) return null;
    return evaluateDecision(telemetry.current, telemetry.hourly, context, telemetry.traffic);
  }, [telemetry, context]);

  const handleCitySearch = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = cityInput.trim();
    if (!trimmed) return;
    setActiveQuery({ city: trimmed });
  };

  const handleUseGeolocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setActiveQuery({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          label: 'Your Live Location',
        });
      },
      () => {
        setLoading(false);
        setError('Location permission denied. Search for any city manually instead.');
      },
      { timeout: 8000 }
    );
  };

  const locationDisplay = telemetry
    ? [telemetry.location.name, telemetry.location.region, telemetry.location.country]
        .filter(Boolean)
        .join(', ')
    : cityInput;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/90 sticky top-0 z-20 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/40 text-sky-400 font-bold text-sm">
                  AR
                </span>
                <h1 className="text-lg font-bold text-white tracking-tight">AuraRoute AI</h1>
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <Radio className="w-3 h-3" aria-hidden="true" />
                  Real-Time
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Context-Aware Mobility, Air Quality &amp; Weather Safety Copilot
              </p>
            </div>
          </div>

          {/* Location & Refresh Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <form onSubmit={handleCitySearch} className="flex items-center gap-1.5">
              <label htmlFor="city-search" className="sr-only">
                Search city
              </label>
              <div className="relative">
                <MapPin
                  className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  id="city-search"
                  type="text"
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                  placeholder="Enter city..."
                  className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 w-44 sm:w-52"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-sky-500 text-slate-950 text-sm font-semibold hover:bg-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-300"
              >
                Check
              </button>
            </form>

            <button
              type="button"
              onClick={handleUseGeolocation}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-medium text-slate-200 hover:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <Navigation className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
              Use GPS
            </button>

            <button
              type="button"
              onClick={() => void fetchLatest(activeQuery)}
              disabled={loading}
              aria-label="Refresh live telemetry"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 hover:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </button>

            <label className="inline-flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer ml-1">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500"
              />
              Auto 60s
            </label>
          </div>
        </div>

        {/* Preset cities */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-2.5 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400">Quick cities:</span>
          {PRESET_CITIES.map((city) => (
            <button
              key={city}
              type="button"
              onClick={() => {
                setCityInput(city);
                setActiveQuery({ city });
              }}
              className="px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300 hover:border-sky-500 hover:text-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {city}
            </button>
          ))}
          {telemetry && (
            <span className="ml-auto text-[11px] text-slate-400">
              Updated: {new Date(telemetry.fetchedAtIso).toLocaleTimeString()} ({telemetry.location.timezone})
            </span>
          )}
        </div>
      </header>

      {/* Main Layout */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {error && (
          <div
            role="alert"
            className="mb-5 bg-rose-500/10 border border-rose-500/30 text-rose-200 rounded-xl p-4 text-sm"
          >
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4">
            <ContextPanel context={context} onChange={setContext} />
          </div>

          <div className="lg:col-span-8 space-y-6">
            {loading && !telemetry ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-sm text-slate-400">
                Fetching live weather and air quality telemetry...
              </div>
            ) : telemetry && assessment ? (
              <>
                <VerdictCard assessment={assessment} locationLabel={locationDisplay} />
                <TelemetryGrid snapshot={telemetry.current} traffic={telemetry.traffic} />
                <HourlyTimeline
                  hourlyScores={assessment.hourlyScores}
                  optimalWindow={assessment.optimalWindow}
                />
                <AssistantChat telemetry={telemetry} context={context} />
              </>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
