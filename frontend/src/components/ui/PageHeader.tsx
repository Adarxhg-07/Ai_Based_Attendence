import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  subtitle?: string;
  action?: ReactNode;
}

export function PageHeader({ title, description, subtitle, action }: PageHeaderProps) {
  const desc = description || subtitle;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        marginBottom: '1.5rem',
        paddingBottom: '1.5rem',
        borderBottom: '3px solid #111111',
      }}
      className="sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <h1
          style={{
            fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
            fontWeight: 700,
            color: '#111111',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            textTransform: 'uppercase',
          }}
        >
          {title}
        </h1>
        {desc && (
          <p style={{ marginTop: '0.375rem', fontSize: '0.875rem', color: '#36454F', fontWeight: 400 }}>
            {desc}
          </p>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}
