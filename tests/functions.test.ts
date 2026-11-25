import { describe, expect, it } from 'vitest';
import assistantHandler from '../netlify/functions/assistant.mts';
import telemetryHandler from '../netlify/functions/telemetry.mts';

describe('Netlify Serverless Functions', () => {
  it('rejects non-POST methods on /api/assistant', async () => {
    const req = new Request('https://example.com/api/assistant', { method: 'GET' });
    const res = await assistantHandler(req);
    expect(res.status).toBe(405);
  });

  it('validates empty question on /api/assistant', async () => {
    const req = new Request('https://example.com/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: '   ' }),
    });
    const res = await assistantHandler(req);
    expect(res.status).toBe(400);
  });

  it('returns context-grounded decision answer when falling back cleanly', async () => {
    const req = new Request('https://example.com/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: 'Should I leave now or wait?',
        context: {
          persona: 'daily_commuter',
          transportMode: 'cycling_two_wheeler',
          timeHorizon: 'now',
          asthmaOrRespiratory: false,
          heatSensitive: false,
          lowLightCaution: false,
        },
        telemetry: {
          location: { name: 'Bengaluru', latitude: 12.97, longitude: 77.59, timezone: 'Asia/Kolkata' },
          fetchedAtIso: '2026-11-25T14:00:00Z',
          current: {
            observedAt: '2026-11-25T19:30',
            temperatureC: 24,
            apparentTemperatureC: 24,
            humidityPct: 60,
            precipitationProbPct: 15,
            precipitationMm: 0,
            windSpeedKmh: 12,
            windGustsKmh: 18,
            uvIndex: 0,
            visibilityKm: 10,
            weatherCode: 1,
            weatherLabel: 'Mainly clear',
            usAqi: 52,
            pm25: 14,
            pm10: 25,
            ozone: 32,
          },
          hourly: [],
        },
      }),
    });

    const res = await assistantHandler(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.verdict).toBe('GO');
    expect(data.score).toBeGreaterThanOrEqual(90);
    expect(data.answer).toContain('Bengaluru');
  });

  it('rejects non-GET methods on /api/telemetry', async () => {
    const req = new Request('https://example.com/api/telemetry', { method: 'POST' });
    const res = await telemetryHandler(req);
    expect(res.status).toBe(405);
  });
});
