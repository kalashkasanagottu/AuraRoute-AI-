export type PersonaId =
  | 'daily_commuter'
  | 'outdoor_athlete'
  | 'respiratory_sensitive'
  | 'field_worker'
  | 'intercity_traveler';

export type TransportMode =
  | 'walking'
  | 'cycling_two_wheeler'
  | 'car_transit'
  | 'outdoor_workout';

export type TimeHorizon = 'now' | 'next_3h' | 'next_6h';

export type DecisionVerdict = 'GO' | 'CAUTION' | 'DELAY_OR_REROUTE' | 'AVOID';

export type RiskSeverity = 'low' | 'moderate' | 'high' | 'critical';

export interface UserContext {
  persona: PersonaId;
  transportMode: TransportMode;
  timeHorizon: TimeHorizon;
  asthmaOrRespiratory: boolean;
  heatSensitive: boolean;
  lowLightCaution: boolean;
}

export interface LocationInfo {
  name: string;
  region?: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface EnvironmentalSnapshot {
  observedAt: string;
  temperatureC: number;
  apparentTemperatureC: number;
  humidityPct: number;
  precipitationProbPct: number;
  precipitationMm: number;
  windSpeedKmh: number;
  windGustsKmh: number;
  uvIndex: number;
  visibilityKm: number;
  weatherCode: number;
  weatherLabel: string;
  usAqi: number;
  pm25: number;
  pm10: number;
  ozone: number;
}

export interface HourlyForecastSlot {
  timeIso: string;
  hourLabel: string;
  temperatureC: number;
  apparentTemperatureC: number;
  precipitationProbPct: number;
  windGustsKmh: number;
  uvIndex: number;
  usAqi: number;
  pm25: number;
  weatherLabel: string;
}

export interface TelemetryPayload {
  location: LocationInfo;
  current: EnvironmentalSnapshot;
  hourly: HourlyForecastSlot[];
  fetchedAtIso: string;
}

export interface RiskFactor {
  id: string;
  label: string;
  metricValue: string;
  severity: RiskSeverity;
  penalty: number;
  reason: string;
}

export interface HourlyScore {
  timeIso: string;
  hourLabel: string;
  score: number;
  verdict: DecisionVerdict;
  usAqi: number;
  precipitationProbPct: number;
  apparentTemperatureC: number;
}

export interface OptimalWindow {
  hourLabel: string;
  timeIso: string;
  score: number;
  verdict: DecisionVerdict;
  improvementOverNow: number;
  summary: string;
}

export interface DecisionAssessment {
  score: number;
  verdict: DecisionVerdict;
  headline: string;
  summary: string;
  riskFactors: RiskFactor[];
  actionableChecklist: string[];
  hourlyScores: HourlyScore[];
  optimalWindow: OptimalWindow | null;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantRequestBody {
  question: string;
  context: UserContext;
  telemetry: TelemetryPayload;
  history?: ChatTurn[];
}

export interface AssistantResponseBody {
  answer: string;
  verdict: DecisionVerdict;
  score: number;
  engine: 'netlify-ai-gateway-gemini' | 'deterministic-context-engine';
  model?: string;
  generatedAtIso: string;
}
