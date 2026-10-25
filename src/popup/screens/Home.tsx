import { ArrowUpRight01Icon, Invoice03Icon, Link01Icon, Notification03Icon, RefreshIcon, SecurityCheckIcon, Shield01Icon } from '@hugeicons/core-free-icons';
import logo from '@/assets/logo.png';
import { api } from '@/lib/api';
import { dashboardUrl } from '@/lib/env';
import { firstName, money } from '@/lib/format';
import { setSession } from '@/lib/storage';
import { useApp, useLoad } from '../state';
import { Card, Empty, ErrorBox, Icon, IconButton, Skeleton, cn } from '../ui';
import { EscrowRow, type EscrowItem } from '../escrow-row';

interface Balance {
  currency: string;
  available: string;
  escrow: string;
}

export function Home() {
  const { session, go, reset } = useApp();
  const uuid = session.user.uuid;

  const user = useLoad(async () => {
    const res = await api('GET', '/user');
    const u = res.user ?? {};
    // keep the saved profile current (name, verification)
    await setSession({ ...session, user: { ...session.user, name: u.name, email: u.email, user_type: u.user_type, is_verified: u.is_verified, compliance_status: u.compliance_status } });
    return u;
  });

  const balances = useLoad<Balance[]>(async () => {
    const res = await api('GET', '/wallet/balance');
    const held = new Map<string, string>((res.escrow ?? []).map((e: any) => [String(e.currency), e.balance]));
    return Object.values(res.balances ?? {})
      .map((b: any) => ({ currency: String(b.currency), available: b.balance, escrow: held.get(String(b.currency)) ?? '0' }))
      .filter((b) => b.currency !== 'PANDA')
      .sort((a, b) => (a.currency === 'NGN' ? -1 : b.currency === 'NGN' ? 1 : Number(b.available) - Number(a.available)));
  });

  const escrows = useLoad<EscrowItem[]>(async () => {
    const res = await api('GET', '/escrow');
    return (Array.isArray(res) ? res : []).sort((a, b) => Number(b.escrow?._id) - Number(a.escrow?._id));
  });

  const name = user.data?.name ?? session.user.name;
  const compliance = String(user.data?.compliance_status ?? session.user.compliance_status ?? '').toLowerCase();
  const verified = ['approved', 'verified', 'completed'].includes(compliance);

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="flex items-center gap-2 h-14 px-4 shrink-0">
        <img src={logo} alt="Pandascrow" className="h-6 w-auto" />
        {session.env === 'sandbox' ? <span className="text-[11px] font-medium rounded-full bg-[#F7EDC1] text-[#7A5D12] px-2 h-5 leading-5">Sandbox</span> : null}
        <span className="flex-1" />
        <IconButton
          icon={RefreshIcon}
          label="Refresh"
          onClick={() => {
            user.reload();
            balances.reload();
            escrows.reload();
          }}
        />
        <IconButton icon={Notification03Icon} label="Alerts" onClick={() => reset({ name: 'alerts' })} />
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 flex flex-col gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight leading-tight">Welcome back, {firstName(name)} 👋</h1>
          <p className="text-sm text-mid-gray">Protecting you, one transaction at a time.</p>
        </div>

        {!user.loading && !verified ? (
          <a href={dashboardUrl(session.env, '/compliance')} target="_blank" rel="noreferrer" className="rounded-lg bg-brand-rust text-white text-xs px-3.5 py-2.5 flex items-center justify-between gap-2">
            <span>Verify your account to start sending and receiving payments securely.</span>
            <Icon icon={ArrowUpRight01Icon} size={16} />
          </a>
        ) : null}

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm text-mid-gray">Balances</h2>
            <a href={dashboardUrl(session.env, '/wallet')} target="_blank" rel="noreferrer" className="text-xs text-brand-blue font-medium">
              Open wallet
            </a>
          </div>
          {balances.error ? (
            <ErrorBox message={balances.error} onRetry={balances.reload} />
          ) : balances.loading && !balances.data ? (
            <div className="flex gap-3">
              <Skeleton className="h-[92px] w-[220px] shrink-0 rounded-xl" />
              <Skeleton className="h-[92px] w-[120px] shrink-0 rounded-xl" />
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto -mx-4 px-4 pb-1 snap-x">
              {(balances.data ?? []).map((b, i) => (
                <div key={b.currency} className={cn('snap-start shrink-0 w-[220px] rounded-xl p-4 flex flex-col gap-1', i === 0 ? 'bg-brand-blue text-white' : 'bg-g-gray')}>
                  <span className={cn('text-xs', i === 0 ? 'text-white/75' : 'text-mid-gray')}>{b.currency} balance</span>
                  <span className="text-[22px] font-semibold tracking-tight leading-tight">{money(b.available, b.currency)}</span>
                  <span className={cn('text-xs', i === 0 ? 'text-white/75' : 'text-mid-gray')}>In escrow {money(b.escrow, b.currency)}</span>
                </div>
              ))}
              {balances.data && !balances.data.length ? <p className="text-sm text-mid-gray">No wallets yet.</p> : null}
            </div>
          )}
        </section>

        <section className="grid grid-cols-3 gap-2">
          {[
            { label: 'New escrow', icon: Shield01Icon, onClick: () => go({ name: 'new-escrow' }) },
            { label: 'Payment link', icon: Link01Icon, onClick: () => go({ name: 'new-link' }) },
            { label: 'Invoice', icon: Invoice03Icon, onClick: () => go({ name: 'new-invoice' }) },
          ].map((a) => (
            <button key={a.label} type="button" onClick={a.onClick} className="flex flex-col items-center gap-1.5 rounded-xl border border-border-gray py-3 text-xs hover:bg-g-gray cursor-pointer">
              <span className="size-9 rounded-full bg-light-blue text-brand-blue flex items-center justify-center">
                <Icon icon={a.icon} size={18} />
              </span>
              {a.label}
            </button>
          ))}
        </section>

        <section className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <h2 className="text-sm text-mid-gray">Recent escrows</h2>
            <button type="button" onClick={() => reset({ name: 'escrows' })} className="text-xs text-brand-blue font-medium cursor-pointer">
              See all
            </button>
          </div>
          <Card className="px-3">
            {escrows.error ? (
              <div className="py-3">
                <ErrorBox message={escrows.error} onRetry={escrows.reload} />
              </div>
            ) : escrows.loading && !escrows.data ? (
              <div className="flex flex-col gap-3 py-3">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
            ) : escrows.data?.length ? (
              escrows.data.slice(0, 5).map((item) => <EscrowRow key={item.escrow._id} item={item} uuid={uuid} onClick={() => go({ name: 'escrow', id: Number(item.escrow._id) })} />)
            ) : (
              <Empty icon={SecurityCheckIcon} title="No escrows yet" text="Create one to hold payment safely until delivery." />
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}
