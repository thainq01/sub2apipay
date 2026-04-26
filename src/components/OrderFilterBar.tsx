import type { Locale } from '@/lib/locale';
import { getFilterOptions, type OrderStatusFilter } from '@/lib/pay-utils';
import { useState, useRef, useEffect } from 'react';

interface OrderFilterBarProps {
  isDark: boolean;
  locale: Locale;
  activeFilter: OrderStatusFilter;
  onChange: (filter: OrderStatusFilter) => void;
}

export default function OrderFilterBar({ isDark, locale, activeFilter, onChange }: OrderFilterBarProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const options = getFilterOptions(locale);
  const current = options.find((o) => o.key === activeFilter) || options[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={[
          'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
          isDark
            ? 'border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-600'
            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
        ].join(' ')}
      >
        <span>{current.label}</span>
        <svg className={['h-4 w-4 transition-transform', open ? 'rotate-180' : ''].join(' ')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className={[
          'absolute left-0 top-full z-50 mt-1 min-w-[180px] overflow-hidden rounded-lg border shadow-lg',
          isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white',
        ].join(' ')}>
          <div className="max-h-60 overflow-y-auto py-1">
            {options.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => { onChange(item.key); setOpen(false); }}
                className={[
                  'flex w-full items-center px-3 py-2 text-left text-sm transition-colors',
                  activeFilter === item.key
                    ? isDark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-50 text-indigo-700'
                    : isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50',
                ].join(' ')}
              >
                {item.label}
                {activeFilter === item.key && (
                  <svg className="ml-auto h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
