import { check, group, sleep } from 'k6';
import http from 'k6/http';
import { AI_P95_MS, API_URL, headers, newSession, trends, uniqueSuffix } from './lib/config.js';

/**
 * Critical-path performance run for Voyagenie: catalogue browsing, destination detail,
 * packages, contact form and the three GenAI features, ending on the governance view.
 *
 * Deliberately a single virtual user for five minutes — this is a latency baseline for
 * the demo stack, not a stress test. Run against LLM_PROVIDER=mock so AI timings are
 * the app's own overhead rather than a third-party provider's.
 */
export const options = {
  vus: 1,
  duration: '5m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    'journey_catalogue_ms': ['p(95)<500'],
    'journey_destination_detail_ms': ['p(95)<500'],
    'journey_packages_ms': ['p(95)<500'],
    'journey_contact_ms': ['p(95)<500'],
    'journey_trips_ms': ['p(95)<500'],
    'journey_governance_ms': ['p(95)<800'],
    // Sized for the mock provider; raise these when pointing at a real LLM.
    'journey_ai_itinerary_ms': [`p(95)<${AI_P95_MS}`],
    'journey_ai_chat_ms': [`p(95)<${AI_P95_MS}`],
    'journey_ai_budget_ms': [`p(95)<${AI_P95_MS}`],
  },
};

const ok = (response, name) =>
  check(response, { [`${name} -> 2xx`]: (r) => r.status >= 200 && r.status < 300 });

export default function () {
  const session = newSession();
  const params = { headers: headers(session) };
  let destinationId = 1;

  group('01 browse catalogue', () => {
    const list = http.get(`${API_URL}/api/destinations`, { ...params, tags: { name: 'GET /api/destinations' } });
    ok(list, 'destinations');
    trends.catalogue.add(list.timings.duration);

    const filters = http.get(`${API_URL}/api/destinations/filters`, {
      ...params,
      tags: { name: 'GET /api/destinations/filters' },
    });
    ok(filters, 'destination filters');
    trends.catalogue.add(filters.timings.duration);

    const filtered = http.get(`${API_URL}/api/destinations?budget=low&style=culture`, {
      ...params,
      tags: { name: 'GET /api/destinations?filters' },
    });
    ok(filtered, 'filtered destinations');
    trends.catalogue.add(filtered.timings.duration);

    const destinations = list.json('destinations');
    if (Array.isArray(destinations) && destinations.length) {
      destinationId = destinations[(__ITER + 1) % destinations.length].id;
    }
  });
  sleep(1);

  group('02 destination detail', () => {
    const detail = http.get(`${API_URL}/api/destinations/${destinationId}`, {
      ...params,
      tags: { name: 'GET /api/destinations/:id' },
    });
    ok(detail, 'destination detail');
    trends.detail.add(detail.timings.duration);
  });
  sleep(1);

  group('03 packages', () => {
    const list = http.get(`${API_URL}/api/packages`, { ...params, tags: { name: 'GET /api/packages' } });
    ok(list, 'packages');
    trends.packages.add(list.timings.duration);

    const byStyle = http.get(`${API_URL}/api/packages?style=luxury`, {
      ...params,
      tags: { name: 'GET /api/packages?style' },
    });
    ok(byStyle, 'packages by style');
    trends.packages.add(byStyle.timings.duration);

    const first = list.json('packages.0.id');
    if (first) {
      const detail = http.get(`${API_URL}/api/packages/${first}`, {
        ...params,
        tags: { name: 'GET /api/packages/:id' },
      });
      ok(detail, 'package detail');
      trends.packages.add(detail.timings.duration);
    }
  });
  sleep(1);

  group('04 contact inquiry', () => {
    const response = http.post(
      `${API_URL}/api/contact`,
      JSON.stringify({
        name: 'k6 Load User',
        email: `k6-${uniqueSuffix()}@example.com`,
        subject: 'Performance baseline run',
        message: 'Automated k6 inquiry generated during a performance baseline run.',
      }),
      { ...params, tags: { name: 'POST /api/contact' } },
    );
    ok(response, 'contact inquiry');
    trends.contact.add(response.timings.duration);
  });
  sleep(1);

  group('05 ai itinerary and save', () => {
    const itinerary = http.post(
      `${API_URL}/ai/itinerary`,
      JSON.stringify({
        destination: `Load City ${uniqueSuffix()}`,
        days: 3,
        budget: 'medium',
        travel_type: 'family',
        interests: ['food', 'nature'],
      }),
      { ...params, tags: { name: 'POST /ai/itinerary' } },
    );
    ok(itinerary, 'ai itinerary');
    trends.itinerary.add(itinerary.timings.duration);

    const content = itinerary.json('content');
    if (typeof content === 'string' && content.length) {
      const saved = http.post(
        `${API_URL}/api/trips`,
        JSON.stringify({
          title: `k6 baseline trip ${uniqueSuffix()}`,
          destination: 'Load City',
          days: 3,
          budget: 'medium',
          source: 'ai_itinerary',
          itineraryText: content,
        }),
        { ...params, tags: { name: 'POST /api/trips' } },
      );
      ok(saved, 'save trip');
      trends.trips.add(saved.timings.duration);
    }

    const list = http.get(`${API_URL}/api/trips`, { ...params, tags: { name: 'GET /api/trips' } });
    ok(list, 'list trips');
    trends.trips.add(list.timings.duration);
  });
  sleep(1);

  group('06 ai assistant', () => {
    const response = http.post(
      `${API_URL}/ai/chat`,
      JSON.stringify({ message: `What should I pack for a trip in ${uniqueSuffix()}?`, history: [] }),
      { ...params, tags: { name: 'POST /ai/chat' } },
    );
    ok(response, 'ai chat');
    trends.chat.add(response.timings.duration);
  });
  sleep(1);

  group('07 ai budget optimizer', () => {
    const response = http.post(
      `${API_URL}/ai/budget`,
      JSON.stringify({
        destination: `Load City ${uniqueSuffix()}`,
        days: 5,
        budget_amount: 2400,
        currency: 'USD',
        travellers: 2,
        travel_style: 'balanced',
      }),
      { ...params, tags: { name: 'POST /ai/budget' } },
    );
    ok(response, 'ai budget');
    trends.budget.add(response.timings.duration);
  });
  sleep(1);

  group('08 governance', () => {
    const response = http.get(`${API_URL}/api/llm-audit?limit=50`, {
      ...params,
      tags: { name: 'GET /api/llm-audit' },
    });
    ok(response, 'audit log');
    trends.governance.add(response.timings.duration);
  });
  sleep(1);
}
