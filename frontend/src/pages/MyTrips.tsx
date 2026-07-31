import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorAlert } from '../components/Feedback';
import { Markdown } from '../components/Markdown';
import { cloneTrip, deleteTrip, fetchTrips, renameTrip } from '../api/endpoints';
import type { ApiError } from '../api/client';
import type { Trip } from '../types';

export const MyTrips = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selected, setSelected] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    fetchTrips()
      .then((data) => {
        setTrips(data.trips);
        setSelected((current) => data.trips.find((t) => t.id === current?.id) ?? data.trips[0] ?? null);
        setError(null);
      })
      .catch((err: ApiError) => setError(err.message))
      .finally(() => setLoading(false));

  useEffect(() => {
    void load();
  }, []);

  const onDelete = async (id: number) => {
    await deleteTrip(id);
    if (selected?.id === id) setSelected(null);
    await load();
  };

  const onClone = async (id: number) => {
    await cloneTrip(id);
    await load();
  };

  const onRename = async (trip: Trip) => {
    const title = window.prompt('New trip title', trip.title);
    if (!title) return;
    await renameTrip(trip.id, title);
    await load();
  };

  return (
    <>
      <div className="page-head">
        <div className="container">
          <div className="eyebrow">My Trips</div>
          <h1>Saved Itineraries and Budgets</h1>
          <p>Everything you save is persisted in DB against your browser session.</p>
        </div>
      </div>

      <section className="section">
        <div className="container">
          {error && <ErrorAlert message={error} />}

          {loading ? (
            <div className="skeleton" style={{ height: 260 }} />
          ) : trips.length === 0 ? (
            <div className="empty">
              <h3>No saved trips yet</h3>
              <p>Generate an itinerary or a budget plan with AI, then save it here.</p>
              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link className="btn btn--primary" to="/planner">
                  Open AI Trip Planner
                </Link>
                <Link className="btn btn--ghost" to="/budget">
                  Open AI Budget-Optimizer
                </Link>
              </div>
            </div>
          ) : (
            <div className="split">
              <div style={{ display: 'grid', gap: '0.85rem' }}>
                {trips.map((trip) => (
                  <article
                    key={trip.id}
                    className="panel"
                    style={{
                      padding: '1rem 1.1rem',
                      borderColor: selected?.id === trip.id ? 'var(--teal)' : 'var(--line)',
                    }}
                    data-testid="trip-item"
                  >
                    <div className="chips" style={{ marginBottom: '0.45rem' }}>
                      <span className="chip">{trip.source === 'ai_budget' ? 'budget plan' : 'itinerary'}</span>
                      {trip.days && <span className="chip chip--grey">{trip.days} days</span>}
                      {trip.budget && <span className="chip chip--grey">{trip.budget}</span>}
                    </div>
                    <h3 style={{ marginBottom: '0.3rem' }}>{trip.title}</h3>
                    <p style={{ fontSize: '0.85rem', margin: '0 0 0.7rem' }}>
                      {trip.destination} · saved {new Date(trip.created_at).toLocaleDateString()}
                    </p>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button className="btn btn--ghost btn--sm" onClick={() => setSelected(trip)}>
                        View
                      </button>
                      <button className="btn btn--ghost btn--sm" onClick={() => onRename(trip)}>
                        Rename
                      </button>
                      <button className="btn btn--ghost btn--sm" onClick={() => onClone(trip.id)}>
                        Clone
                      </button>
                      <button className="btn btn--danger btn--sm" onClick={() => onDelete(trip.id)}>
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              <div>
                {selected ? (
                  <div className="ai-output" data-testid="trip-detail">
                    <Markdown>{selected.itinerary_text}</Markdown>
                  </div>
                ) : (
                  <div className="empty">
                    <h3>Select a trip</h3>
                    <p>Pick a saved trip on the left to read the full plan.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
};
