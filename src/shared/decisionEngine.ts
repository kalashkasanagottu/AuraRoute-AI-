import type {
  DecisionAssessment,
  DecisionVerdict,
  EnvironmentalSnapshot,
  HourlyForecastSlot,
  HourlyScore,
  OptimalWindow,
  PersonaId,
  RiskFactor,
  RiskSeverity,
  TransportMode,
  UserContext,
} from './types.ts';

interface PersonaConfig {
  label: string;
  description: string;
  aqiWeight: number;
  heatWeight: number;
  rainWeight: number;
  windWeight: number;
  uvWeight: number;
  visibilityWeight: number;
  aqiCautionThreshold: number;
  aqiAvoidThreshold: number;
  heatCautionC: number;
  heatAvoidC: number;
}

export const PERSONA_PROFILES: Record<PersonaId, PersonaConfig> = {
  daily_commuter: {
    label: 'Daily Commuter',
    description: 'Balances travel safety, rain delays, visibility, and exposure along transit corridors.',
    aqiWeight: 1.0,
    heatWeight: 0.9,
    rainWeight: 1.15,
    windWeight: 1.0,
    uvWeight: 0.7,
    visibilityWeight: 1.2,
    aqiCautionThreshold: 100,
    aqiAvoidThreshold: 200,
    heatCautionC: 35,
    heatAvoidC: 42,
  },
  outdoor_athlete: {
    label: 'Outdoor Athlete',
    description: 'High respiratory ventilation increases PM2.5 uptake and heat-stress vulnerability.',
    aqiWeight: 1.55,
    heatWeight: 1.45,
    rainWeight: 1.0,
    windWeight: 0.95,
    uvWeight: 1.3,
    visibilityWeight: 0.8,
    aqiCautionThreshold: 65,
    aqiAvoidThreshold: 140,
    heatCautionC: 30,
    heatAvoidC: 37,
  },
  respiratory_sensitive: {
    label: 'Respiratory-Sensitive / Elderly',
    description: 'Strict air quality and temperature thresholds to protect cardiovascular and lung health.',
    aqiWeight: 1.75,
    heatWeight: 1.35,
    rainWeight: 0.9,
    windWeight: 0.85,
    uvWeight: 1.0,
    visibilityWeight: 0.8,
    aqiCautionThreshold: 55,
    aqiAvoidThreshold: 120,
    heatCautionC: 31,
    heatAvoidC: 37,
  },
  field_worker: {
    label: 'Field / Delivery Worker',
    description: 'Sustained multi-hour outdoor exposure requiring hydration, UV, and gust safety.',
    aqiWeight: 1.25,
    heatWeight: 1.5,
    rainWeight: 1.2,
    windWeight: 1.2,
    uvWeight: 1.4,
    visibilityWeight: 1.1,
    aqiCautionThreshold: 90,
    aqiAvoidThreshold: 175,
    heatCautionC: 33,
    heatAvoidC: 39,
  },
  intercity_traveler: {
    label: 'Intercity Traveler',
    description: 'Prioritizes highway visibility, storm gusts, and heavy precipitation disruption.',
    aqiWeight: 0.7,
    heatWeight: 0.75,
    rainWeight: 1.4,
    windWeight: 1.45,
    uvWeight: 0.5,
    visibilityWeight: 1.55,
    aqiCautionThreshold: 140,
    aqiAvoidThreshold: 260,
    heatCautionC: 37,
    heatAvoidC: 44,
  },
};

const TRANSPORT_MODIFIERS: Record<
  TransportMode,
  { label: string; exposureMult: number; rainMult: number; windMult: number; visibilityMult: number }
> = {
  walking: {
    label: 'Walking',
    exposureMult: 1.15,
    rainMult: 1.25,
    windMult: 0.85,
    visibilityMult: 0.75,
  },
  cycling_two_wheeler: {
    label: 'Cycling / Two-Wheeler',
    exposureMult: 1.25,
    rainMult: 1.4,
    windMult: 1.45,
    visibilityMult: 1.35,
  },
  car_transit: {
    label: 'Car / Enclosed Transit',
    exposureMult: 0.55,
    rainMult: 0.75,
    windMult: 0.8,
    visibilityMult: 1.25,
  },
  outdoor_workout: {
    label: 'Outdoor Workout',
    exposureMult: 1.45,
    rainMult: 1.15,
    windMult: 0.9,
    visibilityMult: 0.7,
  },
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function classifyVerdict(score: number, hasCriticalTrigger: boolean): DecisionVerdict {
  if (hasCriticalTrigger || score < 40) return 'AVOID';
  if (score < 62) return 'DELAY_OR_REROUTE';
  if (score < 82) return 'CAUTION';
  return 'GO';
}

function severityFromPenalty(penalty: number, critical: boolean): RiskSeverity {
  if (critical || penalty >= 30) return 'critical';
  if (penalty >= 18) return 'high';
  if (penalty >= 8) return 'moderate';
  return 'low';
}

function selectTargetSnapshot(
  current: EnvironmentalSnapshot,
  hourly: HourlyForecastSlot[],
  horizon: UserContext['timeHorizon']
): EnvironmentalSnapshot {
  if (horizon === 'now' || hourly.length === 0) return current;
  const offset = horizon === 'next_3h' ? Math.min(3, hourly.length - 1) : Math.min(6, hourly.length - 1);
  const slot = hourly[offset];
  return {
    ...current,
    observedAt: slot.timeIso,
    temperatureC: slot.temperatureC,
    apparentTemperatureC: slot.apparentTemperatureC,
    precipitationProbPct: slot.precipitationProbPct,
    windGustsKmh: slot.windGustsKmh,
    uvIndex: slot.uvIndex,
    usAqi: slot.usAqi,
    pm25: slot.pm25,
    weatherLabel: slot.weatherLabel,
  };
}

function scoreSnapshot(
  snap: EnvironmentalSnapshot,
  context: UserContext
): { score: number; verdict: DecisionVerdict; riskFactors: RiskFactor[]; checklist: string[] } {
  const persona = PERSONA_PROFILES[context.persona];
  const transport = TRANSPORT_MODIFIERS[context.transportMode];

  const aqiThresholdScale = context.asthmaOrRespiratory ? 0.78 : 1.0;
  const heatThresholdShift = context.heatSensitive ? -3 : 0;
  const aqiCaution = persona.aqiCautionThreshold * aqiThresholdScale;
  const aqiAvoid = persona.aqiAvoidThreshold * aqiThresholdScale;
  const heatCaution = persona.heatCautionC + heatThresholdShift;
  const heatAvoid = persona.heatAvoidC + heatThresholdShift;

  const risks: RiskFactor[] = [];
  const checklist: string[] = [];
  let totalPenalty = 0;
  let hasCritical = false;

  // 1. Air Quality Evaluation
  if (snap.usAqi >= aqiCaution) {
    const ratio = Math.min(2, (snap.usAqi - aqiCaution) / Math.max(25, aqiAvoid - aqiCaution));
    const rawPenalty = (12 + ratio * 28) * persona.aqiWeight * transport.exposureMult;
    const penalty = Math.round(Math.min(55, rawPenalty));
    const critical = snap.usAqi >= aqiAvoid;
    if (critical) hasCritical = true;
    totalPenalty += penalty;
    risks.push({
      id: 'aqi',
      label: 'Air Quality (US AQI)',
      metricValue: `AQI ${Math.round(snap.usAqi)} (PM2.5: ${snap.pm25.toFixed(1)} µg/m³)`,
      severity: severityFromPenalty(penalty, critical),
      penalty,
      reason: critical
        ? `Exceeds safe threshold (${Math.round(aqiAvoid)}) for ${persona.label} via ${transport.label}.`
        : `Elevated particulate levels above ${Math.round(aqiCaution)} warrant respiratory precautions.`,
    });
    if (context.transportMode !== 'car_transit') {
      checklist.push('Wear a well-fitted N95/KN95 mask outdoors.');
    } else {
      checklist.push('Keep cabin air on recirculation mode with windows closed.');
    }
  }

  // 2. Thermal Stress Evaluation
  if (snap.apparentTemperatureC >= heatCaution) {
    const ratio = Math.min(2, (snap.apparentTemperatureC - heatCaution) / Math.max(3, heatAvoid - heatCaution));
    const penalty = Math.round(Math.min(45, (10 + ratio * 24) * persona.heatWeight * transport.exposureMult));
    const critical = snap.apparentTemperatureC >= heatAvoid;
    if (critical) hasCritical = true;
    totalPenalty += penalty;
    risks.push({
      id: 'heat',
      label: 'Thermal Heat Stress',
      metricValue: `Feels like ${snap.apparentTemperatureC.toFixed(1)}°C`,
      severity: severityFromPenalty(penalty, critical),
      penalty,
      reason: critical
        ? `Extreme heat load above ${heatAvoid}°C creates high dehydration/exhaustion risk.`
        : `Warm conditions above ${heatCaution}°C increase exertion strain.`,
    });
    checklist.push('Carry 500 ml+ water/electrolytes and take shaded breaks every 30 minutes.');
  } else if (snap.apparentTemperatureC <= 5) {
    const penalty = Math.round(Math.min(25, (6 - snap.apparentTemperatureC) * 2.2 * persona.heatWeight));
    totalPenalty += penalty;
    risks.push({
      id: 'cold',
      label: 'Cold Exposure',
      metricValue: `Feels like ${snap.apparentTemperatureC.toFixed(1)}°C`,
      severity: severityFromPenalty(penalty, false),
      penalty,
      reason: 'Low apparent temperature increases wind-chill and airway irritation risk.',
    });
    checklist.push('Wear thermal layering and cover neck/airways against cold air.');
  }

  // 3. Precipitation & Road Grip
  if (snap.precipitationProbPct >= 35 || snap.precipitationMm >= 0.5) {
    const rainFactor = Math.max(snap.precipitationProbPct / 100, Math.min(1, snap.precipitationMm / 5));
    const penalty = Math.round(Math.min(40, rainFactor * 30 * persona.rainWeight * transport.rainMult));
    const critical = snap.precipitationProbPct >= 85 && context.transportMode === 'cycling_two_wheeler';
    if (critical) hasCritical = true;
    totalPenalty += penalty;
    risks.push({
      id: 'rain',
      label: 'Precipitation Risk',
      metricValue: `${Math.round(snap.precipitationProbPct)}% chance (${snap.precipitationMm.toFixed(1)} mm)`,
      severity: severityFromPenalty(penalty, critical),
      penalty,
      reason:
        context.transportMode === 'cycling_two_wheeler'
          ? 'Wet pavement significantly reduces two-wheeler traction and braking distance.'
          : 'Likely rainfall may slow transit and reduce outdoor comfort.',
    });
    checklist.push(
      context.transportMode === 'car_transit'
        ? 'Allow +20% travel buffer for wet-road traffic.'
        : 'Pack waterproof outer shell and protect electronics.'
    );
  }

  // 4. Wind Gusts
  if (snap.windGustsKmh >= 32) {
    const penalty = Math.round(
      Math.min(35, ((snap.windGustsKmh - 28) / 2.2) * persona.windWeight * transport.windMult)
    );
    const critical = snap.windGustsKmh >= 60 && context.transportMode === 'cycling_two_wheeler';
    if (critical) hasCritical = true;
    totalPenalty += penalty;
    risks.push({
      id: 'wind',
      label: 'Crosswind & Gusts',
      metricValue: `Gusts ${Math.round(snap.windGustsKmh)} km/h`,
      severity: severityFromPenalty(penalty, critical),
      penalty,
      reason: 'Strong wind gusts affect balance on two-wheelers and kick up roadside dust.',
    });
    checklist.push('Avoid exposed bridges or tree-lined routes during peak gusts.');
  }

  // 5. Visibility
  const visThreshold = context.lowLightCaution ? 6 : 3.5;
  if (snap.visibilityKm < visThreshold) {
    const penalty = Math.round(
      Math.min(35, ((visThreshold - snap.visibilityKm) / visThreshold) * 28 * persona.visibilityWeight * transport.visibilityMult)
    );
    const critical = snap.visibilityKm < 1.0 && context.transportMode !== 'walking';
    if (critical) hasCritical = true;
    totalPenalty += penalty;
    risks.push({
      id: 'visibility',
      label: 'Low Visibility',
      metricValue: `${snap.visibilityKm.toFixed(1)} km`,
      severity: severityFromPenalty(penalty, critical),
      penalty,
      reason: 'Reduced visibility increases collision risk in mixed traffic.',
    });
    checklist.push('Use high-visibility clothing / headlights and maintain extra following distance.');
  }

  // 6. UV Index
  if (snap.uvIndex >= 6 && context.transportMode !== 'car_transit') {
    const penalty = Math.round(Math.min(18, (snap.uvIndex - 4) * 2.1 * persona.uvWeight));
    totalPenalty += penalty;
    risks.push({
      id: 'uv',
      label: 'High UV Radiation',
      metricValue: `UV ${snap.uvIndex.toFixed(1)}`,
      severity: severityFromPenalty(penalty, false),
      penalty,
      reason: 'High solar UV exposure requires skin and eye protection.',
    });
    checklist.push('Apply SPF 30+ sunscreen and wear UV-protective sunglasses.');
  }

  if (checklist.length === 0) {
    checklist.push('Conditions are favorable; standard situational awareness is sufficient.');
  }

  risks.sort((a, b) => b.penalty - a.penalty);
  const score = clampScore(100 - totalPenalty);
  const verdict = classifyVerdict(score, hasCritical);

  return { score, verdict, riskFactors: risks, checklist };
}

export function evaluateDecision(
  current: EnvironmentalSnapshot,
  hourly: HourlyForecastSlot[],
  context: UserContext
): DecisionAssessment {
  const persona = PERSONA_PROFILES[context.persona];
  const transport = TRANSPORT_MODIFIERS[context.transportMode];
  const activeSnap = selectTargetSnapshot(current, hourly, context.timeHorizon);
  const { score, verdict, riskFactors, checklist } = scoreSnapshot(activeSnap, context);

  const hourlyScores: HourlyScore[] = hourly.slice(0, 12).map((slot) => {
    const slotSnap: EnvironmentalSnapshot = {
      ...current,
      observedAt: slot.timeIso,
      temperatureC: slot.temperatureC,
      apparentTemperatureC: slot.apparentTemperatureC,
      precipitationProbPct: slot.precipitationProbPct,
      windGustsKmh: slot.windGustsKmh,
      uvIndex: slot.uvIndex,
      usAqi: slot.usAqi,
      pm25: slot.pm25,
      weatherLabel: slot.weatherLabel,
    };
    const evaluated = scoreSnapshot(slotSnap, context);
    return {
      timeIso: slot.timeIso,
      hourLabel: slot.hourLabel,
      score: evaluated.score,
      verdict: evaluated.verdict,
      usAqi: slot.usAqi,
      precipitationProbPct: slot.precipitationProbPct,
      apparentTemperatureC: slot.apparentTemperatureC,
    };
  });

  let optimalWindow: OptimalWindow | null = null;
  if (hourlyScores.length > 0) {
    const best = hourlyScores.reduce((acc, item) => (item.score > acc.score ? item : acc), hourlyScores[0]);
    const improvement = best.score - score;
    optimalWindow = {
      hourLabel: best.hourLabel,
      timeIso: best.timeIso,
      score: best.score,
      verdict: best.verdict,
      improvementOverNow: improvement,
      summary:
        improvement >= 8
          ? `Waiting until ${best.hourLabel} raises your readiness score by +${improvement} pts (AQI ${Math.round(best.usAqi)}, Rain ${Math.round(best.precipitationProbPct)}%).`
          : `${best.hourLabel} is the cleanest upcoming window (${best.score}/100, ${best.verdict.replace(/_/g, ' ')}).`,
    };
  }

  const headlineMap: Record<DecisionVerdict, string> = {
    GO: `Clear to Go for ${persona.label}`,
    CAUTION: `Proceed with Caution (${transport.label})`,
    DELAY_OR_REROUTE: `Delay or Switch Mode Recommended`,
    AVOID: `High Risk — Avoid Unnecessary Exposure`,
  };

  const topRiskNote =
    riskFactors.length > 0
      ? `Primary driver: ${riskFactors[0].label} (${riskFactors[0].metricValue}).`
      : `All monitored environmental metrics are within safe bounds for ${persona.label}.`;

  return {
    score,
    verdict,
    headline: headlineMap[verdict],
    summary: `${topRiskNote} ${optimalWindow && verdict !== 'GO' ? optimalWindow.summary : ''}`.trim(),
    riskFactors,
    actionableChecklist: checklist,
    hourlyScores,
    optimalWindow,
  };
}

const IGNORED_PLACE_TOKENS = new Set([
  'home',
  'work',
  'office',
  'now',
  'today',
  'tonight',
  'tomorrow',
  'morning',
  'afternoon',
  'evening',
  'night',
  'all',
  'peak',
  'this',
  'that',
  'the',
]);

export function extractMentionedLocation(question: string): string | null {
  const match = question.match(
    /\b(?:at|in|near|around|for|to)\s+([a-zA-Z][a-zA-Z\s,-]{1,40}?)(?:\s+(?:now|today|tonight|tomorrow|right now|currently|please)\b|[?.!]|$)/i
  );
  if (!match) return null;
  const candidate = match[1].trim().replace(/[,.\s]+$/, '');
  if (!candidate || candidate.length < 3 || IGNORED_PLACE_TOKENS.has(candidate.toLowerCase())) {
    return null;
  }
  return candidate;
}

export function synthesizeContextReply(
  question: string,
  locationName: string,
  current: EnvironmentalSnapshot,
  context: UserContext,
  decision: DecisionAssessment
): string {
  const persona = PERSONA_PROFILES[context.persona].label;
  const mode = TRANSPORT_MODIFIERS[context.transportMode].label;
  const qLower = question.toLowerCase();

  const lines: string[] = [
    `**Verdict for ${locationName} (${persona} · ${mode}):** ${decision.verdict.replace(/_/g, ' ')} — Readiness Score **${decision.score}/100**.`,
    '',
  ];

  if (
    qLower.includes('traffic') ||
    qLower.includes('congestion') ||
    qLower.includes('jam') ||
    qLower.includes('road')
  ) {
    const weatherDelay =
      current.precipitationProbPct >= 40 || current.precipitationMm >= 0.5 || current.visibilityKm < 3.5
        ? 'Elevated weather-driven slowdown likely — wet roads or reduced visibility typically add +15% to +25% travel delay.'
        : 'No major weather-induced road disruption right now (clear visibility and dry/low rain risk).';
    lines.push(
      `**Road Traffic Scope:** Live GPS vehicle-speed / congestion feeds (e.g., Google Maps or TomTom) are not connected, so real-time jam speeds are not estimated.`,
      `**Weather & Visibility Road Impact for ${locationName}:** ${weatherDelay} (Rain chance **${Math.round(current.precipitationProbPct)}%**, visibility **${current.visibilityKm.toFixed(1)} km**, gusts **${Math.round(current.windGustsKmh)} km/h**, US AQI **${Math.round(current.usAqi)}**).`
    );
  } else if (
    qLower.includes('when') ||
    qLower.includes('wait') ||
    qLower.includes('best') ||
    qLower.includes('time') ||
    qLower.includes('window')
  ) {
    if (decision.optimalWindow) {
      lines.push(`**Timing Recommendation:** ${decision.optimalWindow.summary}`);
    }
  } else if (
    qLower.includes('mask') ||
    qLower.includes('aqi') ||
    qLower.includes('air') ||
    qLower.includes('breath') ||
    qLower.includes('asthma')
  ) {
    lines.push(
      `**Air Quality Breakdown:** Live US AQI is **${Math.round(current.usAqi)}** (PM2.5 **${current.pm25.toFixed(1)} µg/m³**, PM10 **${current.pm10.toFixed(1)} µg/m³**).`
    );
  } else if (
    qLower.includes('rain') ||
    qLower.includes('wind') ||
    qLower.includes('bike') ||
    qLower.includes('car') ||
    qLower.includes('walk')
  ) {
    lines.push(
      `**Mode & Weather Check:** Temperature feels like **${current.apparentTemperatureC.toFixed(1)}°C**, rain chance **${Math.round(current.precipitationProbPct)}%**, gusts **${Math.round(current.windGustsKmh)} km/h**, visibility **${current.visibilityKm.toFixed(1)} km**.`
    );
  } else {
    lines.push(`**Current Context Assessment:** ${decision.summary}`);
  }

  if (decision.riskFactors.length > 0) {
    lines.push('', '**Active Risk Drivers:**');
    for (const rf of decision.riskFactors.slice(0, 3)) {
      lines.push(`- **${rf.label}** (${rf.metricValue}): ${rf.reason}`);
    }
  }

  lines.push('', '**Recommended Actions:**');
  for (const item of decision.actionableChecklist.slice(0, 3)) {
    lines.push(`- ${item}`);
  }

  if (decision.optimalWindow && decision.optimalWindow.improvementOverNow >= 6 && !qLower.includes('when')) {
    lines.push('', `*Tip:* ${decision.optimalWindow.summary}`);
  }

  return lines.join('\n');
}
