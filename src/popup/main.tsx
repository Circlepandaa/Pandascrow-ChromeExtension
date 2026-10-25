import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles.css';
import { getSession, takeDraft, type ListingDraft, type Session } from '@/lib/storage';
import { App } from './App';
import { Login } from './screens/Login';
import { Spinner } from './ui';

// Opened as a small window from a marketplace page, rather than the toolbar popup
const isWindow = new URLSearchParams(location.search).has('window');
document.body.classList.add(isWindow ? 'window' : 'popup');

function Root() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [draft, setDraft] = useState<ListingDraft | null>(null);

  useEffect(() => {
    Promise.all([getSession(), takeDraft()]).then(([s, d]) => {
      setDraft(d);
      setSession(s);
    });
    // Signed out from another view (background, other window): follow along
    const onChange = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && 'session' in changes && !changes.session.newValue) setSession(null);
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  if (session === undefined) {
    return (
      <div className="h-full min-h-[600px] flex items-center justify-center text-brand-blue">
        <Spinner size={28} />
      </div>
    );
  }
  if (!session) return <Login onSignedIn={setSession} pendingDraft={Boolean(draft)} />;
  return <App session={session} draft={draft} onSignedOut={() => setSession(null)} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
