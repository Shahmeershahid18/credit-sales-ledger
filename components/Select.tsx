'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

export type SelectOption = {
  value: string;
  label: string;
  description?: string; // second line, muted
  meta?: string; // right-aligned, e.g. an amount
  disabled?: boolean;
};

interface SelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchable?: boolean; // shows a search box; on by default for long lists
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  size?: 'md' | 'sm';
  ariaLabel?: string;
}

/**
 * Styled dropdown that matches the form inputs. Keyboard: arrows, Enter, Escape, Home/End.
 */
export function Select({
  id,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  searchable,
  searchPlaceholder = 'Search…',
  emptyText = 'No matches',
  disabled = false,
  className = '',
  size = 'md',
  ariaLabel,
}: SelectProps) {
  const autoId = useId();
  const listId = `${id ?? autoId}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);

  const showSearch = searchable ?? options.length > 8;
  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.description ?? ''}`.toLowerCase().includes(q));
  }, [options, query]);

  // Close when clicking or tabbing outside
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Keep the highlighted option in view
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const firstEnabled = (list: SelectOption[], from: number, step: 1 | -1) => {
    for (let i = from; i >= 0 && i < list.length; i += step) {
      if (!list[i].disabled) return i;
    }
    return -1;
  };

  const openList = () => {
    if (disabled) return;
    setQuery('');
    const current = options.findIndex((o) => o.value === value);
    setActiveIndex(current >= 0 ? current : firstEnabled(options, 0, 1));
    setOpen(true);
    if (showSearch) requestAnimationFrame(() => searchRef.current?.focus());
  };

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  const choose = (option: SelectOption | undefined) => {
    if (!option || option.disabled) return;
    onChange(option.value);
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = firstEnabled(filtered, activeIndex + 1, 1);
        if (next >= 0) setActiveIndex(next);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prev = firstEnabled(filtered, activeIndex - 1, -1);
        if (prev >= 0) setActiveIndex(prev);
        break;
      }
      case 'Home':
        e.preventDefault();
        setActiveIndex(firstEnabled(filtered, 0, 1));
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(firstEnabled(filtered, filtered.length - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        choose(filtered[activeIndex]);
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Tab':
        close(false);
        break;
    }
  };

  const height = size === 'sm' ? 'h-9' : 'h-10';
  const activeId = open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined;

  return (
    <div ref={rootRef} className={`relative ${className}`} onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={showSearch ? undefined : activeId}
        aria-label={ariaLabel}
        className={`w-full ${height} pl-3 pr-9 rounded-lg border bg-white text-left text-sm flex items-center transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-zinc-50 disabled:text-zinc-400 disabled:cursor-not-allowed ${
          open ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-zinc-300 hover:border-zinc-400'
        }`}
      >
        <span className={`truncate ${selected ? 'text-zinc-900' : 'text-zinc-400'}`}>{selected ? selected.label : placeholder}</span>
        {selected?.meta && <span className="ml-auto pl-2 text-xs text-zinc-500 shrink-0 tabular-nums">{selected.meta}</span>}
        <ChevronDown
          className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full min-w-[12rem] rounded-lg border border-zinc-200 bg-white shadow-lg shadow-zinc-900/10 overflow-hidden">
          {showSearch && (
            <div className="relative border-b border-zinc-100">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                aria-controls={listId}
                aria-activedescendant={activeId}
                className="w-full h-10 pl-9 pr-3 text-sm placeholder:text-zinc-400 focus:outline-none"
              />
            </div>
          )}
          <ul ref={listRef} id={listId} role="listbox" tabIndex={-1} className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && <li className="px-3 py-2.5 text-sm text-zinc-500">{emptyText}</li>}
            {filtered.map((o, i) => {
              const isSelected = o.value === value;
              const isActive = i === activeIndex;
              return (
                <li
                  key={o.value}
                  id={`${listId}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={o.disabled || undefined}
                  onPointerEnter={() => !o.disabled && setActiveIndex(i)}
                  onClick={() => choose(o)}
                  className={`mx-1 px-2.5 py-2 rounded-md flex items-start gap-2 text-sm ${
                    o.disabled ? 'text-zinc-400 cursor-not-allowed' : 'cursor-pointer text-zinc-900'
                  } ${isActive && !o.disabled ? 'bg-zinc-100' : ''}`}
                >
                  <Check className={`w-4 h-4 mt-0.5 shrink-0 text-emerald-600 ${isSelected ? '' : 'invisible'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{o.label}</span>
                    {o.description && (
                      <span className={`block text-xs ${o.disabled ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        {o.description}
                      </span>
                    )}
                  </span>
                  {o.meta && <span className="shrink-0 text-xs tabular-nums text-zinc-500 mt-0.5">{o.meta}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
