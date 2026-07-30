import { useEffect, useRef, useState } from 'react';
import { AiMetaBar } from '../components/AiMetaBar';
import { ErrorAlert } from '../components/Feedback';
import { Markdown } from '../components/Markdown';
import { ApiError } from '../api/client';
import { askAssistant } from '../api/endpoints';
import type { LlmMeta } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'What is the best time of year to visit Japan?',
  'How do I keep a two-week Europe trip under 2000 USD?',
  'What should I pack for Iceland in winter?',
  'Is Singapore a good destination with young children?',
];

const MAX_CHARS = 2000;

const GREETING: Message = {
  role: 'assistant',
  content:
    'Hi! I am the Voyagenie travel assistant. Ask me about destinations, seasons, budgets, visas or packing — ' +
    'or tell me the trip you have in mind and I will help you shape it.',
};

export const Assistant = () => {
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ code?: string; message: string } | null>(null);
  const [meta, setMeta] = useState<{ meta: LlmMeta; cached: boolean } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || loading) return;

    if (message.length > MAX_CHARS) {
      setError({
        code: 'prompt_too_long',
        message: `Your message is ${message.length} characters. The limit is ${MAX_CHARS}.`,
      });
      return;
    }

    setError(null);
    const history = messages.filter((m) => m !== GREETING);
    setMessages((current) => [...current, { role: 'user', content: message }]);
    setInput('');
    setLoading(true);
    try {
      const result = await askAssistant({ message, history });
      setMessages((current) => [...current, { role: 'assistant', content: result.content }]);
      setMeta({ meta: result.meta, cached: result.cached });
    } catch (err) {
      const apiError = err as ApiError;
      setError({ code: apiError.code, message: apiError.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div className="container">
          <div className="eyebrow">AI Travel Assistant</div>
          <h1>Ask anything about your trip</h1>
          <p>
            Conversational travel help with the same guardrails as every other AI feature: prompt-length limits,
            hourly rate limits, prompt-injection filtering and full audit logging.
          </p>
        </div>
      </div>

      <section className="section">
        <div className="container split">
          <aside className="panel panel--tint">
            <h3>Try asking</h3>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  className="btn btn--ghost btn--sm"
                  style={{ textAlign: 'left', justifyContent: 'flex-start' }}
                  onClick={() => send(suggestion)}
                  disabled={loading}
                >
                  {suggestion}
                </button>
              ))}
            </div>
            <h3 style={{ marginTop: '1.5rem' }}>Good to know</h3>
            <ul className="list-check" style={{ fontSize: '0.9rem' }}>
              <li>Answers are travel-scoped; other topics are redirected.</li>
              <li>Messages over {MAX_CHARS} characters are rejected before any LLM call.</li>
              <li>Chat is limited to 25 calls per hour per session.</li>
            </ul>
          </aside>

          <div>
            {error && <ErrorAlert code={error.code} message={error.message} />}
            <div className="chat">
              <div className="chat__log" ref={logRef} data-testid="chat-log">
                {messages.map((message, index) => (
                  <div key={index} className={`bubble bubble--${message.role === 'user' ? 'user' : 'ai'}`}>
                    {message.role === 'assistant' ? <Markdown>{message.content}</Markdown> : <p>{message.content}</p>}
                  </div>
                ))}
                {loading && (
                  <div className="bubble bubble--ai">
                    <p style={{ margin: 0 }}>Thinking…</p>
                  </div>
                )}
              </div>
              <form
                className="chat__form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void send(input);
                }}
              >
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask a travel question…"
                  aria-label="Message"
                  data-testid="chat-input"
                />
                <button className="btn btn--primary" type="submit" disabled={loading || !input.trim()}>
                  {loading ? <span className="spinner" /> : 'Send'}
                </button>
              </form>
            </div>
            {meta && <AiMetaBar meta={meta.meta} cached={meta.cached} />}
          </div>
        </div>
      </section>
    </>
  );
};
