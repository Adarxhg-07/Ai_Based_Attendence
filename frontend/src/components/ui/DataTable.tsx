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
      <div
        style={{
          background: '#FFFFFF',
          border: '3px solid #111',
          borderRadius: '0.5rem',
          boxShadow: '4px 4px 0 #111',
          padding: '3rem',
          textAlign: 'center',
        }}
      >
        <div
          style={{ width: 32, height: 32, border: '3px solid #D1D1D1', borderTop: '3px solid #CC0000', borderRadius: '50%', margin: '0 auto' }}
          className="animate-spin"
        />
        <p style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#36454F', fontWeight: 500 }}>Loading...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        style={{
          background: '#FFFFFF',
          border: '3px solid #111',
          borderRadius: '0.5rem',
          boxShadow: '4px 4px 0 #111',
          padding: '3rem',
          textAlign: 'center',
        }}
      >
        <p style={{ color: '#36454F', fontWeight: 600 }}>No data found</p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '3px solid #111',
        borderRadius: '0.5rem',
        boxShadow: '4px 4px 0 #111',
        overflow: 'hidden',
      }}
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ minWidth: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#111111' }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    padding: '0.75rem 1rem',
                    textAlign: 'left',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#FFFFFF',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    whiteSpace: 'nowrap',
                  }}
                >
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
                style={{
                  borderTop: '1px solid #D1D1D1',
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'background 0.15s ease-out',
                }}
                onMouseEnter={(e) => {
                  if (onRowClick) e.currentTarget.style.background = '#FFD700';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      padding: '0.75rem 1rem',
                      fontSize: '0.875rem',
                      color: '#111111',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col.render ? col.render(item) : item[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            borderTop: '2px solid #111',
            background: '#F0F0F0',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: '#36454F', fontFamily: "'JetBrains Mono', monospace" }}>
            {pagination.totalItems} ITEMS
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              style={{
                padding: '0.375rem',
                background: pagination.page <= 1 ? '#D1D1D1' : '#111',
                color: pagination.page <= 1 ? '#999' : '#FFF',
                border: '2px solid #111',
                borderRadius: '0.375rem',
                cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#111', minWidth: '60px', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}>
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              style={{
                padding: '0.375rem',
                background: pagination.page >= pagination.totalPages ? '#D1D1D1' : '#111',
                color: pagination.page >= pagination.totalPages ? '#999' : '#FFF',
                border: '2px solid #111',
                borderRadius: '0.375rem',
                cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
