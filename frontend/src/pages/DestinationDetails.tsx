import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DestinationCard, PackageCard } from '../components/Cards';
import { ErrorAlert } from '../components/Feedback';
import { fetchDestination } from '../api/endpoints';
import type { Destination, TravelPackage } from '../types';

export const DestinationDetails = () => {
  const { id = '' } = useParams();
  const [data, setData] = useState<{
    destination: Destination;
    related: Destination[];
    packages: TravelPackage[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    fetchDestination(id)
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [id]);

  if (error) {
    return (
      <section className="section">
        <div className="container">
          <ErrorAlert message={error} />
          <Link className="btn btn--ghost" to="/destinations">
            Back to destinations
          </Link>
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="section">
        <div className="container">
          <div className="skeleton" style={{ height: 320 }} />
        </div>
      </section>
    );
  }

  const { destination, related, packages } = data;

  return (
    <>
      <div
        className="hero"
        style={{
          background: `linear-gradient(180deg, rgba(6,30,33,0.7), rgba(6,30,33,0.55)), url('${destination.image_url}') center/cover`,
        }}
      >
        <div className="container hero__inner" style={{ padding: '4.5rem 0 3.5rem' }}>
          <div className="breadcrumbs" style={{ color: 'rgba(255,255,255,0.8)' }}>
            <Link to="/" style={{ color: 'inherit' }}>
              Home
            </Link>{' '}
            /{' '}
            <Link to="/destinations" style={{ color: 'inherit' }}>
              Destinations
            </Link>{' '}
            / {destination.city}
          </div>
          <h1>
            {destination.city}, {destination.country}
          </h1>
          <p>{destination.summary}</p>
          <div className="hero__actions">
            <Link
              className="btn btn--amber"
              to={`/planner?destination=${encodeURIComponent(destination.city)}`}
            >
              Plan a trip with AI
            </Link>
            <Link
              className="btn btn--ghost"
              to={`/budget?destination=${encodeURIComponent(destination.city)}`}
            >
              Estimate the budget
            </Link>
          </div>
        </div>
      </div>

      <section className="section">
        <div className="container split">
          <aside className="panel">
            <h3>Trip snapshot</h3>
            <table className="data" style={{ width: '100%' }}>
              <tbody>
                <tr>
                  <th>Best season</th>
                  <td>{destination.best_season}</td>
                </tr>
                <tr>
                  <th>Budget level</th>
                  <td style={{ textTransform: 'capitalize' }}>{destination.budget_level}</td>
                </tr>
                <tr>
                  <th>Travel style</th>
                  <td style={{ textTransform: 'capitalize' }}>{destination.travel_style}</td>
                </tr>
                <tr>
                  <th>Estimated budget</th>
                  <td>USD {destination.estimated_budget_usd.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
            <h3 style={{ marginTop: '1.5rem' }}>Travel tips</h3>
            <ul className="list-check">
              {destination.travel_tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </aside>

          <div>
            <h2>Overview</h2>
            <p>{destination.description}</p>

            <h2 style={{ marginTop: '2rem' }}>Top attractions</h2>
            <ul className="list-check">
              {destination.attractions.map((attraction) => (
                <li key={attraction}>{attraction}</li>
              ))}
            </ul>

            <h2 style={{ marginTop: '2rem' }}>Gallery</h2>
            <div className="grid grid--4">
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className="card__media"
                  style={{
                    borderRadius: 12,
                    background: `linear-gradient(135deg, hsl(${170 + index * 12} 30% 82%), hsl(${180 + index * 14} 28% 68%))`,
                    display: 'grid',
                    placeItems: 'center',
                    color: '#0b5a54',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  Photo {index + 1}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {packages.length > 0 && (
        <section className="section section--tint">
          <div className="container">
            <div className="section-head">
              <div>
                <div className="eyebrow">Packages</div>
                <h2>Trips that include {destination.city}</h2>
              </div>
            </div>
            <div className="grid grid--3">
              {packages.map((pkg) => (
                <PackageCard key={pkg.id} pkg={pkg} />
              ))}
            </div>
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="section">
          <div className="container">
            <div className="section-head">
              <div>
                <div className="eyebrow">You may also like</div>
                <h2>Related destinations</h2>
              </div>
            </div>
            <div className="grid grid--3">
              {related.map((item) => (
                <DestinationCard key={item.id} destination={item} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
};
