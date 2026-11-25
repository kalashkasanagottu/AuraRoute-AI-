import { evaluateDecision, synthesizeContextReply } from '../shared/decisionEngine.ts';
import { fetchLiveTelemetry, resolveLocationByCity } from '../shared/telemetryService.ts';
import type {
  AssistantRequestBody,
  AssistantResponseBody,
  TelemetryPayload,
} from '../shared/types.ts';

export async function loadTelemetry(params: {
  city?: string;
  lat?: number;
  lon?: number;
  label?: string;
}): Promise<TelemetryPayload> {
  const query = new URLSearchParams();
  if (params.lat !== undefined && params.lon !== undefined) {
    query.set('lat', String(params.lat));
    query.set('lon', String(params.lon));
    if (params.label) query.set('label', params.label);
  } else {
    query.set('city', params.city || 'New Delhi');
  }

  try {
    const resp = await fetch(`/api/telemetry?${query.toString()}`);
    const contentType = resp.headers.get('content-type') || '';
    if (resp.ok && contentType.includes('application/json')) {
      return (await resp.json()) as TelemetryPayload;
    }
  } catch {
    // Fallback below when running plain `vite` dev without Netlify Functions emulator
  }

  const location =
    params.lat !== undefined && params.lon !== undefined
      ? {
          name: params.label || `Coordinates (${params.lat.toFixed(2)}, ${params.lon.toFixed(2)})`,
          latitude: params.lat,
          longitude: params.lon,
          timezone: 'auto',
        }
      : await resolveLocationByCity(params.city || 'New Delhi');

  return fetchLiveTelemetry(location);
}

export async function askCopilot(payload: AssistantRequestBody): Promise<AssistantResponseBody> {
  try {
    const resp = await fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const contentType = resp.headers.get('content-type') || '';
    if (resp.ok && contentType.includes('application/json')) {
      return (await resp.json()) as AssistantResponseBody;
    }
  } catch {
    // Fallback below when running plain `vite` dev without Netlify Functions emulator
  }

  const decision = evaluateDecision(
    payload.telemetry.current,
    payload.telemetry.hourly,
    payload.context
  );
  const answer = synthesizeContextReply(
    payload.question,
    payload.telemetry.location.name,
    payload.telemetry.current,
    payload.context,
    decision
  );

  return {
    answer,
    verdict: decision.verdict,
    score: decision.score,
    engine: 'deterministic-context-engine',
    generatedAtIso: new Date().toISOString(),
  };
}
