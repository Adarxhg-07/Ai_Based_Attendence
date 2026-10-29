import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Column<T> {
  key: string;
  header?: string;
  label?: string;
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  pagination?: {
    page: number;
    totalPages: number;
    totalItems?: number;
    onPageChange: (page: number) => void;
  };
  loading?: boolean;
  onRowClick?: (item: T) => void;
}

export function DataTable<T extends Record<string, any>>({
  columns, data, pagination, loading, onRowClick,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="glass p-12 text-center">
        <div className="w-8 h-8 border-2 border-maroon-700/30 border-t-maroon-600 rounded-full animate-spin mx-auto" />
        <p className="mt-3 text-sm text-white/40">Loading...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="glass p-12 text-center">
        <p className="text-white/40">No data found</p>
      </div>
    );
  }

  return (
    <div className="glass overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">
                  {col.header || col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, idx) => (
              <tr
                key={(item as any).id || idx}
                onClick={() => onRowClick?.(item)}
                className={`border-b border-white/[0.04] transition-colors ${
                  onRowClick ? 'cursor-pointer hover:bg-white/[0.03]' : ''
                }`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-sm text-white/70 whitespace-nowrap">
                    {col.render ? col.render(item) : item[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
          <span className="text-sm text-white/30">
            {pagination.totalItems} total items
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed text-white/50"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm text-white/50 min-w-[60px] text-center">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed text-white/50"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
