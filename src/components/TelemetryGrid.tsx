import type { EnvironmentalSnapshot } from '../shared/types.ts';
import { Wind, Thermometer, Droplets, Eye, Sun, Activity } from 'lucide-react';

interface TelemetryGridProps {
  snapshot: EnvironmentalSnapshot;
}

export function TelemetryGrid({ snapshot }: TelemetryGridProps) {
  const cards = [
    {
      label: 'Temperature',
      value: `${snapshot.temperatureC.toFixed(1)}°C`,
      sub: `Feels like ${snapshot.apparentTemperatureC.toFixed(1)}°C`,
      icon: Thermometer,
      accent: 'text-orange-400',
    },
    {
      label: 'Air Quality (US AQI)',
      value: `${Math.round(snapshot.usAqi)}`,
      sub: `PM2.5 ${snapshot.pm25.toFixed(1)} · PM10 ${snapshot.pm10.toFixed(1)} µg/m³`,
      icon: Activity,
      accent: snapshot.usAqi > 150 ? 'text-rose-400' : snapshot.usAqi > 100 ? 'text-amber-400' : 'text-emerald-400',
    },
    {
      label: 'Rain & Humidity',
      value: `${Math.round(snapshot.precipitationProbPct)}%`,
      sub: `${snapshot.precipitationMm.toFixed(1)} mm · ${Math.round(snapshot.humidityPct)}% RH`,
      icon: Droplets,
      accent: 'text-sky-400',
    },
    {
      label: 'Wind & Gusts',
      value: `${Math.round(snapshot.windSpeedKmh)} km/h`,
      sub: `Gusts up to ${Math.round(snapshot.windGustsKmh)} km/h`,
      icon: Wind,
      accent: 'text-cyan-400',
    },
    {
      label: 'Visibility',
      value: `${snapshot.visibilityKm.toFixed(1)} km`,
      sub: snapshot.weatherLabel,
      icon: Eye,
      accent: 'text-indigo-400',
    },
    {
      label: 'UV Index',
      value: `${snapshot.uvIndex.toFixed(1)}`,
      sub: snapshot.uvIndex >= 6 ? 'High UV protection advised' : 'Low–Moderate UV',
      icon: Sun,
      accent: 'text-yellow-400',
    },
  ];

  return (
    <section aria-label="Live environmental telemetry">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span>{card.label}</span>
                <Icon className={`w-4 h-4 ${card.accent}`} aria-hidden="true" />
              </div>
              <div className="text-xl font-bold text-white tracking-tight">{card.value}</div>
              <div className="text-xs text-slate-400 mt-1 truncate" title={card.sub}>
                {card.sub}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
