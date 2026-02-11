import { ApiError } from '@/api/client';
import Button from '@/components/ui/Button';
import GoogleSignInButton from '@/components/ui/GoogleSignInButton';
import Input from '@/components/ui/Input';
import { useAuth } from '@/contexts/AuthContext';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { signIn, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  if (!loading && user) {
    navigate(from, { replace: true });
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
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
    <div className="page page--auth">
      <div className="auth-card">
        <h1>Sign In</h1>
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
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={submitting}
          />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
        <div className="auth-divider">
          <span>or</span>
        </div>
        <GoogleSignInButton
          redirectTo={from}
          onError={(msg) => setError(msg)}
        />
        <p className="auth-footer">
          Don't have an account? <Link to="/signup">Create account</Link>
        </p>
      </div>
    </div>
  );
}
