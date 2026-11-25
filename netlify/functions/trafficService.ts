import type { TrafficSnapshot } from '../../src/shared/types.ts';

interface TomTomFlowResponse {
  flowSegmentData?: {
    frc?: string;
    currentSpeed?: number;
    freeFlowSpeed?: number;
    currentTravelTime?: number;
    freeFlowTravelTime?: number;
    confidence?: number;
    roadClosure?: boolean;
  };
}

/**
 * Fetch live road traffic segment flow from TomTom using a server-side secret key.
 * Never logs or exposes the API key in responses or errors.
 */
export async function fetchLiveTraffic(
  latitude: number,
  longitude: number,
  apiKey: string | undefined
): Promise<TrafficSnapshot | undefined> {
  if (!apiKey) return undefined;

  const lat = Number(latitude.toFixed(5));
  const lon = Number(longitude.toFixed(5));
  const url =
    `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json` +
    `?point=${lat},${lon}&unit=KMPH&key=${encodeURIComponent(apiKey)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) return undefined;

    const data = (await resp.json()) as TomTomFlowResponse;
    const seg = data.flowSegmentData;
    if (!seg || typeof seg.currentSpeed !== 'number' || typeof seg.freeFlowSpeed !== 'number') {
      return undefined;
    }

    const freeFlow = Math.max(1, seg.freeFlowSpeed);
    const congestionPct = Math.max(0, Math.min(100, Math.round((1 - seg.currentSpeed / freeFlow) * 100)));
    const curTime = Number(seg.currentTravelTime ?? 0);
    const freeTime = Number(seg.freeFlowTravelTime ?? curTime);
    const delayMinutes = Math.max(0, Math.round((curTime - freeTime) / 60));

    return {
      currentSpeedKmh: Math.round(seg.currentSpeed),
      freeFlowSpeedKmh: Math.round(seg.freeFlowSpeed),
      congestionPct,
      currentTravelTimeSec: curTime,
      freeFlowTravelTimeSec: freeTime,
      delayMinutes,
      roadClosure: Boolean(seg.roadClosure),
      confidence: Number(seg.confidence ?? 0),
      roadClass: seg.frc || 'FRC',
    };
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}
