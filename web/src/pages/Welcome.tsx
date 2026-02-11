import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function Welcome() {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading">Loading…</div>;
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="welcome">
      {/* ── Header ── */}
      <header className="welcome-header">
        <span className="welcome-header__logo">CarMinder</span>
        <nav className="welcome-header__nav">
          <Link to="/login" className="welcome-header__link">
            Sign In
          </Link>
          <Link to="/signup" className="button button--primary button--sm">
            Get Started
          </Link>
        </nav>
      </header>

      {/* ── Hero ── */}
      <section className="welcome-hero">
        <span className="welcome-hero__badge">Vehicle maintenance, simplified</span>
        <h1 className="welcome-hero__title">
          Never miss a service<br />deadline again
        </h1>
        <p className="welcome-hero__subtitle">
          CarMinder keeps track of every oil change, brake service, tire rotation,
          and inspection across all your vehicles — so you can drive with confidence.
        </p>
        <div className="welcome-hero__actions">
          <Link to="/signup" className="button button--primary welcome-hero__cta">
            Create Free Account
          </Link>
          <Link to="/login" className="button button--ghost welcome-hero__cta">
            I already have an account
          </Link>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="welcome-stats">
        <div className="welcome-stat">
          <span className="welcome-stat__number">5+</span>
          <span className="welcome-stat__label">Service types tracked</span>
        </div>
        <div className="welcome-stat">
          <span className="welcome-stat__number">100%</span>
          <span className="welcome-stat__label">Free to use</span>
        </div>
        <div className="welcome-stat">
          <span className="welcome-stat__number">Instant</span>
          <span className="welcome-stat__label">Vehicle lookup</span>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="welcome-section">
        <div className="welcome-section__header">
          <h2>Everything you need to stay on top of maintenance</h2>
          <p>One place for your entire vehicle service history, upcoming schedules, and reminders.</p>
        </div>
        <div className="welcome-features">
          <div className="welcome-feature-card">
            <div className="welcome-feature-card__icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
            </div>
            <h3>Service Tracking</h3>
            <p>
              Log oil changes, brake replacements, tire rotations, and EU control
              inspections. Your complete maintenance history in one place.
            </p>
          </div>

          <div className="welcome-feature-card">
            <div className="welcome-feature-card__icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <h3>Smart Calendar</h3>
            <p>
              Interactive monthly calendar with event markers and color-coded
              urgency levels. See what is coming up at a glance.
            </p>
          </div>

          <div className="welcome-feature-card">
            <div className="welcome-feature-card__icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <h3>Vehicle Lookup</h3>
            <p>
              Enter a Norwegian registration number and instantly get full vehicle
              specs — engine, fuel type, weight, registration date, and more.
            </p>
          </div>

          <div className="welcome-feature-card">
            <div className="welcome-feature-card__icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
              </svg>
            </div>
            <h3>Service Status</h3>
            <p>
              See at-a-glance status badges for every service type on each vehicle.
              Overdue, due soon, or all good — instantly visible.
            </p>
          </div>

          <div className="welcome-feature-card">
            <div className="welcome-feature-card__icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <h3>Multi-Vehicle</h3>
            <p>
              Add as many vehicles as you need. Each car has its own service
              history, status dashboard, and maintenance timeline.
            </p>
          </div>

          <div className="welcome-feature-card">
            <div className="welcome-feature-card__icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h3>Secure &amp; Private</h3>
            <p>
              Your data is protected with industry-standard encryption and
              authentication. Only you can access your vehicle information.
            </p>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="welcome-section welcome-section--alt">
        <div className="welcome-section__header">
          <h2>Get started in three steps</h2>
          <p>From signup to full maintenance tracking in under two minutes.</p>
        </div>
        <div className="welcome-steps">
          <div className="welcome-step">
            <div className="welcome-step__number">1</div>
            <h3>Create your account</h3>
            <p>Sign up with your email. No credit card required, free forever.</p>
          </div>
          <div className="welcome-steps__connector" />
          <div className="welcome-step">
            <div className="welcome-step__number">2</div>
            <h3>Add your vehicles</h3>
            <p>Look up by registration number or enter details manually.</p>
          </div>
          <div className="welcome-steps__connector" />
          <div className="welcome-step">
            <div className="welcome-step__number">3</div>
            <h3>Track everything</h3>
            <p>Log services, view your calendar, and never miss a deadline.</p>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="welcome-cta">
        <h2>Ready to take control of your car maintenance?</h2>
        <p>Join CarMinder today and keep every vehicle running smoothly.</p>
        <Link to="/signup" className="button button--primary welcome-hero__cta">
          Get Started for Free
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer className="welcome-footer">
        <p>CarMinder &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
