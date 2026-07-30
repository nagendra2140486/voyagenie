import { Link } from 'react-router-dom';
import type { Destination, TravelPackage } from '../types';

const FALLBACK_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 10"><rect width="16" height="10" fill="#cfe6e2"/></svg>`,
  );

const onImageError = (event: React.SyntheticEvent<HTMLImageElement>) => {
  event.currentTarget.src = FALLBACK_IMAGE;
};

export const DestinationCard = ({ destination }: { destination: Destination }) => (
  <article className="card" data-testid="destination-card">
    <img
      className="card__media"
      src={destination.image_url}
      alt={`${destination.city}, ${destination.country}`}
      loading="lazy"
      onError={onImageError}
    />
    <div className="card__body">
      <div className="chips">
        <span className="chip">{destination.travel_style}</span>
        <span className="chip chip--grey">{destination.budget_level} budget</span>
      </div>
      <h3 className="card__title">
        {destination.city}, {destination.country}
      </h3>
      <p className="card__text">{destination.summary}</p>
      <div className="card__meta">
        <span>Best: {destination.best_season}</span>
      </div>
      <div className="card__footer">
        <span className="price">
          ~USD {destination.estimated_budget_usd.toLocaleString()} <span>/ trip</span>
        </span>
        <Link className="btn btn--ghost btn--sm" to={`/destinations/${destination.id}`}>
          Explore
        </Link>
      </div>
    </div>
  </article>
);

export const PackageCard = ({ pkg }: { pkg: TravelPackage }) => (
  <article className="card" data-testid="package-card">
    <img className="card__media" src={pkg.image_url} alt={pkg.title} loading="lazy" onError={onImageError} />
    <div className="card__body">
      <div className="chips">
        <span className="chip">{pkg.travel_style}</span>
        <span className="chip chip--grey">{pkg.duration_days} days</span>
      </div>
      <h3 className="card__title">{pkg.title}</h3>
      <ul className="list-check" style={{ fontSize: '0.88rem' }}>
        {pkg.highlights.slice(0, 3).map((highlight) => (
          <li key={highlight}>{highlight}</li>
        ))}
      </ul>
      <div className="card__footer">
        <span className="price">
          {pkg.price_range.split(' - ')[0]} <span>onwards</span>
        </span>
        <Link
          className="btn btn--ghost btn--sm"
          to={`/planner?destination=${encodeURIComponent(pkg.destination_city ?? pkg.title)}&days=${pkg.duration_days}`}
        >
          Plan this trip
        </Link>
      </div>
    </div>
  </article>
);
