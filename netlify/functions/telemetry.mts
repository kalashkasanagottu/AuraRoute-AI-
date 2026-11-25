import type { Config } from '@netlify/functions';
import { fetchLiveTelemetry, resolveLocationByCity } from '../../src/shared/telemetryService.ts';
import { fetchLiveTraffic } from './trafficService.ts';

function parseCoordinate(raw: string | null, min: number, max: number): number | null {
  if (!raw) return null;
  const num = Number(raw);
  if (!Number.isFinite(num) || num < min || num > max) return null;
  return num;
}

export default async (req: Request) => {
  if (req.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const url = new URL(req.url);
  const city = url.searchParams.get('city');
  const lat = parseCoordinate(url.searchParams.get('lat'), -90, 90);
  const lon = parseCoordinate(url.searchParams.get('lon'), -180, 180);

  try {
    const location =
      lat !== null && lon !== null
        ? {
            name: url.searchParams.get('label')?.slice(0, 60) || `Coordinates (${lat.toFixed(2)}, ${lon.toFixed(2)})`,
            latitude: lat,
            longitude: lon,
            timezone: 'auto',
          }
        : await resolveLocationByCity(city || 'New Delhi');

    const tomtomKey = Netlify.env.get('TOMTOM_API_KEY');
    const [payload, traffic] = await Promise.all([
      fetchLiveTelemetry(location),
      fetchLiveTraffic(location.latitude, location.longitude, tomtomKey),
    ]);

    return Response.json(
      { ...payload, ...(traffic ? { traffic } : {}) },
      {
        headers: {
          'Cache-Control': 'public, max-age=60',
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to fetch live telemetry.';
    return Response.json({ error: message }, { status: 400 });
  }
};

export const config: Config = {
  path: '/api/telemetry',
  method: ['GET'],
};
