import { CheckmarkCircle02Icon, Share08Icon } from '@hugeicons/core-free-icons';
import { dashboardUrl } from '@/lib/env';
import { money } from '@/lib/format';
import { useApp } from '../state';
import { Button, CopyField, Icon } from '../ui';

/** Success page after creating an escrow, payment link or invoice. */
export function Created({ kind, data, role }: { kind: 'escrow' | 'link' | 'invoice'; data: Record<string, any>; role?: string }) {
  const { reset, go, session } = useApp();
  const link: string | undefined = data.payment_url ?? data.link ?? data.authorization_url;

  const heading = kind === 'escrow' ? `Escrow #${data.escrow_id} created` : kind === 'link' ? 'Payment link ready' : `Invoice ${data.invoice_number ?? ''} created`;
  const sub =
    kind === 'escrow'
      ? role === 'buyer'
        ? 'Pay into escrow now. The seller is notified and ships once your payment is secured.'
        : 'Send the payment link to the buyer. You ship once the money is secured in escrow.'
      : kind === 'link'
        ? data.live
          ? 'Share it in your chats and listings. Payments are held in escrow until the order is confirmed.'
          : 'Make it live in the dashboard, then share it.'
        : `We emailed the invoice to ${data.client ?? 'your client'}. You can also share the link.`;

  const share = async () => {
    if (!link) return;
    const text = kind === 'escrow' ? `Pay safely through Pandascrow escrow: ${link}` : link;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Pandascrow', text, url: link });
        return;
      } catch {
        /* fall back to WhatsApp */
      }
    }
    chrome.tabs.create({ url: `https://wa.me/?text=${encodeURIComponent(text)}` });
  };

  return (
    <div className="flex flex-col h-full min-h-0 p-5 overflow-y-auto">
      <div className="flex flex-col items-center text-center gap-2 pt-6">
        <span className="size-14 rounded-full bg-[#D9F9BA] text-[#3D7223] flex items-center justify-center">
          <Icon icon={CheckmarkCircle02Icon} size={30} />
        </span>
        <h1 className="text-xl font-semibold tracking-tight">{heading}</h1>
        {data.amount || data.total ? <p className="text-[26px] font-semibold tracking-tight">{money(data.amount ?? data.total, data.currency)}</p> : null}
        <p className="text-sm text-mid-gray max-w-[300px]">{sub}</p>
      </div>

      <div className="flex flex-col gap-2.5 mt-6">
        {link ? (
          <>
            <CopyField value={link} />
            {kind === 'escrow' && role === 'buyer' ? (
              <Button variant="blue" size="lg" onClick={() => chrome.tabs.create({ url: link })}>
                Pay now
              </Button>
            ) : (
              <Button variant="outline" icon={Share08Icon} onClick={share}>
                Share link
              </Button>
            )}
          </>
        ) : kind === 'escrow' ? (
          <p className="text-sm text-mid-gray text-center rounded-lg bg-g-gray p-3">The payment link isn't ready yet. Open the escrow to get one.</p>
        ) : null}

        {kind === 'escrow' && data.escrow_id ? (
          <Button variant="outline" onClick={() => reset({ name: 'escrow', id: Number(data.escrow_id) })}>
            View escrow
          </Button>
        ) : null}
        {kind !== 'escrow' ? (
          <a href={dashboardUrl(session.env, kind === 'link' ? '/payments' : '/invoices')} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center h-10 text-sm text-brand-blue font-medium">
            Open in dashboard
          </a>
        ) : null}
        <Button variant="ghost" onClick={() => reset({ name: 'home' })}>
          Done
        </Button>
        <button type="button" onClick={() => go({ name: kind === 'escrow' ? 'new-escrow' : kind === 'link' ? 'new-link' : 'new-invoice' })} className="text-sm text-mid-gray hover:text-brand-black cursor-pointer">
          Create another
        </button>
      </div>
    </div>
  );
}
