import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DestinationCard } from '../components/Cards';
import { CardSkeletons, ErrorAlert } from '../components/Feedback';
import { fetchDestinationFilters, fetchDestinations } from '../api/endpoints';
import type { Destination } from '../types';

interface Filters {
  countries: string[];
  styles: string[];
  seasons: string[];
  budgetLevels: string[];
}

export const Destinations = () => {
  const [params, setParams] = useSearchParams();
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const current = {
    q: params.get('q') ?? '',
    country: params.get('country') ?? '',
    budget: params.get('budget') ?? '',
    style: params.get('style') ?? '',
  };

  useEffect(() => {
    fetchDestinationFilters().then(setFilters).catch(() => setFilters(null));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchDestinations(current)
      .then((data) => {
        setDestinations(data.destinations);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.toString()]);

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  return (
    <>
      <div className="page-head">
        <div className="container">
          <div className="eyebrow">Destinations</div>
          <h1>Find your next trip</h1>
          <p>Filter the catalogue by country, budget level or travel style, then open a destination for details.</p>
        </div>
      </div>

      <section className="section">
        <div className="container">
          <div className="panel panel--tint" style={{ marginBottom: '2rem' }}>
            <div className="form-row">
              <div className="field">
                <label htmlFor="q">Search</label>
                <input
                  id="q"
                  type="search"
                  placeholder="City, country or keyword"
                  defaultValue={current.q}
                  onChange={(event) => update('q', event.target.value)}
                  data-testid="destination-search"
                />
              </div>
              <div className="field">
                <label htmlFor="country">Country</label>
                <select id="country" value={current.country} onChange={(event) => update('country', event.target.value)}>
                  <option value="">All countries</option>
                  {filters?.countries.map((country) => (
                    <option key={country}>{country}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="budget">Budget level</label>
                <select id="budget" value={current.budget} onChange={(event) => update('budget', event.target.value)}>
                  <option value="">Any budget</option>
                  {(filters?.budgetLevels ?? ['low', 'medium', 'high']).map((level) => (
                    <option key={level}>{level}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="style">Travel style</label>
                <select id="style" value={current.style} onChange={(event) => update('style', event.target.value)}>
                  <option value="">Any style</option>
                  {filters?.styles.map((style) => (
                    <option key={style}>{style}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {error && <ErrorAlert message={error} />}

          {loading ? (
            <CardSkeletons count={6} />
          ) : destinations.length ? (
            <>
              <p data-testid="result-count">
                <strong>{destinations.length}</strong> destination{destinations.length === 1 ? '' : 's'} found
              </p>
              <div className="grid grid--3">
                {destinations.map((destination) => (
                  <DestinationCard key={destination.id} destination={destination} />
                ))}
              </div>
            </>
          ) : (
            <div className="empty">
              <h3>No destinations match those filters</h3>
              <p>Try clearing a filter or searching for a different city.</p>
              <button className="btn btn--ghost" onClick={() => setParams(new URLSearchParams())}>
                Clear filters
              </button>
            </div>
          )}
        </div>
      </section>
    </>
  );
};
