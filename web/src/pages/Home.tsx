import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (e) {
      console.error('Feil ved utlogging', e);
    }
  };

  return (
    <main className="page home-page">
      <header className="home-header">
        <div>
          <h1>Hjem</h1>
          <p>
            Velkommen til CarMinder
            {user?.displayName ? `, ${user.displayName}` : ''}. Her får du
            oversikt over bilene dine og kommende vedlikehold.
          </p>
        </div>
        <button className="button button-secondary" onClick={handleLogout}>
          Logg ut
        </button>
      </header>

      <section className="home-grid">
        <section className="card">
          <h2>Dagens status</h2>
          <p>
            Ingen varsler akkurat nå. Legg til biler og vedlikeholdsplaner for å
            se dem her.
          </p>
        </section>

        <section className="card">
          <h2>Kommende vedlikehold</h2>
          <ul className="home-list">
            <li>Ingen planlagte oppgaver. Dette fylles ut etter hvert.</li>
          </ul>
        </section>

        <section className="card">
          <h2>Hurtighandlinger</h2>
          <div className="home-actions">
            <button
              className="button button-primary"
              onClick={() => navigate('/profile')}
            >
              Gå til profil
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}
