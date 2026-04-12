import type { Locale } from '@/lib/locale';

interface PaginationBarProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  pageSizeOptions?: number[];
  locale?: Locale;
  isDark?: boolean;
  loading?: boolean;
  onPageChange: (newPage: number) => void;
  onPageSizeChange?: (newSize: number) => void;
}

export default function PaginationBar({
  page,
  totalPages,
  total,
  pageSize,
  pageSizeOptions = [20, 50, 100],
  locale,
  isDark = false,
  loading = false,
  onPageChange,
  onPageSizeChange,
}: PaginationBarProps) {
  const t = locale === 'vi'
    ? { total: 'Tổng', items: 'đơn', perPage: '/ trang', prev: 'Trước', next: 'Sau' }
    : { total: 'Total', items: 'items', perPage: '/ page', prev: 'Prev', next: 'Next' };

  const arrowBtn = (disabled: boolean) => [
    'inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
    disabled || loading
      ? 'cursor-not-allowed opacity-30'
      : isDark
        ? 'text-slate-300 hover:bg-slate-700'
        : 'text-slate-600 hover:bg-slate-100',
  ].join(' ');

  return (
    <div className={[
      'mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-2.5',
      isDark ? 'border-slate-700/60 bg-slate-800/30' : 'border-slate-100 bg-slate-50/50',
    ].join(' ')}>
      {/* Left: total + per page */}
      <div className="flex items-center gap-2">
        <span className={['text-xs', isDark ? 'text-slate-400' : 'text-slate-500'].join(' ')}>
          {t.total} {total} {t.items}
        </span>
        {onPageSizeChange && (
          <select
            value={pageSize}
            disabled={loading}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className={[
              'rounded-lg border px-2 py-1 text-xs font-medium focus:outline-none',
              isDark
                ? 'border-slate-600 bg-slate-800 text-slate-200'
                : 'border-slate-200 bg-white text-slate-700',
              loading ? 'opacity-40 cursor-not-allowed' : '',
            ].join(' ')}
          >
            {pageSizeOptions.map((s) => (
              <option key={s} value={s}>{s} {t.perPage}</option>
            ))}
          </select>
        )}
      </div>

      {/* Right: pagination arrows */}
      {totalPages > 1 && (
        <div className="flex items-center gap-0.5">
          <button type="button" disabled={page <= 1 || loading} onClick={() => onPageChange(1)} className={arrowBtn(page <= 1)}>
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="11 17 6 12 11 7" /><polyline points="18 17 13 12 18 7" /></svg>
          </button>
          <button type="button" disabled={page <= 1 || loading} onClick={() => onPageChange(page - 1)} className={arrowBtn(page <= 1)}>
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <span className={['mx-2 text-xs font-medium tabular-nums', isDark ? 'text-slate-300' : 'text-slate-600'].join(' ')}>
            {page} / {totalPages}
          </span>
          <button type="button" disabled={page >= totalPages || loading} onClick={() => onPageChange(page + 1)} className={arrowBtn(page >= totalPages)}>
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="9 18 15 12 9 6" /></svg>
          </button>
          <button type="button" disabled={page >= totalPages || loading} onClick={() => onPageChange(totalPages)} className={arrowBtn(page >= totalPages)}>
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="6 17 11 12 6 7" /><polyline points="13 17 18 12 13 7" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}
