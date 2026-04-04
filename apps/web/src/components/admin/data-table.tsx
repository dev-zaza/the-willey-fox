import React from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Column<T> {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  offset?: number;
  limit?: number;
  onPrev?: () => void;
  onNext?: () => void;
  getKey: (row: T) => string;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    open: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    resolved: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
    dismissed: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
    expired: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
    flagged: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    contacted: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    closed: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
    free: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
    premium: 'admin-accent-bg-dim admin-accent-text border-zinc-700',
    basic: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    failed: 'bg-red-500/15 text-red-400 border-red-500/20',
    partial: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    pending: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    lost: 'bg-red-500/15 text-red-400 border-red-500/20',
  };
  const cls = map[status.toLowerCase()] ?? 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20';
  return (
    <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium', cls)}>
      {status}
    </span>
  );
}

export function DataTable<T>({
  columns,
  data,
  loading,
  emptyMessage = 'No data found',
  offset = 0,
  limit = 50,
  onPrev,
  onNext,
  getKey,
}: DataTableProps<T>) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border admin-border-color overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-5 w-5 animate-spin admin-text-subtle" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b admin-border-color admin-surface">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={cn(
                        'px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider admin-text-subtle',
                        col.className,
                      )}
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y admin-border-color">
                {data.map((row) => (
                  <tr
                    key={getKey(row)}
                    className="admin-hover transition-colors"
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={cn('px-4 py-3', col.className)}>
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-12 text-center text-sm admin-text-subtle">
                      {emptyMessage}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(onPrev || onNext) && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs admin-text-subtle">
            {data.length > 0 ? `Showing ${offset + 1}–${offset + data.length}` : 'No results'}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onPrev}
              disabled={!onPrev || offset === 0}
              className="flex items-center gap-1 rounded-lg border admin-border-color admin-surface px-3 py-1.5 text-xs admin-text-muted admin-hover disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </button>
            <button
              onClick={onNext}
              disabled={!onNext || data.length < limit}
              className="flex items-center gap-1 rounded-lg border admin-border-color admin-surface px-3 py-1.5 text-xs admin-text-muted admin-hover disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
