import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AiMetaBar } from '../components/AiMetaBar';
import { ErrorAlert, OutputSkeleton, SuccessAlert } from '../components/Feedback';
import { Markdown } from '../components/Markdown';
import { ApiError } from '../api/client';
import { createTrip, generateItinerary } from '../api/endpoints';
import type { AiResult } from '../types';

const INTERESTS = ['food', 'history', 'nature', 'shopping', 'nightlife', 'adventure', 'art', 'relaxation'];
const MAX_CONSTRAINT_CHARS = 2000;

const EXAMPLES = [
  { destination: 'Singapore', days: 4, travelType: 'family', interests: ['food', 'nature'] },
  { destination: 'Tokyo', days: 6, travelType: 'couple', interests: ['food', 'art'] },
  { destination: 'Bali', days: 7, travelType: 'solo', interests: ['nature', 'relaxation'] },
];

export const TripPlanner = () => {
  const [params] = useSearchParams();
  const [destination, setDestination] = useState(params.get('destination') ?? '');
  const [days, setDays] = useState(Number(params.get('days')) || 4);
  const [budget, setBudget] = useState('medium');
  const [travelType, setTravelType] = useState('family');
  const [interests, setInterests] = useState<string[]>(['food']);
  const [constraints, setConstraints] = useState('');

  const [result, setResult] = useState<AiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ code?: string; message: string } | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggleInterest = (interest: string) =>
    setInterests((current) =>
      current.includes(interest) ? current.filter((i) => i !== interest) : [...current, interest],
    );

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(null);
    setResult(null);
    try {
      setResult(
        await generateItinerary({
          destination: destination.trim(),
          days,
          budget,
          travel_type: travelType,
          interests,
          constraints: constraints.trim(),
        }),
      );
    } catch (err) {
      const apiError = err as ApiError;
      setError({ code: apiError.code, message: apiError.message });
    } finally {
      setLoading(false);
    }
  };

  const onSave = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const { trip } = await createTrip({
        title: `${days}-day ${destination} trip`,
        destination,
        days,
        budget,
        travelType,
        source: 'ai_itinerary',
        itineraryText: result.content,
      });
      setSaved(trip.title);
    } catch (err) {
      setError({ code: (err as ApiError).code, message: (err as ApiError).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div className="container">
          <div className="eyebrow">AI Trip Planner</div>
          <h1>Generate a day-by-day itinerary</h1>
          <p>
            Tell us where and how you travel. The request goes to our backend, which calls the Python AI service —
            the browser never talks to an LLM provider directly.
          </p>
        </div>
      </div>

      <section className="section">
        <div className="container split">
          <form className="panel form" onSubmit={onSubmit} data-testid="planner-form">
            <div className="field">
              <label htmlFor="destination">Destination *</label>
              <input
                id="destination"
                required
                minLength={2}
                placeholder="e.g. Singapore"
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
              />
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="days">Days *</label>
                <input
                  id="days"
                  type="number"
                  min={1}
                  max={30}
                  required
                  value={days}
                  onChange={(event) => setDays(Number(event.target.value))}
                />
              </div>
              <div className="field">
                <label htmlFor="budget">Budget level</label>
                <select id="budget" value={budget} onChange={(event) => setBudget(event.target.value)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="travelType">Travel type</label>
                <select id="travelType" value={travelType} onChange={(event) => setTravelType(event.target.value)}>
                  <option value="solo">Solo</option>
                  <option value="couple">Couple</option>
                  <option value="family">Family</option>
                  <option value="friends">Friends</option>
                  <option value="business">Business</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label>Interests</label>
              <div className="chips">
                {INTERESTS.map((interest) => (
                  <button
                    type="button"
                    key={interest}
                    className={`btn btn--sm ${interests.includes(interest) ? 'btn--primary' : 'btn--ghost'}`}
                    style={{ textTransform: 'capitalize' }}
                    onClick={() => toggleInterest(interest)}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label htmlFor="constraints">Constraints or preferences</label>
              <textarea
                id="constraints"
                maxLength={MAX_CONSTRAINT_CHARS + 200}
                placeholder="e.g. travelling with a 4-year-old, no long hikes, vegetarian food only"
                value={constraints}
                onChange={(event) => setConstraints(event.target.value)}
              />
              <span className={`hint ${constraints.length > MAX_CONSTRAINT_CHARS ? 'over' : ''}`}>
                {constraints.length} / {MAX_CONSTRAINT_CHARS} characters (prompt length guardrail)
              </span>
            </div>

            <button className="btn btn--primary" type="submit" disabled={loading || !destination.trim()}>
              {loading && <span className="spinner" />}
              {loading ? 'Generating…' : 'Generate itinerary'}
            </button>

            <div className="field">
              <span className="hint">Try an example:</span>
              <div className="chips">
                {EXAMPLES.map((example) => (
                  <button
                    key={example.destination}
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => {
                      setDestination(example.destination);
                      setDays(example.days);
                      setTravelType(example.travelType);
                      setInterests(example.interests);
                    }}
                  >
                    {example.days}d {example.destination} · {example.travelType}
                  </button>
                ))}
              </div>
            </div>
          </form>

          <div>
            {error && <ErrorAlert code={error.code} message={error.message} />}
            {saved && (
              <SuccessAlert>
                Saved “{saved}” to <a href="/trips">My Trips</a>.
              </SuccessAlert>
            )}

            {loading && <OutputSkeleton />}

            {!loading && !result && (
              <div className="empty">
                <h3>Your itinerary will appear here</h3>
                <p>Fill in the form and generate a structured, day-wise plan you can save to My Trips.</p>
              </div>
            )}

            {!loading && result && (
              <>
                <div className="ai-output" data-testid="itinerary-output">
                  <Markdown>{result.content}</Markdown>
                </div>
                <AiMetaBar
                  meta={result.meta}
                  cached={result.cached}
                  remaining={result.rateLimit?.remaining}
                  limit={result.rateLimit?.limit}
                />
                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <button className="btn btn--primary" onClick={onSave} disabled={saving}>
                    {saving ? 'Saving…' : 'Save to My Trips'}
                  </button>
                  <button
                    className="btn btn--ghost"
                    onClick={() => navigator.clipboard?.writeText(result.content)}
                  >
                    Copy itinerary
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </>
  );
};
