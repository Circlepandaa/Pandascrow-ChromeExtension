import { useState, type FormEvent } from 'react';
import { Delete02Icon, PlusSignIcon } from '@hugeicons/core-free-icons';
import { api } from '@/lib/api';
import { isEmail, money } from '@/lib/format';
import { useAction, useApp } from '../state';
import { Button, ErrorBox, Field, Header, Icon, Input, Select } from '../ui';
import { useCurrencies } from './NewEscrow';

interface Item {
  description: string;
  quantity: string;
  price: string;
}

function inDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function NewInvoice() {
  const { back, go } = useApp();
  const currencies = useCurrencies();
  const action = useAction();
  const [client, setClient] = useState({ name: '', email: '', phone: '' });
  const [currency, setCurrency] = useState('NGN');
  const [due, setDue] = useState(inDays(14));
  const [items, setItems] = useState<Item[]>([{ description: '', quantity: '1', price: '' }]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const total = items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.price.replace(/,/g, '')) || 0), 0);

  const setItem = (index: number, patch: Partial<Item>) => setItems((list) => list.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!client.name.trim()) next.name = "Enter the client's name.";
    if (!isEmail(client.email)) next.email = 'Enter a valid email. The invoice is sent there.';
    if (!client.phone.trim()) next.phone = "Enter the client's phone number.";
    if (!due) next.due = 'Pick a due date.';
    const clean = items
      .map((i) => ({ description: i.description.trim(), quantity: Number(i.quantity), unit_price: i.price.replace(/,/g, '').trim() }))
      .filter((i) => i.description || i.unit_price);
    if (!clean.length) next.items = 'Add at least one item.';
    else if (clean.some((i) => !i.description || !Number.isInteger(i.quantity) || i.quantity <= 0 || !(Number(i.unit_price) > 0))) next.items = 'Each item needs a description, a whole-number quantity and a price.';
    setErrors(next);
    if (Object.keys(next).length) return;

    void action.run(async () => {
      const res = await api('POST', '/invoice', {
        body: {
          owner_uuid: '', // the API fills this in from your session
          client: { full_name: client.name.trim(), email: client.email.trim(), phone: client.phone.trim() },
          invoice: { currency, due_date: due },
          items: clean,
          payment: { method: 'payment_link' },
          metadata: { source: 'chrome-extension' },
        },
      });
      go({ name: 'created', kind: 'invoice', data: { ...res, client: client.name.trim(), total, currency } });
    });
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <Header title="New invoice" onBack={back} />
      <form onSubmit={submit} className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">Bill to</p>
          <Field label="Client name" error={errors.name}>
            <Input placeholder="Person or company" value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} aria-invalid={Boolean(errors.name)} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Email" error={errors.email}>
              <Input type="email" placeholder="billing@client.co" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} aria-invalid={Boolean(errors.email)} />
            </Field>
            <Field label="Phone" error={errors.phone}>
              <Input type="tel" placeholder="080…" value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} aria-invalid={Boolean(errors.phone)} />
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Currency">
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {(currencies.data ?? ['NGN']).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Due date" error={errors.due}>
            <Input type="date" value={due} min={inDays(0)} onChange={(e) => setDue(e.target.value)} />
          </Field>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Items</p>
          {items.map((item, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-xl bg-g-gray p-2.5">
              <div className="flex gap-2">
                <Input placeholder="Description" value={item.description} onChange={(e) => setItem(i, { description: e.target.value })} className="h-10" />
                {items.length > 1 ? (
                  <button type="button" aria-label="Remove item" onClick={() => setItems((l) => l.filter((_, j) => j !== i))} className="shrink-0 size-10 rounded-lg text-mid-gray hover:bg-e-gray flex items-center justify-center cursor-pointer">
                    <Icon icon={Delete02Icon} size={18} />
                  </button>
                ) : null}
              </div>
              <div className="grid grid-cols-[72px_1fr] gap-2">
                <Input inputMode="numeric" placeholder="Qty" value={item.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} className="h-10" aria-label="Quantity" />
                <Input inputMode="decimal" placeholder="Unit price" value={item.price} onChange={(e) => setItem(i, { price: e.target.value })} className="h-10" aria-label="Unit price" />
              </div>
            </div>
          ))}
          {errors.items ? <p className="text-xs text-[#B42318]">{errors.items}</p> : null}
          <button type="button" onClick={() => setItems((l) => [...l, { description: '', quantity: '1', price: '' }])} className="self-start inline-flex items-center gap-1.5 text-sm text-brand-blue font-medium cursor-pointer">
            <Icon icon={PlusSignIcon} size={16} /> Add item
          </button>
        </div>

        <div className="flex items-center justify-between border-t border-border-gray pt-3">
          <span className="text-sm text-mid-gray">Total</span>
          <span className="text-lg font-semibold">{money(total, currency)}</span>
        </div>

        {action.error ? <ErrorBox message={action.error} /> : null}
        <Button type="submit" variant="blue" size="lg" loading={action.busy} className="w-full">
          Create invoice
        </Button>
      </form>
    </div>
  );
}
