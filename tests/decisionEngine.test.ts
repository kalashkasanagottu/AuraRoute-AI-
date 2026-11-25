import { describe, expect, it } from 'vitest';
import {
  evaluateDecision,
  extractMentionedLocation,
  synthesizeContextReply,
} from '../src/shared/decisionEngine.ts';
import type { EnvironmentalSnapshot, HourlyForecastSlot, UserContext } from '../src/shared/types.ts';

const cleanSnap: EnvironmentalSnapshot = {
  observedAt: '2026-11-25T14:00',
  temperatureC: 24,
  apparentTemperatureC: 24,
  humidityPct: 45,
  precipitationProbPct: 10,
  precipitationMm: 0,
  windSpeedKmh: 10,
  windGustsKmh: 15,
  uvIndex: 3,
  visibilityKm: 10,
  weatherCode: 0,
  weatherLabel: 'Clear sky',
  usAqi: 38,
  pm25: 9,
  pm10: 18,
  ozone: 35,
};

const pollutedSnap: EnvironmentalSnapshot = {
  ...cleanSnap,
  usAqi: 165,
  pm25: 78,
  windGustsKmh: 38,
  precipitationProbPct: 60,
  precipitationMm: 2.2,
};

const sampleHourly: HourlyForecastSlot[] = [
  {
    timeIso: '2026-11-25T15:00',
    hourLabel: '15:00',
    temperatureC: 25,
    apparentTemperatureC: 25,
    precipitationProbPct: 65,
    windGustsKmh: 40,
    uvIndex: 3,
    usAqi: 170,
    pm25: 80,
    weatherLabel: 'Moderate rain',
  },
  {
    timeIso: '2026-11-25T18:00',
    hourLabel: '18:00',
    temperatureC: 21,
    apparentTemperatureC: 21,
    precipitationProbPct: 10,
    windGustsKmh: 14,
    uvIndex: 0,
    usAqi: 65,
    pm25: 18,
    weatherLabel: 'Mainly clear',
  },
];

describe('Context Decision Engine', () => {
  it('returns GO with high score in clean conditions', () => {
    const ctx: UserContext = {
      persona: 'daily_commuter',
      transportMode: 'walking',
      timeHorizon: 'now',
      asthmaOrRespiratory: false,
      heatSensitive: false,
      lowLightCaution: false,
    };
    const res = evaluateDecision(cleanSnap, sampleHourly, ctx);
    expect(res.verdict).toBe('GO');
    expect(res.score).toBeGreaterThanOrEqual(90);
    expect(res.riskFactors).toHaveLength(0);
  });

  it('penalizes respiratory-sensitive athlete much more strictly than car commuter in polluted air', () => {
    const carCtx: UserContext = {
      persona: 'daily_commuter',
      transportMode: 'car_transit',
      timeHorizon: 'now',
      asthmaOrRespiratory: false,
      heatSensitive: false,
      lowLightCaution: false,
    };
    const athleteCtx: UserContext = {
      persona: 'outdoor_athlete',
      transportMode: 'outdoor_workout',
      timeHorizon: 'now',
      asthmaOrRespiratory: true,
      heatSensitive: false,
      lowLightCaution: false,
    };

    const carRes = evaluateDecision(pollutedSnap, sampleHourly, carCtx);
    const athleteRes = evaluateDecision(pollutedSnap, sampleHourly, athleteCtx);

    expect(athleteRes.score).toBeLessThan(carRes.score);
    expect(athleteRes.verdict).toBe('AVOID');
    expect(athleteRes.actionableChecklist.some((item) => item.includes('N95'))).toBe(true);
  });

  it('identifies the cleanest optimal departure window across hourly slots', () => {
    const ctx: UserContext = {
      persona: 'daily_commuter',
      transportMode: 'cycling_two_wheeler',
      timeHorizon: 'now',
      asthmaOrRespiratory: false,
      heatSensitive: false,
      lowLightCaution: false,
    };
    const res = evaluateDecision(pollutedSnap, sampleHourly, ctx);
    expect(res.optimalWindow).not.toBeNull();
    expect(res.optimalWindow?.hourLabel).toBe('18:00');
    expect(res.optimalWindow!.improvementOverNow).toBeGreaterThan(20);
  });

  it('synthesizes grounded context replies referencing live telemetry', () => {
    const ctx: UserContext = {
      persona: 'respiratory_sensitive',
      transportMode: 'walking',
      timeHorizon: 'now',
      asthmaOrRespiratory: true,
      heatSensitive: false,
      lowLightCaution: false,
    };
    const decision = evaluateDecision(pollutedSnap, sampleHourly, ctx);
    const reply = synthesizeContextReply('Do I need a mask?', 'New Delhi', pollutedSnap, ctx, decision);
    expect(reply).toContain('New Delhi');
    expect(reply).toContain('165');
    expect(reply).toContain('N95');
  });

  it('extracts locality mentions and explains road traffic scope honestly', () => {
    expect(extractMentionedLocation('what is the traffic at whitefield?')).toBe('whitefield');
    expect(extractMentionedLocation('should I leave now?')).toBeNull();

    const ctx: UserContext = {
      persona: 'daily_commuter',
      transportMode: 'car_transit',
      timeHorizon: 'now',
      asthmaOrRespiratory: false,
      heatSensitive: false,
      lowLightCaution: false,
    };
    const decision = evaluateDecision(pollutedSnap, sampleHourly, ctx);
    const reply = synthesizeContextReply(
      'what is the traffic at whitefield?',
      'Whitefield (Kadugodi), Bengaluru',
      pollutedSnap,
      ctx,
      decision
    );
    expect(reply).toContain('Whitefield (Kadugodi), Bengaluru');
    expect(reply).toContain('Road Traffic Scope');
    expect(reply).toContain('unavailable');
  });

  it('penalizes heavy live traffic congestion and reports live speeds when TomTom telemetry is present', () => {
    const ctx: UserContext = {
      persona: 'daily_commuter',
      transportMode: 'car_transit',
      timeHorizon: 'now',
      asthmaOrRespiratory: false,
      heatSensitive: false,
      lowLightCaution: false,
    };
    const liveTraffic = {
      currentSpeedKmh: 14,
      freeFlowSpeedKmh: 35,
      congestionPct: 60,
      currentTravelTimeSec: 600,
      freeFlowTravelTimeSec: 240,
      delayMinutes: 6,
      roadClosure: false,
      confidence: 0.98,
      roadClass: 'FRC3',
    };
    const decision = evaluateDecision(cleanSnap, sampleHourly, ctx, liveTraffic);
    expect(decision.score).toBeLessThan(85);
    expect(decision.riskFactors.some((r) => r.id === 'traffic')).toBe(true);

    const reply = synthesizeContextReply(
      'How is the traffic at Whitefield?',
      'Whitefield, Karnataka',
      cleanSnap,
      ctx,
      decision,
      liveTraffic
    );
    expect(reply).toContain('14 km/h');
    expect(reply).toContain('35 km/h');
    expect(reply).toContain('60% slower');
  });
});
