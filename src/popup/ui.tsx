import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import { ArrowLeft01Icon, Copy01Icon, Tick02Icon, ViewIcon, ViewOffIcon } from '@hugeicons/core-free-icons';
import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function Icon({ icon, size = 18, className, strokeWidth = 1.5 }: { icon: IconSvgElement; size?: number; className?: string; strokeWidth?: number }) {
  return <HugeiconsIcon icon={icon} size={size} strokeWidth={strokeWidth} className={className} />;
}

// ─── buttons ────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'blue' | 'dark' | 'outline' | 'ghost' | 'danger';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand-coral text-white hover:bg-brand-coral/90',
  blue: 'bg-brand-blue text-white hover:bg-brand-blue/90',
  dark: 'bg-brand-black text-white hover:bg-brand-black/90',
  outline: 'border border-border-gray bg-white text-brand-black hover:bg-g-gray',
  ghost: 'text-brand-black hover:bg-g-gray',
  danger: 'border border-[#F9BABA] bg-white text-[#B42318] hover:bg-[#FEF3F2]',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm' | 'md' | 'lg'; loading?: boolean; icon?: IconSvgElement }) {
  const sizes = { sm: 'h-8 px-3 text-xs gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-11 px-5 text-[15px] gap-2' };
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-full font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30 disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none',
        VARIANTS[variant],
        sizes[size],
        className,
      )}
    >
      {loading ? <Spinner size={16} className={variant === 'outline' || variant === 'ghost' ? 'text-brand-black' : 'text-white'} /> : icon ? <Icon icon={icon} size={size === 'sm' ? 14 : 16} /> : null}
      {children}
    </button>
  );
}

export function IconButton({ icon, label, onClick, className, badge }: { icon: IconSvgElement; label: string; onClick?: () => void; className?: string; badge?: number }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={cn('relative inline-flex size-9 items-center justify-center rounded-full text-brand-slategrey hover:bg-g-gray cursor-pointer', className)}>
      <Icon icon={icon} size={20} />
      {badge ? <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-brand-coral text-white text-[10px] leading-4 text-center font-semibold">{badge > 9 ? '9+' : badge}</span> : null}
    </button>
  );
}

export function Spinner({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg className={cn('ps-spin', className)} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ─── form fields ────────────────────────────────────────────────────────────

export function Field({ label, hint, error, children, aside }: { label: string; hint?: string; error?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 w-full">
      <span className="flex items-center justify-between text-sm text-mid-gray">
        <span>{label}</span>
        {aside}
      </span>
      {children}
      {error ? <span className="text-xs text-[#B42318]">{error}</span> : hint ? <span className="text-xs text-light-gray">{hint}</span> : null}
    </label>
  );
}

const inputClass =
  'h-11 w-full rounded-lg border border-border-gray bg-white px-3.5 text-sm text-brand-black placeholder:text-light-gray outline-none transition-colors focus:border-brand-blue/60 focus:ring-2 focus:ring-brand-blue/10 aria-invalid:border-brand-coral';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputClass, className)} />;
}

export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? 'text' : 'password'} className="pr-11" />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-light-gray hover:text-mid-gray cursor-pointer">
        <Icon icon={show ? ViewOffIcon : ViewIcon} size={18} />
      </button>
    </div>
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputClass, 'h-auto min-h-20 py-2.5 resize-none', className)} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(inputClass, 'appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23616161%27 stroke-width=%272%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E")] bg-[right_14px_center] bg-no-repeat pr-9', className)}>
      {children}
    </select>
  );
}

/** Two or more side-by-side choices, like the dashboard's tab switch. */
export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="grid gap-1 rounded-full bg-g-gray p-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn('h-8 rounded-full text-sm transition-colors cursor-pointer', value === o.value ? 'bg-white text-brand-black font-medium shadow-round' : 'text-mid-gray hover:text-brand-black')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── display ────────────────────────────────────────────────────────────────

/** Status colours from the dashboard's status pills. */
export function StatusPill({ status }: { status?: string | null }) {
  const s = String(status ?? '').toLowerCase();
  let tone = 'bg-[#BAEDF9] text-[#236572]';
  if (/^(paid|completed|complete|success|successful|released|active|live|delivered|resolved)$/.test(s)) tone = 'bg-[#D9F9BA] text-[#3D7223]';
  else if (/^(pending|processing|open|initiated|awaiting.*|unpaid|partially.*)$/.test(s)) tone = 'bg-[#F7EDC1] text-[#7A5D12]';
  else if (/^(failed|cancelled|canceled|expired|disputed|declined|past due|closed|reversed)$/.test(s)) tone = 'bg-[#F9BABA] text-[#722323]';
  else if (/^(draft|inactive)$/.test(s)) tone = 'bg-[#E4E4E4] text-[#554E4E]';
  return <span className={cn('inline-flex items-center h-6 px-2.5 rounded-full text-xs capitalize whitespace-nowrap', tone)}>{status || 'unknown'}</span>;
}

export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={cn('rounded-xl border border-border-gray bg-white', onClick && 'cursor-pointer hover:border-light-gray-02 transition-colors', className)}>
      {children}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('ps-skeleton', className)} />;
}

export function Empty({ icon, title, text, action }: { icon: IconSvgElement; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center gap-2 py-10 px-6">
      <div className="size-12 rounded-full bg-g-gray flex items-center justify-center text-mid-gray">
        <Icon icon={icon} size={22} />
      </div>
      <p className="font-medium">{title}</p>
      {text ? <p className="text-sm text-mid-gray">{text}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg bg-[#FEF3F2] border border-[#FECDCA] px-3.5 py-3 text-sm text-[#B42318] flex items-start justify-between gap-3">
      <span>{message}</span>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="shrink-0 font-medium underline underline-offset-2 cursor-pointer">
          Retry
        </button>
      ) : null}
    </div>
  );
}

/** Page header with optional back arrow. */
export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <header className="flex items-center gap-2 h-14 px-4 border-b border-border-gray bg-white shrink-0">
      {onBack ? <IconButton icon={ArrowLeft01Icon} label="Back" onClick={onBack} className="-ml-2" /> : null}
      <h1 className="text-lg font-semibold tracking-tight flex-1 truncate">{title}</h1>
      {right}
    </header>
  );
}

/** A value with a copy button. */
export function CopyField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border-gray bg-g-gray pl-3.5 pr-1.5 h-11">
      <span className="flex-1 truncate text-sm" title={value}>
        {label ? <span className="text-mid-gray">{label} </span> : null}
        {value}
      </span>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        }}
        className={cn('inline-flex items-center gap-1 h-8 px-3 rounded-full text-xs font-medium cursor-pointer', copied ? 'bg-[#D9F9BA] text-[#3D7223]' : 'bg-white border border-border-gray hover:bg-e-gray')}
      >
        <Icon icon={copied ? Tick02Icon : Copy01Icon} size={14} />
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm border-b border-border-gray last:border-0">
      <span className="text-mid-gray shrink-0">{label}</span>
      <span className="text-right break-words min-w-0">{value}</span>
    </div>
  );
}
