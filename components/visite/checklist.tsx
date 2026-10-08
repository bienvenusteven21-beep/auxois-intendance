"use client";

import { useState, useTransition } from "react";
import { setChecklistItem } from "@/app/actions/visites";
import { Icon } from "@/components/ui/icon";
import type { ItemResult, VisitItemRow } from "@/lib/types";

export function VisitChecklist({
  items: initial,
  onCreateObservation,
}: {
  items: VisitItemRow[];
  onCreateObservation?: (item: VisitItemRow) => void;
}) {
  const [items, setItems] = useState(initial);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const categories = [...new Set(items.map((i) => i.category))];
  const done = items.filter((i) => i.result === "ok" || i.result === "anomalie").length;

  function update(id: string, patch: Partial<VisitItemRow>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function setResult(item: VisitItemRow, result: ItemResult | null) {
    const next = item.result === result ? null : result;
    update(item.id, { result: next, checked_at: next ? new Date().toISOString() : null });
    startTransition(async () => {
      const res = await setChecklistItem(item.id, next);
      if (res?.error) setError(res.error);
    });
  }

  function setNumber(item: VisitItemRow, raw: string) {
    const value = raw === "" ? null : Number(raw.replace(",", "."));
    update(item.id, { value_number: value });
  }

  function commitNumber(item: VisitItemRow) {
    const result: ItemResult | null = item.value_number === null || Number.isNaN(item.value_number) ? null : "ok";
    update(item.id, { result });
    startTransition(async () => {
      const res = await setChecklistItem(item.id, result, item.value_number, undefined);
      if (res?.error) setError(res.error);
    });
  }

  function commitNote(item: VisitItemRow) {
    startTransition(async () => {
      const res = await setChecklistItem(item.id, item.result, undefined, item.note);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-14 lg:top-0 z-10 -mx-4 px-4 py-2 bg-cream/95 backdrop-blur">
        <div className="flex items-center justify-between text-[14px] text-ink-500 mb-1">
          <span>
            {done} / {items.length} points contrôlés
          </span>
          <span>{Math.round((done / Math.max(items.length, 1)) * 100)} %</span>
        </div>
        <div className="h-2 rounded-full bg-stone-200 overflow-hidden">
          <div className="h-full bg-forest-600 transition-all" style={{ width: `${(done / Math.max(items.length, 1)) * 100}%` }} />
        </div>
      </div>
      {error && <p className="rounded-xl bg-danger-100 text-danger-600 px-4 py-2 text-[14px]">{error}</p>}

      {categories.map((cat) => (
        <section key={cat} className="bg-white rounded-2xl border border-stone-200/60 shadow-soft overflow-hidden">
          <h3 className="px-4 py-2.5 bg-forest-50 text-[13px] uppercase tracking-[0.12em] font-sans font-semibold text-forest-800">{cat}</h3>
          <ul className="divide-y divide-stone-100">
            {items
              .filter((i) => i.category === cat)
              .map((item) => (
                <li key={item.id} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <p className={`flex-1 text-[16px] leading-snug ${item.result === "ok" ? "text-ink-500" : "text-forest-900"}`}>{item.label}</p>
                    {item.kind === "check" ? (
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setResult(item, "ok")}
                          aria-pressed={item.result === "ok"}
                          className={`flex h-12 w-12 items-center justify-center rounded-xl border-2 transition ${
                            item.result === "ok" ? "bg-ok-600 border-ok-600 text-white" : "border-stone-200 text-ink-400 hover:border-ok-600"
                          }`}
                          aria-label="OK"
                        >
                          <Icon name="check" size={24} strokeWidth={2.4} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setResult(item, "anomalie")}
                          aria-pressed={item.result === "anomalie"}
                          className={`flex h-12 w-12 items-center justify-center rounded-xl border-2 transition ${
                            item.result === "anomalie" ? "bg-warn-600 border-warn-600 text-white" : "border-stone-200 text-ink-400 hover:border-warn-600"
                          }`}
                          aria-label="Anomalie"
                        >
                          <Icon name="alert" size={22} strokeWidth={2.2} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.value_number ?? ""}
                          onChange={(e) => setNumber(item, e.target.value)}
                          onBlur={() => commitNumber(item)}
                          className={`w-24 rounded-xl border-2 px-3 h-12 text-center text-[17px] ${item.result === "ok" ? "border-ok-600" : "border-stone-200"}`}
                          placeholder="—"
                        />
                        {item.unit && <span className="text-ink-500 text-[14px]">{item.unit}</span>}
                      </div>
                    )}
                  </div>
                  {item.result === "anomalie" && (
                    <div className="mt-3 space-y-2 animate-fade-up">
                      <textarea
                        value={item.note ?? ""}
                        onChange={(e) => update(item.id, { note: e.target.value })}
                        onBlur={() => commitNote(item)}
                        rows={2}
                        placeholder="Décrivez ce que vous constatez…"
                        className="w-full rounded-xl border border-warn-600/40 bg-warn-100/40 px-3 py-2 text-[15px]"
                      />
                      {onCreateObservation && (
                        <button type="button" onClick={() => onCreateObservation(item)} className="inline-flex items-center gap-2 rounded-xl bg-warn-100 text-warn-600 px-3 h-10 text-[14px] font-medium">
                          <Icon name="flag" size={16} /> Créer une observation
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
