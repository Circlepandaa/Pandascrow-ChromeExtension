import { useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { useAction, useApp } from '../state';
import { Button, ErrorBox, Field, Header, Input, Select, Textarea } from '../ui';
import { useCurrencies } from './NewEscrow';

export function NewLink() {
  const { back, go } = useApp();
  const currencies = useCurrencies();
  const action = useAction();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    const clean = amount.replace(/,/g, '').trim();
    if (!name.trim()) next.name = 'Name the link, e.g. "Ada Shoes".';
    if (!description.trim()) next.description = 'Tell buyers what they are paying for.';
    if (clean && (!/^\d+(\.\d{1,2})?$/.test(clean) || Number(clean) <= 0)) next.amount = 'Enter a valid amount or leave it empty.';
    setErrors(next);
    if (Object.keys(next).length) return;

    void action.run(async () => {
      const res = await api('POST', '/payme', { body: { type: 'onetime', name: name.trim(), description: description.trim(), currency, ...(clean ? { amount: clean } : {}) } });
      let live = false;
      // New links start switched off; turn this one on so it can be shared right away
      try {
        const list = await api('GET', '/payme', { query: { type: 'onetime' } });
        const link = (list.links ?? []).find((l: any) => l.link_slug === res.slug);
        if (link?._id) {
          await api('POST', '/payme/live', { body: { payme_id: link._id } });
          live = true;
        }
      } catch {
        /* the link still exists; it can be made live in the dashboard */
      }
      go({ name: 'created', kind: 'link', data: { ...res, name: name.trim(), amount: clean, currency, live } });
    });
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <Header title="New payment link" onBack={back} />
      <form onSubmit={submit} className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4" noValidate>
        <p className="text-sm text-mid-gray -mt-1">Buyers pay through the link and the money is held in escrow until they confirm the order.</p>
        <Field label="Link name" error={errors.name}>
          <Input placeholder="e.g. Ada Shoes" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(errors.name)} />
        </Field>
        <Field label="Description" error={errors.description}>
          <Textarea placeholder="What are buyers paying for?" value={description} onChange={(e) => setDescription(e.target.value)} aria-invalid={Boolean(errors.description)} />
        </Field>
        <div className="grid grid-cols-[1fr_96px] gap-2">
          <Field label="Amount (optional)" error={errors.amount} hint="Leave empty to let the buyer enter it.">
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
        {action.error ? <ErrorBox message={action.error} /> : null}
        <Button type="submit" variant="blue" size="lg" loading={action.busy} className="w-full">
          Create link
        </Button>
      </form>
    </div>
  );
}
