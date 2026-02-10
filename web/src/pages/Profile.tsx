import { useAuth } from '@/contexts/AuthContext';

export default function Profile() {
  const { user } = useAuth();

  return (
    <main className="page profile-page">
      <header className="page-header">
        <h1>Profil</h1>
        <p>Se og oppdater kontoinformasjonen din.</p>
      </header>

      <section className="card">
        <h2>Brukerinfo</h2>
        {user ? (
          <dl className="profile-details">
            <div className="profile-details__row">
              <dt>Navn</dt>
              <dd>{user.displayName ?? 'Ikke satt'}</dd>
            </div>
            <div className="profile-details__row">
              <dt>E-post</dt>
              <dd>{user.email}</dd>
            </div>
          </dl>
        ) : (
          <p>Ingen bruker er innlogget.</p>
        )}
      </section>
    </main>
  );
}

