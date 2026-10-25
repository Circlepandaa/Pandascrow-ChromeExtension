import { useMemo, useState } from 'react';
import { Search01Icon, SecurityCheckIcon } from '@hugeicons/core-free-icons';
import { api } from '@/lib/api';
import { useApp, useLoad } from '../state';
import { Button, Empty, ErrorBox, Header, Icon, Input, Skeleton, cn } from '../ui';
import { EscrowRow, type EscrowItem } from '../escrow-row';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'disputed', label: 'Disputed' },
] as const;

export function Escrows() {
  const { session, go } = useApp();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const [query, setQuery] = useState('');

  const list = useLoad<EscrowItem[]>(async () => {
    const res = await api('GET', '/escrow');
    return (Array.isArray(res) ? res : []).sort((a, b) => Number(b.escrow?._id) - Number(a.escrow?._id));
  });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (list.data ?? []).filter((item) => {
      const e = item.escrow ?? {};
      if (filter !== 'all' && String(e.status).toLowerCase() !== filter) return false;
      if (!q) return true;
      return [e.title, e.description, e._id, ...(item.participants ?? []).flatMap((p) => [p.name, p.email])].some((v) => String(v ?? '').toLowerCase().includes(q));
    });
  }, [list.data, filter, query]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <Header title="Escrows" right={<Button size="sm" variant="blue" onClick={() => go({ name: 'new-escrow' })}>New escrow</Button>} />
      <div className="px-4 pt-3 flex flex-col gap-2.5 shrink-0">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-light-gray">
            <Icon icon={Search01Icon} size={16} />
          </span>
          <Input placeholder="Search title, email or ID" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9 h-10" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn('shrink-0 h-8 px-3.5 rounded-full text-sm border cursor-pointer', filter === f.key ? 'border-brand-blue text-brand-blue bg-light-blue font-medium' : 'border-border-gray text-mid-gray hover:text-brand-black')}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        {list.error ? (
          <div className="pt-3">
            <ErrorBox message={list.error} onRetry={list.reload} />
          </div>
        ) : list.loading && !list.data ? (
          <div className="flex flex-col gap-3 pt-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : rows.length ? (
          rows.map((item) => <EscrowRow key={item.escrow._id} item={item} uuid={session.user.uuid} onClick={() => go({ name: 'escrow', id: Number(item.escrow._id) })} />)
        ) : (
          <Empty
            icon={SecurityCheckIcon}
            title={list.data?.length ? 'No escrows match' : 'No escrows yet'}
            text={list.data?.length ? 'Try another filter or search.' : 'Funds stay safe until the buyer confirms delivery.'}
            action={!list.data?.length ? <Button variant="blue" size="sm" onClick={() => go({ name: 'new-escrow' })}>Create an escrow</Button> : undefined}
          />
        )}
      </div>
    </div>
  );
}
