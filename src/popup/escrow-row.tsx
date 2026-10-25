import { money, timeAgo } from '@/lib/format';
import { StatusPill } from './ui';

export interface EscrowItem {
  escrow: Record<string, any>;
  participants?: Array<Record<string, any>>;
  [key: string]: any;
}

/** The other party on an escrow, from the signed-in user's point of view. */
export function counterparty(item: EscrowItem, uuid: string): Record<string, any> | undefined {
  const others = (item.participants ?? []).filter((p) => p.user_id !== uuid);
  return others.find((p) => p.role !== 'initiator') ?? others[0];
}

export function EscrowRow({ item, uuid, onClick }: { item: EscrowItem; uuid: string; onClick: () => void }) {
  const e = item.escrow ?? {};
  const other = counterparty(item, uuid);
  const role = e.initiator_id === uuid ? e.initiator_role : e.initiator_role === 'buyer' ? 'seller' : e.initiator_role === 'seller' ? 'buyer' : '';
  return (
    <button type="button" onClick={onClick} className="w-full flex items-center gap-3 py-3 text-left border-b border-border-gray last:border-0 hover:bg-g-gray/60 -mx-1 px-1 rounded-md cursor-pointer">
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{e.title || `Escrow #${e._id}`}</p>
        <p className="text-xs text-mid-gray truncate">
          {role ? (role === 'seller' ? 'Selling to ' : role === 'buyer' ? 'Buying from ' : 'Broker · ') : ''}
          {other?.name || other?.email || 'counterparty'} · {timeAgo(e.created_at)}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="font-semibold text-sm">{money(e.amount, e.currency)}</span>
        <StatusPill status={e.status} />
      </div>
    </button>
  );
}
