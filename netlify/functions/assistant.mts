import process from 'node:process';
import type { Config } from '@netlify/functions';
import { GoogleGenAI } from '@google/genai';
import {
  evaluateDecision,
  extractMentionedLocation,
  PERSONA_PROFILES,
  synthesizeContextReply,
} from '../../src/shared/decisionEngine.ts';
import { fetchLiveTelemetry, resolveLocationByCity } from '../../src/shared/telemetryService.ts';
import { fetchLiveTraffic } from './trafficService.ts';
import type { AssistantRequestBody, AssistantResponseBody } from '../../src/shared/types.ts';

function sanitizeText(input: unknown, maxLen: number): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, maxLen);
}

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body: AssistantRequestBody;
  try {
    body = (await req.json()) as AssistantRequestBody;
  } catch {
    return Response.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const question = sanitizeText(body?.question, 600);
  if (!question) {
    return Response.json({ error: 'Question cannot be empty.' }, { status: 400 });
  }
  if (!body?.context || !body?.telemetry?.current || !body?.telemetry?.location) {
    return Response.json({ error: 'Missing required context or telemetry payload.' }, { status: 400 });
  }

  let activeTelemetry = body.telemetry;
  const tomtomKey = typeof Netlify !== 'undefined' ? Netlify.env.get('TOMTOM_API_KEY') : undefined;
  const mentionedPlace = extractMentionedLocation(question);
  if (
    mentionedPlace &&
    !body.telemetry.location.name.toLowerCase().includes(mentionedPlace.toLowerCase())
  ) {
    try {
      const resolved = await resolveLocationByCity(mentionedPlace);
      const [tel, traffic] = await Promise.all([
        fetchLiveTelemetry(resolved),
        fetchLiveTraffic(resolved.latitude, resolved.longitude, tomtomKey),
      ]);
      activeTelemetry = { ...tel, ...(traffic ? { traffic } : {}) };
    } catch {
      // Keep the current dashboard telemetry if the mentioned phrase is not a resolvable place
    }
  } else if (!activeTelemetry.traffic && tomtomKey) {
    const traffic = await fetchLiveTraffic(
      activeTelemetry.location.latitude,
      activeTelemetry.location.longitude,
      tomtomKey
    );
    if (traffic) {
      activeTelemetry = { ...activeTelemetry, traffic };
    }
  }

  const decision = evaluateDecision(
    activeTelemetry.current,
    activeTelemetry.hourly || [],
    body.context,
    activeTelemetry.traffic
  );
  const locationLabel = [
    activeTelemetry.location.name,
    activeTelemetry.location.region,
  ]
    .filter(Boolean)
    .join(', ');
  const locationName = sanitizeText(locationLabel, 100) || 'Selected location';

  const hasGatewayCreds = Boolean(
    process.env.GEMINI_API_KEY && process.env.GOOGLE_GEMINI_BASE_URL
  );

  if (hasGatewayCreds) {
    try {
      const ai = new GoogleGenAI({});
      const persona = PERSONA_PROFILES[body.context.persona];
      const historyText = (body.history || [])
        .slice(-6)
        .map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${sanitizeText(h.content, 400)}`)
        .join('\n');

      const systemPrompt = [
        'You are AuraRoute AI, a real-time environmental safety and urban mobility copilot.',
        'Base every recommendation strictly on the provided live telemetry, user context, and deterministic decision assessment.',
        'If the user asks about live vehicle traffic or congestion speeds, clearly state that live road-traffic feeds are not connected and focus on weather/visibility road-delay risks.',
        'Keep responses concise, structured with clear bullet points, and directly actionable for the user persona.',
        'Never invent metrics that are not present in the telemetry.',
      ].join(' ');

      const userPrompt = JSON.stringify({
        location: locationName,
        persona: persona.label,
        userContext: body.context,
        liveTelemetry: activeTelemetry.current,
        liveTraffic: activeTelemetry.traffic || null,
        deterministicDecision: {
          score: decision.score,
          verdict: decision.verdict,
          riskFactors: decision.riskFactors,
          actionableChecklist: decision.actionableChecklist,
          optimalWindow: decision.optimalWindow,
        },
        recentHistory: historyText || undefined,
        userQuestion: question,
      });

      const modelName = 'gemini-2.5-flash';
      const result = await ai.models.generateContent({
        model: modelName,
        contents: `${systemPrompt}\n\nContext JSON:\n${userPrompt}`,
      });

      const text = result.text?.trim();
      if (text) {
        const respBody: AssistantResponseBody = {
          answer: text,
          verdict: decision.verdict,
          score: decision.score,
          engine: 'netlify-ai-gateway-gemini',
          model: modelName,
          generatedAtIso: new Date().toISOString(),
        };
        return Response.json(respBody);
      }
    } catch {
      // Fall through cleanly to deterministic context reasoning engine
    }
  }

  const fallbackAnswer = synthesizeContextReply(
    question,
    locationName,
    activeTelemetry.current,
    body.context,
    decision,
    activeTelemetry.traffic
  );

  const respBody: AssistantResponseBody = {
    answer: fallbackAnswer,
    verdict: decision.verdict,
    score: decision.score,
    engine: 'deterministic-context-engine',
    generatedAtIso: new Date().toISOString(),
  };
  return Response.json(respBody);
};

export const config: Config = {
  path: '/api/assistant',
  method: ['POST'],
};
