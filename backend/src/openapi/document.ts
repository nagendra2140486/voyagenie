import { OpenApiGeneratorV31, OpenAPIRegistry, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { config } from '../config.js';
import { budgetSchema, chatSchema, itinerarySchema } from '../routes/ai.js';
import { inquirySchema } from '../routes/contact.js';
import { destinationFiltersSchema } from '../routes/destinations.js';
import { auditQuerySchema } from '../routes/governance.js';
import { packageFiltersSchema } from '../routes/packages.js';
import { tripCreateSchema, tripUpdateSchema } from '../routes/trips.js';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

const sessionHeader = registry.registerParameter(
  'SessionId',
  z.string().max(64).openapi({
    param: { name: 'x-session-id', in: 'header', required: false },
    description:
      'Mock session identity. Any stable string; the server generates an `anon-<uuid>` one when omitted and echoes it back on the response.',
    example: 'demo-session-1',
  }),
);

const idParam = z.object({
  id: z.coerce.number().int().openapi({ param: { name: 'id', in: 'path' }, example: 1 }),
});

const ErrorResponse = registry.register(
  'Error',
  z
    .object({
      code: z.string().openapi({ example: 'not_found' }),
      message: z.string().openapi({ example: 'Destination not found.' }),
      field: z.string().optional(),
    })
    .openapi('Error'),
);

const Destination = registry.register(
  'Destination',
  z
    .object({
      id: z.number().int(),
      city: z.string(),
      country: z.string(),
      summary: z.string(),
      budget_level: z.enum(['low', 'medium', 'high']),
      travel_style: z.string(),
      best_season: z.string(),
      image_url: z.string(),
      attractions: z.array(z.string()),
    })
    .openapi('Destination'),
);

const Package = registry.register(
  'Package',
  z
    .object({
      id: z.number().int(),
      title: z.string(),
      destination_id: z.number().int().nullable(),
      duration_days: z.number().int(),
      price_range: z.string(),
      price_from_usd: z.number(),
      travel_style: z.string(),
      inclusions: z.array(z.string()),
      destination_city: z.string().nullable(),
      destination_country: z.string().nullable(),
    })
    .openapi('Package'),
);

const Trip = registry.register(
  'Trip',
  z
    .object({
      id: z.number().int(),
      session_id: z.string(),
      title: z.string(),
      destination: z.string(),
      days: z.number().int().nullable(),
      budget: z.string().nullable(),
      travel_type: z.string().nullable(),
      source: z.enum(['ai_itinerary', 'ai_budget', 'manual', 'package']),
      itinerary_text: z.string(),
      created_at: z.string().datetime(),
    })
    .openapi('Trip'),
);

const RateLimit = registry.register(
  'RateLimit',
  z
    .object({
      allowed: z.boolean(),
      limit: z.number().int(),
      used: z.number().int(),
      remaining: z.number().int(),
      resetsAt: z.string().datetime(),
    })
    .openapi('RateLimit'),
);

const AiResponse = registry.register(
  'AiResponse',
  z
    .object({
      content: z.string().openapi({ description: 'Markdown answer from the LLM.' }),
      meta: z.object({
        provider: z.string(),
        model: z.string(),
        prompt_chars: z.number().int(),
        token_estimate: z.number().int(),
        latency_ms: z.number().int(),
      }),
      cached: z.boolean().openapi({ description: 'True when served from `llm_cache`, which also skips the rate limiter.' }),
      rateLimit: RateLimit.optional(),
    })
    .openapi('AiResponse'),
);

const json = <T extends z.ZodTypeAny>(schema: T) => ({ content: { 'application/json': { schema } } });

const errorResponses = {
  400: { description: 'Validation or guardrail rejection.', ...json(ErrorResponse) },
  404: { description: 'Not found.', ...json(ErrorResponse) },
};

registry.registerPath({
  method: 'get',
  path: '/health',
  operationId: 'health',
  tags: ['System'],
  summary: 'Liveness probe',
  responses: {
    200: {
      description: 'Service is up.',
      ...json(z.object({ status: z.literal('ok'), service: z.string(), provider: z.string() })),
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/destinations',
  operationId: 'listDestinations',
  tags: ['Catalogue'],
  summary: 'List destinations',
  description: 'All filters combine with AND. `q` matches city, country or summary.',
  request: { query: destinationFiltersSchema },
  responses: {
    200: { description: 'Matching destinations.', ...json(z.object({ count: z.number().int(), destinations: z.array(Destination) })) },
    400: errorResponses[400],
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/destinations/filters',
  operationId: 'getDestinationFilters',
  tags: ['Catalogue'],
  summary: 'Available filter values',
  responses: {
    200: {
      description: 'Distinct values to populate the filter controls.',
      ...json(
        z.object({
          countries: z.array(z.string()),
          styles: z.array(z.string()),
          seasons: z.array(z.string()),
          budgetLevels: z.array(z.enum(['low', 'medium', 'high'])),
        }),
      ),
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/destinations/{id}',
  operationId: 'getDestination',
  tags: ['Catalogue'],
  summary: 'Destination detail',
  description: 'Returns the destination plus up to three related destinations and the packages that target it.',
  request: { params: idParam },
  responses: {
    200: {
      description: 'Destination detail.',
      ...json(z.object({ destination: Destination, related: z.array(Destination.partial()), packages: z.array(Package) })),
    },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/packages',
  operationId: 'listPackages',
  tags: ['Catalogue'],
  summary: 'List packages',
  request: { query: packageFiltersSchema },
  responses: {
    200: { description: 'Matching packages.', ...json(z.object({ count: z.number().int(), packages: z.array(Package) })) },
    400: errorResponses[400],
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/packages/{id}',
  operationId: 'getPackage',
  tags: ['Catalogue'],
  summary: 'Package detail',
  request: { params: idParam },
  responses: {
    200: { description: 'Package detail.', ...json(z.object({ package: Package })) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/trips',
  operationId: 'listTrips',
  tags: ['Trips'],
  summary: 'List saved trips for the session',
  request: { headers: [sessionHeader] },
  responses: {
    200: { description: 'Trips owned by this session id.', ...json(z.object({ count: z.number().int(), trips: z.array(Trip) })) },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/trips',
  operationId: 'createTrip',
  tags: ['Trips'],
  summary: 'Save a trip',
  request: { headers: [sessionHeader], body: json(tripCreateSchema) },
  responses: {
    201: { description: 'Trip created.', ...json(z.object({ trip: Trip })) },
    400: errorResponses[400],
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/trips/{id}',
  operationId: 'getTrip',
  tags: ['Trips'],
  summary: 'Trip detail',
  request: { headers: [sessionHeader], params: idParam },
  responses: {
    200: { description: 'Trip detail.', ...json(z.object({ trip: Trip })) },
    404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/trips/{id}',
  operationId: 'updateTrip',
  tags: ['Trips'],
  summary: 'Rename or retarget a trip',
  request: { headers: [sessionHeader], params: idParam, body: json(tripUpdateSchema) },
  responses: {
    200: { description: 'Updated trip.', ...json(z.object({ trip: Trip })) },
    ...errorResponses,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/trips/{id}/clone',
  operationId: 'cloneTrip',
  tags: ['Trips'],
  summary: 'Clone a trip',
  description: 'Copies the trip within the same session, appending " (copy)" to the title.',
  request: { headers: [sessionHeader], params: idParam },
  responses: {
    201: { description: 'Cloned trip.', ...json(z.object({ trip: Trip })) },
    404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/trips/{id}',
  operationId: 'deleteTrip',
  tags: ['Trips'],
  summary: 'Delete a trip',
  request: { headers: [sessionHeader], params: idParam },
  responses: {
    204: { description: 'Deleted.' },
    404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/contact',
  operationId: 'createInquiry',
  tags: ['Contact'],
  summary: 'Submit an inquiry',
  request: { body: json(inquirySchema) },
  responses: {
    201: {
      description: 'Inquiry stored; `id` is the reference number shown to the user.',
      ...json(z.object({ inquiry: z.object({ id: z.number().int(), created_at: z.string().datetime() }) })),
    },
    400: errorResponses[400],
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/llm-audit',
  operationId: 'getLlmAudit',
  tags: ['Governance'],
  summary: 'LLM audit log, usage and active configuration',
  description: '`llmConfig` deliberately exposes only `apiKeyConfigured: boolean` — the key itself never leaves the server.',
  request: { headers: [sessionHeader], query: auditQuerySchema },
  responses: {
    200: {
      description: 'Governance snapshot.',
      ...json(
        z.object({
          entries: z.array(z.record(z.unknown())),
          summary: z.record(z.unknown()),
          rateLimitUsage: z.record(RateLimit),
          cacheEntries: z.number().int(),
          llmConfig: z.object({
            provider: z.string(),
            model: z.string(),
            apiKeyConfigured: z.boolean(),
            timeoutSeconds: z.number().int(),
            maxInputChars: z.number().int(),
            cacheEnabled: z.boolean(),
            rateLimitPerHour: z.object({ itinerary: z.number().int(), chat: z.number().int(), budget: z.number().int() }),
          }),
        }),
      ),
    },
  },
});

const AI_PATHS = [
  { path: '/ai/itinerary', operationId: 'generateItinerary', summary: 'Generate a day-by-day itinerary', schema: itinerarySchema, feature: 'itinerary' as const },
  { path: '/ai/chat', operationId: 'travelChat', summary: 'Ask the travel assistant', schema: chatSchema, feature: 'chat' as const },
  { path: '/ai/budget', operationId: 'optimiseBudget', summary: 'Optimise a trip budget', schema: budgetSchema, feature: 'budget' as const },
];

for (const route of AI_PATHS) {
  registry.registerPath({
    method: 'post',
    path: route.path,
    operationId: route.operationId,
    tags: ['GenAI'],
    summary: route.summary,
    description: [
      `Guardrails, in order: payload validation, free-text length (\`LLM_MAX_INPUT_CHARS\`, currently ${config.llm.maxInputChars}),`,
      `cache lookup, then the hourly per-session rate limit (currently ${config.rateLimitPerHour[route.feature]} for this feature).`,
      'A cache hit returns immediately and does not consume rate-limit budget.',
      'Responses carry `x-ratelimit-limit` and `x-ratelimit-remaining`.',
    ].join(' '),
    request: { headers: [sessionHeader], body: json(route.schema) },
    responses: {
      200: { description: 'Generated content.', ...json(AiResponse) },
      400: {
        description: 'Validation failure (`invalid_request`), prompt too long (`prompt_too_long`) or a blocked injection attempt (`prompt_injection_blocked`).',
        ...json(ErrorResponse),
      },
      429: {
        description: 'Hourly rate limit reached (`rate_limited`).',
        ...json(ErrorResponse.extend({ rateLimit: RateLimit })),
      },
      502: { description: 'The AI service failed or timed out.', ...json(ErrorResponse) },
    },
  });
}

export const openApiDocument = new OpenApiGeneratorV31(registry.definitions).generateDocument({
  openapi: '3.1.0',
  info: {
    title: 'Voyagenie API',
    version: '1.0.0',
    description:
      'Travel catalogue plus GenAI features. Generated from the same zod schemas the routes validate with, so the spec cannot drift from the implementation.',
  },
  servers: [{ url: `http://localhost:${config.port}`, description: 'Local development' }],
  tags: [
    { name: 'Catalogue', description: 'Destinations and packages.' },
    { name: 'Trips', description: 'Saved itineraries, scoped to the session id.' },
    { name: 'GenAI', description: 'LLM-backed features behind validation, cache and rate-limit guardrails.' },
    { name: 'Governance', description: 'Audit log, usage and non-secret LLM configuration.' },
    { name: 'Contact', description: 'Inquiry form.' },
    { name: 'System', description: 'Health check.' },
  ],
});
