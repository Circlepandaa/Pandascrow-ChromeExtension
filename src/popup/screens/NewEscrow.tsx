import { useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { isEmail, money } from '@/lib/format';
import type { ListingDraft } from '@/lib/storage';
import { useAction, useApp, useLoad } from '../state';
import { Button, ErrorBox, Field, Header, Input, Segmented, Select, Textarea } from '../ui';

type Role = 'seller' | 'buyer';

/** Currencies the user has wallets in, NGN first. */
export function useCurrencies() {
  return useLoad<string[]>(async () => {
    try {
      const res = await api('GET', '/wallets');
      const list = (res.wallets ?? []).map((w: any) => String(w.currency).toUpperCase()).filter((c: string) => c !== 'PANDA');
      return Array.from(new Set(['NGN', ...list]));
    } catch {
      return ['NGN', 'USD'];
    }
  });
}

export function NewEscrow({ draft }: { draft: ListingDraft | null }) {
  const { back, go, canGoBack, reset } = useApp();
  const currencies = useCurrencies();
  const action = useAction();

  const [role, setRole] = useState<Role>(draft ? 'buyer' : 'seller');
  const [title, setTitle] = useState(draft?.title ?? '');
  const [description, setDescription] = useState(draft ? `${draft.description ? draft.description.slice(0, 300) + '\n\n' : ''}Listing on ${draft.site}: ${draft.url}` : '');
  const [amount, setAmount] = useState(draft?.amount ?? '');
  const [currency, setCurrency] = useState(draft?.currency ?? 'NGN');
  const [name, setName] = useState(draft?.seller ?? '');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [fees, setFees] = useState<'buyer' | 'seller' | 'both'>('buyer');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const other = role === 'seller' ? 'Buyer' : 'Seller';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    const cleanAmount = amount.replace(/,/g, '').trim();
    if (!title.trim()) next.title = 'Give the deal a short title.';
    if (!description.trim()) next.description = 'Describe what is being bought.';
    if (!/^\d+(\.\d{1,2})?$/.test(cleanAmount) || Number(cleanAmount) <= 0) next.amount = 'Enter the amount, e.g. 45000';
    if (!isEmail(email)) next.email = `Enter the ${other.toLowerCase()}'s email. We send them the escrow details.`;
    setErrors(next);
    if (Object.keys(next).length) return;

    const party = { name: name.trim() || undefined, email: email.trim(), phone: phone.trim() || undefined };
    const body: Record<string, unknown> = {
      escrow_type: 'onetime',
      initiator_role: role,
      title: title.trim(),
      description: description.trim(),
      currency,
      amount: cleanAmount,
      who_pay_fees: fees,
      ...(role === 'seller' ? { buyer_details: party } : { seller_details: party }),
      ...(deliveryDate ? { delivery_date: deliveryDate } : {}),
      ...(draft ? { metadata: { source: 'chrome-extension', listing_url: draft.url, listing_site: draft.site } } : {}),
    };

    void action.run(async () => {
      const res = await api('POST', '/escrow/initialize', { body });
      go({ name: 'created', kind: 'escrow', data: { ...res, title: title.trim(), amount: cleanAmount, currency }, role });
    });
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <Header title="New escrow" onBack={canGoBack ? back : () => reset({ name: 'home' })} />
      <form onSubmit={submit} className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4" noValidate>
        {draft ? (
          <div className="flex gap-3 rounded-xl border border-border-gray p-2.5">
            {draft.image ? <img src={draft.image} alt="" className="size-14 rounded-lg object-cover shrink-0 bg-g-gray" referrerPolicy="no-referrer" /> : null}
            <div className="min-w-0 flex flex-col justify-center">
              <p className="text-xs text-mid-gray">From {draft.site}</p>
              <p className="font-medium truncate">{draft.title}</p>
              {draft.amount ? <p className="text-sm">{money(draft.amount, draft.currency ?? 'NGN')}</p> : <p className="text-xs text-mid-gray">Price not found. Enter it below.</p>}
            </div>
          </div>
        ) : null}

        <Segmented<Role>
          value={role}
          onChange={setRole}
          options={[
            { value: 'seller', label: "I'm selling" },
            { value: 'buyer', label: "I'm buying" },
          ]}
        />

        <Field label="What is being sold?" error={errors.title}>
          <Input placeholder="e.g. iPhone 15 Pro, 256GB" value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={Boolean(errors.title)} />
        </Field>
        <Field label="Description" error={errors.description}>
          <Textarea placeholder="Condition, what's included, delivery terms" value={description} onChange={(e) => setDescription(e.target.value)} aria-invalid={Boolean(errors.description)} />
        </Field>
        <div className="grid grid-cols-[1fr_96px] gap-2">
          <Field label="Amount" error={errors.amount}>
            <Input inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={Boolean(errors.amount)} />
          </Field>
          <Field label="Currency">
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {(currencies.data ?? ['NGN']).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="flex flex-col gap-3 rounded-xl bg-g-gray p-3">
          <p className="text-sm font-medium">{other} details</p>
          <Field label={`${other}'s email`} error={errors.email} hint={role === 'buyer' ? 'Ask the seller in your chat. They get an email to accept the deal.' : undefined}>
            <Input type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(errors.email)} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Name (optional)">
              <Input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Phone (optional)">
              <Input type="tel" placeholder="080…" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Delivery date">
            <Input type="date" value={deliveryDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDeliveryDate(e.target.value)} />
          </Field>
          <Field label="Fee paid by">
            <Select value={fees} onChange={(e) => setFees(e.target.value as typeof fees)}>
              <option value="buyer">Buyer</option>
              <option value="seller">Seller</option>
              <option value="both">Split</option>
            </Select>
          </Field>
        </div>

        {action.error ? (
          <div className="flex flex-col gap-2">
            <ErrorBox message={action.error} />
            {/^Escrow created/i.test(action.error) ? (
              // the escrow exists; only the payment step failed
              <Button type="button" variant="outline" onClick={() => reset({ name: 'escrows' })}>
                View my escrows
              </Button>
            ) : null}
          </div>
        ) : null}

        <Button type="submit" variant="blue" size="lg" loading={action.busy} className="w-full shrink-0">
          {role === 'buyer' ? 'Create escrow and pay' : 'Create escrow'}
        </Button>
        <p className="text-xs text-light-gray text-center -mt-1">The money is held by Pandascrow and only released when the buyer confirms delivery.</p>
      </form>
    </div>
  );
}
