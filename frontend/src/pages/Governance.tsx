import { useEffect, useState } from 'react';
import { ErrorAlert } from '../components/Feedback';
import { fetchGovernance } from '../api/endpoints';
import type { ApiError } from '../api/client';
import type { GovernanceView } from '../types';

const STATUS_CHIP: Record<string, string> = {
  success: 'chip',
  rejected_rate_limit: 'chip chip--amber',
  rejected_prompt_length: 'chip chip--amber',
  rejected_validation: 'chip chip--amber',
  timeout: 'chip chip--amber',
  error: 'chip chip--amber',
};

export const Governance = () => {
  const [data, setData] = useState<GovernanceView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    fetchGovernance()
      .then(setData)
      .catch((err: ApiError) => setError(err.message));

  useEffect(() => {
    void load();
  }, []);

  return (
    <>
      <div className="page-head">
        <div className="container">
          <div className="eyebrow">Governance</div>
          <h1>AI usage, controls and audit log</h1>
          <p>
            Every LLM call is recorded here: feature, provider, model, status, prompt size and latency. API keys are
            never stored or returned by this endpoint.
          </p>
        </div>
      </div>

      <section className="section">
        <div className="container">
          {error && <ErrorAlert message={error} />}
          {!data ? (
            <div className="skeleton" style={{ height: 300 }} />
          ) : (
            <>
              <div className="stat-grid" style={{ marginBottom: '2rem' }}>
                <div className="stat">
                  <strong>{data.entries.length}</strong>
                  <span>Recent audit entries</span>
                </div>
                <div className="stat">
                  <strong>{data.summary.success ?? 0}</strong>
                  <span>Successful LLM calls</span>
                </div>
                <div className="stat">
                  <strong>
                    {Object.entries(data.summary)
                      .filter(([status]) => status.startsWith('rejected'))
                      .reduce((total, [, count]) => total + count, 0)}
                  </strong>
                  <span>Blocked by guardrails</span>
                </div>
                <div className="stat">
                  <strong>{data.cacheEntries}</strong>
                  <span>Cached responses</span>
                </div>
              </div>

              <div className="split" style={{ marginBottom: '2rem' }}>
                <div className="panel">
                  <h3>Active LLM configuration</h3>
                  <table className="data" style={{ width: '100%' }}>
                    <tbody>
                      <tr>
                        <th>Provider</th>
                        <td>{data.llmConfig.provider}</td>
                      </tr>
                      <tr>
                        <th>Model</th>
                        <td>{data.llmConfig.model}</td>
                      </tr>
                      <tr>
                        <th>API key</th>
                        <td>{data.llmConfig.apiKeyConfigured ? 'configured (never exposed)' : 'not required (mock)'}</td>
                      </tr>
                      <tr>
                        <th>Request timeout</th>
                        <td>{data.llmConfig.timeoutSeconds}s</td>
                      </tr>
                      <tr>
                        <th>Max prompt length</th>
                        <td>{data.llmConfig.maxInputChars} chars</td>
                      </tr>
                      <tr>
                        <th>Response cache</th>
                        <td>{data.llmConfig.cacheEnabled ? 'enabled' : 'disabled'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="panel">
                  <h3>Your hourly rate-limit usage</h3>
                  <table className="data" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Feature</th>
                        <th>Used</th>
                        <th>Limit</th>
                        <th>Resets</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(data.rateLimitUsage).map(([feature, usage]) => (
                        <tr key={feature}>
                          <td style={{ textTransform: 'capitalize' }}>{feature}</td>
                          <td>{usage.used}</td>
                          <td>{usage.limit}</td>
                          <td>{new Date(usage.resetsAt).toLocaleTimeString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button className="btn btn--ghost btn--sm" style={{ marginTop: '1rem' }} onClick={load}>
                    Refresh
                  </button>
                </div>
              </div>

              <h2>LLM audit log</h2>
              <div className="table-wrap">
                <table className="data" data-testid="audit-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Feature</th>
                      <th>Status</th>
                      <th>Provider</th>
                      <th>Model</th>
                      <th>Prompt chars</th>
                      <th>~Tokens</th>
                      <th>Latency</th>
                      <th>Cached</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.entries.map((entry) => (
                      <tr key={entry.id}>
                        <td>{new Date(entry.created_at).toLocaleString()}</td>
                        <td style={{ textTransform: 'capitalize' }}>{entry.feature}</td>
                        <td>
                          <span className={STATUS_CHIP[entry.status] ?? 'chip chip--grey'}>{entry.status}</span>
                        </td>
                        <td>{entry.provider}</td>
                        <td>{entry.model}</td>
                        <td>{entry.prompt_chars}</td>
                        <td>{entry.token_estimate}</td>
                        <td>{entry.latency_ms} ms</td>
                        <td>{entry.cached ? 'yes' : 'no'}</td>
                        <td>{entry.detail ?? '—'}</td>
                      </tr>
                    ))}
                    {data.entries.length === 0 && (
                      <tr>
                        <td colSpan={10}>No LLM calls recorded yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
};
