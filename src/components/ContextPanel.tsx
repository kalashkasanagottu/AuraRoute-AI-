import { PERSONA_PROFILES } from '../shared/decisionEngine.ts';
import type { PersonaId, TimeHorizon, TransportMode, UserContext } from '../shared/types.ts';
import { ShieldAlert, UserCheck, Compass, Clock } from 'lucide-react';

interface ContextPanelProps {
  context: UserContext;
  onChange: (next: UserContext) => void;
}

const PERSONAS: PersonaId[] = [
  'daily_commuter',
  'outdoor_athlete',
  'respiratory_sensitive',
  'field_worker',
  'intercity_traveler',
];

const TRANSPORT_OPTIONS: Array<{ value: TransportMode; label: string }> = [
  { value: 'walking', label: 'Walking' },
  { value: 'cycling_two_wheeler', label: 'Cycling / Two-Wheeler' },
  { value: 'car_transit', label: 'Car / Enclosed Transit' },
  { value: 'outdoor_workout', label: 'Outdoor Workout' },
];

const HORIZON_OPTIONS: Array<{ value: TimeHorizon; label: string }> = [
  { value: 'now', label: 'Depart Now' },
  { value: 'next_3h', label: 'In +3 Hours' },
  { value: 'next_6h', label: 'In +6 Hours' },
];

export function ContextPanel({ context, onChange }: ContextPanelProps) {
  const activePersona = PERSONA_PROFILES[context.persona];

  return (
    <aside
      aria-label="User context controls"
      className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-5"
    >
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <UserCheck className="w-5 h-5 text-sky-400" aria-hidden="true" />
        <h2 className="text-base font-semibold text-white">Your Context Profile</h2>
      </div>

      {/* Persona Selector */}
      <div>
        <label htmlFor="persona-select" className="block text-xs font-medium text-slate-300 mb-1.5">
          Challenge Persona / Role
        </label>
        <select
          id="persona-select"
          value={context.persona}
          onChange={(e) => onChange({ ...context, persona: e.target.value as PersonaId })}
          className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          {PERSONAS.map((pid) => (
            <option key={pid} value={pid}>
              {PERSONA_PROFILES[pid].label}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">{activePersona.description}</p>
      </div>

      {/* Transport / Activity Mode */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Compass className="w-4 h-4 text-sky-400" aria-hidden="true" />
          <span className="text-xs font-medium text-slate-300">Travel / Activity Mode</span>
        </div>
        <div className="grid grid-cols-1 gap-2" role="radiogroup" aria-label="Travel or activity mode">
          {TRANSPORT_OPTIONS.map((opt) => {
            const active = context.transportMode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange({ ...context, transportMode: opt.value })}
                className={`text-left px-3 py-2 rounded-lg text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                  active
                    ? 'bg-sky-500/15 border-sky-500 text-sky-200 font-medium'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time Horizon */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Clock className="w-4 h-4 text-sky-400" aria-hidden="true" />
          <span className="text-xs font-medium text-slate-300">Decision Time Window</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {HORIZON_OPTIONS.map((opt) => {
            const active = context.timeHorizon === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ ...context, timeHorizon: opt.value })}
                className={`px-2 py-2 rounded-lg text-xs font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                  active
                    ? 'bg-sky-500 text-slate-950 border-sky-400'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sensitivities */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <ShieldAlert className="w-4 h-4 text-amber-400" aria-hidden="true" />
          <span className="text-xs font-medium text-slate-300">Health &amp; Safety Constraints</span>
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={context.asthmaOrRespiratory}
              onChange={(e) => onChange({ ...context, asthmaOrRespiratory: e.target.checked })}
              className="rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-sky-500"
            />
            <span>Asthma / Respiratory sensitivity</span>
          </label>
          <label className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={context.heatSensitive}
              onChange={(e) => onChange({ ...context, heatSensitive: e.target.checked })}
              className="rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-sky-500"
            />
            <span>Heat exhaustion sensitivity</span>
          </label>
          <label className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={context.lowLightCaution}
              onChange={(e) => onChange({ ...context, lowLightCaution: e.target.checked })}
              className="rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-sky-500"
            />
            <span>Strict visibility / glare caution</span>
          </label>
        </div>
      </div>
    </aside>
  );
}
