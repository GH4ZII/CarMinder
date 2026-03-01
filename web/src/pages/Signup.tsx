import { ApiError } from '@/api/client';
import Button from '@/components/ui/Button';
import GoogleSignInButton from '@/components/ui/GoogleSignInButton';
import Input from '@/components/ui/Input';
import { useAuth } from '@/contexts/AuthContext';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { signUp, user, loading } = useAuth();
  const navigate = useNavigate();

  if (!loading && user) {
    navigate('/', { replace: true });
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setError('All fields are required');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      await signUp(email, password, name);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.detail ?? err.message;
        if (detail.includes('EMAIL_EXISTS')) setError('An account with this email already exists');
        else if (detail.includes('INVALID_EMAIL')) setError('Invalid email address');
        else if (detail.includes('WEAK_PASSWORD')) setError('Password is too weak');
        else setError(detail);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Registration failed');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page page--auth">
      <div className="auth-card">
        <div className="auth-card__logo">CarMinder</div>
        <h1>Create Account</h1>
        <p className="auth-card__subtitle">Get started tracking your car maintenance</p>
        <form onSubmit={handleSubmit} className="form">
          <Input
            label="Name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={submitting}
          />
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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={submitting}
          />
          <Input
            label="Confirm Password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={submitting}
          />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>
        <div className="auth-divider">
          <span>or</span>
        </div>
        <GoogleSignInButton
          label="Sign up with Google"
          onError={(msg) => setError(msg)}
        />
        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
