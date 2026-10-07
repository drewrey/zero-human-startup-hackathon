"use client";

import { PLATFORM_LABELS, type PriceCheckResult, type Verdict } from "@/lib/types";

const VERDICT_STYLE: Record<Verdict, { label: string; className: string }> = {
  BUY: { label: "BUY", className: "bg-buy-bg text-buy" },
  BUY_UNDER: { label: "BUY", className: "bg-buy-bg text-buy" },
  MAYBE: { label: "MAYBE", className: "bg-maybe-bg text-maybe" },
  PASS: { label: "PASS", className: "bg-pass-bg text-pass" },
  NOT_ENOUGH_DATA: { label: "NOT ENOUGH DATA", className: "bg-neutral-bg text-muted" },
};

const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n))}`;

export function itemName(r: PriceCheckResult): string {
  const { brand, variant, type, size } = r.item;
  return [brand, variant ?? type, size].filter(Boolean).join(" ") || "Unknown item";
}

export function ResultCard({
  result,
  homePlatform,
  saved,
  onWhy,
  onSave,
  onNew,
}: {
  result: PriceCheckResult;
  homePlatform: string;
  saved: boolean;
  onWhy: () => void;
  onSave: () => void;
  onNew: () => void;
}) {
  const style = VERDICT_STYLE[result.verdict];
  const rec = result.platforms.find((p) => p.platform === result.recommendedPlatform) ?? null;
  const noTag = result.item.tagPrice == null;

  return (
    <section aria-live="polite" className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
      <div className={`flex items-end justify-between gap-3 px-5 pt-5 pb-4 ${style.className}`}>
        <div>
          <div className="text-xs font-medium tracking-wide uppercase opacity-80">{itemName(result)}</div>
          <div className="text-4xl leading-none font-bold tracking-tight">{style.label}</div>
        </div>
        {rec && (
          <div className="text-right">
            {result.verdict === "BUY_UNDER" || (noTag && result.maxBuyPrice != null) ? (
              <div className="text-2xl font-bold">under ${result.maxBuyPrice}</div>
            ) : (
              <div className="text-2xl font-bold">
                {rec.netProfit >= 0 ? "+" : ""}
                {money(rec.netProfit)}
              </div>
            )}
            <div className="text-sm font-medium">on {PLATFORM_LABELS[rec.platform]}</div>
          </div>
        )}
      </div>

      <div className="space-y-4 px-5 py-4">
        <p className="text-base leading-snug">{result.reason}</p>

        {rec && (
          <dl className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Sold range" value={`${money(rec.p25)}–${money(rec.p75)}`} />
            <Stat label="Comps" value={`${rec.compsUsed}`} />
            <Stat label="Sells in" value={`~${rec.estDaysToSell}d`} />
          </dl>
        )}

        {rec && (
          <p className="text-sm text-muted">
            Median {money(rec.median)} · fees {money(rec.fees)}
            {rec.shipping > 0 && ` · shipping ${money(rec.shipping)}`}
            {noTag ? " · no tag price given" : ` · tag $${result.item.tagPrice}`}
          </p>
        )}

        {result.platforms.length > 1 && (
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {result.platforms.map((p) => (
              <li key={p.platform} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="flex items-center gap-2">
                  {PLATFORM_LABELS[p.platform]}
                  {p.platform === result.recommendedPlatform && <span aria-label="recommended">⭐</span>}
                  {p.platform === homePlatform && (
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">home</span>
                  )}
                </span>
                <span className="tabular-nums">
                  {money(p.netProfit)}
                  {noTag && <span className="text-muted"> before cost</span>}
                  <span className="text-muted"> · {p.compsUsed} comps</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        {result.dataSource === "live" && result.platforms.length <= 1 && (
          <p className="text-xs text-muted">
            eBay sold listings, last 90 days
            {result.dataAsOf &&
              ` · as of ${new Date(result.dataAsOf).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
            . More marketplaces coming.
          </p>
        )}

        <div className="flex flex-wrap gap-2 text-xs">
          {result.confidence === "low" && result.verdict !== "NOT_ENOUGH_DATA" && (
            <Badge className="bg-maybe-bg text-maybe">Low confidence</Badge>
          )}
          {result.dataSource === "demo" && <Badge className="bg-pass-bg text-pass">Demo data, not real sales</Badge>}
          {result.assumptions.length > 0 && (
            <Badge className="bg-surface-2 text-muted">Assuming {result.assumptions.join(", ")}</Badge>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button onClick={onWhy} className="h-12 rounded-2xl border border-border font-medium active:bg-surface-2">
            Why?
          </button>
          <button
            onClick={onSave}
            disabled={saved}
            className="h-12 rounded-2xl border border-border font-medium active:bg-surface-2 disabled:opacity-50"
          >
            {saved ? "Saved ✓" : "+ Haul"}
          </button>
          <button onClick={onNew} className="h-12 rounded-2xl bg-accent font-medium text-accent-text active:opacity-90">
            Next item
          </button>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-2 py-2.5">
      <dt className="text-[11px] tracking-wide text-muted uppercase">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`rounded-full px-2.5 py-1 font-medium ${className}`}>{children}</span>;
}
