import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DestinationCard, PackageCard } from '../components/Cards';
import { CardSkeletons, SuccessAlert } from '../components/Feedback';
import { fetchDestinations, fetchPackages } from '../api/endpoints';
import type { Destination, TravelPackage } from '../types';

const TESTIMONIALS = [
  {
    quote:
      'The AI planner gave us a four-day Singapore plan in seconds, and it actually matched our budget. We saved it and used it as-is.',
    author: 'Ananya R., family traveller',
  },
  {
    quote:
      'I used the budget optimizer before booking Tokyo. The expense split was realistic and the tips shaved about 15% off our trip.',
    author: 'Marco D., solo traveller',
  },
  {
    quote:
      'Being able to ask follow-up questions to the assistant and then save the itinerary is what makes this different from a chatbot.',
    author: 'Priya S., couple travel',
  },
];

export const Home = () => {
  const [search, setSearch] = useState('');
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [packages, setPackages] = useState<TravelPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([fetchDestinations({}), fetchPackages()])
      .then(([d, p]) => {
        setDestinations(d.destinations.slice(0, 6));
        setPackages(p.packages.slice(0, 3));
      })
      .finally(() => setLoading(false));
  }, []);

  const onSearch = (event: React.FormEvent) => {
    event.preventDefault();
    navigate(`/destinations?q=${encodeURIComponent(search.trim())}`);
  };

  return (
    <>
      <section className="hero">
        <div className="container hero__inner">
          <span className="hero__badge">✦ AI trip planning, grounded in real budgets</span>
          <h1>Plan the trip you actually want — in minutes, not weekends.</h1>
          <p>
            Search 12 hand-picked destinations, browse curated packages, then let Voyagenie&apos;s AI build a
            day-by-day itinerary and a budget that holds up.
          </p>
          <form className="searchbar" onSubmit={onSearch} role="search">
            <input
              type="search"
              placeholder="Where to? Try Singapore, Tokyo or Bali"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search destinations"
              data-testid="hero-search"
            />
            <button className="btn btn--primary" type="submit">
              Search
            </button>
          </form>
          <div className="hero__actions">
            <Link className="btn btn--amber" to="/planner">
              Generate an itinerary
            </Link>
            <Link className="btn btn--ghost" to="/packages">
              Browse packages
            </Link>
          </div>
          <div className="hero__stats">
            <div className="hero__stat">
              <strong>12</strong>
              <span>Curated destinations</span>
            </div>
            <div className="hero__stat">
              <strong>8</strong>
              <span>Ready-made packages</span>
            </div>
            <div className="hero__stat">
              <strong>3</strong>
              <span>AI planning tools</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <div className="eyebrow">Popular right now</div>
              <h2>Destinations travellers are booking</h2>
              <p>Synthetic but realistic catalogue data, filterable by country, budget, season and travel style.</p>
            </div>
            <Link className="btn btn--ghost" to="/destinations">
              View all
            </Link>
          </div>
          {loading ? <CardSkeletons count={6} /> : (
            <div className="grid grid--3">
              {destinations.map((destination) => (
                <DestinationCard key={destination.id} destination={destination} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section section--tint">
        <div className="container">
          <div className="section-head">
            <div>
              <div className="eyebrow">Three ways to plan</div>
              <h2>Your AI travel studio</h2>
            </div>
          </div>
          <div className="grid grid--3">
            {[
              {
                to: '/planner',
                title: 'AI Trip Planner',
                text: 'Give us a destination, duration, budget and interests. Get a structured day-wise itinerary you can save.',
                cta: 'Generate itinerary',
              },
              {
                to: '/assistant',
                title: 'AI Travel Assistant',
                text: 'Ask anything: visas, packing, best season, family-friendly routing. Conversational and travel-scoped.',
                cta: 'Start chatting',
              },
              {
                to: '/budget',
                title: 'AI Budget Optimizer',
                text: 'Enter your total budget and get an expense split with concrete ways to stay inside it.',
                cta: 'Optimize budget',
              },
            ].map((item) => (
              <div key={item.to} className="panel">
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <Link className="btn btn--primary btn--sm" to={item.to}>
                  {item.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <div className="eyebrow">Featured packages</div>
              <h2>Curated trips, ready to go</h2>
            </div>
            <Link className="btn btn--ghost" to="/packages">
              All packages
            </Link>
          </div>
          {loading ? <CardSkeletons count={3} /> : (
            <div className="grid grid--3">
              {packages.map((pkg) => (
                <PackageCard key={pkg.id} pkg={pkg} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section section--tint">
        <div className="container">
          <div className="section-head">
            <div>
              <div className="eyebrow">Travellers</div>
              <h2>What people say</h2>
            </div>
          </div>
          <div className="grid grid--3">
            {TESTIMONIALS.map((testimonial) => (
              <blockquote key={testimonial.author} className="testimonial">
                <p>“{testimonial.quote}”</p>
                <footer>— {testimonial.author}</footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="newsletter">
            <div>
              <h2>Get one great trip idea a month</h2>
              <p>Seasonal destinations, price windows and AI itinerary templates. No spam.</p>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setSubscribed(true);
              }}
            >
              <input type="email" required placeholder="you@example.com" aria-label="Email address" />
              <button className="btn btn--amber" type="submit">
                Subscribe
              </button>
            </form>
          </div>
          {subscribed && (
            <div style={{ marginTop: '1rem' }}>
              <SuccessAlert>Thanks — you are on the list. (Demo only, nothing is emailed.)</SuccessAlert>
            </div>
          )}
        </div>
      </section>
    </>
  );
};
