"use client";

import { useState } from "react";
import type { HaulItem } from "@/lib/storage";
import { PLATFORM_LABELS, PLATFORMS, type PriceCheckResult, type Settings } from "@/lib/types";

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-3xl bg-surface pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="-mr-2 h-10 rounded-full px-3 text-muted active:bg-surface-2">
            Done
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function CompsPanel({ result, onClose }: { result: PriceCheckResult; onClose: () => void }) {
  const [showExcluded, setShowExcluded] = useState(false);
  return (
    <Sheet title="Why this verdict" onClose={onClose}>
      {result.dataSource === "demo" && (
        <p className="mb-4 rounded-2xl bg-pass-bg px-4 py-3 text-sm text-pass">
          These are generated demo listings, not real sales. Live marketplace data is coming next.
        </p>
      )}
      <label className="mb-4 flex items-center gap-3 text-sm">
        <input type="checkbox" checked={showExcluded} onChange={(e) => setShowExcluded(e.target.checked)} className="size-5" />
        Show listings we excluded
      </label>
      {result.platforms.length === 0 && <p className="text-muted">No matching sales found.</p>}
      {result.platforms.map((p) => (
        <section key={p.platform} className="mb-6">
          <h3 className="mb-2 font-semibold">
            {PLATFORM_LABELS[p.platform]} <span className="font-normal text-muted">· {p.compsUsed} used</span>
          </h3>
          <ul className="divide-y divide-border rounded-2xl border border-border text-sm">
            {p.comps.map((c) => (
              <li key={c.url} className="flex justify-between gap-3 px-4 py-2.5">
                <span className="truncate">{c.title}</span>
                <span className="shrink-0 tabular-nums">
                  ${c.price}
                  {c.soldAt && <span className="text-muted"> · {new Date(c.soldAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
                </span>
              </li>
            ))}
            {showExcluded &&
              p.excluded.map((c) => (
                <li key={c.url} className="flex justify-between gap-3 px-4 py-2.5 text-muted line-through decoration-1">
                  <span className="truncate">{c.title}</span>
                  <span className="shrink-0 no-underline">
                    ${c.price} · {c.reason}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </Sheet>
  );
}

export function HaulPanel({
  items,
  onRemove,
  onClear,
  onClose,
}: {
  items: HaulItem[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  // BR-17
  const spent = items.reduce((n, i) => n + (i.purchaseCost ?? 0), 0);
  const profit = items.reduce((n, i) => n + i.netProfit, 0);
  return (
    <Sheet title="Today's haul" onClose={onClose}>
      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        <Total label="Items" value={`${items.length}`} />
        <Total label="Spent" value={`$${spent.toFixed(0)}`} />
        <Total label="Exp. profit" value={`$${profit.toFixed(0)}`} />
      </div>
      {items.length === 0 ? (
        <p className="text-muted">Nothing saved yet. Tap “+ Haul” on a result to add it.</p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border text-sm">
          {items.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{i.name}</div>
                <div className="text-muted">
                  {i.tagPrice != null ? `$${i.tagPrice} tag` : "no tag price"}
                  {i.platform && ` · ${PLATFORM_LABELS[i.platform]}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold tabular-nums">${Math.round(i.netProfit)}</span>
                <button onClick={() => onRemove(i.id)} aria-label={`Remove ${i.name}`} className="h-9 w-9 rounded-full text-muted active:bg-surface-2">
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {items.length > 0 && (
        <button onClick={onClear} className="mt-4 h-11 w-full rounded-2xl border border-border text-pass">
          Clear haul
        </button>
      )}
    </Sheet>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-2 py-3">
      <div className="text-[11px] tracking-wide text-muted uppercase">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function SettingsPanel({
  settings,
  onChange,
  onClose,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
}) {
  const num = (v: string, fallback: number) => (v === "" || Number.isNaN(Number(v)) ? fallback : Number(v));
  return (
    <Sheet title="Settings" onClose={onClose}>
      <div className="space-y-6">
        <fieldset>
          <legend className="mb-2 font-medium">Where do you usually sell?</legend>
          <div className="grid grid-cols-2 gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                onClick={() => onChange({ ...settings, homePlatform: p })}
                aria-pressed={settings.homePlatform === p}
                className={`h-12 rounded-2xl border font-medium ${
                  settings.homePlatform === p ? "border-accent bg-accent text-accent-text" : "border-border"
                }`}
              >
                {PLATFORM_LABELS[p]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted">We favor your home platform unless another one clearly nets more.</p>
        </fieldset>

        <Field
          label="Minimum profit to buy"
          prefix="$"
          value={settings.minProfit}
          onChange={(v) => onChange({ ...settings, minProfit: Math.max(0, num(v, settings.minProfit)) })}
        />
        <Field
          label="Must sell within"
          suffix="days"
          value={settings.maxDays}
          onChange={(v) => onChange({ ...settings, maxDays: Math.max(1, num(v, settings.maxDays)) })}
        />
        <Field
          label="Sales tax at the store"
          suffix="%"
          value={Math.round(settings.salesTaxRate * 10000) / 100}
          onChange={(v) => onChange({ ...settings, salesTaxRate: Math.min(20, Math.max(0, num(v, 0))) / 100 })}
        />
      </div>
    </Sheet>
  );
}

function Field({
  label,
  value,
  prefix,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block font-medium">{label}</span>
      <span className="flex h-12 items-center gap-2 rounded-2xl border border-border px-4">
        {prefix && <span className="text-muted">{prefix}</span>}
        <input
          type="number"
          inputMode="decimal"
          defaultValue={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-lg outline-none"
        />
        {suffix && <span className="text-muted">{suffix}</span>}
      </span>
    </label>
  );
}
