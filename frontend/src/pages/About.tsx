import { Link } from 'react-router-dom';

export const About = () => (
  <>
    <div className="page-head">
      <div className="container">
        <div className="eyebrow">About us</div>
        <h1>Travel planning that respects your time and your budget</h1>
        <p>
          Voyagenie combines a conventional travel portal with an AI planning studio, built on an enterprise GenAI
          operating model: configurable providers, strict guardrails and full auditability.
        </p>
      </div>
    </div>

    <section className="section">
      <div className="container split">
        <div className="panel panel--tint">
          <h3>At a glance</h3>
          <ul className="list-check">
            <li>12 curated destinations, 8 packages</li>
            <li>3 AI features: itineraries, assistant, budgets</li>
            <li>Provider-agnostic LLM layer</li>
            <li>Rate limits, prompt filtering and audit logs</li>
          </ul>
        </div>
        <div>
          <h2>Who we are</h2>
          <p>
            We are a small team of travel obsessives and engineers. We got tired of planning tools that either dump a
            list of links on you or hide behind a chat box, so we built both halves properly: a real catalogue you can
            browse, and AI that turns your constraints into a plan you can act on.
          </p>

          <h2 style={{ marginTop: '2rem' }}>Our mission</h2>
          <p>
            Make good trip planning take minutes, not weekends — without pretending an AI can book your flights or
            guarantee a price. Every number we show is an estimate, and we say so.
          </p>

          <h2 style={{ marginTop: '2rem' }}>What we offer</h2>
          <div className="grid grid--2" style={{ marginTop: '1rem' }}>
            {[
              ['Destination research', 'Filterable catalogue with budgets, seasons, attractions and practical tips.'],
              ['Curated packages', 'Fixed-duration trips with clear inclusions and indicative pricing.'],
              ['AI itineraries', 'Day-wise plans shaped by your interests, budget level and constraints.'],
              ['AI budgets', 'Expense splits and savings recommendations for a fixed total budget.'],
            ].map(([title, text]) => (
              <div key={title} className="panel">
                <h3>{title}</h3>
                <p style={{ marginBottom: 0 }}>{text}</p>
              </div>
            ))}
          </div>

          <h2 style={{ marginTop: '2rem' }}>Why choose us</h2>
          <ul className="list-check">
            <li>Your prompts never leave our servers unfiltered — the browser never calls an LLM provider directly.</li>
            <li>Every AI call is rate-limited, length-checked, timeout-bound and audit-logged.</li>
            <li>Switching LLM provider is a configuration change, not a code change.</li>
            <li>Saved trips are yours to view, rename, clone or delete at any time.</li>
          </ul>

          <p style={{ marginTop: '2rem' }}>
            Curious how the controls work? See the <Link to="/ai-governance">AI Governance dashboard</Link>.
          </p>
        </div>
      </div>
    </section>
  </>
);
