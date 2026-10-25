import { ArrowUpRight01Icon } from '@hugeicons/core-free-icons';
import { api } from '@/lib/api';
import { dashboardUrl } from '@/lib/env';
import { money, shortDate } from '@/lib/format';
import { useAction, useApp, useLoad } from '../state';
import { Button, Card, CopyField, ErrorBox, Header, Icon, Row, Skeleton, StatusPill } from '../ui';

export function EscrowDetail({ id }: { id: number }) {
  const { session, back, toast } = useApp();
  const detail = useLoad(() => api('GET', '/escrow/single', { query: { escrow_id: id } }), [id]);
  const action = useAction();

  const e = detail.data?.escrow ?? {};
  const parties: any[] = detail.data?.participants ?? [];
  const milestones: any[] = detail.data?.milestones ?? [];
  const isBuyerSide = (e.initiator_id === session.user.uuid && e.initiator_role === 'buyer') || (e.initiator_id !== session.user.uuid && e.initiator_role === 'seller');
  const status = String(e.status ?? '').toLowerCase();

  const newLink = () =>
    action.run(async () => {
      const res = await api('POST', '/escrow/regenerate-payment', { body: { escrow_id: id } });
      const url = res.payment_url ?? res.authorization_url ?? res.link;
      if (url) {
        detail.setData({ ...detail.data, escrow: { ...e, payment_url: url } });
        toast('New payment link ready.');
      } else toast('Payment link refreshed.');
    });

  const resendCode = () =>
    action.run(async () => {
      await api('POST', '/escrow/resend-otp', { body: { escrow_id: id } });
      toast('Release code sent to the buyer.');
    });

  return (
    <div className="flex flex-col h-full min-h-0">
      <Header title={`Escrow #${id}`} onBack={back} />
      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4">
        {detail.error ? (
          <ErrorBox message={detail.error} onRetry={detail.reload} />
        ) : detail.loading && !detail.data ? (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-40" />
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <StatusPill status={e.status} />
                <span className="text-xs text-mid-gray capitalize">{e.escrow_type} escrow</span>
              </div>
              <h2 className="text-xl font-semibold tracking-tight leading-snug">{e.title}</h2>
              {e.description ? <p className="text-sm text-mid-gray whitespace-pre-line">{e.description}</p> : null}
              <p className="text-[28px] font-semibold tracking-tight mt-1">{money(e.amount, e.currency)}</p>
            </div>

            {e.payment_url && ['pending', 'unpaid', 'initiated'].includes(status) ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-mid-gray">{isBuyerSide ? 'Pay into escrow with this link' : 'Send this payment link to the buyer'}</p>
                <CopyField value={e.payment_url} />
                {isBuyerSide ? (
                  <Button variant="blue" onClick={() => chrome.tabs.create({ url: e.payment_url })}>
                    Pay now
                  </Button>
                ) : null}
              </div>
            ) : null}

            <Card className="px-3.5">
              <Row label="Buyer pays" value={money(e.amount_pay ?? e.amount, e.currency)} />
              <Row label="Seller receives" value={money(e.amount_receive ?? e.amount, e.currency)} />
              <Row label="Fees paid by" value={<span className="capitalize">{e.who_pay_fees ?? 'buyer'}</span>} />
              {e.delivery_date ? <Row label="Delivery date" value={shortDate(e.delivery_date)} /> : null}
              <Row label="Created" value={shortDate(e.created_at)} />
            </Card>

            {parties.length ? (
              <section className="flex flex-col gap-2">
                <h3 className="text-sm text-mid-gray">Parties</h3>
                <Card className="px-3.5">
                  {parties.map((p) => (
                    <Row key={p._id} label={p.user_id === session.user.uuid ? 'You' : p.role === 'initiator' ? 'Started by' : 'Counterparty'} value={<span className="flex flex-col items-end"><span>{p.name || '—'}</span><span className="text-xs text-mid-gray">{p.email}</span></span>} />
                  ))}
                </Card>
              </section>
            ) : null}

            {milestones.length ? (
              <section className="flex flex-col gap-2">
                <h3 className="text-sm text-mid-gray">Milestones</h3>
                <Card className="px-3.5">
                  {milestones.map((m) => (
                    <Row key={m._id} label={m.title} value={<span className="flex items-center gap-2">{money(m.amount, e.currency)} <StatusPill status={m.status} /></span>} />
                  ))}
                </Card>
              </section>
            ) : null}

            {action.error ? <ErrorBox message={action.error} /> : null}

            <div className="flex flex-col gap-2">
              {['pending', 'unpaid', 'initiated'].includes(status) ? (
                <Button variant="outline" loading={action.busy} onClick={newLink}>
                  Get a new payment link
                </Button>
              ) : null}
              {status === 'active' && !isBuyerSide ? (
                <Button variant="outline" loading={action.busy} onClick={resendCode}>
                  Resend release code to buyer
                </Button>
              ) : null}
              <a href={dashboardUrl(session.env, '/transactions')} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 h-10 text-sm text-brand-blue font-medium">
                Open in dashboard <Icon icon={ArrowUpRight01Icon} size={15} />
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
