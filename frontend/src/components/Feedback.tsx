export const ErrorAlert = ({ code, message }: { code?: string; message: string }) => {
  const isGuardrail =
    code === 'rate_limited' || code === 'prompt_too_long' || code === 'prompt_injection_blocked';
  return (
    <div className={`alert ${isGuardrail ? 'alert--warn' : 'alert--error'}`} role="alert" data-testid="error-alert">
      <strong>{isGuardrail ? 'Guardrail triggered' : 'Something went wrong'}</strong>
      {message}
      {code && <div style={{ marginTop: '0.35rem', fontSize: '0.78rem', opacity: 0.8 }}>code: {code}</div>}
    </div>
  );
};

export const SuccessAlert = ({ children }: { children: React.ReactNode }) => (
  <div className="alert alert--ok" role="status" data-testid="success-alert">
    {children}
  </div>
);

export const CardSkeletons = ({ count = 6 }: { count?: number }) => (
  <div className="grid grid--3">
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="skeleton" style={{ height: 320 }} />
    ))}
  </div>
);

export const OutputSkeleton = () => (
  <div className="ai-output">
    <div className="skeleton" style={{ height: 26, width: '55%', marginBottom: 18 }} />
    {[90, 80, 96, 70, 88].map((width, index) => (
      <div key={index} className="skeleton" style={{ height: 13, width: `${width}%`, marginBottom: 12 }} />
    ))}
    <p style={{ marginTop: 20, fontSize: '0.85rem' }}>Generating with the configured LLM provider…</p>
  </div>
);
