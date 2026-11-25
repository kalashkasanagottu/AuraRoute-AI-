import type { DecisionAssessment, DecisionVerdict } from '../shared/types.ts';
import { CheckCircle2, AlertTriangle, Clock, OctagonAlert } from 'lucide-react';

interface VerdictCardProps {
  assessment: DecisionAssessment;
  locationLabel: string;
}

const VERDICT_STYLES: Record<
  DecisionVerdict,
  { badge: string; border: string; label: string; Icon: typeof CheckCircle2 }
> = {
  GO: {
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    border: 'border-emerald-500/30',
    label: 'GO',
    Icon: CheckCircle2,
  },
  CAUTION: {
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    border: 'border-amber-500/30',
    label: 'CAUTION',
    Icon: AlertTriangle,
  },
  DELAY_OR_REROUTE: {
    badge: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
    border: 'border-orange-500/30',
    label: 'DELAY / REROUTE',
    Icon: Clock,
  },
  AVOID: {
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
    border: 'border-rose-500/40',
    label: 'AVOID EXPOSURE',
    Icon: OctagonAlert,
  },
};

export function VerdictCard({ assessment, locationLabel }: VerdictCardProps) {
  const style = VERDICT_STYLES[assessment.verdict];
  const Icon = style.Icon;

  return (
    <section
      aria-label="Context decision verdict"
      aria-live="polite"
      className={`bg-slate-900/95 border ${style.border} rounded-xl p-5 space-y-4`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5 flex-1 min-w-[220px]">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${style.badge}`}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              {style.label}
            </span>
            <span className="text-xs text-slate-400">{locationLabel}</span>
          </div>
          <h2 className="text-lg font-bold text-white">{assessment.headline}</h2>
          <p className="text-sm text-slate-300 leading-relaxed">{assessment.summary}</p>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-center min-w-[110px]">
          <div className="text-[11px] uppercase tracking-wider text-slate-400">Readiness</div>
          <div className="text-3xl font-extrabold text-white">{assessment.score}</div>
          <div className="text-[11px] text-slate-400">out of 100</div>
        </div>
      </div>

      {/* Active Risk Factors */}
      {assessment.riskFactors.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-slate-800/80">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Active Risk Drivers
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {assessment.riskFactors.map((rf) => (
              <div
                key={rf.id}
                className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 text-xs space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-100">{rf.label}</span>
                  <span className="text-amber-300 font-mono">-{rf.penalty} pts</span>
                </div>
                <div className="text-sky-300 font-medium">{rf.metricValue}</div>
                <p className="text-slate-400 leading-snug">{rf.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actionable Checklist */}
      <div className="space-y-2 pt-2 border-t border-slate-800/80">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Context-Specific Action Checklist
        </h3>
        <ul className="space-y-1.5 text-sm text-slate-200 list-disc list-inside">
          {assessment.actionableChecklist.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
