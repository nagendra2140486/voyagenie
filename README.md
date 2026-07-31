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
git clone https://github.com/Cognizant-FrontierAICyberDefense/voyagenie.git
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

End-to-end tests use [Playwright](https://playwright.dev). All three services and PostgreSQL
must be running (`scripts/dev.sh`), with `LLM_PROVIDER=mock` so results are deterministic and
no provider spend is incurred.

```bash
cd tests && npm install
npx playwright install chromium    # once, downloads the browser
npm run typecheck                  # type-check the specs
npm test                           # 35 specs: business, GenAI, guardrails, OpenAPI
npm run test:ui                    # interactive runner
npm run report                     # HTML report of the last run
npm run postman                    # API + guardrail assertions via newman
```

| Spec | Covers |
| --- | --- |
| `e2e/business.spec.ts` | Home, hero search, destination filters and empty state, destination detail, packages and style filter, package → planner handoff, contact form success and validation, every navbar route, 404 |
| `e2e/genai.spec.ts` | Itinerary generation and save to My Trips, response cache, assistant multi-turn chat and suggestions, budget breakdown, trip view/rename/clone/delete, empty state |
| `e2e/guardrails.spec.ts` | Injection blocked, prompt too long, invalid payload, rate limit 429 and `x-ratelimit-*` headers, audit log leaks no key, governance page |
| `e2e/openapi.spec.ts` | OpenAPI spec covers every route and exposes no secrets, Swagger UI renders |

### Spec inventory

[`tests/spec-inventory.json`](tests/spec-inventory.json) lists every spec file, test title and
tag. Automated test-selection reads it as a closed vocabulary — a selector may only pick tests
that appear here — so it must match the suite:

```bash
cd tests
npm run inventory         # regenerate after adding, renaming or tagging a test
npm run inventory:check   # non-zero exit if the committed file is stale
```

Keeping it current is the test leads' responsibility; a stale inventory makes selection fall
back to running the whole suite. The file carries no timestamp, so it changes only when the
tests do.

### Coverage map

[`tests/coverage-map.json`](tests/coverage-map.json) answers "which tests exercise this file?".
It is *recorded*, not inferred: a full run with `VOYAGENIE_COVERAGE=1` observes, per test, the
routes visited, the API endpoints called, and the frontend source files whose functions actually
ran (Chromium V8 coverage — Vite dev-serves unbundled modules, so script URLs map straight to
source paths).

```bash
cd tests
npm run coverage:map      # full run against the live stack, rewrites coverage-map.json
```

```json
"bySourceFile": { "frontend/src/pages/Packages.tsx": ["business.spec.ts > … > packages can be filtered by travel style", "…"] },
"byEndpoint":   { "POST /ai/budget": ["genai.spec.ts > … > budget optimizer returns a category breakdown"] },
"backendOwners": { "/api/packages": "backend/src/routes/packages.ts" }
```

`backendOwners` is read from the `app.use()` mounts in `backend/src/index.ts`, so a changed
backend route file resolves to endpoints and from there to tests. Regenerate after adding tests
or moving routes; a source file absent from `bySourceFile` is a genuine coverage gap, not a
mapping error. Recording forces a single worker and adds ~15s to the run, so it is opt-in.

Override the targets with `VOYAGENIE_BASE_URL` (default `http://localhost:5173`) and
`VOYAGENIE_API_URL` (default `http://localhost:4000`). Each test runs in a fresh browser
context, so every test gets its own `x-session-id` — trips and hourly rate-limit counters
never leak between tests.

## API documentation

| Service | Swagger UI | Spec |
| --- | --- | --- |
| Node backend (`/api/*`, `/ai/*`) | http://localhost:4000/api/docs | http://localhost:4000/api/openapi.json |
| Python AI service | http://localhost:8000/docs | http://localhost:8000/openapi.json |

The backend spec is generated at startup from the same zod schemas the routes validate with
([`backend/src/openapi/document.ts`](backend/src/openapi/document.ts)), so request shapes cannot
drift from the implementation — adding a field to a route schema updates the docs automatically.
Only response shapes and prose are declared separately.

## Performance

[k6](https://k6.io) covers the critical journey end to end at the API layer. The run is a
single virtual user for five minutes — a latency baseline for the demo stack, not a stress test.

```bash
k6 run perf/critical-journeys.js                              # 1 VU, 5 minutes
k6 run --duration 30s perf/critical-journeys.js               # quick smoke
k6 run -e VOYAGENIE_API_URL=http://host:4000 perf/critical-journeys.js
```

Each iteration walks catalogue → filters → destination detail → packages → contact →
AI itinerary → save trip → assistant → budget → governance audit log, with a per-journey
`journey_*_ms` trend and thresholds on every step.

Two guardrails shape the script:

- **Rate limits** are per session and hour, so every iteration mints a fresh
  `x-session-id` (`newSession()`); reusing one id would turn most of the run into 429s.
- **`llm_cache`** would otherwise serve repeated AI payloads without touching the provider,
  so AI request bodies carry a unique suffix.

AI thresholds default to `p(95) < 1500ms`, which suits `LLM_PROVIDER=mock`; raise it for a
real provider with `-e AI_P95_MS=8000`.

## Heartbeat gate

`devin/tools/heartbeat.py` is the post-deploy availability gate: it runs after a build is
deployed and before the functional or performance suites, so their failures mean "the code is
wrong" rather than "the deploy is broken". Standard library only, read-only, under a minute.

```bash
python3 devin/tools/heartbeat.py \
  --backend-url http://localhost:4000 --frontend-url http://localhost:5173 --ai-url http://localhost:8000 \
  --run-id local --expect provider=mock --expect api_key=false --out-dir reports/local
```

The checks themselves live in `devin/tools/heartbeat-expectations.json`, not in the script, so the
same script serves any repository: the file declares the services, the API surface, the seed
baselines and the config assertions below.

| Phase | Checks |
| --- | --- |
| Readiness | Polls both `/health` endpoints until they answer or `--ready-timeout` (default 90s) expires — containers are usually still warming right after a deploy |
| System | `/health` on backend and ai-service; `--commit` compares the deployed SHA so a stale build isn't smoke-tested as if it were the new one |
| API | Every parameterless `GET` in `/api/openapi.json`, so a new endpoint is covered the day it ships |
| Data | Catalogue counts match the seed (12 destinations, 8 packages) — the functional specs assert these, so a partial seed is reported as data, not UI, breakage |
| Config | `llmConfig` matches `--expect-provider` / `--expect-api-key`, and no secret-carrying field is serialised |
| Frontend | `index.html` plus every script and stylesheet it references — a SPA returns 200 for any route, so only the assets prove the deploy is intact |
| CORS | Preflight from the frontend origin, which no plain `GET` would reveal |

Exit codes: `0` healthy, `1` a check failed, `2` the environment never became ready (retry the
deploy rather than blaming the tests). Slow-but-correct responses are reported as `warn` unless
`--strict`. Writes `heartbeat.json`, `heartbeat.md` and JUnit XML to `--out-dir`.

`devin/tools/publish_report.py` posts any of those markdown reports to the CRaaS PR QE
Impact API, keeping the payload shape and report-type vocabulary in one place:

```bash
python3 devin/tools/publish_report.py --file reports/local/heartbeat.md \
  --reporttype heartbeat-report --pr-id 12 \
  --appname voyagenie --repository https://github.com/Cognizant-FrontierAICyberDefense/voyagenie/
```

The API requires `analysis_json` alongside the markdown. The script fills it from the report's own
`<!-- prqe-verdict -->` fenced block when there is one, `--json-file` when given, and `{}`
otherwise, so a stage with nothing structured to say still publishes. 5xx responses are retried
with backoff — the Cosmos write path returns intermittent 500s — while 4xx fails immediately,
since a rejected document is wrong rather than unlucky.

`--appname` and `--repository` have no defaults (or set `CRAAS_APPNAME` / `CRAAS_REPOSITORY`):
the script is copied between repositories, and document ids are `{appname}_{reporttype}_{pr_id}`,
so a stale default would file this app's reports under another app's id.

## PRQE run configuration

`devin/config.yaml` describes this repository to the shared PRQE playbooks — PR analysis,
heartbeat, functional, performance and final analysis. Those playbooks are used across
repositories and name nothing repo-specific, so anything they need to know about the layout is
declared here: the heartbeat and publisher commands, the spec inventory and coverage map used
for test selection, the force-full and low-signal path lists, the test and performance commands,
and the CRaaS report type for each stage.

Keep it current when paths move. A wrong path there makes a stage skip or fall back to the full
suite, which is exactly the silent failure the selection logic is meant to avoid.

### Ticket attribution

`devin/tools/tickets.py` maps a PR's remediation tickets to the files they changed, so the final
verdict can say which ticket a failing test belongs to:

```bash
python3 devin/tools/tickets.py --repo . --base origin/main --head HEAD --out tickets.json
# VIT0016042: 1 commit(s), 2 file(s) -> backend/src/openapi/document.ts, backend/src/routes/contact.ts
```

Ids are matched as `VIT` + digits anywhere in a commit's title or body, rather than by parsing the
`fix(...)` scope: CRaaS writes `fix(VIT0015739): ...` in some repos and
`fix(security): VIT0016042 - ...` in others, and scope-parsing yields `security` for the second.
Commits with no id collect under `_untracked`, which is what lets a failure be reported as
non-ticket-related instead of being attached to the nearest ticket.

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
