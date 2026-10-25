import { useEffect, useState } from 'react';
import { ArrowUpRight01Icon, Logout01Icon } from '@hugeicons/core-free-icons';
import { dashboardUrl, VERSION } from '@/lib/env';
import { initials } from '@/lib/format';
import { getSettings, saveSettings, type Settings } from '@/lib/storage';
import { useApp } from '../state';
import { Button, Card, Header, Icon, cn } from '../ui';

function Toggle({ checked, onChange, label, text }: { checked: boolean; onChange: (v: boolean) => void; label: string; text: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="w-full flex items-center gap-3 py-3 text-left cursor-pointer">
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-mid-gray">{text}</span>
      </span>
      <span className={cn('relative w-10 h-6 rounded-full transition-colors shrink-0', checked ? 'bg-brand-blue' : 'bg-light-gray-02')}>
        <span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </span>
    </button>
  );
}

export function Account() {
  const { session, signOut } = useApp();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [leaving, setLeaving] = useState(false);
  const u = session.user;

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const update = async (patch: Partial<Settings>) => {
    const next = await saveSettings(patch);
    setSettings(next);
    chrome.runtime.sendMessage({ type: 'settings-changed' }).catch(() => undefined);
  };

  const links = [
    { label: 'Open dashboard', path: '/' },
    { label: 'Wallet', path: '/wallet' },
    { label: 'Settings and security', path: '/settings' },
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      <Header title="Account" />
      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="size-12 rounded-full bg-brand-vividorange text-white font-semibold flex items-center justify-center">{initials(u.name)}</span>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-brand-blue">{u.user_type || 'Pandascrow'}</p>
            <p className="font-semibold truncate">{u.name || u.email}</p>
            <p className="text-sm text-mid-gray truncate">{u.email}</p>
          </div>
          <span className={cn('ml-auto text-[11px] font-medium rounded-full px-2 h-5 leading-5 shrink-0', session.env === 'live' ? 'bg-[#D9F9BA] text-[#3D7223]' : 'bg-[#F7EDC1] text-[#7A5D12]')}>
            {session.env === 'live' ? 'Live' : 'Sandbox'}
          </span>
        </div>

        {settings ? (
          <Card className="px-3.5 divide-y divide-border-gray">
            <Toggle checked={settings.alerts} onChange={(v) => update({ alerts: v })} label="Browser alerts" text="Get notified when an escrow is paid, released or disputed." />
            <Toggle checked={settings.marketplaceButton} onChange={(v) => update({ marketplaceButton: v })} label="Escrow button on marketplaces" text="Show “Pay safely with Pandascrow” on Facebook Marketplace, Jiji and Instagram." />
          </Card>
        ) : null}

        <Card className="px-3.5 divide-y divide-border-gray">
          {links.map((l) => (
            <a key={l.path} href={dashboardUrl(session.env, l.path)} target="_blank" rel="noreferrer" className="flex items-center justify-between py-3 text-sm hover:text-brand-blue">
              {l.label}
              <Icon icon={ArrowUpRight01Icon} size={16} className="text-light-gray" />
            </a>
          ))}
        </Card>

        <Button
          variant="danger"
          icon={Logout01Icon}
          loading={leaving}
          onClick={() => {
            setLeaving(true);
            signOut();
          }}
        >
          Sign out
        </Button>
        <p className="text-xs text-light-gray text-center">Pandascrow for Chrome · v{VERSION}</p>
      </div>
    </div>
  );
}
