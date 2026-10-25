import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { SessionEnded } from '@/lib/api';
import type { ListingDraft, Session } from '@/lib/storage';

export type Route =
  | { name: 'home' }
  | { name: 'escrows' }
  | { name: 'escrow'; id: number }
  | { name: 'new-escrow'; draft?: ListingDraft | null }
  | { name: 'new-link' }
  | { name: 'new-invoice' }
  | { name: 'alerts' }
  | { name: 'account' }
  | { name: 'created'; kind: 'escrow' | 'link' | 'invoice'; data: Record<string, any>; role?: string };

export const TABS = ['home', 'escrows', 'alerts', 'account'] as const;

interface AppState {
  session: Session;
  route: Route;
  go: (route: Route) => void;
  back: () => void;
  /** Replace the whole stack (tab switch). */
  reset: (route: Route) => void;
  signOut: () => void;
  toast: (message: string) => void;
  canGoBack: boolean;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ session, initial, onSignedOut, children }: { session: Session; initial: Route; onSignedOut: () => void; children: (route: Route) => ReactNode }) {
  const [stack, setStack] = useState<Route[]>([initial]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const toast = useCallback((message: string) => {
    setToastMsg(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastMsg(null), 2600);
  }, []);

  const value: AppState = {
    session,
    route: stack[stack.length - 1],
    go: (route) => setStack((s) => [...s, route]),
    back: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
    reset: (route) => setStack([route]),
    signOut: onSignedOut,
    toast,
    canGoBack: stack.length > 1,
  };

  return (
    <Ctx.Provider value={value}>
      {children(value.route)}
      {toastMsg ? (
        <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-20 z-50 rounded-full bg-brand-black text-white text-sm px-4 py-2 shadow-lg max-w-[340px] text-center">
          {toastMsg}
        </div>
      ) : null}
    </Ctx.Provider>
  );
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}

/** Load data for a screen; sends you back to sign-in if the session ended. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const { signOut } = useApp();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    load()
      .then((d) => alive && setData(d))
      .catch((err) => {
        if (!alive) return;
        if (err instanceof SessionEnded) signOut();
        else setError(err?.message ?? 'Something went wrong.');
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { data, error, loading, reload: () => setTick((t) => t + 1), setData };
}

/** Run an action (form submit), turning a SessionEnded into sign-out. */
export function useAction() {
  const { signOut } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (err: any) {
      if (err instanceof SessionEnded) signOut();
      else setError(err?.message ?? 'Something went wrong.');
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}
