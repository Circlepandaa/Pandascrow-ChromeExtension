import { api, freshSession, SessionEnded } from '@/lib/api';
import { dashboardUrl } from '@/lib/env';
import { getSession, getSettings, setDraft } from '@/lib/storage';
import type { Listing } from '@/content/extract';

/**
 * Background worker:
 *  - checks for new notifications every 2 minutes, shows browser alerts and the unread badge;
 *  - keeps the session token fresh;
 *  - opens the escrow form when a marketplace button is clicked.
 */

const POLL_MINUTES = 2;

chrome.runtime.onInstalled.addListener(() => {
  void schedule();
  void poll();
});
chrome.runtime.onStartup.addListener(() => {
  void schedule();
  void poll();
});

async function schedule(): Promise<void> {
  const existing = await chrome.alarms.get('poll');
  if (!existing) await chrome.alarms.create('poll', { periodInMinutes: POLL_MINUTES, delayInMinutes: 0.1 });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'poll') void poll();
});

async function setBadge(count: number): Promise<void> {
  await chrome.action.setBadgeBackgroundColor({ color: '#e76f51' });
  await chrome.action.setBadgeText({ text: count > 0 ? (count > 99 ? '99+' : String(count)) : '' });
}

interface Notice {
  _id: number;
  title: string;
  message: string;
  is_read: number | boolean;
}

let polling = false;

export async function poll(): Promise<void> {
  if (polling) return;
  polling = true;
  try {
    const session = await getSession();
    if (!session) {
      await setBadge(0);
      return;
    }
    await freshSession(); // refresh the token even when alerts are off

    const settings = await getSettings();
    const res = await api('GET', '/notification', { query: { limit: 20 } });
    const items: Notice[] = res.notifications ?? [];
    const unread = items.filter((n) => !Number(n.is_read));
    await chrome.storage.local.set({ unreadCount: unread.length });
    await setBadge(unread.length);

    const { lastNotificationId } = await chrome.storage.local.get('lastNotificationId');
    const newest = Math.max(0, ...items.map((n) => Number(n._id) || 0));
    if (typeof lastNotificationId !== 'number') {
      // First check after sign-in: remember where we are, don't replay old alerts
      await chrome.storage.local.set({ lastNotificationId: newest });
      return;
    }
    const fresh = unread.filter((n) => Number(n._id) > lastNotificationId).slice(0, 3);
    if (newest > lastNotificationId) await chrome.storage.local.set({ lastNotificationId: newest });
    if (!settings.alerts) return;
    for (const n of fresh.reverse()) {
      chrome.notifications.create(`ps-${n._id}`, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: n.title || 'Pandascrow',
        message: n.message || '',
        priority: 1,
      });
    }
  } catch (err) {
    if (err instanceof SessionEnded) await setBadge(0);
    // network errors: try again on the next alarm
  } finally {
    polling = false;
  }
}

chrome.notifications.onClicked.addListener(async (id) => {
  chrome.notifications.clear(id);
  const session = await getSession();
  chrome.tabs.create({ url: dashboardUrl(session?.env ?? 'live', '/notifications') });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && 'session' in changes && !changes.session.newValue) void setBadge(0);
  if (area === 'local' && changes.unreadCount) void setBadge(Number(changes.unreadCount.newValue) || 0);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'signed-in' || message?.type === 'settings-changed') {
    void chrome.storage.local.remove('lastNotificationId').then(() => poll());
    return;
  }
  if (message?.type === 'open-escrow' && sender.tab) {
    void openEscrow(message.listing as Listing, sender.tab).then(() => sendResponse({ ok: true }));
    return true;
  }
});

/** Save the listing and show the escrow form: the toolbar popup if Chrome allows, else a small window. */
async function openEscrow(listing: Listing, tab: chrome.tabs.Tab): Promise<void> {
  await setDraft({
    title: listing.title,
    amount: listing.amount,
    currency: listing.currency,
    description: listing.description,
    url: listing.url,
    image: listing.image,
    site: listing.site,
    seller: listing.seller,
    createdAt: Date.now(),
  });
  try {
    await chrome.action.openPopup({ windowId: tab.windowId });
    return;
  } catch {
    /* not supported here: open a window instead */
  }
  const width = 400;
  const height = 640;
  let left: number | undefined;
  let top: number | undefined;
  try {
    const win = await chrome.windows.get(tab.windowId);
    if (win.left !== undefined && win.width !== undefined) left = win.left + win.width - width - 24;
    if (win.top !== undefined) top = win.top + 80;
  } catch {
    /* default position */
  }
  const url = chrome.runtime.getURL('popup.html?window=1');
  try {
    await chrome.windows.create({ url, type: 'popup', width, height, left, top, focused: true });
  } catch {
    // position off-screen (multiple monitors, minimised window): let Chrome place it
    await chrome.windows.create({ url, type: 'popup', width, height, focused: true });
  }
}
