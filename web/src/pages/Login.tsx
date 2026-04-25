import { ApiError } from '@/api/client';
import Button from '@/components/ui/Button';
import GoogleSignInButton from '@/components/ui/GoogleSignInButton';
import Input from '@/components/ui/Input';
import { useAuth } from '@/contexts/AuthContext';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const REMEMBER_ME_KEY = 'remember_me_enabled';
const REMEMBERED_EMAIL_KEY = 'remembered_email';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { signIn, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  useEffect(() => {
    try {
      const rememberFlag = localStorage.getItem(REMEMBER_ME_KEY);
      const savedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY);
      const shouldRemember = rememberFlag !== 'false';
      setRememberMe(shouldRemember);
      if (shouldRemember && savedEmail) {
        setEmail(savedEmail);
      }
    } catch {
      // Ignore local storage errors and continue with defaults.
    }
  }, []);

  if (!loading && user) {
    navigate(from, { replace: true });
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Please fill in both email and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      if (rememberMe) {
        localStorage.setItem(REMEMBER_ME_KEY, 'true');
        localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
      } else {
        localStorage.setItem(REMEMBER_ME_KEY, 'false');
        localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.detail ?? err.message
          : err instanceof Error
            ? err.message
            : 'Login failed'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page page--auth page--auth-app-theme">
      <div className="auth-card auth-card--app-theme">
        <div className="auth-card__logo auth-card__logo--app-theme">
          <span aria-label="CarMinder logo">CM</span>
        </div>
        <h1>Welcome back</h1>
        <p className="auth-card__subtitle">Log in to manage your vehicles</p>
        <form onSubmit={handleSubmit} className="form">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={submitting}
          />
          <div className="input-wrap">
            <label htmlFor="login-password" className="input-label">
              Password
            </label>
            <div className="auth-password-wrap">
              <input
                id="login-password"
                className="input auth-password-input"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={submitting}
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={submitting}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <label className="auth-remember-row">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={submitting}
            />
            <span>Remember me</span>
          </label>
          <p className="auth-footer auth-footer--small">
            <Link to="/forgot-password">Forgot password?</Link>
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Log in'}
          </Button>
        </form>
        <div className="auth-divider">
          <span>Or continue with</span>
        </div>
        <GoogleSignInButton
          label="Continue with Google"
          redirectTo={from}
          onError={(msg) => setError(msg)}
        />
        <p className="auth-footer">
          Don't have an account? <Link to="/signup">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
