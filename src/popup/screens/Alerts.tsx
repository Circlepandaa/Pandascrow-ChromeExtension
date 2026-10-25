import { Notification03Icon } from '@hugeicons/core-free-icons';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { useApp, useLoad } from '../state';
import { Empty, ErrorBox, Header, Skeleton, cn } from '../ui';

interface Notice {
  _id: number;
  title: string;
  message: string;
  type?: string;
  is_read: number | boolean;
  created_at: string;
}

export function Alerts() {
  const { toast } = useApp();
  const list = useLoad<Notice[]>(async () => {
    const res = await api('GET', '/notification', { query: { limit: 30 } });
    const items: Notice[] = res.notifications ?? (Array.isArray(res) ? res : []);
    const unread = items.filter((n) => !Number(n.is_read)).length;
    await chrome.storage.local.set({ unreadCount: unread });
    return items;
  });

  const markRead = async (n: Notice) => {
    if (Number(n.is_read)) return;
    list.setData((list.data ?? []).map((x) => (x._id === n._id ? { ...x, is_read: 1 } : x)));
    try {
      await api('POST', '/notification/mark-as-read', { body: { notification_id: n._id } });
      const { unreadCount } = await chrome.storage.local.get('unreadCount');
      await chrome.storage.local.set({ unreadCount: Math.max(0, (Number(unreadCount) || 1) - 1) });
    } catch {
      toast("Couldn't mark it as read. Try again.");
    }
  };

  const markAll = async () => {
    const unread = (list.data ?? []).filter((n) => !Number(n.is_read));
    list.setData((list.data ?? []).map((x) => ({ ...x, is_read: 1 })));
    await Promise.allSettled(unread.map((n) => api('POST', '/notification/mark-as-read', { body: { notification_id: n._id } })));
    await chrome.storage.local.set({ unreadCount: 0 });
  };

  const hasUnread = (list.data ?? []).some((n) => !Number(n.is_read));

  return (
    <div className="flex flex-col h-full min-h-0">
      <Header
        title="Alerts"
        right={
          hasUnread ? (
            <button type="button" onClick={markAll} className="text-sm text-brand-blue font-medium cursor-pointer">
              Mark all read
            </button>
          ) : undefined
        }
      />
      <div className="flex-1 min-h-0 overflow-y-auto">
        {list.error ? (
          <div className="p-4">
            <ErrorBox message={list.error} onRetry={list.reload} />
          </div>
        ) : list.loading && !list.data ? (
          <div className="p-4 flex flex-col gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : list.data?.length ? (
          list.data.map((n) => {
            const unread = !Number(n.is_read);
            return (
              <button key={n._id} type="button" onClick={() => markRead(n)} className={cn('w-full text-left flex gap-3 px-4 py-3 border-b border-border-gray hover:bg-g-gray cursor-pointer', unread && 'bg-light-blue/50')}>
                <span className={cn('mt-1.5 size-2 rounded-full shrink-0', unread ? 'bg-brand-coral' : 'bg-transparent')} />
                <span className="flex flex-col gap-0.5 min-w-0">
                  <span className={cn('text-sm', unread ? 'font-semibold' : 'font-medium')}>{n.title}</span>
                  <span className="text-sm text-mid-gray line-clamp-2">{n.message}</span>
                  <span className="text-xs text-light-gray">{timeAgo(n.created_at)}</span>
                </span>
              </button>
            );
          })
        ) : (
          <Empty icon={Notification03Icon} title="You're all caught up" text="Payments, releases and disputes show up here." />
        )}
      </div>
    </div>
  );
}
