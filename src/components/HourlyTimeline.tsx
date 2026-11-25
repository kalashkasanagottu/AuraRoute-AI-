import type { HourlyScore, OptimalWindow } from '../shared/types.ts';

interface HourlyTimelineProps {
  hourlyScores: HourlyScore[];
  optimalWindow: OptimalWindow | null;
}

export function HourlyTimeline({ hourlyScores, optimalWindow }: HourlyTimelineProps) {
  if (hourlyScores.length === 0) return null;

  return (
    <section
      aria-label="12-hour optimal departure timeline"
      className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-white">12-Hour Readiness Forecast</h2>
          <p className="text-xs text-slate-400">
            Dynamically scored for your selected persona, mode, and health sensitivities.
          </p>
        </div>
        {optimalWindow && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30 font-medium">
            Best Window: {optimalWindow.hourLabel} ({optimalWindow.score}/100)
          </span>
        )}
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2 pt-1">
        {hourlyScores.map((slot) => {
          const isBest = optimalWindow?.timeIso === slot.timeIso;
          const barColor =
            slot.score >= 82
              ? 'bg-emerald-500'
              : slot.score >= 62
                ? 'bg-amber-500'
                : slot.score >= 40
                  ? 'bg-orange-500'
                  : 'bg-rose-500';

          return (
            <div
              key={slot.timeIso}
              className={`rounded-lg p-2 border text-center flex flex-col items-center justify-between ${
                isBest
                  ? 'bg-sky-500/10 border-sky-400'
                  : 'bg-slate-950/70 border-slate-800'
              }`}
              title={`${slot.hourLabel}: Score ${slot.score}/100 | AQI ${Math.round(
                slot.usAqi
              )} | Rain ${Math.round(slot.precipitationProbPct)}%`}
            >
              <span className="text-[11px] font-medium text-slate-300">{slot.hourLabel}</span>
              <div className="w-full h-14 flex items-end justify-center my-1.5 bg-slate-900 rounded overflow-hidden">
                <div
                  className={`w-full ${barColor} transition-all`}
                  style={{ height: `${Math.max(12, slot.score)}%` }}
                />
              </div>
              <span className="text-xs font-bold text-white">{slot.score}</span>
              <span className="text-[10px] text-slate-400">AQI {Math.round(slot.usAqi)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
