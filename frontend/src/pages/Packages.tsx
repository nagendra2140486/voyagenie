import { useEffect, useMemo, useState } from 'react';
import { PackageCard } from '../components/Cards';
import { CardSkeletons, ErrorAlert } from '../components/Feedback';
import { fetchPackages } from '../api/endpoints';
import type { TravelPackage } from '../types';

export const Packages = () => {
  const [packages, setPackages] = useState<TravelPackage[]>([]);
  const [style, setStyle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchPackages(style ? { style } : {})
      .then((data) => {
        setPackages(data.packages);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [style]);

  const styles = useMemo(() => ['family', 'luxury', 'culture', 'wellness', 'adventure', 'budget'], []);

  return (
    <>
      <div className="page-head">
        <div className="container">
          <div className="eyebrow">Packages</div>
          <h1>Curated travel packages</h1>
          <p>
            Fixed-duration trips with hotels, transfers and headline experiences included. Prices are indicative and
            no booking is processed in this demo portal.
          </p>
        </div>
      </div>

      <section className="section">
        <div className="container">
          <div className="chips" style={{ marginBottom: '2rem' }}>
            <button
              className={`btn btn--sm ${style === '' ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => setStyle('')}
            >
              All styles
            </button>
            {styles.map((item) => (
              <button
                key={item}
                className={`btn btn--sm ${style === item ? 'btn--primary' : 'btn--ghost'}`}
                style={{ textTransform: 'capitalize' }}
                onClick={() => setStyle(item)}
              >
                {item}
              </button>
            ))}
          </div>

          {error && <ErrorAlert message={error} />}

          {loading ? (
            <CardSkeletons count={6} />
          ) : packages.length ? (
            <div className="grid grid--3">
              {packages.map((pkg) => (
                <PackageCard key={pkg.id} pkg={pkg} />
              ))}
            </div>
          ) : (
            <div className="empty">
              <h3>No packages in this style yet</h3>
              <p>Try another travel style, or build your own trip with the AI planner.</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
};
