import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AiMetaBar } from '../components/AiMetaBar';
import { ErrorAlert, OutputSkeleton, SuccessAlert } from '../components/Feedback';
import { Markdown } from '../components/Markdown';
import { ApiError } from '../api/client';
import { createTrip, optimizeBudget } from '../api/endpoints';
import type { AiResult } from '../types';

export const BudgetOptimizer = () => {
  const [params] = useSearchParams();
  const [destination, setDestination] = useState(params.get('destination') ?? '');
  const [days, setDays] = useState(5);
  const [amount, setAmount] = useState(1500);
  const [currency, setCurrency] = useState('USD');
  const [travellers, setTravellers] = useState(2);
  const [style, setStyle] = useState('balanced');

  const [result, setResult] = useState<AiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ code?: string; message: string } | null>(null);
  const [saved, setSaved] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setSaved(false);
    try {
      setResult(
        await optimizeBudget({
          destination: destination.trim(),
          days,
          budget_amount: amount,
          currency,
          travellers,
          travel_style: style,
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
    try {
      await createTrip({
        title: `${destination} budget plan (${currency} ${amount})`,
        destination,
        days,
        budget: `${currency} ${amount}`,
        travelType: style,
        source: 'ai_budget',
        itineraryText: result.content,
      });
      setSaved(true);
    } catch (err) {
      setError({ code: (err as ApiError).code, message: (err as ApiError).message });
    }
  };

  return (
    <>
      <div className="page-head">
        <div className="container">
          <div className="eyebrow">AI Budget Optimizer</div>
          <h1>Make your budget go further</h1>
          <p>
            Enter what you can spend and get an expense split across stay, food, local travel and activities — plus
            concrete recommendations to stay inside the number.
          </p>
        </div>
      </div>

      <section className="section">
        <div className="container split">
          <form className="panel form" onSubmit={onSubmit} data-testid="budget-form">
            <div className="field">
              <label htmlFor="destination">Destination *</label>
              <input
                id="destination"
                required
                placeholder="e.g. Bali"
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
              />
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="days">Duration (days) *</label>
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
                <label htmlFor="travellers">Travellers</label>
                <input
                  id="travellers"
                  type="number"
                  min={1}
                  max={20}
                  value={travellers}
                  onChange={(event) => setTravellers(Number(event.target.value))}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="currency">Currency</label>
                <select id="currency" value={currency} onChange={(event) => setCurrency(event.target.value)}>
                  {['USD', 'EUR', 'GBP', 'INR', 'SGD', 'AED'].map((code) => (
                    <option key={code}>{code}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="amount">Total budget *</label>
                <input
                  id="amount"
                  type="number"
                  min={1}
                  required
                  value={amount}
                  onChange={(event) => setAmount(Number(event.target.value))}
                />
              </div>
              <div className="field">
                <label htmlFor="style">Travel style</label>
                <select id="style" value={style} onChange={(event) => setStyle(event.target.value)}>
                  <option value="budget">Budget</option>
                  <option value="balanced">Balanced</option>
                  <option value="luxury">Luxury</option>
                </select>
              </div>
            </div>

            <button className="btn btn--primary" type="submit" disabled={loading || !destination.trim()}>
              {loading && <span className="spinner" />}
              {loading ? 'Optimizing…' : 'Optimize my budget'}
            </button>
            <span className="hint">
              Budget calls are limited to 10 per hour per session and capped at 700 output tokens.
            </span>
          </form>

          <div>
            {error && <ErrorAlert code={error.code} message={error.message} />}
            {saved && <SuccessAlert>Budget plan saved to My Trips.</SuccessAlert>}
            {loading && <OutputSkeleton />}

            {!loading && !result && (
              <div className="empty">
                <h3>Your budget breakdown will appear here</h3>
                <p>We split the total across accommodation, food, transport, activities and a safety buffer.</p>
              </div>
            )}

            {!loading && result && (
              <>
                <div className="ai-output" data-testid="budget-output">
                  <Markdown>{result.content}</Markdown>
                </div>
                <AiMetaBar
                  meta={result.meta}
                  cached={result.cached}
                  remaining={result.rateLimit?.remaining}
                  limit={result.rateLimit?.limit}
                />
                <div style={{ marginTop: '1rem' }}>
                  <button className="btn btn--primary" onClick={onSave}>
                    Save to My Trips
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
