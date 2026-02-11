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
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const { signIn, signInWithGoogle, user, loading } = useAuth();
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

  async function handleGoogleSignIn() {
    setError(null);
    setGoogleSubmitting(true);
    try {
      await signInWithGoogle();
      navigate(from, { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.detail ?? err.message
          : err instanceof Error
            ? err.message
            : 'Google-innlogging feilet'
      );
    } finally {
      setGoogleSubmitting(false);
    }
  }

  return (
    <div className="page page--auth">
      <h1>Logg inn</h1>
      <form onSubmit={handleSubmit} className="form">
        <Input
          label="E-post"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={submitting || googleSubmitting}
        />
        <Input
          label="Passord"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={submitting || googleSubmitting}
        />
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button type="submit" disabled={submitting || googleSubmitting}>
          {submitting ? 'Logger inn…' : 'Logg inn'}
        </Button>
        <div className="form-divider">
          <span>eller</span>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={handleGoogleSignIn}
          disabled={submitting || googleSubmitting}
        >
          {googleSubmitting ? 'Logger inn med Google…' : 'Fortsett med Google'}
        </Button>
      </form>
      <p className="auth-footer">
        Har du ikke konto? <Link to="/signup">Registrer deg</Link>
      </p>
    </div>
  );
}
