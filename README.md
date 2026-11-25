# AuraRoute AI — Context-Aware Real-Time Mobility & Safety Copilot

**AuraRoute AI** is a real-time, cloud-deployed decision-making assistant that evaluates live hyper-local weather, air quality (AQI/PM2.5), wind gusts, visibility, and UV telemetry against a user's personal mobility context to produce actionable Go / Caution / Delay / Avoid guidance and conversational recommendations.

---

## 1. Chosen Vertical

**Smart Urban Mobility, Environmental Safety & Commute Intelligence**

Urban commuters, outdoor athletes, field/delivery workers, elderly or respiratory-sensitive individuals, and intercity travelers all experience the **exact same weather and air quality differently**. A generic weather app shows raw numbers (`29°C, AQI 145`), leaving people to guess whether it is safe to cycle, run, or commute. AuraRoute AI turns live telemetry into persona-tailored decisions.

---

## 2. Approach and Logic

AuraRoute AI combines a **deterministic Context Decision Engine** with a **serverless conversational AI copilot**:

1. **Persona-Parameterized Risk Matrix (`src/shared/decisionEngine.ts`):**
   - Five distinct user personas (`Daily Commuter`, `Outdoor Athlete`, `Respiratory-Sensitive / Elderly`, `Field / Delivery Worker`, `Intercity Traveler`) each define calibrated weights and hard safety thresholds across six dimensions:
     - **Air Quality (US AQI & PM2.5)**
     - **Thermal Stress (Apparent Temperature — Heat & Cold)**
     - **Precipitation & Wet-Road Risk**
     - **Wind Gusts**
     - **Visibility**
     - **UV Radiation**
   - Travel / activity modes (`Walking`, `Cycling / Two-Wheeler`, `Car / Enclosed Transit`, `Outdoor Workout`) apply exposure, traction, and visibility multipliers (for instance, heavy rain + gusts penalize two-wheelers far more heavily than enclosed cars).
   - Health constraint flags (`Asthma / Respiratory sensitivity`, `Heat sensitivity`, `Low-light caution`) dynamically tighten thresholds in real time.

2. **Transparent Readiness Score & Verdict:**
   - Starts at `100` and deducts weighted penalties for every active environmental trigger, producing:
     - `GO` (`82–100`)
     - `CAUTION` (`62–81`)
     - `DELAY_OR_REROUTE` (`40–61`)
     - `AVOID` (`< 40` or critical safety threshold breach)
   - Generates a ranked list of **Active Risk Drivers** and a **Context-Specific Action Checklist** (e.g., N95 mask, cabin air recirculation, hydration cadence, wet-road travel buffer).

3. **12-Hour Optimal Departure Window Scanner:**
   - Evaluates the next 12 hourly forecast intervals under the user's *exact* persona and sensitivity profile to identify the safest upcoming time window and quantify score improvement.

4. **Hybrid Conversational AI (`netlify/functions/assistant.mts`):**
   - Sends live telemetry, user context, deterministic risk breakdown, and recent chat turns to **Google Gemini (`gemini-2.5-flash`) via Netlify AI Gateway**.
   - Includes automatic fallback to `synthesizeContextReply` (our deterministic context reasoning synthesizer) when running offline or without gateway credentials, guaranteeing reliable, honest answers without fabricated metrics.

---

## 3. How the Solution Works

```text
Browser (React 19 + TypeScript + Tailwind)
  ├── Location Input: City Search / Quick Presets / Browser GPS
  ├── Context Profile: Persona + Mode + Time Horizon + Health Flags
  │
  ├── GET /api/telemetry  ──► Netlify Function (telemetry.mts)
  │                             ├── Open-Meteo Geocoding API
  │                             ├── Open-Meteo Live Weather & 12h Forecast
  │                             └── Open-Meteo Live Air Quality (AQI, PM2.5, PM10, O3)
  │
  └── POST /api/assistant ──► Netlify Function (assistant.mts)
                                ├── Context Decision Engine (deterministic scoring)
                                └── Gemini via Netlify AI Gateway (with deterministic fallback)
```

---

## 4. Assumptions Made

1. **Telemetry & Geocoding Scope:** Uses the public Open-Meteo Weather & Air Quality APIs, OpenStreetMap Nominatim locality fallback (prioritizing Indian cities & neighborhoods such as `Whitefield, Bengaluru`), and server-side **TomTom Traffic Flow** (`TOMTOM_API_KEY` stored securely as a Netlify runtime secret, never committed to the repository). When running locally without `TOMTOM_API_KEY`, traffic queries honestly note that live vehicle-speed feeds are unavailable offline while reporting weather-driven road delay risks.
2. **Threshold Calibration:** Persona AQI thresholds are adapted conservatively around US EPA AQI bands, scaled down for high-ventilation (`Outdoor Athlete`) and vulnerable (`Respiratory-Sensitive`) profiles.
3. **Privacy by Default:** Browser GPS coordinates and user context preferences stay ephemeral per request and are not persisted to a third-party database.
4. **Resilient AI Availability:** When deployed on Netlify with AI Gateway active, conversational replies use Gemini (`gemini-2.5-flash`); in local/offline environments, the deterministic context engine supplies grounded answers without failing.

---

## 5. Quality, Security, Accessibility & Testing

- **Security:** Strict input sanitization and length caps on `/api/assistant`, coordinate range validation on `/api/telemetry`, zero client-side secrets, and security headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`) configured in `netlify.toml`.
- **Accessibility:** Skip-to-main-content link, semantic landmarks (`header`, `main`, `aside`, `section`), keyboard focus outlines, explicit labels, radio groups, and `aria-live="polite"` status updates.
- **Testing & Verification:**
  ```bash
  npm install
  npm test       # Vitest suite covering context scoring, persona logic & serverless functions
  npm run build  # TypeScript typecheck + Vite production bundle
  ```
