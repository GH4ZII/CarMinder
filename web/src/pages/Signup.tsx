import { Link } from 'react-router-dom';

export default function Signup() {
  return (
    <div className="page page--auth">
      <h1>Registrer deg</h1>
      <p>Skjema kommer her.</p>
      <p className="auth-footer">
        <Link to="/login">Logg inn</Link>
      </p>
    </div>
  );
}
