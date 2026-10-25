import { useEffect, useState } from 'react';
import { Add01Icon, Home03Icon, Invoice03Icon, Link01Icon, Notification03Icon, SecurityCheckIcon, Shield01Icon, UserCircleIcon } from '@hugeicons/core-free-icons';
import type { IconSvgElement } from '@hugeicons/react';
import { logout } from '@/lib/api';
import type { ListingDraft, Session } from '@/lib/storage';
import { AppProvider, useApp, type Route } from './state';
import { cn, Icon } from './ui';
import { Home } from './screens/Home';
import { Escrows } from './screens/Escrows';
import { EscrowDetail } from './screens/EscrowDetail';
import { NewEscrow } from './screens/NewEscrow';
import { NewLink } from './screens/NewLink';
import { NewInvoice } from './screens/NewInvoice';
import { Alerts } from './screens/Alerts';
import { Account } from './screens/Account';
import { Created } from './screens/Created';

export function App({ session, draft, onSignedOut }: { session: Session; draft: ListingDraft | null; onSignedOut: () => void }) {
  const initial: Route = draft ? { name: 'new-escrow', draft } : { name: 'home' };
  return (
    <AppProvider
      session={session}
      initial={initial}
      onSignedOut={() => {
        void logout().finally(onSignedOut);
      }}
    >
      {(route) => <Shell route={route} />}
    </AppProvider>
  );
}

function Shell({ route }: { route: Route }) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    chrome.storage.local.get('unreadCount').then(({ unreadCount }) => setUnread(Number(unreadCount) || 0));
    const onChange = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes.unreadCount) setUnread(Number(changes.unreadCount.newValue) || 0);
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  const showNav = ['home', 'escrows', 'alerts', 'account'].includes(route.name);

  return (
    <div className="flex flex-col h-[600px] bg-white">
      <main className="flex-1 min-h-0 flex flex-col">{screen(route)}</main>
      {showNav ? <BottomNav current={route.name} unread={unread} /> : null}
    </div>
  );
}

function screen(route: Route) {
  switch (route.name) {
    case 'home':
      return <Home />;
    case 'escrows':
      return <Escrows />;
    case 'escrow':
      return <EscrowDetail id={route.id} />;
    case 'new-escrow':
      return <NewEscrow draft={route.draft ?? null} />;
    case 'new-link':
      return <NewLink />;
    case 'new-invoice':
      return <NewInvoice />;
    case 'alerts':
      return <Alerts />;
    case 'account':
      return <Account />;
    case 'created':
      return <Created kind={route.kind} data={route.data} role={route.role} />;
  }
}

function BottomNav({ current, unread }: { current: Route['name']; unread: number }) {
  const { reset, go } = useApp();
  const [menu, setMenu] = useState(false);

  const tab = (name: 'home' | 'escrows' | 'alerts' | 'account', label: string, icon: IconSvgElement, badge?: number) => (
    <button
      type="button"
      onClick={() => reset({ name } as Route)}
      className={cn('relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[11px] cursor-pointer', current === name ? 'text-brand-blue font-medium' : 'text-mid-gray hover:text-brand-black')}
    >
      <Icon icon={icon} size={21} />
      {label}
      {badge ? <span className="absolute top-1.5 left-1/2 ml-1.5 min-w-4 h-4 px-1 rounded-full bg-brand-coral text-white text-[10px] leading-4 text-center font-semibold">{badge > 9 ? '9+' : badge}</span> : null}
    </button>
  );

  return (
    <>
      {menu ? (
        <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setMenu(false)}>
          <div className="absolute bottom-0 inset-x-0 rounded-t-2xl bg-white p-4 pb-5 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-mid-gray px-1 pb-1">Create</p>
            {[
              { label: 'Escrow transaction', text: 'Hold payment until the item is delivered', icon: Shield01Icon, route: { name: 'new-escrow' } as Route },
              { label: 'Payment link', text: 'Share one link, get paid through escrow', icon: Link01Icon, route: { name: 'new-link' } as Route },
              { label: 'Invoice', text: 'Bill a client and get a payment link', icon: Invoice03Icon, route: { name: 'new-invoice' } as Route },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setMenu(false);
                  go(item.route);
                }}
                className="flex items-center gap-3 rounded-xl border border-border-gray p-3 text-left hover:bg-g-gray cursor-pointer"
              >
                <span className="size-10 rounded-full bg-light-blue text-brand-blue flex items-center justify-center shrink-0">
                  <Icon icon={item.icon} size={20} />
                </span>
                <span className="flex flex-col">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-xs text-mid-gray">{item.text}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <nav className="h-16 shrink-0 border-t border-border-gray bg-white flex items-center px-2">
        {tab('home', 'Home', Home03Icon)}
        {tab('escrows', 'Escrows', SecurityCheckIcon)}
        <div className="flex-1 flex items-center justify-center">
          <button type="button" aria-label="Create" onClick={() => setMenu(true)} className="size-11 rounded-full bg-brand-blue text-white flex items-center justify-center shadow-md hover:bg-brand-blue/90 cursor-pointer">
            <Icon icon={Add01Icon} size={22} strokeWidth={2} />
          </button>
        </div>
        {tab('alerts', 'Alerts', Notification03Icon, unread)}
        {tab('account', 'Account', UserCircleIcon)}
      </nav>
    </>
  );
}
