'use client';

import React, { useState } from 'react';
import { Check, Loader2, Pencil, Plus, X } from 'lucide-react';
import { Material } from '@/lib/types';
import { formatRs } from '@/lib/format';
import { deleteMaterialAction, saveMaterialAction } from '@/app/actions/materials';
import { inputClass } from './ui';

interface MaterialPillsProps {
  materials: Material[];
  onMaterialsChange: React.Dispatch<React.SetStateAction<Material[]>>;
  available: boolean;
  units: string[];
  selectedName: string;
  filterText: string;
  onPick: (material: Material) => void;
}

type Draft = { id: string | null; name: string; unit: string; rate: string };

const COLLAPSED_COUNT = 12;
const pillBase = 'h-7 rounded-full border text-xs font-medium inline-flex items-center transition-colors';

export function MaterialPills({
  materials: list,
  onMaterialsChange: setList,
  available,
  units,
  selectedName,
  filterText,
  onPick,
}: MaterialPillsProps) {
  const [managing, setManaging] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!available) {
    return (
      <p className="text-xs text-amber-700">
        Saved materials are not set up yet. Run the latest migration in Supabase to enable them.
      </p>
    );
  }

  const query = filterText.trim().toLowerCase();
  const exactMatch = list.some((m) => m.name.toLowerCase() === query);
  const matching = query && !exactMatch ? list.filter((m) => m.name.toLowerCase().includes(query)) : list;
  const visible = showAll || managing || query ? matching : matching.slice(0, COLLAPSED_COUNT);
  const hiddenCount = matching.length - visible.length;

  const openEditor = (m?: Material) => {
    setError(null);
    setDraft(
      m
        ? { id: m.id, name: m.name, unit: m.unit, rate: m.rate === null ? '' : String(m.rate) }
        : { id: null, name: query && !exactMatch ? filterText.trim() : '', unit: units[0], rate: '' }
    );
  };

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    const result = await saveMaterialAction(draft.id, { name: draft.name, unit: draft.unit, rate: draft.rate });
    setBusy(false);
    if (!result.success) return setError(result.error);

    const saved = result.material;
    setList((prev) =>
      [...prev.filter((m) => m.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name))
    );
    setDraft(null);
  };

  const remove = async (m: Material) => {
    if (!window.confirm(`Remove "${m.name}" from saved materials? Past sales are not changed.`)) return;
    setError(null);
    const previous = list;
    setList((prev) => prev.filter((x) => x.id !== m.id));
    const result = await deleteMaterialAction(m.id);
    if (!result.success) {
      setList(previous);
      setError(result.error ?? 'Failed to delete material');
    }
  };

  // Enter in the mini editor saves the pill instead of submitting the sale form
  const onEditorKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') {
      setDraft(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {visible.map((m) => {
          const selected = m.name.toLowerCase() === selectedName.trim().toLowerCase();
          if (managing) {
            return (
              <span key={m.id} className={`${pillBase} pl-2.5 pr-1 gap-0.5 bg-white border-zinc-300 text-zinc-800`}>
                {m.name}
                <button
                  type="button"
                  onClick={() => openEditor(m)}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                  aria-label={`Edit ${m.name}`}
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(m)}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-zinc-500 hover:bg-rose-50 hover:text-rose-600"
                  aria-label={`Delete ${m.name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          }
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onPick(m)}
              title={m.rate !== null ? `${formatRs(m.rate)} per ${m.unit}` : m.unit}
              aria-pressed={selected}
              className={`${pillBase} px-2.5 ${
                selected
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                  : 'bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50'
              }`}
            >
              {m.name}
            </button>
          );
        })}

        {hiddenCount > 0 && (
          <button type="button" onClick={() => setShowAll(true)} className={`${pillBase} px-2.5 border-transparent text-zinc-500 hover:text-zinc-900`}>
            +{hiddenCount} more
          </button>
        )}

        <button
          type="button"
          onClick={() => openEditor()}
          className={`${pillBase} px-2.5 gap-1 border-dashed border-zinc-300 text-zinc-600 hover:text-zinc-900 hover:border-zinc-400`}
        >
          <Plus className="w-3 h-3" />
          Add
        </button>

        {list.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setManaging(!managing);
              setDraft(null);
            }}
            className="h-7 px-2 text-xs font-medium text-emerald-700 hover:text-emerald-800"
          >
            {managing ? 'Done' : 'Manage'}
          </button>
        )}
      </div>

      {draft && (
        <div className="p-3 rounded-lg border border-zinc-200 bg-zinc-50 space-y-2" onKeyDown={onEditorKeyDown}>
          <p className="text-xs font-medium text-zinc-700">{draft.id ? 'Edit material' : 'New material'}</p>
          <div className="grid grid-cols-2 sm:grid-cols-[1fr_7rem_8rem] gap-2">
            <input
              type="text"
              aria-label="Material name"
              placeholder="Name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className={`${inputClass} h-9 col-span-2 sm:col-span-1`}
              autoFocus
            />
            <select
              aria-label="Unit"
              value={draft.unit}
              onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
              className={`${inputClass} h-9`}
            >
              {(units.includes(draft.unit) ? units : [...units, draft.unit]).map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              aria-label="Default rate"
              placeholder="Rate"
              value={draft.rate}
              onChange={(e) => setDraft({ ...draft, rate: e.target.value })}
              className={`${inputClass} h-9`}
            />
          </div>
          {error && <p className="text-xs text-rose-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setDraft(null)} className="h-8 px-3 rounded-md text-xs font-medium text-zinc-600 hover:bg-zinc-200/60">
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="h-8 px-3 rounded-md text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-60 inline-flex items-center gap-1"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Save
            </button>
          </div>
        </div>
      )}

      {!draft && error && <p className="text-xs text-rose-700">{error}</p>}
    </div>
  );
}
