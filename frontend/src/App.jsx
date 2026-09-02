import { useCallback, useEffect, useRef, useState } from 'react';
import { isConfigured, missingConfigMessage } from './neonClient.js';
import { useSession, signOut } from './auth.js';
import { listContacts, createContact, updateContact, deleteContact } from './api.js';
import { AuthGate } from './components/AuthGate.jsx';
import { Header } from './components/Header.jsx';
import { Toolbar } from './components/Toolbar.jsx';
import { ContactList } from './components/ContactList.jsx';
import { ContactForm } from './components/ContactForm.jsx';
import { ConfirmDelete } from './components/ConfirmDelete.jsx';
import { LoadingList, EmptyState, ErrorState } from './components/States.jsx';
import { useToast } from './components/Toasts.jsx';
import { PlasmaBackground, BlobField, Scrim, Grain } from './fx/PlasmaBackground.jsx';
import { CursorTrail } from './fx/CursorTrail.jsx';
import { useFireworks } from './fx/Fireworks.jsx';
import { useTrip } from './fx/TripContext.jsx';
import { burstConfetti, megaConfetti, popConfetti } from './fx/celebrate.js';

const DEFAULT_QUERY = { sort: 'created_at', order: 'desc', priority: 'all', q: '' };

/** Shown when the Neon URLs are missing, instead of a blank white screen. */
const ConfigNotice = () => (
  <div className="flex min-h-dvh items-center justify-center p-6">
    <div className="glass max-w-lg p-8 text-center">
      <div className="mb-3 text-4xl" aria-hidden="true">🔌</div>
      <h1 className="mb-3 text-2xl font-black text-white">Not connected yet</h1>
      <p className="text-sm leading-relaxed text-violet-200/75">{missingConfigMessage}</p>
    </div>
  </div>
);

export const App = () => {
  const { user, status, refresh } = useSession();
  const { notify } = useToast();
  const { launch } = useFireworks();
  const { effects } = useTrip();

  const [contacts, setContacts] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [loadError, setLoadError] = useState(null);
  const [query, setQuery] = useState(DEFAULT_QUERY);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const signedIn = status === 'signed-in';

  /**
   * Reload from the server. `requestRef` guards against a slow earlier request
   * landing after a newer one and overwriting fresher results.
   */
  const requestRef = useRef(0);
  const load = useCallback(
    async (nextQuery) => {
      const ticket = ++requestRef.current;
      setLoadState((current) => (current === 'ready' ? 'ready' : 'loading'));
      try {
        const rows = await listContacts(nextQuery);
        if (ticket !== requestRef.current) return;
        setContacts(rows);
        setLoadState('ready');
        setLoadError(null);
      } catch (error) {
        if (ticket !== requestRef.current) return;
        setLoadError(error.message);
        setLoadState('error');
      }
    },
    []
  );

  // Debounce the free-text search so typing does not fire a request per keystroke.
  useEffect(() => {
    if (!signedIn) return undefined;
    const delay = query.q ? 300 : 0;
    const timer = setTimeout(() => load(query), delay);
    return () => clearTimeout(timer);
  }, [signedIn, query, load]);

  const openCreate = () => {
    setEditing(null);
    setServerErrors({});
    setFormOpen(true);
  };

  const openEdit = (contact) => {
    setEditing(contact);
    setServerErrors({});
    setFormOpen(true);
  };

  const handleSubmit = async (values) => {
    setSaving(true);
    setServerErrors({});
    try {
      if (editing) {
        await updateContact(editing.id, values);
        notify(`Updated ${values.name}.`);
        popConfetti(effects);
      } else {
        await createContact(values);
        notify(`${values.name} joined your orbit!`);
        if (values.priority === 'high') {
          megaConfetti(effects);
          launch(2400);
        } else {
          burstConfetti(effects);
        }
      }
      setFormOpen(false);
      setEditing(null);
      await load(query);
    } catch (error) {
      // Field-level messages from the server render inline in the form; the
      // toast carries the headline so it is visible either way.
      setServerErrors(error.fields ?? {});
      notify(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteContact(pendingDelete.id);
      notify(`Removed ${pendingDelete.name}.`);
      setPendingDelete(null);
      await load(query);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      setContacts([]);
      setQuery(DEFAULT_QUERY);
      setLoadState('loading');
      await refresh();
      notify('Signed out. See you soon.', 'info');
    } catch (error) {
      notify(error.message ?? 'Could not sign out. Please try again.', 'error');
    } finally {
      setSigningOut(false);
    }
  };

  if (!isConfigured) return <ConfigNotice />;

  const backdrop = (
    <>
      <PlasmaBackground />
      <BlobField />
      <Scrim />
      <Grain />
      <CursorTrail />
    </>
  );

  if (status === 'loading') {
    return (
      <>
        {backdrop}
        <div className="flex min-h-dvh items-center justify-center" role="status">
          <div className="holo-text animate-pulse text-2xl font-black">Opening the portal…</div>
        </div>
      </>
    );
  }

  if (!signedIn) {
    return (
      <>
        {backdrop}
        <AuthGate onAuthenticated={refresh} />
      </>
    );
  }

  const isFiltered = query.priority !== 'all' || Boolean(query.q.trim());

  return (
    <>
      {backdrop}
      <div className="mx-auto min-h-dvh w-full max-w-6xl px-3 py-5 sm:px-5 sm:py-8">
        <Header
          user={user}
          onAdd={openCreate}
          onSignOut={handleSignOut}
          signingOut={signingOut}
        />

        <main>
          <Toolbar query={query} onChange={setQuery} count={contacts.length} />

          {loadState === 'loading' && contacts.length === 0 ? (
            <LoadingList />
          ) : loadState === 'error' ? (
            <ErrorState message={loadError} onRetry={() => load(query)} />
          ) : contacts.length === 0 ? (
            <EmptyState
              filtered={isFiltered}
              onClear={() => setQuery(DEFAULT_QUERY)}
              onAdd={openCreate}
            />
          ) : (
            <ContactList contacts={contacts} onEdit={openEdit} onDelete={setPendingDelete} />
          )}
        </main>

        <footer className="mt-10 pb-6 text-center text-xs text-violet-300/40">
          Your contacts are private to your account, enforced by Postgres row-level security.
        </footer>
      </div>

      <ContactForm
        open={formOpen}
        onOpenChange={setFormOpen}
        contact={editing}
        onSubmit={handleSubmit}
        busy={saving}
        serverErrors={serverErrors}
      />

      <ConfirmDelete
        contact={pendingDelete}
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
        busy={deleting}
      />
    </>
  );
};
