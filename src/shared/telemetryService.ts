import type {
  EnvironmentalSnapshot,
  HourlyForecastSlot,
  LocationInfo,
  TelemetryPayload,
} from './types.ts';

const WMO_WEATHER_LABELS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Severe thunderstorm with hail',
};

function labelForWeatherCode(code: number): string {
  return WMO_WEATHER_LABELS[code] ?? 'Variable conditions';
}

function formatHourLabel(isoTime: string): string {
  const parts = isoTime.split('T');
  return parts[1] ? parts[1].slice(0, 5) : isoTime;
}

async function fetchJsonWithTimeout<T>(
  url: string,
  timeoutMs = 9000,
  extraHeaders?: Record<string, string>
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: extraHeaders,
    });
    if (!resp.ok) {
      throw new Error(`Upstream API returned HTTP ${resp.status}`);
    }
    return (await resp.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

interface NominatimHit {
  name?: string;
  display_name?: string;
  lat: string;
  lon: string;
  address?: {
    suburb?: string;
    neighbourhood?: string;
    city?: string;
    town?: string;
    state?: string;
    country?: string;
  };
}

async function resolveViaNominatim(query: string, indiaOnly: boolean): Promise<LocationInfo | null> {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '1',
    addressdetails: '1',
  });
  if (indiaOnly) {
    params.set('countrycodes', 'in');
  }

  const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
  const isBrowser = typeof window !== 'undefined';
  const headers = isBrowser ? undefined : { 'User-Agent': 'AuraRouteAI/1.0' };

  try {
    const hits = await fetchJsonWithTimeout<NominatimHit[]>(url, 6000, headers);
    const hit = hits?.[0];
    if (!hit) return null;
    const lat = Number(hit.lat);
    const lon = Number(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    const addr = hit.address ?? {};
    const primaryName =
      hit.name || addr.suburb || addr.neighbourhood || addr.city || addr.town || query;
    const regionParts = [addr.city || addr.town, addr.state].filter(
      (v, idx, arr) => Boolean(v) && v !== primaryName && arr.indexOf(v) === idx
    );

    return {
      name: primaryName,
      region: regionParts.join(', ') || undefined,
      country: addr.country || (indiaOnly ? 'India' : undefined),
      latitude: lat,
      longitude: lon,
      timezone: 'auto',
    };
  } catch {
    return null;
  }
}

export async function resolveLocationByCity(city: string): Promise<LocationInfo> {
  const cleanCity = city.trim().slice(0, 80);
  if (!cleanCity) {
    throw new Error('City name cannot be empty.');
  }

  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    cleanCity
  )}&count=5&language=en&format=json`;

  const geo = await fetchJsonWithTimeout<{
    results?: Array<{
      name: string;
      admin1?: string;
      country?: string;
      country_code?: string;
      latitude: number;
      longitude: number;
      timezone?: string;
    }>;
  }>(geoUrl).catch(() => ({ results: [] }));

  const results = geo.results ?? [];
  const indiaMatch = results.find(
    (r) => r.country_code?.toUpperCase() === 'IN' || r.country?.toLowerCase() === 'india'
  );
  if (indiaMatch) {
    return {
      name: indiaMatch.name,
      region: indiaMatch.admin1,
      country: indiaMatch.country,
      latitude: indiaMatch.latitude,
      longitude: indiaMatch.longitude,
      timezone: indiaMatch.timezone || 'auto',
    };
  }

  // Prefer Indian neighborhood/locality resolution (e.g., Whitefield, Koramangala) before non-Indian homonyms
  const nominatimIndia = await resolveViaNominatim(cleanCity, true);
  if (nominatimIndia) {
    return nominatimIndia;
  }

  const fallback = results[0];
  if (fallback) {
    return {
      name: fallback.name,
      region: fallback.admin1,
      country: fallback.country,
      latitude: fallback.latitude,
      longitude: fallback.longitude,
      timezone: fallback.timezone || 'auto',
    };
  }

  const nominatimGlobal = await resolveViaNominatim(cleanCity, false);
  if (nominatimGlobal) {
    return nominatimGlobal;
  }

  throw new Error(`Could not find location "${cleanCity}". Try a city or locality name.`);
}

export async function fetchLiveTelemetry(location: LocationInfo): Promise<TelemetryPayload> {
  const lat = Number(location.latitude.toFixed(4));
  const lon = Number(location.longitude.toFixed(4));

  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m,wind_gusts_10m,weather_code` +
    `&hourly=temperature_2m,apparent_temperature,precipitation_probability,wind_gusts_10m,uv_index,visibility,weather_code` +
    `&forecast_days=2&timezone=auto`;

  const aqiUrl =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
    `&current=us_aqi,pm2_5,pm10,ozone` +
    `&hourly=us_aqi,pm2_5` +
    `&forecast_days=2&timezone=auto`;

  const [weather, aqi] = await Promise.all([
    fetchJsonWithTimeout<any>(weatherUrl),
    fetchJsonWithTimeout<any>(aqiUrl),
  ]);

  const curW = weather.current ?? {};
  const curA = aqi.current ?? {};
  const hW = weather.hourly ?? {};
  const hA = aqi.hourly ?? {};

  const times: string[] = Array.isArray(hW.time) ? hW.time : [];
  const currentIso: string = curW.time ?? times[0] ?? new Date().toISOString();
  const startIdx = Math.max(
    0,
    times.findIndex((t) => t >= currentIso.slice(0, 13))
  );

  const hourly: HourlyForecastSlot[] = [];
  for (let i = startIdx; i < Math.min(times.length, startIdx + 12); i++) {
    const wCode = Number(hW.weather_code?.[i] ?? curW.weather_code ?? 0);
    hourly.push({
      timeIso: times[i],
      hourLabel: formatHourLabel(times[i]),
      temperatureC: Number(hW.temperature_2m?.[i] ?? curW.temperature_2m ?? 25),
      apparentTemperatureC: Number(hW.apparent_temperature?.[i] ?? curW.apparent_temperature ?? 25),
      precipitationProbPct: Number(hW.precipitation_probability?.[i] ?? 0),
      windGustsKmh: Number(hW.wind_gusts_10m?.[i] ?? curW.wind_gusts_10m ?? 10),
      uvIndex: Number(hW.uv_index?.[i] ?? 0),
      usAqi: Number(hA.us_aqi?.[i] ?? curA.us_aqi ?? 50),
      pm25: Number(hA.pm2_5?.[i] ?? curA.pm2_5 ?? 12),
      weatherLabel: labelForWeatherCode(wCode),
    });
  }

  const currentVisibilityM = Number(hW.visibility?.[startIdx] ?? 10000);
  const currentWeatherCode = Number(curW.weather_code ?? 0);

  const current: EnvironmentalSnapshot = {
    observedAt: currentIso,
    temperatureC: Number(curW.temperature_2m ?? 25),
    apparentTemperatureC: Number(curW.apparent_temperature ?? curW.temperature_2m ?? 25),
    humidityPct: Number(curW.relative_humidity_2m ?? 50),
    precipitationProbPct: Number(hW.precipitation_probability?.[startIdx] ?? 0),
    precipitationMm: Number(curW.precipitation ?? 0),
    windSpeedKmh: Number(curW.wind_speed_10m ?? 8),
    windGustsKmh: Number(curW.wind_gusts_10m ?? 12),
    uvIndex: Number(hW.uv_index?.[startIdx] ?? 0),
    visibilityKm: Number((currentVisibilityM / 1000).toFixed(1)),
    weatherCode: currentWeatherCode,
    weatherLabel: labelForWeatherCode(currentWeatherCode),
    usAqi: Number(curA.us_aqi ?? 50),
    pm25: Number(curA.pm2_5 ?? 12),
    pm10: Number(curA.pm10 ?? 20),
    ozone: Number(curA.ozone ?? 40),
  };

  return {
    location: {
      ...location,
      timezone: weather.timezone || location.timezone || 'UTC',
    },
    current,
    hourly,
    fetchedAtIso: new Date().toISOString(),
  };
}
