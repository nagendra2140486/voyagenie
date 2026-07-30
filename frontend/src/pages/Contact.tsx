import { useState } from 'react';
import { ErrorAlert, SuccessAlert } from '../components/Feedback';
import { submitInquiry } from '../api/endpoints';
import type { ApiError } from '../api/client';

export const Contact = () => {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<{ code?: string; message: string } | null>(null);
  const [reference, setReference] = useState<number | null>(null);

  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus('sending');
    setError(null);
    try {
      const { inquiry } = await submitInquiry({
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject.trim() || undefined,
        message: form.message.trim(),
      });
      setReference(inquiry.id);
      setStatus('sent');
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      const apiError = err as ApiError;
      setError({ code: apiError.code, message: apiError.message });
      setStatus('idle');
    }
  };

  return (
    <>
      <div className="page-head">
        <div className="container">
          <div className="eyebrow">Contact us</div>
          <h1>Talk to a travel specialist</h1>
          <p>Questions about a package, a custom itinerary or group travel? Send us a note and we will reply.</p>
        </div>
      </div>

      <section className="section">
        <div className="container split">
          <aside className="panel panel--tint">
            <h3>Voyagenie HQ</h3>
            <p style={{ marginBottom: '0.5rem' }}>
              14 Harbour Lane
              <br />
              Singapore 049213
            </p>
            <p style={{ marginBottom: '0.5rem' }}>hello@voyagenie.example</p>
            <p>+65 6000 0000</p>
            <h3 style={{ marginTop: '1.5rem' }}>Support hours</h3>
            <p style={{ marginBottom: 0 }}>Mon–Fri, 09:00–18:00 SGT</p>
          </aside>

          <div>
            {error && <ErrorAlert code={error.code} message={error.message} />}
            {status === 'sent' && (
              <SuccessAlert>
                Thanks — your inquiry was stored (reference #{reference}). Our team replies within one business day.
              </SuccessAlert>
            )}
            <form className="panel form" onSubmit={onSubmit} data-testid="contact-form">
              <div className="form-row">
                <div className="field">
                  <label htmlFor="name">Name *</label>
                  <input id="name" required minLength={2} value={form.name} onChange={update('name')} />
                </div>
                <div className="field">
                  <label htmlFor="email">Email *</label>
                  <input id="email" type="email" required value={form.email} onChange={update('email')} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="subject">Subject</label>
                <input id="subject" value={form.subject} onChange={update('subject')} />
              </div>
              <div className="field">
                <label htmlFor="message">Message *</label>
                <textarea
                  id="message"
                  required
                  minLength={10}
                  maxLength={2000}
                  value={form.message}
                  onChange={update('message')}
                  placeholder="Tell us about the trip you have in mind…"
                />
                <span className="hint">{form.message.length} / 2000 characters</span>
              </div>
              <button className="btn btn--primary" type="submit" disabled={status === 'sending'}>
                {status === 'sending' ? 'Sending…' : 'Send inquiry'}
              </button>
            </form>
          </div>
        </div>
      </section>
    </>
  );
};
