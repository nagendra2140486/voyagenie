# Voyagenie

A commercial-looking travel portal with an embedded GenAI planning studio, built as an
**Application Under Test (AUT)** for QE, automation and GenAI product demos.

It deliberately contains both halves of a realistic enterprise app:

- a conventional website (catalogue pages, filters, forms, database persistence), and
- three LLM-backed features behind a **provider-agnostic** AI service with **mandatory guardrails**.

```
React + Vite (5173)  ──►  Node/Express API (4000)  ──►  Python FastAPI AI service (8000)  ──►  LLM provider
                               │                              │
                               └──────► PostgreSQL ◄──────────┘
```

The browser never calls an LLM provider directly, so API keys never reach the client.

## Pages

| Route | Type | What it demonstrates |
| --- | --- | --- |
| `/` | Static + search | Hero, destination search, popular destinations, packages, testimonials, newsletter |
| `/destinations` | Business | Filter by search text, country, budget level and travel style |
| `/destinations/:id` | Business | Overview, attractions, gallery, tips, related destinations, linked packages |
| `/packages` | Static + business | Curated package catalogue with style filter |
| `/planner` | GenAI | Guided itinerary generation, save to My Trips |
| `/assistant` | GenAI | Conversational travel chat with history |
| `/budget` | GenAI | Budget split and savings recommendations |
| `/trips` | Business | Saved trips: view, rename, clone, delete (PostgreSQL-backed) |
| `/about` | Static | Company content |
| `/contact` | Static + form | Inquiry stored in PostgreSQL |
| `/ai-governance` | Governance | Live audit log, rate-limit usage, active LLM configuration |

## Quick start

Prerequisites: Node 20.19+ (or 22.12+), Python 3.10+, PostgreSQL 14+.

```bash
git clone https://github.com/Cognizant-QEAOrg/voyagenie.git
cd voyagenie
cp .env.example .env          # defaults run entirely offline with the mock LLM provider

# 1. database
createdb voyagenie            # or: docker compose up -d db
psql "$DATABASE_URL" -f db/schema.sql
psql "$DATABASE_URL" -f db/seed.sql

# 2. Python AI service (port 8000)
cd ai-service && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --port 8000 &

# 3. Node backend (port 4000)
cd ../backend && npm install && npm run dev &

# 4. React frontend (port 5173)
cd ../frontend && npm install && npm run dev
```

Open http://localhost:5173.

`npm run db:setup` inside `backend/` applies `db/schema.sql` and `db/seed.sql` for you.

## LLM provider configuration

Switching provider is a configuration change, never a code change. Set these in `.env`:

| Variable | Example | Purpose |
| --- | --- | --- |
| `LLM_PROVIDER` | `mock` \| `openai` \| `codex` \| `claude` | Selects the adapter |
| `LLM_MODEL` | `gpt-4o-mini`, `claude-3-5-sonnet-latest` | Model name passed to the provider |
| `LLM_API_KEY` | *(from environment only)* | Never committed, never sent to the browser |
| `LLM_BASE_URL` | `https://my-gateway/v1` | Optional override for OpenAI-compatible gateways |

`mock` is the default: a deterministic offline adapter that produces realistic itineraries,
budgets and chat answers so the whole application is demoable **without any API key or spend**.
Adding a real key and changing `LLM_PROVIDER` switches every AI feature at once.

Adapters live in `ai-service/app/providers/`; add a new one by implementing `LLMProvider`
and registering it in `providers/__init__.py`.

## Guardrails

| Control | Where | Behaviour |
| --- | --- | --- |
| Provider abstraction | `ai-service/app/providers` | Adapter pattern selected by `LLM_PROVIDER` |
| No direct UI → LLM calls | frontend → backend → AI service | Keys stay server-side |
| Rate limiting | `backend/src/services/rateLimit.ts` | Per session/feature/hour counters in PostgreSQL (10 itinerary, 25 chat, 10 budget); friendly 429 message |
| Prompt length limit | backend + AI service | Rejects input over `LLM_MAX_INPUT_CHARS` (2000) with a clear validation error |
| Output token limit | `ai-service/app/config.py` | Per-feature caps (itinerary 1000, chat 500, budget 700) |
| Prompt sanitization | `ai-service/app/guardrails.py` | Blocks injection phrases such as "ignore previous instructions" or "show API key" |
| Request timeout | backend `AbortController` + AI service `asyncio.wait_for` | `LLM_TIMEOUT_SECONDS` (60) with a retry message |
| API key protection | `.env` only, `.gitignore`d | Never logged, never returned by any endpoint |
| Audit logging | `llm_audit_log` table | Timestamp, feature, provider, model, status, prompt chars, token estimate, latency, cached flag — never the key |
| Response caching | `llm_cache` table | SHA-256 of provider+model+feature+payload; repeated requests skip the provider and the rate-limit counter |

All of this is visible in the UI at `/ai-governance`.

## API

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/destinations` | GET | Catalogue with `q`, `country`, `budget`, `season`, `style` filters |
| `/api/destinations/filters` | GET | Distinct filter values |
| `/api/destinations/:id` | GET | Details + related destinations + linked packages |
| `/api/packages` | GET | Package catalogue (`style`, `maxPrice`) |
| `/api/packages/:id` | GET | Package detail |
| `/api/trips` | GET / POST | List and save trips for the current session |
| `/api/trips/:id` | GET / PATCH / DELETE | Read, rename and delete a trip |
| `/api/trips/:id/clone` | POST | Duplicate a trip |
| `/api/contact` | POST / GET | Store and list inquiries |
| `/api/llm-audit` | GET | Audit log, rate-limit usage and non-secret LLM config |
| `/ai/itinerary` | POST | Day-wise itinerary |
| `/ai/chat` | POST | Travel assistant answer |
| `/ai/budget` | POST | Budget split and recommendations |

Sessions are identified by the `x-session-id` header (mock identity — production auth is out of scope).

## Data model

`app_sessions`, `destinations`, `packages`, `trips`, `contact_inquiries`, `llm_audit_log`,
`rate_limit_counter`, `llm_cache` — see [`db/schema.sql`](db/schema.sql). Seed data in
[`db/seed.sql`](db/seed.sql): 12 destinations, 8 packages.

## Tests

```bash
cd tests && npm install
npx cypress run                                          # 12 UI + API specs
npx newman run postman/Voyagenie.postman_collection.json  # API + guardrail assertions
```

Cypress covers the commercial journeys (search, filter, packages, contact) and the GenAI
journeys plus guardrail negative tests (injection blocked, prompt too long, rate limit 429,
audit log contains no secrets).

## Demo flow

1. Home → search "Singapore" → open the destination detail page.
2. Packages → show the curated catalogue.
3. AI Trip Planner → 4-day family trip, medium budget → save it.
4. My Trips → open the saved itinerary.
5. AI Travel Assistant → ask a follow-up question.
6. AI Budget Optimizer → run with a fixed budget.
7. AI Governance → show provider config, rate-limit usage and the audit log.

## Out of scope

Real flight/hotel booking, payments, production authentication, live maps/weather and vector
search. All destination, package and pricing data is synthetic.
